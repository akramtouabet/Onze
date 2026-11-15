// Onze — synchronisation des données avec le compte connecté à Chrome (chrome.storage.sync).
// Aucune configuration : les données suivent le profil Chrome, comme les réglages.
// Chaque donnée (tâches, notes…) est découpée en morceaux, car Chrome limite chaque entrée
// à 8 Ko et l'ensemble à 100 Ko. Fusion : la version modifiée le plus récemment l'emporte.
import { store, SYNC_KEYS, onSettings, touches } from './storage.js';
import { $, debounce, toast } from './utils.js';
import { t } from './i18n.js';
import { reloadSoon } from './cloud.js';

const available = !!globalThis.chrome?.storage?.sync && !!globalThis.chrome?.runtime?.id;
const CHUNK = 2500; // caractères par morceau : reste sous 8 Ko même avec des accents
const QUOTA_KB = 100;

const metaKey = (key) => `d.${key}`;
const chunkKey = (key, i) => `d.${key}.${i}`;
const range = (from, to) => Array.from({ length: Math.max(0, to - from) }, (_, i) => from + i);

let busy = false;
let again = false;
let state = 'idle'; // idle | busy | full | error
let lastSync = 0;

function split(json) {
  const parts = [];
  for (let i = 0; i < json.length;) {
    let end = Math.min(json.length, i + CHUNK);
    const code = json.charCodeAt(end - 1);
    if (end < json.length && code >= 0xd800 && code <= 0xdbff) end--; // ne coupe pas un émoji en deux
    parts.push(json.slice(i, end));
    i = end;
  }
  return parts.length ? parts : [''];
}

async function push(key, value, time, previous) {
  const parts = split(JSON.stringify(value));
  const items = { [metaKey(key)]: { t: time, n: parts.length } };
  parts.forEach((part, i) => { items[chunkKey(key, i)] = part; });
  await chrome.storage.sync.set(items);
  if (previous?.n > parts.length) await chrome.storage.sync.remove(range(parts.length, previous.n).map((i) => chunkKey(key, i)));
}

async function pull(key, remote) {
  const keys = range(0, remote.n).map((i) => chunkKey(key, i));
  const parts = await chrome.storage.sync.get(keys);
  if (keys.some((k) => typeof parts[k] !== 'string')) throw new Error('incomplete');
  return JSON.parse(keys.map((k) => parts[k]).join(''));
}

export async function sync({ manual = false } = {}) {
  if (!available || !store.settings.chromeSync) return;
  if (busy) { again = true; return; }
  busy = true;
  state = 'busy';
  render();
  try {
    const remotes = await chrome.storage.sync.get(SYNC_KEYS.map(metaKey));
    const meta = { ...store.syncMeta() };
    const pulled = [];
    for (const key of SYNC_KEYS) {
      const value = await store.get(key);
      // Donnée locale jamais horodatée : envoyée seulement si le compte n'en a pas.
      const localTime = meta[key] || (value !== undefined ? 1 : 0);
      const remote = remotes[metaKey(key)];
      const remoteTime = remote?.t || 0;
      if (remoteTime > localTime) {
        await store.set(key, await pull(key, remote), { silent: true });
        meta[key] = remoteTime;
        pulled.push(key);
      } else if (localTime > remoteTime && value !== undefined) {
        await push(key, value, localTime, remote);
        meta[key] = localTime;
      }
    }
    // Conserve les horodatages des modifications faites pendant la synchronisation.
    const latest = store.syncMeta();
    for (const key of Object.keys(latest)) meta[key] = Math.max(meta[key] || 0, latest[key] || 0);
    await store.setSyncMeta(meta);

    state = 'idle';
    lastSync = Date.now();
    if (pulled.length) reloadSoon(t('Données mises à jour depuis votre compte Chrome.'));
    else if (manual) toast(t('Synchronisation terminée.'));
  } catch (e) {
    console.warn('Onze : synchronisation Chrome impossible', e);
    state = /quota/i.test(e?.message || '') ? 'full' : 'error';
    if (manual) toast(t(state === 'full' ? 'Espace de synchronisation Chrome plein (100 Ko).' : 'Synchronisation impossible pour le moment.'), 5000);
  } finally {
    busy = false;
    render();
    if (again) { again = false; sync(); }
  }
}

async function render() {
  const status = $('#csync-status');
  if (!status) return;
  $('#csync-now').disabled = !available || !store.settings.chromeSync || busy;
  if (!available) { status.textContent = t('Disponible une fois l\'extension installée dans Chrome.'); return; }
  if (!store.settings.chromeSync) { status.textContent = t('Synchronisation désactivée : vos données restent sur cet appareil.'); return; }
  if (state === 'busy') { status.textContent = t('Synchronisation…'); return; }
  if (state === 'full') { status.textContent = t('Espace de synchronisation Chrome plein (100 Ko). Allégez vos notes, ou utilisez Google Drive ci-dessous.'); return; }
  if (state === 'error') { status.textContent = t('Synchronisation impossible pour le moment.'); return; }
  const used = Math.max(1, Math.round((await chrome.storage.sync.getBytesInUse(null)) / 1024));
  status.textContent = t(lastSync ? 'Synchronisé avec votre compte Chrome · {used} Ko sur {max} Ko' : 'En attente · {used} Ko sur {max} Ko', { used, max: QUOTA_KB });
}

export async function init() {
  $('#csync-now').addEventListener('click', () => sync({ manual: true }));
  $('#settings').addEventListener('panel:open', render);
  onSettings((path) => { if (touches(path, 'chromeSync')) { render(); sync(); } });
  render();
  if (!available) return;

  const later = debounce(() => sync(), 3000);
  document.addEventListener('data-changed', later);
  // Changement venu d'un autre appareil.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && Object.keys(changes).some((k) => k.startsWith('d.'))) later();
  });
  setTimeout(sync, 1200);
}
