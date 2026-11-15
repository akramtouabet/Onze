// Onze — liens favoris (panneau en haut à gauche).
import { store } from './storage.js';
import { $, el, iconBtn, sortable, toast, uid } from './utils.js';

let links = [];
const save = () => store.set('links', links);

/** Icône du site via l'API favicon de Chrome ; sinon l'initiale du nom. */
function faviconFor(link) {
  const box = el('span', { class: 'link-ico', text: (link.name || '?')[0] });
  if (globalThis.chrome?.runtime?.id) {
    const url = new URL(chrome.runtime.getURL('/_favicon/'));
    url.searchParams.set('pageUrl', link.url);
    url.searchParams.set('size', '32');
    const img = el('img', { src: url.toString(), alt: '' });
    img.addEventListener('load', () => box.replaceChildren(img));
  }
  return box;
}

function render() {
  $('#links-list').replaceChildren(...links.map((link) => el('li', { dataset: { id: link.id }, draggable: true },
    el('a', { class: 'link', href: link.url, 'data-focus': '', title: link.url }, faviconFor(link), el('span', { text: link.name })),
    iconBtn('close', `Supprimer le lien ${link.name}`, () => {
      links = links.filter((l) => l.id !== link.id);
      save(); render();
    }, 'round small row-x'))));
}

function normalizeUrl(raw) {
  const value = raw.trim();
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : 'https://' + value);
    return url.hostname.includes('.') || url.hostname === 'localhost' ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function init() {
  links = await store.get('links', []);

  $('#links-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const url = normalizeUrl($('#link-url').value);
    if (!url) { toast('Cette adresse ne semble pas valide.'); return; }
    const name = $('#link-name').value.trim() || new URL(url).hostname.replace(/^www\./, '');
    links.push({ id: uid(), name, url });
    e.target.reset();
    save(); render();
    $('#link-name').focus();
  });

  sortable($('#links-list'), (order) => {
    links = order.map((id) => links.find((l) => l.id === id)).filter(Boolean);
    save(); render();
  });

  render();
}
