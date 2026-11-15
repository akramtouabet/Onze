// Onze — petits utilitaires partagés (DOM, dates, listes réordonnables)
import { locale } from './i18n.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Icône du jeu défini dans newtab.html (<symbol id="i-nom">). */
export function icon(name) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', '#i-' + name);
  svg.append(use);
  return svg;
}

/** Crée un élément. props : class, text, dataset, onxxx (écouteurs), propriétés ou attributs. */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (key in node && typeof value !== 'string') node[key] = value;
    else node.setAttribute(key, value === true ? '' : value);
  }
  node.append(...children.flat().filter((c) => c != null && c !== false));
  return node;
}

export function iconBtn(name, label, onclick, cls = 'round small') {
  return el('button', { type: 'button', class: cls, 'aria-label': label, title: label, onclick }, icon(name));
}

/** Ligne de liste « texte + bouton supprimer », utilisée dans les réglages. */
export function removableRow(text, sub, onRemove, label = 'Supprimer') {
  return el('li', {},
    el('span', { class: 'grow' }, text, sub ? el('span', { class: 'sub', text: sub }) : null),
    iconBtn('close', label, onRemove, 'round small row-x'));
}

export const pad = (n) => String(n).padStart(2, '0');
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/** Clé de jour locale : AAAA-MM-JJ. */
export function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/** Nombre de jours entre aujourd'hui et une clé AAAA-MM-JJ (négatif si passé). */
export function daysUntil(key) {
  const [y, m, d] = key.split('-').map(Number);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((new Date(y, m - 1, d) - today) / 86400000);
}

export function fmtDate(key, options = { day: 'numeric', month: 'short' }) {
  return new Date(key + 'T12:00:00').toLocaleDateString(locale(), options);
}

export function debounce(fn, ms) {
  let timer;
  const wrapped = (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
  wrapped.cancel = () => clearTimeout(timer);
  return wrapped;
}

/** Hachage stable d'une chaîne (pour choisir « la citation du jour », etc.). */
export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

let toastTimer;
export function toast(message, ms = 2800) {
  const node = $('#toast');
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('show'), ms);
}

/** Rend un élément éditable jusqu'à Entrée, Échap ou la perte du focus. */
export function editable(node, done) {
  const original = node.textContent;
  node.contentEditable = 'plaintext-only';
  node.focus();
  getSelection().selectAllChildren(node);
  const onKey = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); node.blur(); }
    else if (e.key === 'Escape') { e.stopPropagation(); node.textContent = original; node.blur(); }
  };
  const finish = () => {
    node.removeEventListener('keydown', onKey);
    node.contentEditable = 'false';
    done(node.textContent.trim(), original);
  };
  node.addEventListener('keydown', onKey);
  node.addEventListener('blur', finish, { once: true });
}

/**
 * Rend une liste réordonnable : glisser-déposer à la souris, Alt + flèches au clavier.
 * Les enfants doivent porter data-id ; onOrder reçoit la nouvelle suite d'identifiants.
 */
export function sortable(list, onOrder) {
  let dragged = null;
  const items = () => [...list.children].filter((n) => n.dataset.id);
  const commit = (focusId) => {
    onOrder(items().map((n) => n.dataset.id));
    if (focusId) list.querySelector(`[data-id="${focusId}"] [data-focus]`)?.focus();
  };

  list.addEventListener('dragstart', (e) => {
    const li = e.target.closest?.('[data-id]');
    if (!li || li.parentNode !== list || !li.draggable) return;
    dragged = li;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', li.dataset.id);
    requestAnimationFrame(() => li.classList.add('dragging'));
  });
  list.addEventListener('dragover', (e) => {
    if (!dragged) return;
    e.preventDefault();
    const after = items().find((n) => n !== dragged && e.clientY < n.getBoundingClientRect().top + n.offsetHeight / 2);
    if (after) list.insertBefore(dragged, after); else list.appendChild(dragged);
  });
  list.addEventListener('drop', (e) => { if (dragged) e.preventDefault(); });
  list.addEventListener('dragend', () => {
    if (!dragged) return;
    dragged.classList.remove('dragging');
    dragged = null;
    commit();
  });
  list.addEventListener('keydown', (e) => {
    if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    const li = e.target.closest('[data-id]');
    if (!li || li.parentNode !== list || !li.draggable) return;
    e.preventDefault();
    const sibling = e.key === 'ArrowUp' ? li.previousElementSibling : li.nextElementSibling;
    if (!sibling) return;
    if (e.key === 'ArrowUp') list.insertBefore(li, sibling); else list.insertBefore(sibling, li);
    commit(li.dataset.id);
  });
}

/** Télécharge un texte sous forme de fichier. */
export function download(filename, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = el('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
