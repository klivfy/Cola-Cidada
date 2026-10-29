// Estado da aplicação — persistido apenas no navegador (localStorage).
import { safeUrl } from './urls.js';
const KEY = 'monitor-cidadao:v1';
const BACKUP_VERSION = 1;

const defaults = () => ({
  theme: 'system', // 'system' | 'light' | 'dark'
  politicians: [], // {id, source:'camara'|'manual', camaraId?, name, party, uf, role, photo?, mandateEnd}
  prefs: { plenario: true, rollcall: true, expenses: true, bills: true },
  alerts: [], // {id, ts, politicianId, text}
  domicile: { state: 'SP', city: 'São Paulo' },
  onboardingDone: false,
  auditCount: 0,
});

const listeners = new Set();
const isRecord = (value) => value && typeof value === 'object' && !Array.isArray(value);

function normalize(value, legacy = false) {
  if (!isRecord(value)) throw new Error('Formato de backup inválido');
  if (value.politicians != null && (!Array.isArray(value.politicians) || value.politicians.length > 5000)) throw new Error('Lista de políticos inválida');
  if (value.alerts != null && (!Array.isArray(value.alerts) || value.alerts.length > 5000)) throw new Error('Lista de alertas inválida');
  const politicians = value.politicians ?? [];
  const alerts = value.alerts ?? [];
  for (const p of politicians) {
    if (!isRecord(p) || typeof p.id !== 'string' || typeof p.name !== 'string') throw new Error('Político inválido');
    for (const key of ['photo', 'url', 'pageUrl', 'tseUrl', 'receiptUrl']) {
      if (p[key] != null && !safeUrl(p[key])) {
        if (legacy) delete p[key];
        else throw new Error('URL inválida');
      }
    }
  }
  if (alerts.some((a) => !isRecord(a) || typeof a.id !== 'string' || typeof a.text !== 'string' || (a.url != null && !safeUrl(a.url)))) throw new Error('Alerta inválido');
  if (value.prefs != null && (!isRecord(value.prefs) || Object.values(value.prefs).some((v) => typeof v !== 'boolean'))) throw new Error('Preferências inválidas');
  if (value.domicile != null && (!isRecord(value.domicile) || typeof value.domicile.state !== 'string' || typeof value.domicile.city !== 'string')) throw new Error('Domicílio inválido');
  if (value.theme != null && !['system', 'light', 'dark'].includes(value.theme)) throw new Error('Tema inválido');
  return { ...defaults(), ...value, politicians, alerts, prefs: { ...defaults().prefs, ...value.prefs } };
}

function parseBackup(jsonString) {
  if (typeof jsonString !== 'string' || jsonString.length > 5_000_000) throw new Error('Backup muito grande');
  const parsed = JSON.parse(jsonString);
  if (parsed?.schemaVersion != null && parsed.schemaVersion !== BACKUP_VERSION) throw new Error('Versão de backup incompatível');
  if (!isRecord(parsed) || !Array.isArray(parsed.politicians) ||
      (Object.hasOwn(parsed, 'alerts') && parsed.alerts == null) ||
      (Object.hasOwn(parsed, 'prefs') && parsed.prefs == null)) throw new Error('Formato de backup inválido');
  return normalize(parsed);
}

function load() {
  try {
    return normalize(JSON.parse(localStorage.getItem(KEY) || '{}'), true);
  } catch {
    return defaults();
  }
}

let state = load();

function persist(next) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch (error) {
    window.dispatchEvent(new Event('cola:storage-error'));
    throw error;
  }
  state = next;
  listeners.forEach((fn) => fn(state));
}

export const store = {
  get: () => state,
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  set(patch) { persist({ ...state, ...patch }); },
  setOnboardingDone(val = true) {
    this.set({ onboardingDone: Boolean(val) });
  },
  incrementAuditCount() {
    this.set({ auditCount: (state.auditCount || 0) + 1 });
  },
  setDomicile(stateUf, city) {
    this.set({ domicile: { state: stateUf, city } });
  },
  addPolitician(p) {
    if (state.politicians.some((x) => x.id === p.id)) return false;
    this.set({ politicians: [...state.politicians, p] });
    return true;
  },
  removePolitician(id) {
    this.set({ politicians: state.politicians.filter((p) => p.id !== id) });
  },
  replacePolitician(id, p) {
    this.set({ politicians: state.politicians.map((x) => (x.id === id ? p : x)) });
  },
  setPref(k, v) { this.set({ prefs: { ...state.prefs, [k]: v } }); },
  addAlerts(list) {
    const known = new Set(state.alerts.map((a) => a.id));
    const fresh = list.filter((a) => !known.has(a.id));
    if (fresh.length) this.set({ alerts: [...fresh, ...state.alerts].slice(0, 200) });
    return fresh.length;
  },
  exportJson: () => JSON.stringify({ schemaVersion: BACKUP_VERSION, ...state }, null, 2),
  previewImport(jsonString) {
    try {
      const next = parseBackup(jsonString);
      return {
        version: next.schemaVersion || 'anterior',
        politicians: next.politicians.length,
        alerts: next.alerts.length,
        domicile: `${next.domicile.city} - ${next.domicile.state}`,
        theme: next.theme,
      };
    } catch {
      return null;
    }
  },
  importJson(jsonString) {
    try {
      persist(parseBackup(jsonString));
      return true;
    } catch {
      return false;
    }
  },
  purge() {
    localStorage.removeItem(KEY);
    state = defaults();
    listeners.forEach((fn) => fn(state));
  },
};
