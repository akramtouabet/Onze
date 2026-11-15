// Onze — gestion des panneaux : un seul ouvert à la fois, fermeture au clic extérieur et avec Échap.
import { $, $$ } from './utils.js';

let current = null; // { panel, button }

function returnFocusTarget(button) {
  // Un bouton situé dans un panneau (grille « Outils ») disparaît à la fermeture : on rend le focus au bouton Outils.
  return button.closest('.panel') ? $('#tools-btn') : button;
}

export function closePanel({ focus = false } = {}) {
  if (!current) return;
  const { panel, button } = current;
  current = null;
  button.setAttribute('aria-expanded', 'false');
  panel.classList.add('closing');
  setTimeout(() => panel.classList.remove('open', 'closing'), 150);
  panel.dispatchEvent(new CustomEvent('panel:close'));
  if (focus) returnFocusTarget(button)?.focus();
}

export function openPanel(button) {
  const panel = document.getElementById(button.dataset.panel);
  if (!panel) return;
  closePanel();
  panel.classList.remove('closing');
  panel.classList.add('open');
  button.setAttribute('aria-expanded', 'true');
  current = { panel, button };
  panel.dispatchEvent(new CustomEvent('panel:open'));
  panel.querySelector('[data-autofocus]')?.focus({ preventScroll: true });
}

export function isOpen(panelId) {
  return current?.panel.id === panelId;
}

export function initPanels() {
  $$('[data-panel]').forEach((button) => {
    button.addEventListener('click', () => {
      if (current?.button === button || isOpen(button.dataset.panel)) closePanel();
      else openPanel(button);
    });
  });
  $$('.panel-close').forEach((b) => b.addEventListener('click', () => closePanel({ focus: true })));

  document.addEventListener('pointerdown', (e) => {
    if (!current) return;
    if (current.panel.contains(e.target) || e.target.closest('[data-panel]')) return;
    closePanel();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && current) closePanel({ focus: true });
  });
}
