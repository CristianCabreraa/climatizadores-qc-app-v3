/** GreenAir QC 2.1: PDF real, Android document picker / share sheet, Web Share on browsers. */
export const ShareEngine = {
  async asBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = () => reject(reader.error || new Error('No se pudo leer PDF'));
      reader.readAsDataURL(blob);
    });
  },
  summary(data = {}) {
    const c = data.checkpoints || {};
    const allGood = Object.values(c).length === 5 && Object.values(c).every(Boolean) &&
      (!data.optionals?.sondaCo2?.has || data.optionals?.sondaCo2?.working) &&
      (!data.optionals?.mandoSuperficie?.has || data.optionals?.mandoSuperficie?.working);
    return `*GREENAIR — FICHA DE CONTROL DE CALIDAD*\n` +
      `*Pedido:* ${data.orderNumber || 'No indicado'}\n` +
      `*Serie:* ${data.serialNumber || 'No indicado'}\n` +
      `*Modelo:* ${data.model || 'No indicado'}\n` +
      `*Cuadro:* ${data.cuadro || 'No indicado'}\n` +
      `*Configuración:* ${data.configuracion || 'No indicada'}\n` +
      `*Sonda CO₂:* ${data.optionals?.sondaCo2?.has ? (data.optionals.sondaCo2.type || 'Tipo no indicado') : 'No instalada'}\n` +
      `*Montador:* ${data.personnel?.montador || 'No indicado'}\n` +
      `*Electricista:* ${data.personnel?.electricista || 'No indicado'}\n` +
      `*Resultado:* ${allGood ? 'CONFORME' : 'CON INCIDENCIAS / NO CONFORME'}\n` +
      `Se adjunta ficha técnica en PDF.`;
  },
  async savePdf(blob, fileName) {
    try {
      if (window.GreenAirNative?.savePdf) {
        const base64 = await this.asBase64(blob);
        window.GreenAirNative.savePdf(base64, fileName);
        return { success: false, pending: true, method: 'android_picker', message: 'Selecciona dónde guardar el PDF.' };
      }
      if (window.showSaveFilePicker) {
        const handle = await window.showSaveFilePicker({ suggestedName: fileName, types: [{
          description: 'PDF', accept: {'application/pdf': ['.pdf']}
        }] });
        const w = await handle.createWritable();
        await w.write(blob);
        await w.close();
        return { success: true, method: 'file_picker', message: 'Archivo guardado: ' + handle.name };
      }
      this.downloadFile(blob, fileName);
      return { success: false, pending: true, method: 'download', message: 'Descarga solicitada. Comprueba la carpeta de Descargas.' };
    } catch (error) {
      return error.name === 'AbortError' ? { cancelled: true } : { success: false, message: error.message };
    }
  },
  async sharePdfNative(blob, fileName, data = {}) {
    try {
      if (window.GreenAirNative?.sharePdf) {
        const base64 = await this.asBase64(blob);
        window.GreenAirNative.sharePdf(base64, fileName, this.summary(data));
        // The receiving application decides whether to include EXTRA_TEXT with EXTRA_STREAM.
        return { success: true, method: 'android_chooser' };
      }
      const file = new File([blob], fileName, { type: 'application/pdf' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `Ficha GreenAir — ${data.orderNumber || ''}`, text: this.summary(data) });
        return { success: true, method: 'web_share' };
      }
      return { success: false, message: 'Este navegador no permite adjuntar archivos directamente. Guarda el PDF y adjúntalo desde WhatsApp o Gmail.' };
    } catch (error) {
      if (error.name === 'AbortError') return { cancelled: true };
      return { success: false, message: 'No se pudo compartir el PDF: ' + error.message };
    }
  },
  downloadFile(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
};
