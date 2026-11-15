// Onze — point d'entrée : charge les réglages, puis initialise chaque module.
import { store } from './storage.js';
import { $ } from './utils.js';
import { initPanels } from './panels.js';
import { initVisibility } from './visibility.js';
import * as settings from './settings.js';
import * as photos from './photos.js';
import * as clock from './clock.js';
import * as focus from './focus.js';
import * as quotes from './quotes.js';
import * as weather from './weather.js';
import * as search from './search.js';
import * as todo from './todo.js';
import * as links from './links.js';
import * as pomodoro from './pomodoro.js';
import * as sounds from './sounds.js';
import * as notes from './notes.js';
import * as habits from './habits.js';
import * as worldclocks from './worldclocks.js';
import * as countdowns from './countdowns.js';
import * as balance from './balance.js';
import * as backup from './backup.js';
import * as cloud from './cloud.js';
import * as chromesync from './chromesync.js';
import { initI18n } from './i18n.js';

/** Écran d'accueil au premier lancement : demande le prénom. */
function onboarding() {
  if (store.settings.onboarded) return;
  document.body.classList.add('onboarding-open');
  $('#onboarding').hidden = false;
  $('#onboarding-name').focus();
  $('#onboarding-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#onboarding-name').value.trim();
    if (!name) return;
    store.setPath('name', name);
    store.setPath('onboarded', true);
    store.flush();
    $('#onboarding').hidden = true;
    document.body.classList.remove('onboarding-open');
  });
}

async function boot() {
  await store.init();
  await initI18n(store.settings.lang);
  document.documentElement.classList.add('ready');
  initPanels();
  settings.init();
  photos.init().catch((e) => console.error('Onze : photos', e)); // réseau : ne bloque pas l'affichage

  const modules = { clock, focus, quotes, weather, search, todo, links, pomodoro, sounds, notes, habits, worldclocks, countdowns, backup, cloud, chromesync };
  for (const [name, module] of Object.entries(modules)) {
    try {
      await module.init();
    } catch (e) {
      console.error(`Onze : le module « ${name} » n'a pas pu démarrer`, e);
    }
  }

  initVisibility();
  balance.init();
  onboarding();
}

boot();
