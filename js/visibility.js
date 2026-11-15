// Onze — visibilité des widgets.
// Un élément [data-widget="x"] est affiché si le réglage show.x est actif,
// sauf pendant une session Focus ou hors des horaires du mode Équilibre.
import { store, onSettings, touches } from './storage.js';
import { $$ } from './utils.js';
import { closePanel } from './panels.js';

const flags = { focus: false, offHours: false };
const KEPT_IN_FOCUS = ['pomodoro'];
const HIDDEN_OFF_HOURS = ['todo', 'focus'];

function isVisible(widget) {
  if (store.settings.show[widget] === false) return false;
  if (flags.focus && !KEPT_IN_FOCUS.includes(widget)) return false;
  if (flags.offHours && HIDDEN_OFF_HOURS.includes(widget)) return false;
  return true;
}

export function refreshVisibility() {
  $$('[data-widget]').forEach((node) => { node.hidden = !isVisible(node.dataset.widget); });
  // Bouton « Outils » : visible si au moins un de ses outils l'est.
  $$('[data-widget-group]').forEach((node) => { node.hidden = !node.dataset.widgetGroup.split(' ').some(isVisible); });
  document.body.classList.toggle('in-focus', flags.focus);
}

export function setFlag(name, value) {
  if (flags[name] === value) return;
  flags[name] = value;
  if (value) closePanel();
  refreshVisibility();
}

export function initVisibility() {
  onSettings((path) => { if (touches(path, 'show')) refreshVisibility(); });
  refreshVisibility();
}
