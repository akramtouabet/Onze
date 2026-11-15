// Onze — comptes à rebours vers des dates importantes (panneau et bandeau sous l'horloge).
import { store, onSettings, touches } from './storage.js';
import { $, daysUntil, el, fmtDate, iconBtn, uid } from './utils.js';

let items = []; // { id, name, date: 'AAAA-MM-JJ' }
const save = () => store.set('countdowns', items);

function short(days) {
  if (days === 0) return "Aujourd'hui";
  return days > 0 ? `J-${days}` : `J+${-days}`;
}

function long(days) {
  if (days === 0) return "C'est aujourd'hui !";
  if (days === 1) return 'Demain';
  if (days === -1) return 'Hier';
  return days > 0 ? `Dans ${days} jours` : `Il y a ${-days} jours`;
}

function render() {
  const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date));

  $('#cd-list').replaceChildren(...sorted.map((c) => {
    const days = daysUntil(c.date);
    return el('li', {},
      el('span', { class: 'grow' }, c.name, el('span', { class: 'sub', text: `${fmtDate(c.date, { day: 'numeric', month: 'long', year: 'numeric' })} · ${long(days)}` })),
      el('span', { class: 'big' + (days >= 0 && days <= 7 ? ' soon' : ''), text: short(days) }),
      iconBtn('close', `Supprimer ${c.name}`, () => { items = items.filter((x) => x.id !== c.id); save(); render(); }, 'round small row-x'));
  }));

  // Sous l'horloge : les trois prochaines échéances.
  const upcoming = store.settings.countdownsOnMain ? sorted.filter((c) => daysUntil(c.date) >= 0).slice(0, 3) : [];
  $('#countdown-strip').replaceChildren(...upcoming.map((c) => el('li', {}, c.name, el('strong', { text: short(daysUntil(c.date)) }))));
}

export async function init() {
  items = await store.get('countdowns', []);

  $('#cd-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#cd-name').value.trim();
    const date = $('#cd-date').value;
    if (!name || !date) return;
    items.push({ id: uid(), name, date });
    e.target.reset();
    save(); render();
  });

  onSettings((path) => { if (touches(path, 'countdownsOnMain')) render(); });
  render();
}
