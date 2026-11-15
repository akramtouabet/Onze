// Onze — stockage.
// Réglages : chrome.storage.sync (suivent le profil Chrome d'un appareil à l'autre).
// Données   : chrome.storage.local (tâches, notes, habitudes, cache…).
// Hors extension (page ouverte dans un simple onglet pour un essai), repli sur localStorage.

const hasChrome = typeof chrome !== 'undefined' && !!chrome.storage?.local;

function area(name) {
  if (hasChrome) {
    const store = chrome.storage[name];
    return {
      get: (key) => store.get(key).then((r) => r[key]),
      set: (key, value) => store.set({ [key]: value }),
      remove: (key) => store.remove(key),
      all: () => store.get(null),
      clear: () => store.clear(),
    };
  }
  const prefix = `onze:${name}:`;
  const keys = () => Object.keys(localStorage).filter((k) => k.startsWith(prefix));
  return {
    get: async (key) => { const v = localStorage.getItem(prefix + key); return v == null ? undefined : JSON.parse(v); },
    set: async (key, value) => localStorage.setItem(prefix + key, JSON.stringify(value)),
    remove: async (key) => localStorage.removeItem(prefix + key),
    all: async () => Object.fromEntries(keys().map((k) => [k.slice(prefix.length), JSON.parse(localStorage.getItem(k))])),
    clear: async () => keys().forEach((k) => localStorage.removeItem(k)),
  };
}

const sync = area('sync');
const local = area('local');

/** Données envoyées vers le compte Google quand la synchronisation est active. */
export const SYNC_KEYS = ['todos', 'links', 'notes', 'habits', 'countdowns', 'worldClocks', 'quotes', 'mantras', 'focus', 'photoFavs', 'photoBanned', 'weatherCities'];
/** Clés propres à l'appareil : jamais exportées ni synchronisées. */
const PRIVATE_KEYS = ['cloudAuth', 'syncMeta', 'pomodoroNotice', 'musicState', 'timerNotice', 'popupTimer', 'popupStopwatch', 'popupTimeMode', 'popupSection'];

export const DEFAULTS = {
  name: '',
  onboarded: false,
  show: {
    clock: true, greeting: true, focus: true, quote: true, weather: true, todo: true, links: true,
    search: true, searchbar: false, pomodoro: true, sounds: true, notes: true, habits: true,
    worldclocks: true, countdowns: true, mantra: false, credit: true,
  },
  clock24: true,
  clockSeconds: false,
  clockSize: 'l',
  clockWeight: '600',
  searchEngine: 'google',
  tempUnit: 'c',
  unsplashKey: '',
  photoSource: 'online',
  photoFrequency: 'day',
  photoThemes: ['nature', 'montagne', 'mer'],
  font: 'inter',
  accent: '#f4a259',
  panelTheme: 'dark',
  quoteFavsOnly: false,
  pomodoro: { work: 25, short: 5, long: 15, cycles: 4, hideWidgets: true, notify: true },
  balance: { enabled: false, start: '09:00', end: '18:00', days: ['1', '2', '3', '4', '5'] },
  countdownsOnMain: false,
  soundVolume: 0.6,
  googleClientId: '',
  cloudAuto: true,
  chromeSync: true,
  lang: '',
};

/** Identifiants de sauvegarde acceptés à l'import (le second date d'avant le changement de nom). */
export const BACKUP_APPS = ['onze', 'au' + 'rore'];

const isObject = (v) => v && typeof v === 'object' && !Array.isArray(v);

function merge(base, over) {
  const out = { ...base };
  if (!isObject(over)) return out;
  for (const key of Object.keys(over)) {
    out[key] = isObject(base[key]) && isObject(over[key]) ? merge(base[key], over[key]) : over[key];
  }
  return out;
}

