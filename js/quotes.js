// Onze — citation du jour, favorites et citations personnalisées.
import { store, onSettings, touches } from './storage.js';
import { $, dayKey, hash, removableRow, uid } from './utils.js';
import { QUOTES } from './quotes-data.js';
import { QUOTES_EN } from './quotes-data-en.js';
import { lang, locale, t } from './i18n.js';

let data = { custom: [], favs: [], shift: { day: '', n: 0 } }; // custom : { id, text, author }
let current = null;

const save = () => store.set('quotes', data);

function all() {
  return [
    ...(lang() === 'en' ? QUOTES_EN.map(([text, author], i) => ({ id: 'e' + i, text, author })) : QUOTES.map(([text, author], i) => ({ id: 'b' + i, text, author }))),
    ...data.custom,
  ];
}

function pool() {
  const everything = all();
  if (store.settings.quoteFavsOnly) {
    const favs = everything.filter((q) => data.favs.includes(q.id));
    if (favs.length) return favs;
  }
  return everything;
}

/** Citation du jour : stable pour la journée, décalée par le bouton « Autre citation ». */
function today() {
  const list = pool();
  const shift = data.shift.day === dayKey() ? data.shift.n : 0;
  return list[(hash(dayKey()) + shift) % list.length];
}

function render(animate = false) {
  current = today();
  const text = $('#quote-text');
  const apply = () => {
    text.textContent = lang() === 'fr' ? `« ${current.text} »` : `“${current.text}”`;
    $('#quote-author').textContent = current.author || t('Anonyme');
    $('#quote-fav').setAttribute('aria-pressed', String(data.favs.includes(current.id)));
    text.classList.remove('swap');
  };
  if (!animate) { apply(); return; }
  text.classList.add('swap');
  setTimeout(apply, 250);
}

function renderLists() {
  $('#quote-custom-list').replaceChildren(...data.custom.map((q) => removableRow(q.text, q.author, () => {
    data.custom = data.custom.filter((x) => x.id !== q.id);
    data.favs = data.favs.filter((id) => id !== q.id);
    save(); render(); renderLists();
  }, 'Supprimer cette citation')));

  const favs = all().filter((q) => data.favs.includes(q.id));
  $('#quote-fav-list').replaceChildren(...favs.map((q) => removableRow(q.text, q.author, () => {
    data.favs = data.favs.filter((id) => id !== q.id);
    save(); render(); renderLists();
  }, 'Retirer des favorites')));
}

export async function init() {
  data = { ...data, ...(await store.get('quotes', {})) };

  $('#quote-fav').addEventListener('click', () => {
    if (!current) return;
    data.favs = data.favs.includes(current.id) ? data.favs.filter((id) => id !== current.id) : [...data.favs, current.id];
    save(); render(); renderLists();
  });
  $('#quote-next').addEventListener('click', () => {
    data.shift = { day: dayKey(), n: (data.shift.day === dayKey() ? data.shift.n : 0) + 1 };
    save(); render(true);
  });
  $('#quote-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = $('#quote-new-text').value.trim().replace(/^[«"“]\s*|\s*[»"”]$/g, '');
    if (!text) return;
    data.custom.push({ id: uid(), text, author: $('#quote-new-author').value.trim() });
    e.target.reset();
    save(); render(); renderLists();
  });
  onSettings((path) => { if (touches(path, 'quoteFavsOnly')) render(); });

  render();
  renderLists();
}
