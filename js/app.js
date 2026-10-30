/**
 * Main Application Controller - GreenAir QC V2
 * Coordinates Home Navigation, OCR scanning, Dropdowns (Cuadro, Configuración, Montador, Electricista),
 * Optional Photo Evidence (0, 1, 2, 3+), PDF Report generation, and Real File Saving / Sharing.
 */
import { ImageCompressor } from './compressor.js';
import { TagOCR } from './ocr.js';
import { PersonnelStorage } from './storage.js';
import { PDFGenerator } from './pdf-generator.js';
import { ShareEngine } from './share.js';

class AppController {
  constructor() {
    this.photos = [];
    this.currentPdfBlob = null;
    this.currentPdfFileName = '';
    this.currentPdfSizeBytes = 0;
    this.activeManageRole = null;
    this.pdfSaved = false;
  }

  init() {
    PersonnelStorage.init();
    this.renderDropdowns();
    this.bindEvents();
    this.updatePhotoCounter();
    this.updateCheckpointStatuses();
    window.addEventListener('greenair-native', (e) => {
      if (e.detail?.type === 'saved') { this.pdfSaved = true; this.showToast('PDF guardado correctamente en Android.', 'success'); }
      if (e.detail?.type === 'save_cancelled') this.showToast('Guardado cancelado.', 'info');
      if (e.detail?.type === 'error') this.showToast(e.detail.message || 'Error Android', 'error');
    });
    console.log('GreenAir QC V2 inicializada con éxito.');
  }

  // ----------------------------------------------------
  // EVENT BINDINGS
  // ----------------------------------------------------
  bindEvents() {
    // 1. NAVIGATION EVENTS (HOME SCREEN V2)
    const btnMenuLogistica = document.getElementById('btnMenuLogistica');
    const modalLogistica = document.getElementById('modalLogistica');
    const btnCloseLogisticaModal = document.getElementById('btnCloseLogisticaModal');

    if (btnMenuLogistica && modalLogistica) {
      btnMenuLogistica.addEventListener('click', () => {
        modalLogistica.classList.remove('hidden');
      });
    }

    if (btnCloseLogisticaModal && modalLogistica) {
      btnCloseLogisticaModal.addEventListener('click', () => {
        modalLogistica.classList.add('hidden');
      });
    }

    const btnMenuElectricidad = document.getElementById('btnMenuElectricidad');
    const btnBackToHome = document.getElementById('btnBackToHome');
    const viewHomeScreen = document.getElementById('viewHomeScreen');
    const viewElectricityScreen = document.getElementById('viewElectricityScreen');

    if (btnMenuElectricidad && viewHomeScreen && viewElectricityScreen) {
      btnMenuElectricidad.addEventListener('click', () => {
        viewHomeScreen.classList.add('hidden');
        viewElectricityScreen.classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    if (btnBackToHome && viewHomeScreen && viewElectricityScreen) {
      btnBackToHome.addEventListener('click', () => {
        // Return to home without losing any entered form data
        viewElectricityScreen.classList.add('hidden');
        viewHomeScreen.classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    // 2. OCR PLATE SCANNING
    const plateInput = document.getElementById('plateFileInput');
    if (plateInput) {
      plateInput.addEventListener('change', (e) => this.handlePlateUpload(e));
    }

    // 3. PHOTO EVIDENCE (OPTIONAL)
    ['photoCameraInput','photoGalleryInput'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', e => this.handlePhotoUpload(e));
    });
    document.getElementById('btnClearForm')?.addEventListener('click', () => this.clearFormAfterConfirm(false));

    // 4. CHECKPOINTS TOGGLE
    document.querySelectorAll('.checkpoint-card input[type=checkbox]').forEach(input => input.addEventListener('change', () => this.updateCheckpointStatuses()));
    const btnCheckAll = document.getElementById('btnCheckAll');
    if (btnCheckAll) {
      btnCheckAll.addEventListener('click', () => this.checkAllCheckpoints(true));
    }

    // Optional components toggles
    const chkSondaCo2 = document.getElementById('chkSondaCo2');
    if (chkSondaCo2) {
      chkSondaCo2.addEventListener('change', (e) => {
        const sub = document.getElementById('subSondaCo2Container');
        if (sub) sub.classList.toggle('hidden', !e.target.checked);
      });
    }

    const chkMando = document.getElementById('chkMando');
    if (chkMando) {
      chkMando.addEventListener('change', (e) => {
        const sub = document.getElementById('subMandoContainer');
        if (sub) sub.classList.toggle('hidden', !e.target.checked);
      });
    }

    // 5. ADD ITEM (+) BUTTONS
    document.querySelectorAll('[data-add-role]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const role = e.currentTarget.getAttribute('data-add-role');
        this.openAddItemModal(role);
      });
    });

    // MANAGE LISTS (GEAR ICON)
    document.querySelectorAll('[data-manage-role]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const role = e.currentTarget.getAttribute('data-manage-role');
        this.openManageModal(role);
      });
    });

