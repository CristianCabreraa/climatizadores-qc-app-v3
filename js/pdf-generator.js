/**
 * Professional Industrial PDF Report Generator - GreenAir QC V2
 * Generates an executive-grade quality inspection sheet using jsPDF
 * Includes equipment metadata, CUADRO, CONFIGURACIÓN, checkpoints, optional components, personnel signatures, and adaptive photo gallery (0, 1, 2, 3+ photos).
 */

export const PDFGenerator = {
  /**
   * Generates the PDF document
   * @param {Object} data - Full form data
   * @returns {Promise<{doc: any, blob: Blob, fileName: string, objectUrl: string, sizeBytes: number}>}
   */
  async generateReport(data) {
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) {
      throw new Error('La librería jsPDF no está cargada.');
    }

    // Create A4 portrait document
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const contentWidth = pageWidth - (margin * 2);

    const safeSerial = (data.serialNumber || 'SN-SIN-SERIE').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeOrder = (data.orderNumber || 'SIN_PEDIDO').replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `${safeOrder}_${safeSerial}_Ficha_Pruebas.pdf`;
    const allOk = Object.values(data.checkpoints || {}).length === 5 && Object.values(data.checkpoints).every(Boolean) &&
      (!data.optionals?.sondaCo2?.has || data.optionals.sondaCo2.working) &&
      (!data.optionals?.mandoSuperficie?.has || data.optionals.mandoSuperficie.working);

    // ----------------------------------------------------
    // 1. HEADER & BRANDING
    // ----------------------------------------------------
    // Top banner background
    doc.setFillColor(24, 60, 51); // GreenAir dark green
    doc.rect(0, 0, pageWidth, 28, 'F');

    // Accent line
    doc.setFillColor(235, 145, 55); // subtle orange accent
    doc.rect(0, 28, pageWidth, 2, 'F');

    // Brand title
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('GREENAIR INDUSTRIAL - SISTEMAS DE CLIMATIZACIÓN', margin, 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text('CONTROL DE CALIDAD Y REGISTRO DE ENSAYOS TÉCNICOS', margin, 18);
    doc.text(`DOC. REF: QC-${safeOrder}-${safeSerial}`, margin, 23);

    // Right-aligned status stamp
    doc.setFillColor(...(allOk ? [16, 133, 84] : [185, 28, 28]));
    doc.roundedRect(pageWidth - margin - 38, 7, 38, 14, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(allOk ? 'ENSAYO OK' : 'INCIDENCIAS', pageWidth - margin - 19, 14, { align: 'center' });
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.text(allOk ? 'CHECKPOINTS OK' : 'REVISAR FICHA', pageWidth - margin - 19, 18, { align: 'center' });

    let currentY = 35;

    // ----------------------------------------------------
    // 2. EQUIPMENT IDENTIFICATION CARD (CUADRO & CONFIGURACIÓN)
    // ----------------------------------------------------
    doc.setFillColor(241, 245, 249); // slate-100
    doc.roundedRect(margin, currentY, contentWidth, 42, 2, 2, 'F');
    doc.setDrawColor(203, 213, 225); // slate-300
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, currentY, contentWidth, 42, 2, 2, 'S');

    // Card Title
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text('DATOS DE IDENTIFICACIÓN DEL EQUIPO (PLACA Y CUADRO ELÉCTRICO)', margin + 4, currentY + 6);

    // Row 1: CUADRO & MODELO
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('CUADRO:', margin + 4, currentY + 13.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(data.cuadro || 'No indicado', margin + 30, currentY + 13.5);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('MODELO DE MÁQUINA:', margin + 95, currentY + 13.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(16, 105, 78);
    doc.text(data.model || 'N/A', margin + 136, currentY + 13.5);

    // Row 2: Nº DE SERIE & FECHA DE FABRICACIÓN
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('Nº DE SERIE:', margin + 4, currentY + 20.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(data.serialNumber || 'N/A', margin + 30, currentY + 20.5);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('FECHA FABRICACIÓN:', margin + 95, currentY + 20.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(data.fabricationDate || 'N/A', margin + 136, currentY + 20.5);

    // Row 3: CONFIGURACIÓN DE LA MÁQUINA & FECHA ENSAYO
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('CONFIGURACIÓN:', margin + 4, currentY + 27.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(16, 105, 78); // dark green
    doc.text(data.configuracion || 'No indicada', margin + 35, currentY + 27.5);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('FECHA / HORA ENSAYO:', margin + 95, currentY + 27.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    const nowStr = new Date().toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
    doc.text(nowStr, margin + 136, currentY + 27.5);

    doc.setTextColor(71, 85, 105);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('Nº DE PEDIDO:', margin + 4, currentY + 35);
    doc.setTextColor(24, 60, 51);
    doc.text(data.orderNumber || 'N/A', margin + 35, currentY + 35);
    currentY += 47;

    // ----------------------------------------------------
    // 3. CHECKPOINTS TABLE
    // ----------------------------------------------------
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text('CHECKPOINTS DE FUNCIONAMIENTO TÉCNICO', margin, currentY);
    currentY += 4;

    const checkpoints = [
      { name: 'Presostatos', checked: data.checkpoints?.presostatos, desc: 'Verificación de corte y rearme por presión diferencial' },
      { name: 'Ventilador de Impulsión', checked: data.checkpoints?.ventImpulsion, desc: 'Sentido de giro, vibraciones, consumo y caudal nominal' },
      { name: 'Ventilador de Retorno', checked: data.checkpoints?.ventRetorno, desc: 'Sentido de giro, balance dinámico y consumo eléctrico' },
      { name: 'Temperatura de Impulsión', checked: data.checkpoints?.tempImpulsion, desc: 'Sonda térmica calibrada y respuesta dinámica' },
      { name: 'Temperatura de Retorno', checked: data.checkpoints?.tempRetorno, desc: 'Sonda térmica calibrada y lectura en consola' },
    ];

    // Table Header
    doc.setFillColor(226, 232, 240); // slate-200
    doc.rect(margin, currentY, contentWidth, 6, 'F');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    doc.text('ELEMENTO INSPECCIONADO', margin + 4, currentY + 4.2);
    doc.text('CRITERIO DE ACEPTACIÓN', margin + 55, currentY + 4.2);
    doc.text('ESTADO', margin + 155, currentY + 4.2);
    currentY += 6;

    checkpoints.forEach((cp, idx) => {
      const rowY = currentY;
      const isEven = idx % 2 === 0;
      doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 252);
      doc.rect(margin, rowY, contentWidth, 6.5, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, rowY + 6.5, margin + contentWidth, rowY + 6.5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text(cp.name, margin + 4, rowY + 4.4);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(cp.desc, margin + 55, rowY + 4.4);

      // Status Badge
      if (cp.checked) {
        doc.setFillColor(209, 250, 229); // green-100
        doc.roundedRect(margin + 152, rowY + 1, 24, 4.5, 1, 1, 'F');
        doc.setTextColor(6, 95, 70); // green-800
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.text('CORRECTO (OK)', margin + 164, rowY + 4.2, { align: 'center' });
      } else {
        doc.setFillColor(254, 226, 226); // red-100
        doc.roundedRect(margin + 152, rowY + 1, 24, 4.5, 1, 1, 'F');
        doc.setTextColor(153, 27, 27); // red-800
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.text('NO CONFORME', margin + 164, rowY + 4.2, { align: 'center' });
      }

      currentY += 6.5;
    });

    currentY += 4;

    // ----------------------------------------------------
    // 4. OPTIONAL COMPONENTS
    // ----------------------------------------------------
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text('COMPONENTES OPCIONALES', margin, currentY);
    currentY += 3.5;

    const optionals = [
      {
        name: 'Sonda de CO2',
        has: data.optionals?.sondaCo2?.has,
        working: data.optionals?.sondaCo2?.working,
        desc: data.optionals?.sondaCo2?.has ? ('Tipo: ' + (data.optionals.sondaCo2.type || 'Sin especificar')) : 'No instalado'
      },
      {
        name: 'Mando de Superficie',
        has: data.optionals?.mandoSuperficie?.has,
        working: data.optionals?.mandoSuperficie?.working,
        desc: 'Pantalla mural de control táctil / botonera de usuario'
      }
    ];

    optionals.forEach((opt) => {
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(margin, currentY, contentWidth, 7.5, 1, 1, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, currentY, contentWidth, 7.5, 1, 1, 'S');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text(opt.name, margin + 4, currentY + 4.8);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(opt.desc, margin + 50, currentY + 4.8);

      if (opt.has) {
        if (opt.working) {
          doc.setFillColor(209, 250, 229);
          doc.roundedRect(margin + 138, currentY + 1.5, 38, 4.5, 1, 1, 'F');
          doc.setTextColor(6, 95, 70);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7);
          doc.text('INSTALADO - PRUEBA OK', margin + 157, currentY + 4.6, { align: 'center' });
        } else {
          doc.setFillColor(254, 243, 199);
          doc.roundedRect(margin + 138, currentY + 1.5, 38, 4.5, 1, 1, 'F');
          doc.setTextColor(146, 64, 14);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7);
          doc.text('INSTALADO - PENDIENTE', margin + 157, currentY + 4.6, { align: 'center' });
        }
      } else {
        doc.setFillColor(241, 245, 249);
        doc.roundedRect(margin + 138, currentY + 1.5, 38, 4.5, 1, 1, 'F');
        doc.setTextColor(100, 116, 139);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.text('NO INCLUIDO EN MODELO', margin + 157, currentY + 4.6, { align: 'center' });
      }

      currentY += 9;
    });

    currentY += 2;

    // ----------------------------------------------------
    // 5. OPERATIONS PERSONNEL / SIGNATURES (MONTADOR & ELECTRICISTA)
    // ----------------------------------------------------
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text('PERSONAL DE OPERACIONES RESPONSABLE', margin, currentY);
    currentY += 3.5;

    const personnelBoxWidth = (contentWidth - 6) / 2;
    const personnelList = [
      { role: 'MONTADOR', subtitle: 'Armó la máquina completa', name: data.personnel?.montador || 'Sin asignar' },
      { role: 'ELECTRICISTA', subtitle: 'Cableó y probó la máquina', name: data.personnel?.electricista || 'Sin asignar' },
    ];

    personnelList.forEach((p, i) => {
      const boxX = margin + (i * (personnelBoxWidth + 6));
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(boxX, currentY, personnelBoxWidth, 20, 1.5, 1.5, 'F');
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(boxX, currentY, personnelBoxWidth, 20, 1.5, 1.5, 'S');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(16, 105, 78);
      doc.text(p.role, boxX + 4, currentY + 4.8);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(p.subtitle, boxX + 4, currentY + 8.5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(p.name, boxX + 4, currentY + 14);

      // Signature line
      doc.setDrawColor(148, 163, 184);
      doc.setLineDashPattern([1, 1], 0);
      doc.line(boxX + 4, currentY + 17, boxX + personnelBoxWidth - 4, currentY + 17);
      doc.setLineDashPattern([], 0);
    });

    currentY += 25;

    // ----------------------------------------------------
    // 6. PHOTOGRAPHIC EVIDENCE (ADAPTIVE: 0, 1, 2, 3+ PHOTOS)
    // ----------------------------------------------------
    const photos = data.photos || [];
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`EVIDENCIA FOTOGRÁFICA DE FUNCIONAMIENTO (${photos.length} ${photos.length === 1 ? 'FOTOGRAFÍA' : 'FOTOGRAFÍAS'})`, margin, currentY);
    currentY += 4;

    if (photos.length === 0) {
      // 0 photos: Clean placeholder, perfectly balanced layout
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(margin, currentY, contentWidth, 16, 1.5, 1.5, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, currentY, contentWidth, 16, 1.5, 1.5, 'S');

      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('No se adjuntaron fotografías adicionales a esta ficha.', margin + 6, currentY + 7);
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text('Los resultados de los checkpoints están documentados en la tabla anterior.', margin + 6, currentY + 11.5);
      currentY += 20;
    } else {
      // Every attached photo must appear in the report, with automatic new pages.
      const gap = 5;
      const w = (contentWidth - gap) / 2;
      const h = 46;
      for (let idx = 0; idx < photos.length; idx++) {
        const column = idx % 2;
        if (column === 0 && currentY + h + 8 > pageHeight - 20) {
          doc.addPage();
          currentY = 18;
        }
        const x = margin + column * (w + gap);
        const photo = photos[idx];
        try {
          doc.addImage(photo.dataUrl, 'JPEG', x, currentY, w, h - 7, undefined, 'FAST');
          doc.setDrawColor(160, 174, 167);
          doc.rect(x, currentY, w, h - 7, 'S');
          doc.setFillColor(24, 60, 51);
          doc.rect(x, currentY + h - 7, w, 7, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          const text = `Foto ${idx + 1}: ${photo.caption || 'Evidencia'}`;
          doc.text(text.length > 53 ? text.slice(0, 50) + '...' : text, x + 2, currentY + h - 2.4);
        } catch (err) {
          console.error('No se pudo incluir foto en PDF:', err);
          doc.setTextColor(153, 27, 27);
          doc.text(`Foto ${idx + 1} no disponible`, x + 2, currentY + 8);
        }
        if (column === 1 || idx === photos.length - 1) currentY += h + 5;
      }
    }

    // ----------------------------------------------------
    // 7. FOOTER & COMPLIANCE
    // ----------------------------------------------------
    const footerY = pageHeight - 11;
    const count = doc.getNumberOfPages();
    for (let n = 1; n <= count; n++) {
      doc.setPage(n);
      doc.setDrawColor(203, 213, 225);
      doc.line(margin, footerY - 2, pageWidth - margin, footerY - 2);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(95, 113, 108);
      doc.text('GreenAir Industrial — Registro interno de Control de Calidad y Electricidad', margin, footerY + 2);
      doc.text(`Pedido ${safeOrder} | Pág. ${n}/${count}`, pageWidth - margin, footerY + 2, { align: 'right' });
    }

    // Output blob and base64
    const blob = doc.output('blob');
    if (!blob || blob.size < 500) {
      throw new Error('El documento PDF generado está vacío o no es válido.');
    }

    const objectUrl = null; // No crear URL innecesaria; el guardado se inicia desde acciones de usuario.
    const sizeBytes = blob.size;

    return {
      doc,
      blob,
      fileName,
      objectUrl,
      sizeBytes
    };
  }
};
