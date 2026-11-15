// Onze — horloges du monde : plusieurs fuseaux horaires.
import { store, onSettings, touches } from './storage.js';
import { $, el, iconBtn, toast, uid } from './utils.js';
import { lang, locale, t } from './i18n.js';

let clocks = []; // { id, label, tz }
const save = () => store.set('worldClocks', clocks);

/** Décalage du fuseau par rapport à UTC, en minutes, à l'instant donné. */
function offsetMinutes(tz, date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric',
  }).formatToParts(date).map((p) => [p.type, Number(p.value)]));
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  return Math.round((asUtc - date.getTime()) / 60000);
}

function describeOffset(tz, now) {
  const diff = offsetMinutes(tz, now) + now.getTimezoneOffset(); // par rapport à l'heure locale
  const day = new Intl.DateTimeFormat('fr-CA', { timeZone: tz }).format(now); // AAAA-MM-JJ
  const local = new Intl.DateTimeFormat('fr-CA').format(now);
  const dayLabel = day > local ? t(' · demain') : day < local ? t(' · hier') : '';
  if (diff === 0) return t('Même heure') + dayLabel;
  const h = Math.floor(Math.abs(diff) / 60);
  const m = Math.abs(diff) % 60;
  return `${diff > 0 ? '+' : '−'}${h} h${m ? ' ' + m : ''}${dayLabel}`;
}

function render() {
  const now = new Date();
  $('#wc-list').replaceChildren(...clocks.map((c) => el('li', {},
    el('span', { class: 'grow' }, c.label, el('span', { class: 'sub', text: describeOffset(c.tz, now) })),
    el('span', {
      class: 'big',
      text: new Intl.DateTimeFormat(locale(), { timeZone: c.tz, hour: store.settings.clock24 ? '2-digit' : 'numeric', minute: '2-digit', hour12: !store.settings.clock24 }).format(now),
    }),
    iconBtn('close', `Retirer ${c.label}`, () => { clocks = clocks.filter((x) => x.id !== c.id); save(); render(); }, 'round small row-x'))));
}

export async function init() {
  clocks = await store.get('worldClocks', []);

  try {
    $('#wc-zones').replaceChildren(...Intl.supportedValuesOf('timeZone').map((tz) => el('option', { value: tz })));
  } catch { /* liste indisponible : la saisie libre reste possible */ }

  $('#wc-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const tz = $('#wc-tz').value.trim();
    try {
      new Intl.DateTimeFormat('fr-FR', { timeZone: tz });
    } catch {
      toast('Fuseau inconnu. Exemple : Europe/Paris, Asia/Tokyo.');
      return;
    }
    const label = $('#wc-label').value.trim() || tz.split('/').pop().replace(/_/g, ' ');
    clocks.push({ id: uid(), label, tz });
    e.target.reset();
    save(); render();
  });

  onSettings((path) => { if (touches(path, 'clock24')) render(); });
  $('#panel-worldclocks').addEventListener('panel:open', render);
  setInterval(() => { if ($('#panel-worldclocks').classList.contains('open')) render(); }, 5000);
  render();
}