/** Langue choisie, ou à défaut celle du navigateur (français ou anglais). */
function resolveLang(value) {
  if (value === 'fr' || value === 'en') return value;
  return (globalThis.navigator?.language || 'fr').toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

let saveTimer = null;
let meta = {};

export const store = {
  settings: merge(DEFAULTS, {}),

  async init() {
    this.settings = merge(DEFAULTS, await sync.get('settings'));
    this.settings.lang = resolveLang(this.settings.lang);
    meta = (await local.get('syncMeta')) || {};

    if (hasChrome) {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'sync' && changes.settings) {
          const incoming = merge(DEFAULTS, changes.settings.newValue);
          incoming.lang = resolveLang(incoming.lang);
          if (JSON.stringify(incoming) === JSON.stringify(this.settings)) return; // notre propre écriture
          this.settings = incoming;
          emitSettings('*');
        }
        if (areaName === 'local') {
          for (const [key, change] of Object.entries(changes)) {
            document.dispatchEvent(new CustomEvent('local:' + key, { detail: change.newValue }));
          }
        }
      });
    }
    addEventListener('pagehide', () => this.flush());
  },

  /** Lit un réglage par chemin : « show.clock », « pomodoro.work »… */
  getPath(path) {
    return path.split('.').reduce((obj, key) => obj?.[key], this.settings);
  },

  setPath(path, value) {
    const keys = path.split('.');
    const last = keys.pop();
    const target = keys.reduce((obj, key) => (obj[key] ??= {}), this.settings);
    if (JSON.stringify(target[last]) === JSON.stringify(value)) return;
    target[last] = value;
    emitSettings(path);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => this.flush(), 500); // regroupe les écritures (quota de chrome.storage.sync)
  },

  flush() {
    if (saveTimer == null) return;
    clearTimeout(saveTimer);
    saveTimer = null;
    sync.set('settings', this.settings).catch((e) => console.warn('Onze : réglages non enregistrés', e));
  },

  async get(key, fallback) {
    const value = await local.get(key);
    return value === undefined ? fallback : value;
  },

  /** Enregistre une donnée. silent : sans marquer la donnée comme modifiée pour la synchro Google. */
  async set(key, value, { silent = false } = {}) {
    await local.set(key, value);
    if (!silent && SYNC_KEYS.includes(key)) {
      meta[key] = Date.now();
      local.set('syncMeta', meta);
      document.dispatchEvent(new CustomEvent('data-changed', { detail: { key } }));
    }
  },

  remove: (key) => local.remove(key),

  /** Suit les changements d'une donnée faits depuis un autre onglet. */
  watch(key, callback) {
    document.addEventListener('local:' + key, (e) => callback(e.detail));
  },

  syncMeta: () => meta,
  async setSyncMeta(next) { meta = next; await local.set('syncMeta', meta); },

  /** Tout ce qui est exportable : réglages + données (hors clés propres à l'appareil). */
  async exportAll() {
    const data = await local.all();
    for (const key of PRIVATE_KEYS) delete data[key];
    return { app: 'onze', version: 1, exportedAt: new Date().toISOString(), settings: this.settings, data };
  },

  async importAll(backup) {
    if (!BACKUP_APPS.includes(backup?.app) || !isObject(backup.data)) throw new Error('Fichier non reconnu');
    this.settings = merge(DEFAULTS, backup.settings);
    await sync.set('settings', this.settings);
    const now = Date.now();
    for (const [key, value] of Object.entries(backup.data)) {
      if (PRIVATE_KEYS.includes(key)) continue;
      await local.set(key, value);
      if (SYNC_KEYS.includes(key)) meta[key] = now;
    }
    await local.set('syncMeta', meta);
  },

  async resetAll() {
    clearTimeout(saveTimer);
    saveTimer = null;
    await Promise.all([sync.clear(), local.clear()]);
  },
};

function emitSettings(path) {
  document.dispatchEvent(new CustomEvent('settings', { detail: { path } }));
}

/** Réagit aux changements de réglages. Le chemin vaut « * » pour un changement global. */
export function onSettings(callback) {
  document.addEventListener('settings', (e) => callback(e.detail.path));
}

/** Vrai si le chemin modifié concerne l'un des préfixes donnés. */
export function touches(path, ...prefixes) {
  return path === '*' || prefixes.some((p) => path === p || path.startsWith(p + '.'));
}
