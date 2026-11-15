// Onze — minuteur et chronomètre de la fenêtre de l'icône.
// L'état est enregistré : ils continuent de tourner fenêtre fermée. La fin du minuteur est
// signalée par une notification (alarme confiée au service worker).
import { store } from './storage.js';
import { el } from './utils.js';
import { t } from './i18n.js';

const ALARM = 'onze-timer';
const PRESETS = [1, 5, 10, 15, 25, 45]; // minutes
const hasAlarms = !!globalThis.chrome?.alarms;
const pad = (n) => String(n).padStart(2, '0');

function clock(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function beep() {
  try {
    const ctx = new AudioContext();
    [0, 0.25, 0.5].forEach((delay) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const at = ctx.currentTime + delay;
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.2, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + 0.22);
    });
    setTimeout(() => ctx.close(), 1200);
  } catch { /* son indisponible : la notification suffit */ }
}

export async function mountTimer(root) {
  // Minuteur : endsAt (en cours) ou remaining (en pause), sinon prêt pour « duration » secondes.
  const timer = { duration: 300, endsAt: null, remaining: null, ...(await store.get('popupTimer', {})) };
  // Chronomètre : elapsed (cumul en ms) + startedAt quand il tourne.
  const watch = { startedAt: null, elapsed: 0, ...(await store.get('popupStopwatch', {})) };
  let mode = await store.get('popupTimeMode', 'timer');
  let finished = false;
  if (timer.endsAt && timer.endsAt <= Date.now()) { timer.endsAt = null; timer.remaining = null; finished = true; } // terminé fenêtre fermée
  if (timer.finishedAt) { finished = true; delete timer.finishedAt; store.set('popupTimer', timer); }
  globalThis.chrome?.action?.setBadgeText({ text: '' }); // la pastille « terminé » a été vue

  const saveTimer = () => store.set('popupTimer', timer);
  const saveWatch = () => store.set('popupStopwatch', watch);

  async function schedule() {
    if (!hasAlarms) return;
    const when = timer.endsAt;
    await chrome.alarms.clear(ALARM);
    if (!when || when !== timer.endsAt) return;
    await store.set('timerNotice', { title: t('Minuteur terminé'), message: t('Le temps est écoulé.') });
    await chrome.alarms.create(ALARM, { when });
  }

  const left = () => (timer.endsAt ? Math.max(0, Math.ceil((timer.endsAt - Date.now()) / 1000)) : timer.remaining ?? timer.duration);
  const elapsed = () => watch.elapsed + (watch.startedAt ? Date.now() - watch.startedAt : 0);

  // ── Interface ──
  const tabButton = (id, label) => el('button', { type: 'button', role: 'tab', dataset: { mode: id }, text: label, onclick: () => { mode = id; store.set('popupTimeMode', mode); render(); } });
  const tabs = el('div', { class: 'mp-tabs', role: 'tablist' }, tabButton('timer', 'Minuteur'), tabButton('stopwatch', 'Chronomètre'));
  const display = el('p', { class: 'time-big', role: 'timer' });
  const status = el('p', { class: 'time-status', role: 'status' });

  const custom = el('input', { type: 'number', min: '1', max: '600', step: '1', 'aria-label': 'Durée en minutes', placeholder: 'min' });
  const setMinutes = (minutes) => {
    const value = Math.max(1, Math.min(600, Math.round(minutes)));
    Object.assign(timer, { duration: value * 60, endsAt: null, remaining: null });
    finished = false;
    saveTimer(); schedule(); render();
  };
  custom.addEventListener('change', () => { if (custom.value) setMinutes(Number(custom.value)); });
  const presets = el('div', { class: 'chips time-presets' },
    PRESETS.map((m) => el('button', { type: 'button', class: 'chip', dataset: { minutes: String(m) }, text: `${m} min`, onclick: () => { custom.value = ''; setMinutes(m); } })),
    custom);

  const main = el('button', { type: 'button', class: 'primary' });
  const reset = el('button', { type: 'button', class: 'stop', text: 'Remettre à zéro' });
  main.addEventListener('click', () => {
    finished = false;
    if (mode === 'timer') {
      if (timer.endsAt) { timer.remaining = left(); timer.endsAt = null; } // pause
      else { timer.endsAt = Date.now() + left() * 1000; timer.remaining = null; }
      saveTimer(); schedule();
    } else {
      if (watch.startedAt) { watch.elapsed = elapsed(); watch.startedAt = null; } else watch.startedAt = Date.now();
      saveWatch();
    }
    render();
  });
  reset.addEventListener('click', () => {
    finished = false;
    if (mode === 'timer') { timer.endsAt = null; timer.remaining = null; saveTimer(); schedule(); }
    else { watch.startedAt = null; watch.elapsed = 0; saveWatch(); }
    render();
  });

  root.replaceChildren(tabs, display, status, presets, el('div', { class: 'time-controls' }, main, reset));

  function render() {
    for (const button of tabs.children) button.setAttribute('aria-selected', String(button.dataset.mode === mode));
    const isTimer = mode === 'timer';
    presets.hidden = !isTimer || !!timer.endsAt;
    if (isTimer) {
      display.textContent = clock(left());
      const paused = !timer.endsAt && timer.remaining != null;
      main.textContent = timer.endsAt ? 'Pause' : paused ? 'Reprendre' : 'Démarrer';
      reset.disabled = !timer.endsAt && !paused;
      status.textContent = finished ? 'Terminé !' : '';
      for (const chip of presets.querySelectorAll('.chip')) chip.setAttribute('aria-pressed', String(Number(chip.dataset.minutes) * 60 === timer.duration));
    } else {
      const ms = elapsed();
      display.textContent = `${clock(Math.floor(ms / 1000))}.${Math.floor((ms % 1000) / 100)}`;
      main.textContent = watch.startedAt ? 'Pause' : ms ? 'Reprendre' : 'Démarrer';
      reset.disabled = !ms;
      status.textContent = '';
    }
    display.classList.toggle('running', isTimer ? !!timer.endsAt : !!watch.startedAt);
  }

  setInterval(() => {
    if (timer.endsAt && Date.now() >= timer.endsAt) {
      timer.endsAt = null; timer.remaining = null; finished = true;
      saveTimer();
      if (!hasAlarms) beep(); // dans l'extension, la sonnerie vient du service worker
      // La fenêtre est ouverte : la fin est déjà visible, on retire la pastille posée par le service worker.
      setTimeout(() => { saveTimer(); globalThis.chrome?.action?.setBadgeText({ text: '' }); }, 1500);
      if (!hasAlarms && globalThis.Notification?.permission === 'granted') new Notification(t('Minuteur terminé'), { body: t('Le temps est écoulé.'), icon: 'icons/icon128.png' });
      render();
    } else if (timer.endsAt || watch.startedAt) render();
  }, 100);

  render();
  return { running: () => !!timer.endsAt || !!watch.startedAt };
}
