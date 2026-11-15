// Onze — mode Équilibre : hors des horaires de travail, les tâches et l'objectif du jour sont masqués.
import { store, onSettings, touches } from './storage.js';
import { $ } from './utils.js';
import { setFlag } from './visibility.js';

let override = false; // « Afficher quand même », valable pour cet onglet

function offHours() {
  const { enabled, start, end, days } = store.settings.balance;
  if (!enabled) return false;
  const now = new Date();
  if (!days.includes(String(now.getDay()))) return true;
  const minutes = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const from = sh * 60 + sm;
  const to = eh * 60 + em;
  // Gère aussi les horaires de nuit (ex. 22:00 → 06:00).
  return from <= to ? minutes < from || minutes >= to : minutes >= to && minutes < from;
}

function check() {
  const off = offHours() && !override;
  setFlag('offHours', off);
  $('#balance-note').hidden = !off;
}

export function init() {
  $('#balance-override').addEventListener('click', () => { override = true; check(); });
  onSettings((path) => { if (touches(path, 'balance')) { override = false; check(); } });
  check();
  setInterval(check, 30000);
}
