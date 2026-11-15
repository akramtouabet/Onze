// Onze — objectif principal du jour (remis à zéro chaque jour) et mantras.
import { store } from './storage.js';
import { $, dayKey, hash, pick, removableRow, uid } from './utils.js';
import { lang, locale, t } from './i18n.js';

const CHEERS = ['Bien joué !', 'Bravo !', 'Excellent travail !', 'Mission accomplie !', 'Objectif atteint !', 'Belle journée de travail !'];
const defaultMantras = () => ['Un pas après l\'autre.', 'Respire.', 'L\'essentiel d\'abord.', 'Fais simple.', 'Ici et maintenant.', 'Mieux vaut fait que parfait.']
  .map((text, i) => ({ id: 'm' + i, text: t(text) }));

let focus = { text: '', done: false, day: '' };
let mantras = [];

const saveFocus = () => store.set('focus', focus);
const saveMantras = () => store.set('mantras', mantras);

const FADE_OUT = 380;
let swapTimer = 0;

// Fondu enchaîné entre la question et l'objectif affiché.
function swapFocus(render) {
  const section = $('#focus');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  clearTimeout(swapTimer);
  if (reduced) { render(); return; }
  section.classList.remove('entering');
  section.classList.add('leaving');
  swapTimer = setTimeout(() => {
    render();
    section.classList.remove('leaving');
    section.classList.add('entering');
    swapTimer = setTimeout(() => section.classList.remove('entering'), 1100);
  }, FADE_OUT);
}

function renderFocus() {
  const has = !!focus.text;
  $('#focus-form').hidden = has;
  $('#focus-set').hidden = !has;
  $('#focus-text').textContent = focus.text;
  $('#focus-done').checked = focus.done;
  if (!focus.done) $('#focus-cheer').textContent = '';
}

function renderMantra() {
  // Un mantra par jour, choisi de façon stable.
  $('#mantra').textContent = mantras.length ? mantras[hash(dayKey()) % mantras.length].text : '';
}

function renderMantraList() {
  $('#mantra-list').replaceChildren(...mantras.map((m) => removableRow(m.text, null, () => {
    mantras = mantras.filter((x) => x.id !== m.id);
    saveMantras(); renderMantra(); renderMantraList();
  }, 'Supprimer ce mantra')));
}

export async function init() {
  focus = await store.get('focus', focus);
  if (focus.day !== dayKey()) focus = { text: '', done: false, day: dayKey() };
  mantras = await store.get('mantras', defaultMantras());

  $('#focus-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = $('#focus-input').value.trim();
    if (!text) return;
    focus = { text, done: false, day: dayKey() };
    saveFocus();
    swapFocus(() => { $('#focus-input').value = ''; renderFocus(); });
  });
  $('#focus-done').addEventListener('change', (e) => {
    focus.done = e.target.checked;
    $('#focus-cheer').textContent = focus.done ? t(pick(CHEERS)) : '';
    saveFocus();
  });
  $('#focus-clear').addEventListener('click', () => {
    focus = { text: '', done: false, day: dayKey() };
    saveFocus();
    swapFocus(() => { renderFocus(); $('#focus-input').focus({ preventScroll: true }); });
  });

  $('#mantra-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = $('#mantra-new').value.trim();
    if (!text) return;
    mantras.push({ id: uid(), text });
    $('#mantra-new').value = '';
    saveMantras(); renderMantra(); renderMantraList();
  });

  renderFocus();
  renderMantra();
  renderMantraList();
}