    // Save New Item Modal Buttons
    const btnSaveNewTech = document.getElementById('btnSaveNewTech');
    if (btnSaveNewTech) {
      btnSaveNewTech.addEventListener('click', () => this.saveNewItem());
    }

    const btnCloseTechModal = document.getElementById('btnCloseTechModal');
    const btnCancelAddTech = document.getElementById('btnCancelAddTech');
    if (btnCloseTechModal) {
      btnCloseTechModal.addEventListener('click', () => this.closeAddItemModal());
    }
    if (btnCancelAddTech) {
      btnCancelAddTech.addEventListener('click', () => this.closeAddItemModal());
    }

    const btnCloseManageModal = document.getElementById('btnCloseManageModal');
    const btnCloseManageModalBtn = document.getElementById('btnCloseManageModalBtn');
    if (btnCloseManageModal) {
      btnCloseManageModal.addEventListener('click', () => this.closeManageModal());
    }
    if (btnCloseManageModalBtn) {
      btnCloseManageModalBtn.addEventListener('click', () => this.closeManageModal());
    }

    // 6. MAIN ACTION: "Guardar Ficha y Generar PDF"
    const btnSaveReport = document.getElementById('btnSaveReport');
    if (btnSaveReport) {
      btnSaveReport.addEventListener('click', () => this.saveAndGenerateReport());
    }

    // 7. POST-GENERATION ACTIONS (CAMBIO 5, 6 Y 7)
    // A. GUARDAR PDF (Elige carpeta / Descarga)
    const btnSavePdfAction = document.getElementById('btnSavePdfAction');
    if (btnSavePdfAction) {
      btnSavePdfAction.addEventListener('click', () => this.handleSavePdf());
    }

    // B. COMPARTIR PDF (Web Share API nativo con archivo adjunto)
    const btnSharePdfAction = document.getElementById('btnSharePdfAction');
    if (btnSharePdfAction) {
      btnSharePdfAction.addEventListener('click', () => this.handleSharePdf());
    }

    // C. WhatsApp Direct
    const btnQuickWhatsApp = document.getElementById('btnQuickWhatsApp');
    if (btnQuickWhatsApp) {
      btnQuickWhatsApp.addEventListener('click', () => this.handleWhatsAppShare());
    }

    // D. Gmail Direct
    const btnQuickGmail = document.getElementById('btnQuickGmail');
    if (btnQuickGmail) {
      btnQuickGmail.addEventListener('click', () => this.handleGmailShare());
    }

