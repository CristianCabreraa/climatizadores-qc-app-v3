package com.greenair.industrial.qc;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.FileProvider;
import androidx.webkit.WebViewAssetLoader;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;

/** GreenAir QC: isolated local WebView plus Android document/camera/share integration. */
public class MainActivity extends AppCompatActivity {
    private static final String TAG = "GreenAirQC";
    private static final int REQUEST_IMAGES = 101;
    private static final int REQUEST_CAMERA = 102;
    private static final int REQUEST_PDF_SAVE = 103;
    private static final String APP_ORIGIN = "https://appassets.androidplatform.net";

    private WebView webView;
    private ValueCallback<Uri[]> imageCallback;
    private Uri pendingCameraUri;
    private File pendingPdf;
    private WebViewAssetLoader assetLoader;

    @SuppressLint("SetJavaScriptEnabled")
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        webView = new WebView(this);
        setContentView(webView);
        WebSettings cfg = webView.getSettings();
        cfg.setJavaScriptEnabled(true);
        cfg.setDomStorageEnabled(true);
        cfg.setAllowFileAccess(false);
        cfg.setAllowContentAccess(true); // Content URIs provided by the Android document picker.
        cfg.setAllowFileAccessFromFileURLs(false);
        cfg.setAllowUniversalAccessFromFileURLs(false);
        cfg.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

