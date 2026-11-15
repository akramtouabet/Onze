// Onze — sélecteur de musique : onglets « Musique » (morceau embarqué) et « Radio » (stations
// par pays).
// Utilisé par le panneau Sons et par la fenêtre de l'icône.
import { el } from './utils.js';
import { music } from './music.js';
import { TRACKS, MUSIC, RADIOS, isRadio } from './tracks.js';

export function mountMusicPicker(root) {
  let tab = null; // choisi d'après la lecture en cours au premier affichage
  const panes = {}; // créés à la demande, puis conservés

  const tabButton = (id, label) => el('button', {
    type: 'button', role: 'tab', dataset: { tab: id }, text: label,
    onclick: () => { tab = id; draw(); },
  });
  const tabs = el('div', { class: 'mp-tabs', role: 'tablist' },
    tabButton('music', 'Musique'), tabButton('radio', 'Radio'));
  const body = el('div', { class: 'mp-body' });
  root.replaceChildren(tabs, body);

  const chip = (id) => el('button', {
    type: 'button', class: 'chip', 'aria-pressed': 'false', dataset: { music: id }, text: TRACKS[id].name,
    onclick: () => music.toggle(id),
  });

  const build = {
    music: () => el('div', { class: 'chips' }, MUSIC.map(chip)),
    radio: () => el('div', { class: 'mp-groups' }, RADIOS.map((group) => el('div', { class: 'mp-group' },
      el('p', { class: 'mp-country', text: group.country }),
      el('div', { class: 'chips' }, group.ids.map(chip))))),
  };

  function mark() {
    const current = music.current();
    const playingTab = current ? (isRadio(current) ? 'radio' : 'music') : null;
    for (const button of tabs.children) {
      button.setAttribute('aria-selected', String(button.dataset.tab === tab));
      // Petit repère sur l'onglet qui contient la source en cours de lecture.
      button.classList.toggle('playing', button.dataset.tab === playingTab);
    }
    for (const button of body.querySelectorAll('[data-music]')) {
      button.setAttribute('aria-pressed', String(button.dataset.music === current));
    }
  }

  function draw() {
    if (!panes[tab]) body.append(panes[tab] = build[tab]());
    for (const [id, pane] of Object.entries(panes)) pane.hidden = id !== tab;
    mark();
  }

  return {
    /** À appeler quand la lecture change. */
    update() {
      if (tab === null) { tab = isRadio(music.current()) ? 'radio' : 'music'; draw(); } else mark();
    },
  };
}
