// Onze — tâches : listes multiples, vues « À venir » et « Terminées », échéances, glisser-déposer.
import { store } from './storage.js';
import { $, dayKey, daysUntil, editable, el, fmtDate, icon, iconBtn, sortable, toast, uid } from './utils.js';
import { lang, locale, t } from './i18n.js';

const SMART = { upcoming: 'À venir', done: 'Terminées' };
const DEFAULT_DB = {
  lists: [
    { id: 'today', name: "Aujourd'hui" },
    { id: 'inbox', name: 'Boîte de réception' },
    { id: 'perso', name: 'Perso' },
    { id: 'work', name: 'Travail' },
  ],
  active: 'today',
  expanded: false,
  items: [], // { id, list, text, done, doneAt, doneDay, due, created }
};

let db;
const save = () => store.set('todos', db);
const isSmart = () => db.active in SMART;
const listName = (id) => SMART[id] || db.lists.find((l) => l.id === id)?.name || '';

function count(id) {
  if (id === 'done') return db.items.filter((i) => i.done).length;
  if (id === 'upcoming') return db.items.filter((i) => !i.done && i.due).length;
  return db.items.filter((i) => i.list === id && !i.done).length;
}

/** Tâches de la vue active. Une tâche cochée reste visible dans sa liste jusqu'au lendemain. */
function visibleItems() {
  if (db.active === 'done') return db.items.filter((i) => i.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  if (db.active === 'upcoming') return db.items.filter((i) => !i.done && i.due).sort((a, b) => a.due.localeCompare(b.due));
  const today = dayKey();
  return db.items.filter((i) => i.list === db.active && (!i.done || i.doneDay === today));
}

// ── Lignes de tâche ──

function dueBadge(item) {
  const input = el('input', {
    type: 'date', class: 'due-input', value: item.due || '', tabindex: '-1', 'aria-hidden': 'true',
    onchange: (e) => { item.due = e.target.value || null; save(); render(); },
  });
  let label = null;
  let cls = 'due empty';
  if (item.due) {
    const d = daysUntil(item.due);
    label = d === 0 ? "Aujourd'hui" : d === 1 ? 'Demain' : d === -1 ? 'Hier' : fmtDate(item.due);
    cls = 'due' + (item.done ? '' : d < 0 ? ' late' : d === 0 ? ' today' : '');
  }
  const title = item.due ? "Modifier l'échéance" : 'Ajouter une échéance';
  const button = el('button', {
    type: 'button', class: cls, title, 'aria-label': title,
    onclick: () => { try { input.showPicker(); } catch { input.focus(); } },
  }, label || icon('calendar'));
  return el('span', { class: 'due-wrap' }, button, input);
}

function startEdit(node, item) {
  const li = node.closest('li');
  li.draggable = false;
  editable(node, (text) => {
    if (text) item.text = text.slice(0, 200);
    save(); render();
  });
}

function row(item) {
  return el('li', { class: 'task' + (item.done ? ' done' : ''), dataset: { id: item.id }, draggable: !isSmart() },
    el('input', {
      type: 'checkbox', class: 'ck', checked: item.done, 'data-focus': '', 'aria-label': `Terminer : ${item.text}`,
      onchange: (e) => {
        item.done = e.target.checked;
        item.doneAt = item.done ? Date.now() : null;
        item.doneDay = item.done ? dayKey() : null;
        save(); render();
      },
    }),
    el('span', {
      class: 'grow task-text', text: item.text, tabindex: '0', title: 'Double-cliquez (ou Entrée) pour modifier',
      ondblclick: (e) => startEdit(e.currentTarget, item),
      onkeydown: (e) => {
        if (e.key === 'Enter' && !e.currentTarget.isContentEditable) { e.preventDefault(); startEdit(e.currentTarget, item); }
      },
    }),
    db.active !== db.lists[0]?.id && isSmart() ? el('span', { class: 'due', text: listName(item.list) }) : null,
    dueBadge(item),
    iconBtn('close', `Supprimer : ${item.text}`, () => {
      db.items = db.items.filter((i) => i.id !== item.id);
      save(); render();
    }, 'round small row-x'));
}

// ── Menu des listes (menu déroulant et colonne de la vue agrandie) ──

function selectList(id) {
  db.active = id;
  closeMenus();
  save(); render();
}

function newListControl() {
  const button = el('button', { type: 'button', class: 'lst new sep', text: '+ Nouvelle liste' });
  button.addEventListener('click', () => {
    const input = el('input', { type: 'text', class: 'lst-input', placeholder: 'Nom de la liste', maxlength: '30', 'aria-label': 'Nom de la nouvelle liste' });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); render(); }
      if (e.key !== 'Enter') return;
      const name = input.value.trim();
      if (!name) return;
      const list = { id: uid(), name };
      db.lists.push(list);
      selectList(list.id);
    });
    button.replaceWith(input);
    input.focus();
  });
  return button;
}

