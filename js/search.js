// Onze — recherche Web (Google, Bing ou DuckDuckGo).
import { store, onSettings, touches } from './storage.js';
import { $ } from './utils.js';

const ENGINES = {
  google: { name: 'Google', url: 'https://www.google.com/search?q=' },
  bing: { name: 'Bing', url: 'https://www.bing.com/search?q=' },
  duckduckgo: { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=' },
};

const engine = () => ENGINES[store.settings.searchEngine] || ENGINES.google;

function bind(form, input) {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = input.value.trim();
    if (query) location.href = engine().url + encodeURIComponent(query);
  });
}

function renderPlaceholder() {
  const text = `Rechercher avec ${engine().name}`;
  $('#search-input').placeholder = text;
  $('#search-bar-input').placeholder = text;
}

export function init() {
  bind($('#search-form'), $('#search-input'));
  bind($('#search-bar'), $('#search-bar-input'));
  onSettings((path) => { if (touches(path, 'searchEngine')) renderPlaceholder(); });
  renderPlaceholder();
}
