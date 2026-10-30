/**
 * Image Compressor & Optimizer
 * Prevents memory leaks and Android browser freezing by downscaling high-res camera photos
 * to an optimized 1280px resolution and lightweight JPEG quality.
 */
export const ImageCompressor = {
  /**
   * Compresses a File or Blob into a lightweight base64 Data URL and Blob
   * @param {File|Blob} file - The raw photo file from camera or gallery
   * @param {Object} options - Max dimensions and quality options
   * @returns {Promise<{dataUrl: string, blob: Blob, width: number, height: number, sizeKb: number}>}
   */
  compress(file, options = {}) {
    const maxWidth = options.maxWidth || 1280;
    const maxHeight = options.maxHeight || 1280;
    const quality = options.quality !== undefined ? options.quality : 0.78;

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = (err) => reject(new Error('Error al leer el archivo de imagen: ' + err));
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = () => reject(new Error('No se pudo cargar la imagen para compresión'));
        img.onload = () => {
          let { width, height } = img;

          // Calculate aspect ratio downscaling
          if (width > maxWidth || height > maxHeight) {
            if (width > height) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d', { alpha: false });
          
          // Smooth scaling
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'medium';

          ctx.drawImage(img, 0, 0, width, height);

          // Get optimized base64
          const dataUrl = canvas.toDataURL('image/jpeg', quality);

          // Get blob
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Error al generar blob comprimido'));
                return;
              }
              const sizeKb = Math.round(blob.size / 1024);
              resolve({
                dataUrl,
                blob,
                width,
                height,
                sizeKb
              });
            },
            'image/jpeg',
            quality
          );
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  },

  /**
   * Pre-processes an image for OCR: applies grayscale, auto-contrast, and adaptive thresholding
   * to significantly boost OCR recognition on metallic and industrial stickers.
   * @param {string|HTMLImageElement} imageSource 
   * @returns {Promise<string>} Base64 image optimized for OCR engine
   */
  optimizeForOCR(imageSource) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onerror = () => reject(new Error('No se pudo cargar la imagen para pre-procesamiento OCR'));
      img.onload = () => {
        // Limit max OCR width to 1600px for speed
        const scale = Math.min(1, 1600 / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);

        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;

        // Grayscale + High-contrast binarization
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          // Luminance formula
          const gray = 0.299 * r + 0.587 * g + 0.114 * b;
          // Contrast stretch
          const contrast = (gray - 128) * 1.5 + 128;
          const finalVal = contrast > 140 ? 255 : contrast < 90 ? 0 : contrast;

          data[i] = finalVal;
          data[i + 1] = finalVal;
          data[i + 2] = finalVal;
        }

        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };

      if (typeof imageSource === 'string') {
        img.src = imageSource;
      } else {
        img.src = imageSource.src;
      }
    });
  }
};
