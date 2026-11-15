// Onze — service worker.
// 1. Affiche la notification de fin de session Focus même si aucun nouvel onglet n'est ouvert.
// 2. Pilote la musique : elle est jouée par une page cachée (« offscreen »), ce qui la laisse
//    continuer quand l'onglet Onze est fermé. L'état est publié dans chrome.storage.local
//    (« musicState »), que le nouvel onglet et la fenêtre de l'icône observent.
import { TRACKS, DEFAULT_MUSIC_LEVEL, DEFAULT_VOLUME } from './js/tracks.js';

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'onze-pomodoro') return;
  const { pomodoroNotice: notice } = await chrome.storage.local.get('pomodoroNotice');
  if (!notice) return;
  chrome.notifications.create('onze-pomodoro-' + Date.now(), {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon128.png'),
    title: notice.title,
    message: notice.message,
  });
});

// ── Musique ──

const OFFSCREEN = 'offscreen.html';

async function volume() {
  const [{ settings }, { musicLevel }] = await Promise.all([
    chrome.storage.sync.get('settings'),
    chrome.storage.local.get('musicLevel'),
  ]);
  return (musicLevel ?? DEFAULT_MUSIC_LEVEL) * (settings?.soundVolume ?? DEFAULT_VOLUME);
}

const setState = (state) => chrome.storage.local.set({ musicState: state });
const toPlayer = (message) => chrome.runtime.sendMessage({ target: 'offscreen', ...message }).catch(() => {});

let creating = null;
let closeTimer;
async function ensurePlayer() {
  if (await chrome.offscreen.hasDocument()) return;
  creating ??= chrome.offscreen.createDocument({
    url: OFFSCREEN,
    reasons: ['AUDIO_PLAYBACK'],
    justification: 'Lire la musique choisie pendant que l\'onglet Onze est fermé.',
  }).finally(() => { creating = null; });
  await creating;
}

async function play(id) {
  const track = TRACKS[id];
  if (!track) return;
  closeTimer = clearTimeout(closeTimer);
  await ensurePlayer();
  await setState({ id });
  toPlayer({ cmd: 'play', url: track.url, loop: !!track.loop, volume: await volume() });
}

async function stop(error = false) {
  await setState({ id: null, ...(error ? { error: Date.now() } : {}) });
  if (!(await chrome.offscreen.hasDocument())) return;
  await toPlayer({ cmd: 'stop' });
  closeTimer = setTimeout(() => chrome.offscreen.closeDocument().catch(() => {}), 700); // laisse le fondu se terminer
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.target !== 'background') return;
  (async () => {
    if (message.cmd === 'play') await play(message.id);
    else if (message.cmd === 'stop') await stop();
    else if (message.cmd === 'failed') await stop(true);
    else if (message.cmd === 'check') {
      // Chrome ferme la page cachée après un silence prolongé : l'état affiché doit suivre.
      const { musicState } = await chrome.storage.local.get('musicState');
      if (musicState?.id && !(await chrome.offscreen.hasDocument())) await setState({ id: null });
    }
    respond(true);
  })();
  return true; // réponse asynchrone
});

chrome.storage.onChanged.addListener(async (changes, area) => {
  const touched = (area === 'sync' && changes.settings) || (area === 'local' && changes.musicLevel);
  if (touched && (await chrome.offscreen.hasDocument())) toPlayer({ cmd: 'volume', volume: await volume() });
});
