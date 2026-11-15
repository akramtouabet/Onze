// Onze — bloc-notes : plusieurs notes, enregistrement automatique.
import { store } from './storage.js';
import { $, debounce, el, uid } from './utils.js';
import { lang, locale, t } from './i18n.js';

let db = { items: [], active: null }; // items : { id, text, updated }

const current = () => db.items.find((n) => n.id === db.active) || null;
const titleOf = (note) => note.text.trim().split('\n')[0].slice(0, 24) || 'Nouvelle note';

const persist = debounce(() => {
  store.set('notes', db);
  $('#note-status').textContent = 'Enregistré';
}, 400);

function addNote() {
  const note = { id: uid(), text: '', updated: Date.now() };
  db.items.push(note);
  db.active = note.id;
  store.set('notes', db);
  render();
  $('#note-text').focus();
}

function renderTabs() {
  $('#notes-tabs').replaceChildren(
    ...db.items.map((n) => el('button', {
      type: 'button', class: 'chip', role: 'tab', 'aria-selected': String(n.id === db.active), text: titleOf(n),
      onclick: () => { db.active = n.id; store.set('notes', db); render(); },
    })),
    el('button', { type: 'button', class: 'chip', 'aria-label': 'Nouvelle note', title: 'Nouvelle note', text: '+', onclick: addNote }));
}

function render() {
  if (!current()) db.active = db.items[0]?.id || null;
  renderTabs();
  $('#note-text').value = current()?.text || '';
  $('#note-status').textContent = '';
  $('#note-delete').disabled = db.items.length < 2 && !current()?.text;
}

export async function init() {
  db = { ...db, ...(await store.get('notes', {})) };
  if (!db.items.length) { db.items = [{ id: uid(), text: '', updated: Date.now() }]; db.active = db.items[0].id; }

  $('#note-text').addEventListener('input', (e) => {
    const note = current();
    if (!note) return;
    note.text = e.target.value;
    note.updated = Date.now();
    $('#note-status').textContent = 'Enregistrement…';
    $('#note-delete').disabled = false;
    renderTabs();
    persist();
  });

  $('#note-delete').addEventListener('click', () => {
    const note = current();
    if (!note) return;
    if (note.text.trim() && !confirm(t('Supprimer cette note ?'))) return;
    db.items = db.items.filter((n) => n.id !== note.id);
    if (!db.items.length) db.items = [{ id: uid(), text: '', updated: Date.now() }];
    db.active = db.items[0].id;
    store.set('notes', db);
    render();
  });

  render();
}