        assetLoader = new WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this)).build();
        webView.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                return assetLoader.shouldInterceptRequest(req.getUrl());
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                String url = req.getUrl().toString();
                if (url.startsWith(APP_ORIGIN + "/assets/")) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, req.getUrl())); }
                catch (Exception ex) { Log.w(TAG, "No external handler: " + url, ex); }
                return true;
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                                       FileChooserParams params) {
                if (imageCallback != null) imageCallback.onReceiveValue(null);
                imageCallback = callback;
                boolean capture = params.isCaptureEnabled();
                try {
                    if (capture) {
                        File dir = new File(getCacheDir(), "camera");
                        if (!dir.exists() && !dir.mkdirs()) throw new Exception("Cannot create camera cache");
                        File photo = File.createTempFile("greenair_", ".jpg", dir);
                        pendingCameraUri = getFileUri(photo);
                        Intent take = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                        take.putExtra(MediaStore.EXTRA_OUTPUT, pendingCameraUri);
                        take.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        startActivityForResult(take, REQUEST_CAMERA);
                    } else {
                        Intent pick = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                        pick.addCategory(Intent.CATEGORY_OPENABLE);
                        pick.setType("image/*");
                        pick.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,
                            params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);
                        startActivityForResult(pick, REQUEST_IMAGES);
                    }
                    return true;
                } catch (Exception ex) {
                    Log.e(TAG, "File chooser failed", ex);
                    callback.onReceiveValue(null);
                    imageCallback = null;
                    return true;
                }
            }
            @Override public boolean onConsoleMessage(ConsoleMessage m) {
                Log.d(TAG, "JS " + m.messageLevel() + " " + m.message() + " (" + m.lineNumber() + ")");
                return true;
            }
        });
        webView.addJavascriptInterface(new PdfBridge(), "GreenAirNative");
        webView.loadUrl(APP_ORIGIN + "/assets/public/index.html");
    }

    private Uri getFileUri(File file) {
        return FileProvider.getUriForFile(this, getPackageName() + ".files", file);
    }

    private File decodePdf(String base64, String name) throws Exception {
        // Never trust paths supplied from JavaScript.
        String safe = (name == null ? "GreenAir_Ficha.pdf" : name)
            .replaceAll("[^a-zA-Z0-9._-]", "_");
        if (!safe.toLowerCase().endsWith(".pdf")) safe += ".pdf";
        byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
        if (bytes.length < 100 || bytes[0] != '%' || bytes[1] != 'P' || bytes[2] != 'D' || bytes[3] != 'F')
            throw new Exception("PDF no válido");
        File dir = new File(getCacheDir(), "shared_pdfs");
        if (!dir.exists() && !dir.mkdirs()) throw new Exception("No se pudo crear carpeta de archivos");
        File out = new File(dir, safe);
        try (FileOutputStream stream = new FileOutputStream(out)) { stream.write(bytes); }
        return out;
    }

    public class PdfBridge {
        @JavascriptInterface public void savePdf(String base64, String fileName) {
            runOnUiThread(() -> {
                try {
                    pendingPdf = decodePdf(base64, fileName);
                    Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType("application/pdf");
                    intent.putExtra(Intent.EXTRA_TITLE, pendingPdf.getName());
                    startActivityForResult(intent, REQUEST_PDF_SAVE);
                } catch (Exception ex) { nativeError("No se pudo preparar el PDF: " + ex.getMessage()); }
            });
        }
        /**
         * WhatsApp: share the PDF as the only payload, to prevent recipients
         * choosing EXTRA_TEXT over EXTRA_STREAM. The generated summary is copied
         * to clipboard by the explicit user action so it can be pasted into a
         * document caption (if available) or sent as a follow-up message.
         * Android cannot force WhatsApp to send PDF and caption in one bubble.
         */
        @JavascriptInterface public void sharePdfWhatsApp(String base64, String fileName, String summary) {
            runOnUiThread(() -> {
                try {
                    File pdf = decodePdf(base64, fileName);
                    Uri uri = getFileUri(pdf);

                    ClipboardManager clipboard = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                    if (clipboard == null) throw new Exception("Portapapeles no disponible");
                    clipboard.setPrimaryClip(ClipData.newPlainText(
                        "Resumen de ficha GreenAir", summary == null ? "" : summary));

                    Intent send = new Intent(Intent.ACTION_SEND);
                    send.setType("application/pdf");
                    send.putExtra(Intent.EXTRA_STREAM, uri);
                    send.setClipData(ClipData.newRawUri("Ficha PDF GreenAir", uri));
                    send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    // Deliberately omit EXTRA_TEXT here. WhatsApp versions may
                    // otherwise interpret the share as a text-only message.

                    boolean started = false;
                    for (String packageName : new String[]{"com.whatsapp", "com.whatsapp.w4b"}) {
                        Intent targeted = new Intent(send);
                        targeted.setPackage(packageName);
                        try {
                            startActivity(targeted);
                            started = true;
                            break;
                        } catch (ActivityNotFoundException notInstalled) {
                            Log.i(TAG, "WhatsApp target not installed: " + packageName);
                        }
                    }
                    if (!started) {
                        startActivity(Intent.createChooser(send, "Compartir ficha PDF"));
                    }
                    nativeEvent("whatsapp_opened");
                } catch (Exception ex) {
                    nativeError("No se pudo abrir WhatsApp con el PDF: " + ex.getMessage());
                }
            });
        }
        @JavascriptInterface public void sharePdf(String base64, String fileName, String text) {
            runOnUiThread(() -> {
                try {
                    File pdf = decodePdf(base64, fileName);
                    Uri uri = getFileUri(pdf);
                    Intent send = new Intent(Intent.ACTION_SEND);
                    send.setType("application/pdf");
                    send.putExtra(Intent.EXTRA_STREAM, uri);
                    send.putExtra(Intent.EXTRA_TEXT, text == null ? "" : text);
                    send.setClipData(ClipData.newRawUri("Ficha GreenAir", uri));
                    send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    startActivity(Intent.createChooser(send, "Compartir ficha PDF GreenAir"));
                    nativeEvent("share_opened");
                } catch (Exception ex) { nativeError("No se pudo compartir el PDF: " + ex.getMessage()); }
            });
        }
    }

    private void nativeEvent(String event) {
        webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('greenair-native',{detail:{type:'" + event + "'}}))", null);
    }
    private void nativeError(String message) {
        Log.e(TAG, message);
        webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('greenair-native',{detail:{type:'error',message:" + org.json.JSONObject.quote(message) + "}}))", null);
    }

    @Override protected void onActivityResult(int request, int result, @Nullable Intent data) {
        super.onActivityResult(request, result, data);
        if (request == REQUEST_IMAGES || request == REQUEST_CAMERA) {
            if (imageCallback == null) return;
            List<Uri> uris = new ArrayList<>();
            if (result == Activity.RESULT_OK) {
                if (request == REQUEST_CAMERA) {
                    if (pendingCameraUri != null) uris.add(pendingCameraUri);
                } else if (data != null) {
                    ClipData clips = data.getClipData();
                    if (clips != null) {
                        for (int i = 0; i < clips.getItemCount(); i++) uris.add(clips.getItemAt(i).getUri());
                    } else if (data.getData() != null) uris.add(data.getData());
                }
            }
            imageCallback.onReceiveValue(uris.isEmpty() ? null : uris.toArray(new Uri[0]));
            imageCallback = null;
            pendingCameraUri = null;
        } else if (request == REQUEST_PDF_SAVE) {
            if (result == Activity.RESULT_OK && data != null && data.getData() != null && pendingPdf != null) {
                try (OutputStream dest = getContentResolver().openOutputStream(data.getData());
                     java.io.FileInputStream source = new java.io.FileInputStream(pendingPdf)) {
                    if (dest == null) throw new Exception("No se pudo acceder al destino");
                    byte[] buf = new byte[8192]; int count;
                    while ((count = source.read(buf)) != -1) dest.write(buf, 0, count);
                    dest.flush();
                    nativeEvent("saved");
                } catch (Exception ex) { nativeError("Error al guardar: " + ex.getMessage()); }
            } else nativeEvent("save_cancelled");
            pendingPdf = null;
        }
    }

    @Override public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }
}