    // E. FINALIZAR
    const btnFinalizeAction = document.getElementById('btnFinalizeAction');
    if (btnFinalizeAction) {
      btnFinalizeAction.addEventListener('click', () => this.handleFinalizeProcess());
    }
  }

  // ----------------------------------------------------
  // OCR PROCESSING
  // ----------------------------------------------------
  async handlePlateUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    await this.runOcrOnImage(file);
    event.target.value = '';
  }

  async runOcrOnImage(imageSource) {
    const ocrStatusContainer = document.getElementById('ocrStatusContainer');
    const ocrProgressBar = document.getElementById('ocrProgressBar');
    const ocrStatusText = document.getElementById('ocrStatusText');
    const platePreviewImg = document.getElementById('platePreviewImg');
    const platePreviewContainer = document.getElementById('platePreviewContainer');

    if (ocrStatusContainer) ocrStatusContainer.classList.remove('hidden');

    try {
      if (typeof imageSource === 'string') {
        if (platePreviewImg) platePreviewImg.src = imageSource;
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (platePreviewImg) platePreviewImg.src = e.target.result;
        };
        reader.readAsDataURL(imageSource);
      }
      if (platePreviewContainer) platePreviewContainer.classList.remove('hidden');

      // Process OCR
      const result = await TagOCR.processPlate(imageSource, (progress, message) => {
        if (ocrProgressBar) ocrProgressBar.style.width = `${progress}%`;
        if (ocrStatusText) ocrStatusText.innerText = message;
      });

      // Auto-populate inputs
      const modelInput = document.getElementById('modelInput');
      const serialInput = document.getElementById('serialInput');
      const fabDateInput = document.getElementById('fabDateInput');

      if (modelInput && result.model) {
        modelInput.value = result.model;
        this.highlightInput(modelInput);
      }
      if (serialInput && result.serialNumber) {
        serialInput.value = result.serialNumber;
        this.highlightInput(serialInput);
      }
      if (fabDateInput && result.fabricationDate) {
        fabDateInput.value = result.fabricationDate;
        this.highlightInput(fabDateInput);
      }

      this.showToast('OCR completado. Verifique los datos extraídos antes de generar la ficha.', 'info');

      setTimeout(() => {
        if (ocrStatusContainer) ocrStatusContainer.classList.add('hidden');
      }, 2500);

    } catch (err) {
      console.error('Error OCR:', err);
      this.showToast('No se pudo leer la placa automáticamente. Ingrésela manualmente.', 'error');
      if (ocrStatusContainer) ocrStatusContainer.classList.add('hidden');
    }
  }

  highlightInput(inputEl) {
    inputEl.classList.add('ring-2', 'ring-emerald-500', 'bg-emerald-50');
    setTimeout(() => {
      inputEl.classList.remove('ring-2', 'ring-emerald-500', 'bg-emerald-50');
    }, 2000);
  }

  // ----------------------------------------------------
  // CHECKPOINTS LOGIC
  // ----------------------------------------------------
  checkAllCheckpoints(status = true) {
    const ids = ['cpPresostatos', 'cpVentImpulsion', 'cpVentRetorno', 'cpTempImpulsion', 'cpTempRetorno'];
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.checked = status;
    });
    this.updateCheckpointStatuses();
    this.showToast('Todos los checkpoints marcados como correctos.', 'success');
  }

  updateCheckpointStatuses() {
    document.querySelectorAll('.checkpoint-card').forEach(card => {
      const checked = !!card.querySelector('input[type=checkbox]')?.checked;
      const badge = card.querySelector('.checkpoint-status');
      if (!badge) return;
      badge.textContent = checked ? 'Correcto' : 'Incorrecto';
      badge.className = 'checkpoint-status text-xs font-bold px-2.5 py-1 rounded-md ' +
        (checked ? 'text-emerald-800 bg-emerald-100' : 'text-red-800 bg-red-100');
      card.classList.toggle('checked', checked);
    });
  }

  // ----------------------------------------------------
  // DROPDOWNS MANAGEMENT (CUADRO, CONFIGURACIÓN, OPERARIOS)
  // ----------------------------------------------------
  renderDropdowns() {
    this.renderSingleDropdown('cuadro', 'selectCuadro');
    this.renderSingleDropdown('configuracion', 'selectConfiguracion');
    this.renderSingleDropdown('montador', 'selectMontador');
    this.renderSingleDropdown('electricista', 'selectElectricista');
    this.renderSingleDropdown('sondaCo2', 'selectSondaCo2');
  }

  renderSingleDropdown(role, selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;

    const currentVal = select.value;
    const list = PersonnelStorage.getList(role);

    select.innerHTML = '<option value="">-- Seleccionar de la lista --</option>';
    list.forEach((name) => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.innerText = name;
      if (name === currentVal) opt.selected = true;
      select.appendChild(opt);
    });


  }

  openAddItemModal(role) {
    this.activeManageRole = role;
    const modal = document.getElementById('addTechModal');
    const input = document.getElementById('newTechNameInput');
    const roleTitle = document.getElementById('newTechRoleTitle');
    const modalTitle = document.getElementById('modalAddTitle');
    const lblInput = document.getElementById('lblNewItemInput');

    const roleMeta = {
      cuadro: {
        title: 'Cuadro Eléctrico / Fabricante',
        lbl: 'Nombre del Cuadro (ej: GISER, Cuadro Especial):',
        placeholder: 'Ej: GISER'
      },
      configuracion: {
        title: 'Configuración de la Máquina',
        lbl: 'Nombre de la Configuración Técnica:',
        placeholder: 'Ej: Recuperador Free-cooling / Estándar'
      },
      montador: {
        title: 'Montador',
        lbl: 'Nombre Completo del Montador:',
        placeholder: 'Ej: Marcos Delgado'
      },
      sondaCo2: { title: 'Tipo de Sonda CO₂', lbl: 'Nombre del tipo de sonda:', placeholder: 'Escribe el tipo instalado' },
      electricista: {
        title: 'Electricista',
        lbl: 'Nombre Completo del Electricista:',
        placeholder: 'Ej: Laura Fernández'
      }
    };

    const meta = roleMeta[role] || { title: role, lbl: 'Nombre:', placeholder: '' };
    if (roleTitle) roleTitle.innerText = meta.title;
    if (modalTitle) modalTitle.innerText = `Añadir a ${meta.title}`;
    if (lblInput) lblInput.innerText = meta.lbl;
    if (input) {
      input.value = '';
      input.placeholder = meta.placeholder;
      setTimeout(() => input.focus(), 100);
    }
    if (modal) modal.classList.remove('hidden');
  }

  closeAddItemModal() {
    const modal = document.getElementById('addTechModal');
    if (modal) modal.classList.add('hidden');
    this.activeManageRole = null;
  }

  saveNewItem() {
    const input = document.getElementById('newTechNameInput');
    const name = input ? input.value.trim() : '';

    if (!name) {
      this.showToast('Por favor escribe el nombre o identificación.', 'warning');
      return;
    }

    if (!this.activeManageRole) return;

    PersonnelStorage.addName(this.activeManageRole, name);
    this.renderDropdowns();

    const selectMap = {
      cuadro: 'selectCuadro',
      configuracion: 'selectConfiguracion',
      montador: 'selectMontador',
      electricista: 'selectElectricista',
      sondaCo2: 'selectSondaCo2'
    };
    const sel = document.getElementById(selectMap[this.activeManageRole]);
    if (sel) sel.value = name;

    this.showToast(`"${name}" añadido y guardado en la lista local.`, 'success');
    this.closeAddItemModal();
  }

  openManageModal(role) {
    this.activeManageRole = role;
    const modal = document.getElementById('managePersonnelModal');
    const title = document.getElementById('manageRoleTitle');

    const roleTitles = {
      cuadro: 'Gestionar Lista de Cuadros',
      configuracion: 'Gestionar Configuraciones de Máquina',
      montador: 'Gestionar Lista de Montadores',
      electricista: 'Gestionar Lista de Electricistas',
      sondaCo2: 'Gestionar Tipos de Sonda CO₂'
    };

    if (title) title.innerText = roleTitles[role] || `Gestionar ${role}`;

    this.renderManageList();
    if (modal) modal.classList.remove('hidden');
  }

  renderManageList() {
    const listContainer = document.getElementById('managePersonnelList');
    if (!listContainer || !this.activeManageRole) return;

    const list = PersonnelStorage.getList(this.activeManageRole);
    listContainer.innerHTML = '';

    if (list.length === 0) {
      listContainer.innerHTML = '<p class="text-sm text-slate-500 py-3 text-center">No hay elementos registrados en esta lista.</p>';
      return;
    }

    list.forEach((name) => {
      const item = document.createElement('div');
      item.className = 'flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200';
      item.innerHTML = `
        <span class="managed-item-name text-sm font-medium text-slate-800"></span>
        <button class="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition" title="Eliminar elemento">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      `;

      item.querySelector('.managed-item-name').textContent = name;
      item.querySelector('button').addEventListener('click', () => {
        if (confirm(`¿Eliminar "${name}" de la lista local?`)) {
          PersonnelStorage.removeName(this.activeManageRole, name);
          this.renderManageList();
          this.renderDropdowns();
          this.showToast(`"${name}" eliminado de la lista.`, 'info');
        }
      });

      listContainer.appendChild(item);
    });
  }

  closeManageModal() {
    const modal = document.getElementById('managePersonnelModal');
    if (modal) modal.classList.add('hidden');
    this.activeManageRole = null;
  }

  // ----------------------------------------------------
  // PHOTOGRAPHIC EVIDENCE (COMPLETELY OPTIONAL)
  // ----------------------------------------------------
  async handlePhotoUpload(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    this.showToast(`Comprimiendo ${files.length} fotografía(s)...`, 'info');

    let added = 0;
    for (const file of files) {
      try {
        const compressed = await ImageCompressor.compress(file, {
          maxWidth: 1280,
          maxHeight: 1280,
          quality: 0.78
        });

        const caption = `Evidencia de Ensayo ${this.photos.length + 1}`;
        this.photos.push({
          dataUrl: compressed.dataUrl,
          sizeKb: compressed.sizeKb,
          caption,
          timestamp: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
        });
        added++;
      } catch (err) {
        console.error('Error al comprimir foto:', err);
        this.showToast(`No se pudo adjuntar ${file.name || 'la fotografía'}: ${err.message}`, 'error');
      }
    }

    if (added) this.showToast(`${added} fotografía(s) adjuntadas.`, 'success');
    this.renderPhotoGallery();
    this.updatePhotoCounter();
    event.target.value = '';
  }

  renderPhotoGallery() {
    const gallery = document.getElementById('photoGalleryContainer');
    if (!gallery) return;

    gallery.innerHTML = '';

    this.photos.forEach((photo, idx) => {
      const card = document.createElement('div');
      card.className = 'relative group rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm';
      card.innerHTML = `
        <div class="aspect-video w-full bg-slate-100 overflow-hidden relative">
          <img src="${photo.dataUrl}" alt="${photo.caption}" class="w-full h-full object-cover">
          <span class="badge-step">Foto ${idx + 1}</span>
          <span class="absolute top-2 right-2 bg-slate-900/70 text-white text-[10px] px-2 py-0.5 rounded-full font-mono">
            ${photo.sizeKb} KB
          </span>
        </div>
        <div class="p-2.5 flex items-center justify-between gap-2">
          <input type="text" class="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded px-2 py-1 w-full focus:outline-none focus:border-sky-500" value="">
          <button class="btn-delete-photo text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 flex-shrink-0" title="Eliminar foto">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      `;

      card.querySelector('input').value = photo.caption;
      card.querySelector('input').addEventListener('change', (e) => {
        this.photos[idx].caption = e.target.value.trim() || `Evidencia ${idx + 1}`;
      });

      card.querySelector('.btn-delete-photo').addEventListener('click', () => {
        this.photos.splice(idx, 1);
        this.renderPhotoGallery();
        this.updatePhotoCounter();
      });

      gallery.appendChild(card);
    });
  }

  updatePhotoCounter() {
    const badge = document.getElementById('photoCounterBadge');
    const count = this.photos.length;

    if (badge) {
      badge.innerText = `${count} ${count === 1 ? 'foto' : 'fotos'} (Opcional)`;
      if (count > 0) {
        badge.className = 'text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300';
      } else {
        badge.className = 'text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-300';
      }
    }
  }

  // ----------------------------------------------------
  // COLLECT FORM DATA & VALIDATE
  // ----------------------------------------------------
  getFormData() {
    const cuadro = (document.getElementById('selectCuadro')?.value || '').trim();
    const configuracion = (document.getElementById('selectConfiguracion')?.value || '').trim();
    const orderNumber = (document.getElementById('orderNumberInput')?.value || '').trim();
    const model = (document.getElementById('modelInput')?.value || '').trim();
    const serialNumber = (document.getElementById('serialInput')?.value || '').trim();
    const fabricationDate = (document.getElementById('fabDateInput')?.value || '').trim();

    const checkpoints = {
      presostatos: !!document.getElementById('cpPresostatos')?.checked,
      ventImpulsion: !!document.getElementById('cpVentImpulsion')?.checked,
      ventRetorno: !!document.getElementById('cpVentRetorno')?.checked,
      tempImpulsion: !!document.getElementById('cpTempImpulsion')?.checked,
      tempRetorno: !!document.getElementById('cpTempRetorno')?.checked,
    };

    const hasSondaCo2 = !!document.getElementById('chkSondaCo2')?.checked;
    const workingSondaCo2 = hasSondaCo2 && !!document.getElementById('chkSondaCo2Ok')?.checked;

    const hasMando = !!document.getElementById('chkMando')?.checked;
    const workingMando = hasMando && !!document.getElementById('chkMandoOk')?.checked;

    const personnel = {
      montador: document.getElementById('selectMontador')?.value || '',
      electricista: document.getElementById('selectElectricista')?.value || '',
    };

    return {
      orderNumber,
      cuadro,
      configuracion,
      model,
      serialNumber,
      fabricationDate,
      checkpoints,
      optionals: {
        sondaCo2: { has: hasSondaCo2, working: workingSondaCo2,
          type: hasSondaCo2 ? (document.getElementById('selectSondaCo2')?.value || '') : '' },
        mandoSuperficie: { has: hasMando, working: workingMando }
      },
      personnel,
      photos: this.photos
    };
  }

  validateForm(data) {
    if (!data.orderNumber) {
      this.showToast('Indica el Número de Pedido antes de generar el PDF.', 'error');
      document.getElementById('orderNumberInput')?.focus();
      return false;
    }
    if (data.optionals.sondaCo2.has && !data.optionals.sondaCo2.type) {
      this.showToast('Selecciona el tipo de sonda CO₂ o añádelo a la lista.', 'error');
      document.getElementById('selectSondaCo2')?.focus();
      return false;
    }
    if (!data.serialNumber) {
      this.showToast('El Número de Serie es obligatorio (ingréselo o léalo por OCR).', 'error');
      document.getElementById('serialInput')?.focus();
      return false;
    }

    if (!data.model) {
      this.showToast('El Modelo de la máquina es obligatorio.', 'error');
      document.getElementById('modelInput')?.focus();
      return false;
    }

    // REMOVIDA RESTRICCIÓN DE FOTOS (CAMBIO 2): Se permite 0, 1, 2, 3 o más fotos
    return true;
  }

  // ----------------------------------------------------
  // MAIN SAVE & REPORT GENERATION: "Guardar Ficha"
  // ----------------------------------------------------
  async saveAndGenerateReport() {
    const data = this.getFormData();
    if (!this.validateForm(data)) return;

    const btnSave = document.getElementById('btnSaveReport');
    const originalText = btnSave.innerHTML;
    btnSave.disabled = true;
    btnSave.innerHTML = `
      <svg class="w-5 h-5 animate-spin-fast mr-2 inline" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
      </svg>
      Verificando datos y generando PDF...
    `;

    try {
      // 1. Generate PDF
      const result = await PDFGenerator.generateReport(data);
      this.currentPdfBlob = result.blob;
      this.pdfSaved = false;
      this.generatedData = JSON.parse(JSON.stringify({ ...data, photos: [] }));
      this.currentPdfFileName = result.fileName;
      this.currentPdfSizeBytes = result.sizeBytes || result.blob.size;

      // 2. Save record to local history
      PersonnelStorage.saveReportToHistory({
        serialNumber: data.serialNumber,
        orderNumber: data.orderNumber,
        model: data.model,
        cuadro: data.cuadro,
        configuracion: data.configuracion,
        date: data.fabricationDate,
        montador: data.personnel.montador,
        electricista: data.personnel.electricista,
        checkpointsOk: Object.values(data.checkpoints).every(Boolean),
        photosCount: data.photos.length
      });

      // 3. Open UI modal with verified state
      this.openShareModal(data, result.fileName, this.currentPdfSizeBytes);
      this.showToast('Ficha generada correctamente. Lista para guardar o compartir.', 'success');

    } catch (err) {
      console.error('Error al generar PDF:', err);
      this.showToast('Error al generar el documento PDF: ' + err.message, 'error');
    } finally {
      btnSave.disabled = false;
      btnSave.innerHTML = originalText;
    }
  }

  openShareModal(data, fileName, sizeBytes) {
    const modal = document.getElementById('shareModal');
    const labelFileName = document.getElementById('shareModalFileName');
    const labelSerial = document.getElementById('shareModalSerial');
    const labelSize = document.getElementById('shareModalFileSize');

    if (labelFileName) labelFileName.innerText = fileName;
    if (labelSerial) labelSerial.innerText = `Pedido: ${data.orderNumber} | Nº Serie: ${data.serialNumber}`;
    if (labelSize) labelSize.innerText = `${Math.round(sizeBytes / 1024)} KB`;

    if (modal) modal.classList.remove('hidden');
  }

  closeShareModal() {
    const modal = document.getElementById('shareModal');
    if (modal) modal.classList.add('hidden');
  }

  // ----------------------------------------------------
  // POST-GENERATION BUTTON ACTIONS (CAMBIO 5, 6 Y 7)
  // ----------------------------------------------------
  // 1. GUARDAR PDF (File System Access / Direct Download)
  async handleSavePdf() {
    if (!this.currentPdfBlob) {
      this.showToast('No hay ningún PDF generado.', 'error');
      return;
    }

    this.showToast('Seleccionando ubicación de guardado...', 'info');
    const res = await ShareEngine.savePdf(this.currentPdfBlob, this.currentPdfFileName);

    if (res.cancelled) {
      this.showToast('Guardado cancelado por el usuario.', 'info');
    } else if (res.pending) {
      this.showToast(res.message || 'Guardado pendiente de confirmar.', 'info');
    } else if (res.success) {
      this.pdfSaved = true;
      this.showToast(res.message || 'PDF guardado con éxito.', 'success');
    } else {
      this.showToast(res.message || 'Error al guardar el archivo.', 'error');
    }
  }

  // 2. COMPARTIR PDF (Native file sharing)
  async handleSharePdf() {
    if (!this.currentPdfBlob) {
      this.showToast('No hay ningún PDF generado.', 'error');
      return;
    }

    const data = this.generatedData || this.getFormData();
    const res = await ShareEngine.sharePdfNative(this.currentPdfBlob, this.currentPdfFileName, data);

    if (res.cancelled) {
      this.showToast('Envío cancelado.', 'info');
    } else if (res.success) {
      this.showToast('Selector abierto. Confirma el envío desde la aplicación elegida.', 'info');
    } else {
      this.showToast(res.message || 'No fue posible abrir el selector de archivos. Usa Guardar PDF.', 'warning');
    }
  }

  // 3. WHATSAPP DIRECT SHARE
  async handleWhatsAppShare() {
    if (!this.currentPdfBlob) {
      this.showToast('Primero genera una ficha PDF.', 'error');
      return;
    }
    const res = await ShareEngine.sharePdfWhatsApp(
      this.currentPdfBlob, this.currentPdfFileName, this.generatedData || this.getFormData());
    this.showToast(res.message || (res.pending ? 'WhatsApp está abriéndose con el PDF.' :
      'Selecciona WhatsApp para compartir el PDF.'), (res.pending || res.success) ? 'info' : 'warning');
  }

  // 4. GMAIL DIRECT SHARE
  async handleGmailShare() {
    if (!this.currentPdfBlob) return;
    const res = await ShareEngine.sharePdfNative(this.currentPdfBlob, this.currentPdfFileName, this.generatedData || this.getFormData());
    this.showToast(res.success ? 'Selecciona Gmail en el menú para adjuntar el PDF.' :
      (res.message || 'No se pudo adjuntar automáticamente. Guarda el PDF y compártelo manualmente.'), res.success ? 'info' : 'warning');
  }

  // 5. FINALIZAR PROCESO
  handleFinalizeProcess() {
    this.clearFormAfterConfirm(true);
  }

  clearFormAfterConfirm(fromReport = false) {
    const note = this.currentPdfBlob && !this.pdfSaved ?
      'El PDF generado no consta como guardado. Guárdalo antes de comenzar otra máquina si necesitas conservarlo.\n\n' : '';
    if (!window.confirm(note + '¿Borrar todos los datos y fotografías de esta máquina? Las listas de operarios, cuadros y sondas se conservarán.')) return;
    ['orderNumberInput','serialInput','modelInput','fabDateInput'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    ['selectCuadro','selectConfiguracion','selectMontador','selectElectricista','selectSondaCo2'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    document.querySelectorAll('#viewElectricityScreen input[type=checkbox]').forEach(el => { el.checked = false; });
    ['photoCameraInput','photoGalleryInput','plateFileInput'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    this.photos = [];
    this.renderPhotoGallery();
    this.updatePhotoCounter();
    this.updateCheckpointStatuses();
    document.getElementById('subSondaCo2Container')?.classList.add('hidden');
    document.getElementById('subMandoContainer')?.classList.add('hidden');
    const plate = document.getElementById('platePreviewImg'); if (plate) plate.removeAttribute('src');
    document.getElementById('platePreviewContainer')?.classList.add('hidden');
    document.getElementById('ocrStatusContainer')?.classList.add('hidden');
    this.currentPdfBlob = null;
    this.currentPdfFileName = '';
    this.currentPdfSizeBytes = 0;
    this.generatedData = null;
    this.pdfSaved = false;
    this.closeShareModal();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.showToast('Ficha limpia. Lista para una nueva máquina.', 'success');
  }

  // ----------------------------------------------------
  // TOAST NOTIFICATIONS
  // ----------------------------------------------------
  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    const colors = {
      success: 'bg-emerald-600 text-white',
      error: 'bg-red-600 text-white',
      warning: 'bg-amber-500 text-slate-900',
      info: 'bg-slate-900 text-white'
    };

    toast.className = `flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-xs sm:text-sm font-semibold transition-all transform duration-300 translate-y-2 opacity-0 ${colors[type] || colors.info}`;
    const messageSpan = document.createElement('span');
    messageSpan.textContent = message;
    toast.appendChild(messageSpan);

    container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.remove('translate-y-2', 'opacity-0');
    });

    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-2');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
}

// Start app on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new AppController();
  app.init();
  window.__QC_APP__ = app;
});
