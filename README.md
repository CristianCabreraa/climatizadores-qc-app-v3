# GreenAir QC 2.1 — Control de Calidad y Electricidad

Proyecto completo (interfaz web/PWA y aplicación Android WebView) preparado a partir de los archivos originales suministrados.

## Cambios de la versión 2.1

- Logotipo de GreenAir en los iconos de Android y pantalla de inicio.
- Eliminados los botones de placas y fotografías de demostración.
- Número de Pedido introducido manualmente; se registra en el PDF y precede al número de serie en su nombre.
- Checkpoints con distintivos Correcto/Incorrecto según su estado real; inicialmente desmarcados.
- Lista editable de tipos de sonda CO₂; el campo aparece únicamente si se marca que existe la sonda.
- Captura de fotografía y selección de imágenes separadas.
- Android: selector de cámara y documentos, puente de guardar PDF con ACTION_CREATE_DOCUMENT y compartir PDF vía ACTION_SEND + FileProvider.
- Botón de Nueva Máquina / Finalizar con confirmación: borra datos de la máquina actual, fotos y campos; NO elimina las listas persistentes.
- Paleta verde/gris/blanco con detalles naranjas.
- Corregidos valores ficticios del OCR: jamás autocompletar números o modelos inventados cuando falla.
- PDF: estado del ensayo depende de los checkpoints, incluye todas las fotos, con paginación.

## Probar versión web

Instalar Node.js, abrir una terminal en la carpeta y ejecutar:

```bash
node server.js
```

Abrir `http://localhost:3000` (puerto configurable mediante `PORT`). La previsualización web y la APK son **entornos diferentes**.

## Generar APK gratis con GitHub Actions

Subir las carpetas y archivos de este ZIP a la **raíz** de un repositorio GitHub (el ZIP ya contiene `.github/workflows/build-apk.yml`). En *Actions* ejecutar **GreenAir QC 2.1 - APK de prueba**, o efectuar un commit en `main`. Descargar el artefacto `GreenAir-QC-v2-1-debug`, extraer `app-debug.apk` e instalar en el teléfono.

El workflow sincroniza `index.html`, `js/`, `css/` y `assets/` dentro de los assets Android antes de compilar, para evitar versiones antiguas en la APK.

La APK es **debug** y su packageId termina en `.debug`; no sustituye automáticamente la APK de producción. Evitar instalar encima de una debug firmada con otra clave; hacer copia de cualquier dato local antes de desinstalar versiones anteriores.

## Permisos y flujo en Android

- **Tomar fotografía** abre la aplicación de cámara mediante ACTION_IMAGE_CAPTURE y recoge el archivo con FileProvider.
- **Adjuntar evidencia** abre el selector Android (ACTION_OPEN_DOCUMENT), admite varias fotos.
- **Guardar PDF** abre el selector de destino del sistema (ACTION_CREATE_DOCUMENT).
- **Compartir PDF** abre el selector de apps, con archivo `application/pdf` y texto de resumen. WhatsApp y otras aplicaciones deciden si muestran ambos elementos; no es posible prometer envío automático ni destinatario preseleccionado.
- **Nueva máquina** limpia la ficha solo después de confirmar. Si el PDF no está guardado, avisa antes de limpiar.

## Importante: requisitos externos y validación

La página aún utiliza recursos de terceros mediante conexión a internet (Tailwind, jsPDF y Tesseract.js), como hacía la V2 original. Sin red, el PDF/OCR o parte del diseño pueden no funcionar. Para uso 100 % offline será necesario descargar y empaquetar esas librerías y los idiomas OCR con sus licencias.

Esta entrega ha pasado controles sintácticos JavaScript y pruebas de lógica UI en navegador aislado (navegación, campos, estado de checkpoints, sonda editable, carga de imágenes, limpieza). **La compilación Gradle y las funciones de cámara y de WhatsApp en un dispositivo físico no se han probado desde este entorno.** Verifica estas funciones antes de usarla en producción.

## Privacidad

No subir fichas reales, nombres de empleados ni archivos con firmas o claves privadas al repositorio público. Los datos de los formularios y las listas se guardan localmente en el dispositivo salvo lo que el usuario comparta manualmente.
