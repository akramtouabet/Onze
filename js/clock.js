// Onze — horloge centrale et salutation selon le moment de la journée.
import { store, onSettings, touches } from './storage.js';
import { $, pad } from './utils.js';
import { lang, locale, t } from './i18n.js';

function greetingFor(hour) {
  if (hour < 5) return 'Bonne nuit';
  if (hour < 12) return 'Bonjour';
  if (hour < 18) return 'Bon après-midi';
  if (hour < 22) return 'Bonsoir';
  return 'Bonne nuit';
}

function tick() {
  const now = new Date();
  const { clock24, clockSeconds } = store.settings;
  let hours = now.getHours();
  let suffix = '';
  if (!clock24) {
    suffix = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
  }
  $('#clock-time').textContent = `${clock24 ? pad(hours) : hours}:${pad(now.getMinutes())}`;
  $('#clock-sec').textContent = clockSeconds ? ':' + pad(now.getSeconds()) : '';
  $('#clock-ampm').textContent = suffix;
  $('#clock').dateTime = now.toISOString();
  $('#greeting-text').textContent = greetingFor(now.getHours());
}

function renderName() {
  const node = $('#name');
  if (document.activeElement !== node) node.textContent = store.settings.name || t('vous');
}

export function init() {
  const name = $('#name');
  name.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); name.blur(); }
    if (e.key === 'Escape') { name.textContent = store.settings.name; name.blur(); }
  });
  name.addEventListener('blur', () => {
    const value = name.textContent.trim().slice(0, 40);
    if (value) store.setPath('name', value);
    renderName();
  });

  onSettings((path) => {
    if (touches(path, 'name')) renderName();
    if (touches(path, 'clock24', 'clockSeconds')) tick();
  });

  renderName();
  tick();
  // Cale le rafraîchissement sur le début de chaque seconde.
  setTimeout(() => { tick(); setInterval(tick, 1000); }, 1000 - (Date.now() % 1000));
}
