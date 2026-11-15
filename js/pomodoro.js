// Onze — mode Focus (Pomodoro) : travail / pauses, masquage des widgets, notification de fin.
import { store, onSettings, touches } from './storage.js';
import { $, dayKey, pad, toast } from './utils.js';
import { setFlag } from './visibility.js';
import { lang, locale, t } from './i18n.js';

const PHASES = {
  work: { label: 'Concentration', setting: 'work' },
  short: { label: 'Pause courte', setting: 'short' },
  long: { label: 'Pause longue', setting: 'long' },
};
const ALARM = 'onze-pomodoro';
const hasAlarms = !!globalThis.chrome?.alarms;
const baseTitle = document.title;

// endsAt : fin prévue si le minuteur tourne ; remaining : temps restant s'il est en pause.
let st = { phase: 'work', running: false, endsAt: 0, remaining: null, done: 0, cycle: 0, day: dayKey() };

const cfg = () => store.settings.pomodoro;
const duration = (phase) => Math.max(1, Number(cfg()[PHASES[phase].setting]) || 1) * 60000;
const left = () => (st.running ? Math.max(0, st.endsAt - Date.now()) : st.remaining ?? duration(st.phase));
const save = () => store.set('pomodoro', st);

function format(ms) {
  const total = Math.ceil(ms / 1000);
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

function scheduleAlarm() {
  if (!hasAlarms) return;
  chrome.alarms.clear(ALARM);
  if (!st.running || !cfg().notify) { store.remove('pomodoroNotice'); return; }
  const work = st.phase === 'work';
  store.set('pomodoroNotice', {
    title: t(work ? 'Session terminée' : 'La pause est finie'),
    message: t(work ? 'Bravo ! Accordez-vous une pause.' : 'On s\'y remet ?'),
  });
  chrome.alarms.create(ALARM, { when: st.endsAt });
}

function beep() {
  try {
    const ctx = new AudioContext();
    [0, 0.28].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + offset + 0.22);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.25);
    });
    setTimeout(() => ctx.close(), 1000);
  } catch { /* son indisponible : sans importance */ }
}

/** Passe à la phase suivante. completed : la phase est allée à son terme (et non « Passer »). */
function advance(completed) {
  if (st.phase === 'work') {
    if (completed) { st.done++; st.cycle++; }
    const longBreak = completed && st.cycle % Math.max(1, Number(cfg().cycles) || 4) === 0;
    st.phase = longBreak ? 'long' : 'short';
  } else {
    st.phase = 'work';
  }
  st.running = false;
  st.remaining = null;
  st.endsAt = 0;
}

function finish() {
  const wasWork = st.phase === 'work';
  advance(true);
  save(); scheduleAlarm(); render();
  beep();
  const message = t(wasWork ? 'Session terminée. Place à la pause !' : 'La pause est finie. On s\'y remet ?');
  toast(message, 5000);
  // Sans service worker (essai hors extension), la page affiche elle-même la notification.
  if (!hasAlarms && cfg().notify && globalThis.Notification?.permission === 'granted') {
    new Notification('Onze', { body: message, icon: 'icons/icon128.png' });
  }
}

function start() {
  st.endsAt = Date.now() + left();
  st.running = true;
  st.remaining = null;
  if (!hasAlarms && cfg().notify && globalThis.Notification?.permission === 'default') Notification.requestPermission();
  save(); scheduleAlarm(); render();
}

function pause() {
  st.remaining = left();
  st.running = false;
  save(); scheduleAlarm(); render();
}

function reset() {
  st = { ...st, phase: 'work', running: false, remaining: null, endsAt: 0 };
  save(); scheduleAlarm(); render();
}

function render() {
  const ms = left();
  const text = format(ms);
  const label = PHASES[st.phase].label;
  const active = st.running || st.remaining != null;
  const immersive = st.running && st.phase === 'work' && cfg().hideWidgets;

  $('#pomo-time').textContent = text;
  $('#pomo-phase').textContent = label;
  $('#pomo-toggle').textContent = st.running ? 'Pause' : st.remaining != null ? 'Reprendre' : 'Démarrer';
  $('#pomo-count').textContent = st.done ? `${st.done} session${st.done > 1 ? 's' : ''} terminée${st.done > 1 ? 's' : ''} aujourd'hui` : 'Aucune session terminée aujourd\'hui';

  $('#fd-time').textContent = text;
  $('#fd-phase').textContent = label;
  $('#fd-toggle').textContent = 'Pause';
  $('#focus-display').hidden = !immersive;

  const badge = $('#pomo-badge');
  badge.textContent = active ? text : 'Focus';
  badge.closest('.corner').classList.toggle('active', st.running);
  document.title = st.running ? `${text} · ${t(label)}` : t(baseTitle);
  setFlag('focus', immersive);
}

function tick() {
  if (st.running && Date.now() >= st.endsAt) finish();
  else if (st.running) render();
}

export async function init() {
  st = { ...st, ...(await store.get('pomodoro', {})) };
  if (st.day !== dayKey()) { st.day = dayKey(); st.done = 0; st.cycle = 0; }
  // Le minuteur s'est terminé alors qu'aucun onglet n'était ouvert : le service worker a déjà notifié.
  if (st.running && Date.now() >= st.endsAt) { advance(true); save(); }

  $('#pomo-toggle').addEventListener('click', () => (st.running ? pause() : start()));
  $('#pomo-skip').addEventListener('click', () => { advance(false); save(); scheduleAlarm(); render(); });
  $('#pomo-reset').addEventListener('click', reset);
  $('#fd-toggle').addEventListener('click', pause);
  $('#fd-stop').addEventListener('click', reset);

  // Suit l'état modifié depuis un autre onglet.
  store.watch('pomodoro', (value) => { if (value) { st = { ...st, ...value }; render(); } });
  onSettings((path) => { if (touches(path, 'pomodoro')) { render(); scheduleAlarm(); } });

  render();
  setInterval(tick, 250);
}