function listButtons() {
  const entry = (id) => el('button', {
    type: 'button', class: 'lst', 'aria-current': String(id === db.active), onclick: () => selectList(id),
  }, el('span', { text: listName(id) }), el('small', { text: String(count(id)) }));
  return [...db.lists.map((l) => entry(l.id)), entry('upcoming'), entry('done'), newListControl()];
}

function closeMenus() {
  $('#todo-menu').hidden = true;
  $('#todo-more-menu').hidden = true;
  $('#todo-listsel').setAttribute('aria-expanded', 'false');
  $('#todo-more').setAttribute('aria-expanded', 'false');
}

// ── Rendu ──

function render() {
  if (!isSmart() && !db.lists.some((l) => l.id === db.active)) db.active = db.lists[0].id;
  const items = visibleItems();
  const smart = isSmart();

  $('#todo-listname').textContent = listName(db.active);
  $('#todo-menu').replaceChildren(...listButtons());
  $('#todo-side').replaceChildren(...listButtons());
  $('#todo-list').replaceChildren(...items.map(row));
  $('#todo-empty').textContent = db.active === 'done' ? 'Aucune tâche terminée pour le moment.'
    : db.active === 'upcoming' ? 'Aucune échéance à venir.' : 'Rien à faire ici. Ajoutez une tâche ci-dessous.';
  $('#todo-form').hidden = smart;
  $('#todo-rename').hidden = smart;
  $('#todo-list-delete').hidden = smart || db.lists.length < 2;
  $('#panel-todo').classList.toggle('expanded', !!db.expanded);

  const open = db.items.filter((i) => !i.done).length;
  $('#todo-count').textContent = open ? String(open) : '';
}

export async function init() {
  db = { ...DEFAULT_DB, ...(await store.get('todos', {})) };
  if (!db.lists?.length) db.lists = DEFAULT_DB.lists;

  $('#todo-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = $('#todo-input').value.trim();
    if (!text) return;
    db.items.push({ id: uid(), list: db.active, text, done: false, due: null, created: Date.now() });
    $('#todo-input').value = '';
    save(); render();
    const added = $('#todo-list').lastElementChild;
    added?.classList.add('fresh');
    added?.scrollIntoView({ block: 'nearest' });
  });

  $('#todo-listsel').addEventListener('click', () => {
    const willOpen = $('#todo-menu').hidden;
    closeMenus();
    $('#todo-menu').hidden = !willOpen;
    $('#todo-listsel').setAttribute('aria-expanded', String(willOpen));
  });
  $('#todo-more').addEventListener('click', () => {
    const willOpen = $('#todo-more-menu').hidden;
    closeMenus();
    $('#todo-more-menu').hidden = !willOpen;
    $('#todo-more').setAttribute('aria-expanded', String(willOpen));
  });
  document.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('.menu, #todo-listsel, #todo-more')) closeMenus();
  });
  $('#panel-todo').addEventListener('panel:close', closeMenus);

  $('#todo-expand').addEventListener('click', () => {
    closeMenus();
    db.expanded = !db.expanded;
    save(); render();
  });

  $('#todo-rename').addEventListener('click', () => {
    closeMenus();
    const list = db.lists.find((l) => l.id === db.active);
    if (!list) return;
    editable($('#todo-listname'), (name) => {
      if (name) list.name = name.slice(0, 30);
      save(); render();
    });
  });
  $('#todo-clear').addEventListener('click', () => {
    closeMenus();
    const inScope = (i) => i.done && (isSmart() || i.list === db.active);
    const n = db.items.filter(inScope).length;
    if (!n) { toast('Aucune tâche terminée à effacer.'); return; }
    if (!confirm(t(`Effacer définitivement ${n} tâche${n > 1 ? 's' : ''} terminée${n > 1 ? 's' : ''} ?`))) return;
    db.items = db.items.filter((i) => !inScope(i));
    save(); render();
  });
  $('#todo-list-delete').addEventListener('click', () => {
    closeMenus();
    const list = db.lists.find((l) => l.id === db.active);
    if (!list || db.lists.length < 2) return;
    const n = db.items.filter((i) => i.list === list.id).length;
    if (!confirm(t(`Supprimer la liste « ${list.name} »${n ? ` et ses ${n} tâche${n > 1 ? 's' : ''}` : ''} ?`))) return;
    db.lists = db.lists.filter((l) => l.id !== list.id);
    db.items = db.items.filter((i) => i.list !== list.id);
    db.active = db.lists[0].id;
    save(); render();
  });

  sortable($('#todo-list'), (order) => {
    if (isSmart()) return;
    // Réordonne les tâches de la liste active sans toucher à celles des autres listes.
    const moved = order.map((id) => db.items.find((i) => i.id === id)).filter(Boolean);
    const movedIds = new Set(order);
    let next = 0;
    db.items = db.items.map((i) => (movedIds.has(i.id) ? moved[next++] : i));
    save(); render();
  });

  render();
}
