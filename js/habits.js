// Onze — suivi d'habitudes : case du jour, historique des 7 derniers jours, série en cours.
import { store } from './storage.js';
import { $, addDays, dayKey, el, iconBtn, sortable, uid } from './utils.js';
import { lang, locale, t } from './i18n.js';

let habits = []; // { id, name, log: { 'AAAA-MM-JJ': 1 } }
const save = () => store.set('habits', habits);

/** Nombre de jours consécutifs, en partant d'aujourd'hui (ou d'hier si aujourd'hui n'est pas encore coché). */
function streak(habit) {
  let day = new Date();
  if (!habit.log[dayKey(day)]) day = addDays(day, -1);
  let n = 0;
  while (habit.log[dayKey(day)]) { n++; day = addDays(day, -1); }
  return n;
}

function toggle(habit, key) {
  if (habit.log[key]) delete habit.log[key]; else habit.log[key] = 1;
  save(); render();
}

function row(habit) {
  const today = dayKey();
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const date = addDays(new Date(), -i);
    const key = dayKey(date);
    const label = date.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' });
    days.push(el('button', {
      type: 'button', class: 'day-dot', 'aria-pressed': String(!!habit.log[key]),
      title: label, 'aria-label': `${habit.name}, ${label}`,
      text: date.toLocaleDateString(locale(), { weekday: 'narrow' }),
      onclick: () => toggle(habit, key),
    }));
  }
  const n = streak(habit);
  return el('li', { class: 'habit', dataset: { id: habit.id }, draggable: true },
    el('input', {
      type: 'checkbox', class: 'ck', checked: !!habit.log[today], 'data-focus': '', 'aria-label': `${habit.name} : fait aujourd'hui`,
      onchange: () => toggle(habit, today),
    }),
    el('span', { class: 'grow', text: habit.name }),
    el('span', { class: 'days7' }, days),
    el('span', { class: 'streak' + (n ? ' on' : ''), title: 'Jours consécutifs', text: `${n} j` }),
    iconBtn('close', `Supprimer l'habitude ${habit.name}`, () => {
      if (Object.keys(habit.log).length && !confirm(t('Supprimer « {name} » et son historique ?', { name: habit.name }))) return;
      habits = habits.filter((h) => h.id !== habit.id);
      save(); render();
    }, 'round small row-x'));
}

function render() {
  $('#habits-list').replaceChildren(...habits.map(row));
}

export async function init() {
  habits = await store.get('habits', []);

  $('#habits-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#habit-name').value.trim();
    if (!name) return;
    habits.push({ id: uid(), name, log: {} });
    $('#habit-name').value = '';
    save(); render();
  });

  sortable($('#habits-list'), (order) => {
    habits = order.map((id) => habits.find((h) => h.id === id)).filter(Boolean);
    save(); render();
  });

  render();
}
