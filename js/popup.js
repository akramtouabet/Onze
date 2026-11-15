// Onze — fenêtre de l'icône de l'extension : musique et radio, minuteur et chronomètre, notes.
import { store } from './storage.js';
import { initI18n, t } from './i18n.js';
import { music } from './music.js';
import { TRACKS } from './tracks.js';
import { mountMusicPicker } from './music-ui.js';
import { mountTimer } from './popup-timer.js';
import * as notes from './notes.js';

const $ = (selector) => document.querySelector(selector);
let picker = null;

function render({ failedId } = {}) {
  const id = music.current();
  picker.update();
  $('#now').textContent = failedId
    ? t('Impossible de lire « {name} » pour le moment.', { name: TRACKS[failedId]?.name || '' })
    : id ? TRACKS[id]?.name || '' : t('Rien en cours de lecture');
  $('#bars').classList.toggle('on', !!id);
  $('#stop').disabled = !id;
  const level = $('#level');
  if (document.activeElement !== level) level.value = String(music.level());
}

async function boot() {
  await store.init();
  await initI18n(store.settings.lang);
  document.documentElement.style.setProperty('--accent', store.settings.accent);

  picker = mountMusicPicker($('#tracks'));
  $('#level').addEventListener('input', (e) => music.setLevel(Number(e.target.value)));
  $('#stop').addEventListener('click', () => music.stop());

  await music.init(render);

  // Sections : Musique | Minuteur | Notes. On rouvre la dernière, ou le minuteur s'il tourne.
  const timer = await mountTimer($('#timer'));
  await notes.init();
  const show = (section) => {
    for (const button of document.querySelectorAll('.sections button')) button.setAttribute('aria-selected', String(button.dataset.section === section));
    for (const node of document.querySelectorAll('.section')) node.hidden = node.id !== `sec-${section}`;
    store.set('popupSection', section);
    if (section === 'notes') $('#note-text').focus();
  };
  for (const button of document.querySelectorAll('.sections button')) button.addEventListener('click', () => show(button.dataset.section));
  show(timer.running() ? 'time' : await store.get('popupSection', 'music'));
}

boot();
