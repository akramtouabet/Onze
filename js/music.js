// Onze — commande de la musique, commune au nouvel onglet et à la fenêtre de l'icône.
// Dans l'extension, la lecture est confiée au service worker (page cachée) : elle continue
// onglet fermé. Hors extension (page ouverte pour un essai), elle se fait dans la page.
import { store, onSettings, touches } from './storage.js';
import { TRACKS, DEFAULT_MUSIC_LEVEL } from './tracks.js';

const background = !!globalThis.chrome?.runtime?.id;
const send = (message) => chrome.runtime.sendMessage({ target: 'background', ...message }).catch(() => {});

let currentId = null;
let level = DEFAULT_MUSIC_LEVEL;
let lastError = 0;
let listener = () => {};
let local = null; // lecteur de repli : { id, audio }

const notify = (failedId = null) => listener({ id: currentId, failedId });

// ── Repli : lecture dans la page ──

const localVolume = () => level * store.settings.soundVolume;

function fade(audio, to, ms, then) {
  const from = audio.volume;
  const start = performance.now();
  clearInterval(audio.fadeTimer);
  audio.fadeTimer = setInterval(() => {
    const k = Math.min(1, (performance.now() - start) / ms);
    audio.volume = Math.max(0, Math.min(1, from + (to - from) * k));
    if (k === 1) { clearInterval(audio.fadeTimer); then?.(); }
  }, 40);
}

function localStop() {
  if (!local) return;
  const { audio } = local;
  local = null;
  fade(audio, 0, 500, () => { audio.pause(); audio.removeAttribute('src'); audio.load(); });
}

function localPlay(id) {
  localStop();
  const track = TRACKS[id];
  const audio = new Audio(track.url);
  audio.loop = !!track.loop;
  audio.volume = 0;
  const mine = local = { id, audio };
  const failed = () => {
    if (local !== mine) return;
    local = null;
    currentId = null;
    notify(id);
  };
  audio.addEventListener('error', failed);
  audio.play().then(() => { if (local === mine) fade(audio, localVolume(), 900); }, failed);
}

const localRefresh = () => { if (local) { clearInterval(local.audio.fadeTimer); local.audio.volume = localVolume(); } };

// ── Interface commune ──

export const music = {
  /** onChange({ id, failedId }) : appelé à chaque changement de lecture, d'où qu'il vienne. */
  async init(onChange) {
    listener = onChange;
    level = await store.get('musicLevel', DEFAULT_MUSIC_LEVEL);
    if (background) {
      await send({ cmd: 'check' });
      const apply = (state) => {
        const previous = currentId;
        currentId = state?.id || null;
        const failed = state?.error && state.error !== lastError;
        if (state?.error) lastError = state.error;
        notify(failed ? previous : null);
      };
      const state = await store.get('musicState', null);
      lastError = state?.error || 0;
      currentId = state?.id || null;
      store.watch('musicState', apply);
      store.watch('musicLevel', (value) => { if (typeof value === 'number') { level = value; notify(); } });
    } else {
      onSettings((path) => { if (touches(path, 'soundVolume')) localRefresh(); });
    }
    notify();
  },

  current: () => currentId,
  level: () => level,

  /** Lance une source, ou l'arrête si c'est déjà elle qui joue. */
  toggle(id) {
    const stopping = currentId === id;
    currentId = stopping ? null : id;
    if (background) send(stopping ? { cmd: 'stop' } : { cmd: 'play', id });
    else if (stopping) localStop(); else localPlay(id);
    notify();
  },

  stop() { if (currentId) this.toggle(currentId); },

  setLevel(value) {
    level = value;
    store.set('musicLevel', value);
    localRefresh();
  },
};
