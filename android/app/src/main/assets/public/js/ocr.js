/**
 * OCR Engine and Tag Parser
 * Extracts Machine Model, Serial Number, and Fabrication Date from industrial identification plates.
 */
import { ImageCompressor } from './compressor.js';

export const TagOCR = {
  /**
   * Processes an image file or dataUrl using Tesseract OCR with tag-specific heuristics
   * @param {File|string} imageFile - Raw image file or dataUrl
   * @param {Function} onProgress - Progress callback (percentage, status message)
   * @returns {Promise<{model: string, serialNumber: string, fabricationDate: string, rawText: string}>}
   */
  async processPlate(imageFile, onProgress = () => {}) {
    try {
      onProgress(10, 'Optimizando contraste y binarizando placa...');

      // 1. Compress & optimize image for fast OCR
      let base64Image;
      if (typeof imageFile === 'string') {
        base64Image = imageFile;
      } else {
        const compressed = await ImageCompressor.compress(imageFile, { maxWidth: 1600, quality: 0.85 });
        base64Image = compressed.dataUrl;
      }

      // Pre-process image to black/white high-contrast for industrial stickers
      const ocrReadyImage = await ImageCompressor.optimizeForOCR(base64Image);

      onProgress(30, 'Iniciando motor de visión neuronal...');

      // 2. Run OCR using Tesseract if available, or regex parser
      let rawText = '';
      if (window.Tesseract) {
        const worker = await window.Tesseract.createWorker('spa+eng', 1, {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              const progressPct = 30 + Math.round((m.progress || 0) * 60);
              onProgress(progressPct, `Leyendo placa de características... (${Math.round((m.progress || 0) * 100)}%)`);
            }
          }
        });

        // Optimize Tesseract parameters for text on plates
        await worker.setParameters({
          tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz/.-º°#: ',
        });

        const ret = await worker.recognize(ocrReadyImage);
        rawText = ret.data.text || '';
        await worker.terminate();
      } else {
        throw new Error('Motor OCR no disponible. Compruebe la conexión o introduzca datos manualmente.');
      }

      onProgress(95, 'Analizando campos específicos...');

      // 3. Parse fields using specialized heuristics
      const parsed = this.parseTagText(rawText);

      onProgress(100, '¡Lectura completada con éxito!');
      return {
        ...parsed,
        rawText,
        optimizedImage: ocrReadyImage
      };
    } catch (err) {
      console.error('Error en procesamiento OCR:', err);
      throw new Error('Error al procesar la imagen de la placa: ' + err.message);
    }
  },

  /**
   * Heuristic Parser for Industrial HVAC Nameplates:
   * - Model: Top-Left (e.g., GSR26 15/20 H-M)
   * - Serial Number: Top-Right (e.g., Nº 2209946)
   * - Fabrication Date: Top-Center (e.g., 27/10/2026)
   */
  parseTagText(text) {
    const cleanText = text.replace(/\r\n/g, '\n').trim();
    const lines = cleanText.split('\n').map(l => l.trim()).filter(Boolean);

    let model = '';
    let serialNumber = '';
    let fabricationDate = '';

    // Regex 1: Date (DD/MM/YYYY or DD-MM-YYYY)
    // Matches e.g. 27/10/2026, 27-10-2026, 05/11/2025
    const dateMatch = cleanText.match(/\b([0-3]?[0-9][\/\-.][0-1]?[0-9][\/\-.](?:20\d{2}|19\d{2}|\d{2}))\b/);
    if (dateMatch) {
      fabricationDate = dateMatch[1].replace(/[-.]/g, '/');
      // Normalize 2-digit years if needed
      const parts = fabricationDate.split('/');
      if (parts[2] && parts[2].length === 2) {
        parts[2] = '20' + parts[2];
        fabricationDate = parts.join('/');
      }
    }

    // Regex 2: Serial Number (Nº 2209946, N° 2209946, Nº2209946, 2209946, SN 2209946)
    const serialMatch = cleanText.match(/(?:N[ºo°#]|SERIE|S\/N|SN)[\s.:]*([0-9A-Z]{5,10})\b/i);
    if (serialMatch) {
      serialNumber = serialMatch[1].trim();
    } else {
      // Look for a 7-digit standalone number which is standard in HVAC manufacturing
      const numMatch = cleanText.match(/\b([0-9]{7})\b/);
      if (numMatch) {
        serialNumber = numMatch[1];
      }
    }

    // Regex 3: Model (e.g., GSR26 15/20 H-M, GSR26, GSR..., RECUP..., CLIMA...)
    // Look specifically for model prefixes or models with slashes and letters
    const gsrMatch = cleanText.match(/\b(GSR\s*\d{1,2}\s+[0-9/]+\s*[A-Z0-9\-_]*)\b/i);
    if (gsrMatch) {
      model = gsrMatch[1].trim().toUpperCase();
    } else {
      // Match generic Model patterns like "MODELO: XYZ" or uppercase code in the first 2 lines
      const modelLabelMatch = cleanText.match(/(?:MOD(?:ELO)?|TYPE|TIPO)[\s.:]*([A-Z0-9\s\/-]{4,25})/i);
      if (modelLabelMatch) {
        model = modelLabelMatch[1].trim();
      } else if (lines.length > 0) {
        // Fallback: Check first non-empty line
        const candidate = lines[0].replace(fabricationDate, '').replace(serialNumber, '').trim();
        if (candidate.length > 3 && candidate.length < 30) {
          model = candidate;
        }
      }
    }

    // Default fallbacks if clean sample tag
    if (!model && cleanText.includes('GSR')) {
      const idx = cleanText.indexOf('GSR');
      model = cleanText.substring(idx, idx + 18).trim();
    }

    // Regex 4: Fabricante (GISER, GreenAir, Tecna, etc.)
    let fabricante = '';
    if (/GISER/i.test(cleanText) || /gisersl/i.test(cleanText)) {
      fabricante = 'GISER';
    } else if (/GreenAir/i.test(cleanText)) {
      fabricante = 'GreenAir Industrial';
    } else if (/Tecna/i.test(cleanText)) {
      fabricante = 'Tecna Clima';
    } else if (/Systemair/i.test(cleanText)) {
      fabricante = 'Systemair';
    } else if (/Daikin/i.test(cleanText)) {
      fabricante = 'Daikin Industrial';
    }

    return {
      model: model || '',
      serialNumber: serialNumber || '',
      fabricationDate: fabricationDate || '',
      fabricante: fabricante || ''
    };
  },

  /**
   * Generates a realistic synthetic industrial nameplate on a canvas
   * matching the exact specifications (Model top-left, Date top-center, Serial top-right)
   * for immediate demonstration and automated testing.
   * @param {string} model 
   * @param {string} serial 
   * @param {string} date 
   * @returns {string} Data URL of the generated tag
   */
  createSamplePlateDataUrl(model = 'GSR26 15/20 H-M', serial = '2209946', date = '27/10/2026') {
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 450;
    const ctx = canvas.getContext('2d');

    // Metallic brushed aluminum plate background
    const bgGradient = ctx.createLinearGradient(0, 0, 900, 450);
    bgGradient.addColorStop(0, '#f1f5f9');
    bgGradient.addColorStop(0.5, '#e2e8f0');
    bgGradient.addColorStop(1, '#cbd5e1');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, 900, 450);

    // Dark border & screw rivets
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#334155';
    ctx.strokeRect(15, 15, 870, 420);

    // 4 Corner screws
    const screws = [[35, 35], [865, 35], [35, 415], [865, 415]];
    screws.forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.fillStyle = '#94a3b8';
      ctx.fill();
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Screw slot
      ctx.beginPath();
      ctx.moveTo(x - 6, y);
      ctx.lineTo(x + 6, y);
      ctx.stroke();
    });

    // Top Header Banner
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(40, 40, 820, 60);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Arial, sans-serif';
    ctx.fillText('GREENAIR INDUSTRIAL - CLIMATIZACIÓN Y RECUPERACIÓN', 60, 78);

    // 3 KEY ZONES AS PER INDUSTRIAL LABEL SPEC:
    // 1. Top-Left: Model
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 16px Arial, sans-serif';
    ctx.fillText('MODELO / TYPE:', 60, 140);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 28px "Courier New", monospace';
    ctx.fillText(model, 60, 180);

    // 2. Top-Center: Fabrication Date
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 16px Arial, sans-serif';
    ctx.fillText('FECHA FABRICACIÓN:', 360, 140);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 26px "Courier New", monospace';
    ctx.fillText(date, 360, 180);

    // 3. Top-Right: Serial Number
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 16px Arial, sans-serif';
    ctx.fillText('Nº DE SERIE / S.N.:', 660, 140);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 28px "Courier New", monospace';
    ctx.fillText(`Nº ${serial}`, 660, 180);

    // Separator line
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(50, 215);
    ctx.lineTo(850, 215);
    ctx.stroke();

    // Additional Technical Plate Data (V, Hz, kW, Airflow)
    ctx.fillStyle = '#334155';
    ctx.font = '15px Arial, sans-serif';
    ctx.fillText('Tensión: 400V 3~ 50Hz', 60, 255);
    ctx.fillText('Potencia Motor: 2.2 kW', 60, 290);
    ctx.fillText('Presión Estática: 350 Pa', 60, 325);

    ctx.fillText('Caudal Nominal: 3.500 m³/h', 360, 255);
    ctx.fillText('Tipo de Filtro: F7 / G4', 360, 290);
    ctx.fillText('Refrigerante: R-410A / Agua', 360, 325);

    ctx.fillText('Protección: IP55', 660, 255);
    ctx.fillText('Normativa: UNE-EN 1886', 660, 290);
    ctx.fillText('Marcado: CE Industrial', 660, 325);

    // Footer barcode simulation
    ctx.fillStyle = '#0f172a';
    for (let i = 60; i < 840; i += 7) {
      const barW = (i % 3 === 0) ? 4 : 2;
      ctx.fillRect(i, 365, barW, 40);
    }

    return canvas.toDataURL('image/jpeg', 0.9);
  }
};
