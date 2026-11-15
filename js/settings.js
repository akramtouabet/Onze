// Onze — réglages : liaison générique des champs [data-setting], onglets, apparence.
import { store, onSettings } from './storage.js';
import { $, $$, el } from './utils.js';
import { lang } from './i18n.js';

const FALLBACK = '"Helvetica Neue", "Segoe UI", system-ui, sans-serif';
const FONTS = {
  inter: `"Inter", ${FALLBACK}`,
  dmsans: `"DM Sans", ${FALLBACK}`,
  jakarta: `"Plus Jakarta Sans", ${FALLBACK}`,
  outfit: `"Outfit", ${FALLBACK}`,
  figtree: `"Figtree", ${FALLBACK}`,
  systeme: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  serif: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif',
  mono: 'ui-monospace, "SF Mono", "Cascadia Code", Menlo, Consolas, monospace',
};
const ACCENTS = ['#f4a259', '#ff6b6b', '#e879a6', '#a78bfa', '#60a5fa', '#34d399', '#facc15', '#ffffff'];

/** Texte noir ou blanc selon la luminosité de la couleur d'accent. */
function onAccent(hex) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#1b1d22' : '#ffffff';
}

export function applyAppearance() {
  const s = store.settings;
  const accent = /^#[0-9a-f]{6}$/i.test(s.accent) ? s.accent : '#f4a259';
  const root = document.documentElement.style;
  root.setProperty('--font', FONTS[s.font] || FONTS.inter);
  root.setProperty('--accent', accent);
  root.setProperty('--on-accent', onAccent(accent));
  root.setProperty('--clock-weight', s.clockWeight);
  document.body.dataset.panelTheme = s.panelTheme;
  document.body.dataset.clockSize = s.clockSize;
  $$('#accent-swatches .swatch').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.color === accent.toLowerCase())));
}

// ── Liaison des champs ──

function readValue(input) {
  if (input.type === 'checkbox') return input.checked;
  if (input.type === 'number' || input.type === 'range') {
    let n = Number(input.value);
    if (!Number.isFinite(n)) n = Number(input.min) || 0;
    if (input.min !== '') n = Math.max(Number(input.min), n);
    if (input.max !== '') n = Math.min(Number(input.max), n);
    return n;
  }
  return input.value.trim();
}

function syncInputs() {
  $$('[data-setting]').forEach((input) => {
    const value = store.getPath(input.dataset.setting);
    if (input.type === 'checkbox') input.checked = !!value;
    else if (document.activeElement !== input) input.value = value ?? '';
  });
  $$('[data-setting-list]').forEach((input) => {
    input.checked = (store.getPath(input.dataset.settingList) || []).includes(input.value);
  });
}

function bindInputs() {
  $$('[data-setting]').forEach((input) => {
    const event = input.type === 'range' || input.type === 'color' ? 'input' : 'change';
    input.addEventListener(event, () => store.setPath(input.dataset.setting, readValue(input)));
  });
  // Cases à cocher qui composent une liste (thèmes de photos, jours travaillés).
  $$('[data-setting-list]').forEach((input) => {
    input.addEventListener('change', () => {
      const path = input.dataset.settingList;
      const list = (store.getPath(path) || []).filter((v) => v !== input.value);
      if (input.checked) list.push(input.value);
      store.setPath(path, list);
    });
  });
}

function bindTabs() {
  const tabs = $$('#settings [data-tab]');
  tabs.forEach((tab) => tab.addEventListener('click', () => {
    tabs.forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
    $$('#settings [data-tab-panel]').forEach((p) => { p.hidden = p.dataset.tabPanel !== tab.dataset.tab; });
  }));
}

export function init() {
  $('#accent-swatches').replaceChildren(...ACCENTS.map((color) => el('button', {
    type: 'button', class: 'swatch', style: `background:${color}`, dataset: { color },
    'aria-label': `Couleur ${color}`, 'aria-pressed': 'false',
    onclick: () => store.setPath('accent', color),
  })));

  bindInputs();
  bindTabs();
  syncInputs();
  applyAppearance();
  onSettings(() => {
    syncInputs(); applyAppearance();
    // Changer de langue recharge la page : tous les textes sont traduits au chargement.
    if (store.settings.lang !== lang()) { store.flush(); setTimeout(() => location.reload(), 150); }
  });
}
