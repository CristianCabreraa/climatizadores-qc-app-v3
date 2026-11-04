/**
 * Local Storage Manager for GreenAir QC V2
 * Manages dynamic rosters for:
 * - Cuadro (Tipo de cuadro eléctrico: GISER, etc.)
 * - Configuración de la Máquina (Configuraciones técnicas)
 * - Montadores (Armado de máquina)
 * - Electricistas (Cableado y pruebas)
 * with persistence, add, and delete capabilities.
 */

const STORAGE_KEYS = {
  CUADROS: 'qc_cuadros',
  LEGACY_FABRICANTES: 'qc_fabricantes',
  CONFIGURACIONES: 'qc_configuraciones',
  SONDAS_CO2: 'qc_sondas_co2',
  MONTADORES: 'qc_montadores',
  ELECTRICISTAS: 'qc_electricistas',
  LAST_DRAFT: 'qc_last_draft',
  SAVED_REPORTS: 'qc_saved_reports_history'
};

const DEFAULT_DATA = {
  cuadros: ['GISER 440v', 'GISER 230v', 'GISER 230v pequeño', 'Element 230v', 'Element 440v', 'Avanz 230v', 'Avanz 440v', 'Toshiba 230v', 'Toshiba 440v'],
  sondasCo2: ['Sonda Co2', 'Sonda Co2 de Ambiente',],
  configuraciones: ['AV', 'AH', 'BH'], // Initial clean base; user loads custom configurations
  montadores: ['PAULO', 'BRENO', 'LEANDRO', 'MATEUS', 'JHOYNER', 'TIZIANO', 'RAFAEL', 'YURI', 'TIZIANO', 'GERARDO'],
  electricistas: ['JOSE', 'CRISTIAN']
};

export const PersonnelStorage = {
  /**
   * Initializes local lists with defaults or migrates legacy keys if needed
   */
  init() {
    // 1. Cuadros (support migration from legacy fabricantes if present)
    if (!localStorage.getItem(STORAGE_KEYS.CUADROS)) {
      const legacy = localStorage.getItem(STORAGE_KEYS.LEGACY_FABRICANTES);
      if (legacy) {
        localStorage.setItem(STORAGE_KEYS.CUADROS, legacy);
      } else {
        localStorage.setItem(STORAGE_KEYS.CUADROS, JSON.stringify(DEFAULT_DATA.cuadros));
      }
    }

    // 2. Configuraciones de la Máquina (independent technical list)
    if (!localStorage.getItem(STORAGE_KEYS.CONFIGURACIONES)) {
      localStorage.setItem(STORAGE_KEYS.CONFIGURACIONES, JSON.stringify(DEFAULT_DATA.configuraciones));
    }

    if (!localStorage.getItem(STORAGE_KEYS.SONDAS_CO2)) {
      localStorage.setItem(STORAGE_KEYS.SONDAS_CO2, JSON.stringify(DEFAULT_DATA.sondasCo2));
    }

    // 3. Montadores
    if (!localStorage.getItem(STORAGE_KEYS.MONTADORES)) {
      localStorage.setItem(STORAGE_KEYS.MONTADORES, JSON.stringify(DEFAULT_DATA.montadores));
    }

    // 4. Electricistas
    if (!localStorage.getItem(STORAGE_KEYS.ELECTRICISTAS)) {
      localStorage.setItem(STORAGE_KEYS.ELECTRICISTAS, JSON.stringify(DEFAULT_DATA.electricistas));
    }
  },

  /**
   * Get list by category: 'cuadro' | 'fabricante' | 'configuracion' | 'montador' | 'electricista'
   */
  getList(role) {
    this.init();
    let key;
    switch (role) {
      case 'cuadro':
      case 'fabricante':
        key = STORAGE_KEYS.CUADROS;
        break;
      case 'configuracion':
      case 'configuraciones':
        key = STORAGE_KEYS.CONFIGURACIONES;
        break;
      case 'sondaCo2':
        key = STORAGE_KEYS.SONDAS_CO2;
        break;
      case 'montador':
        key = STORAGE_KEYS.MONTADORES;
        break;
      case 'electricista':
        key = STORAGE_KEYS.ELECTRICISTAS;
        break;
      default:
        return [];
    }

    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Error al leer de localStorage:', e);
      return [];
    }
  },

  /**
   * Adds a new item/name to the given category
   */
  addName(role, rawName) {
    const name = rawName ? rawName.trim() : '';
    if (!name) return false;

    const list = this.getList(role);
    if (!list.includes(name)) {
      list.push(name);
      list.sort((a, b) => a.localeCompare(b));
      this.saveList(role, list);
      return true;
    }
    return false;
  },

  /**
   * Removes an item/name from the given category
   */
  removeName(role, name) {
    const list = this.getList(role);
    const updated = list.filter(item => item !== name);
    this.saveList(role, updated);
    return true;
  },

  /**
   * Persists list to localStorage
   */
  saveList(role, list) {
    let key;
    switch (role) {
      case 'cuadro':
      case 'fabricante':
        key = STORAGE_KEYS.CUADROS;
        break;
      case 'configuracion':
      case 'configuraciones':
        key = STORAGE_KEYS.CONFIGURACIONES;
        break;
      case 'sondaCo2':
        key = STORAGE_KEYS.SONDAS_CO2;
        break;
      case 'montador':
        key = STORAGE_KEYS.MONTADORES;
        break;
      case 'electricista':
        key = STORAGE_KEYS.ELECTRICISTAS;
        break;
      default:
        return;
    }
    localStorage.setItem(key, JSON.stringify(list));
  },

  /**
   * Saves a completed test record into history
   */
  saveReportToHistory(report) {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SAVED_REPORTS);
      const history = raw ? JSON.parse(raw) : [];
      const summary = {
        serialNumber: report.serialNumber,
        model: report.model,
        cuadro: report.cuadro || report.fabricante || 'GISER',
        configuracion: report.configuracion || 'Estándar',
        date: report.date || new Date().toISOString().split('T')[0],
        timestamp: new Date().toISOString(),
        montador: report.montador,
        electricista: report.electricista,
        allCheckpointsOk: report.checkpointsOk,
        photosCount: report.photosCount || 0
      };
      history.unshift(summary);
      if (history.length > 50) history.pop();
      localStorage.setItem(STORAGE_KEYS.SAVED_REPORTS, JSON.stringify(history));
    } catch (e) {
      console.warn('No se pudo guardar historial:', e);
    }
  }
};
