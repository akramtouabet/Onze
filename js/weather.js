// Onze — météo via Open-Meteo (sans clé) : conditions actuelles, heure par heure, 7 jours, plusieurs villes.
import { store, onSettings, touches } from './storage.js';
import { $, el, icon, toast } from './utils.js';
import { lang, locale, t } from './i18n.js';

const CACHE_MS = 30 * 60 * 1000;
let state = { cities: [], active: null }; // cities : { id, name, lat, lon }
let cache = {}; // id → { t, d }

const save = () => store.set('weatherCities', state);
const activeCity = () => state.cities.find((c) => c.id === state.active) || state.cities[0] || null;

/** Code météo WMO → [pictogramme, libellé]. */
function describe(code, isDay = 1) {
  if (code === 0) return [isDay ? '☀️' : '🌙', 'Ciel dégagé'];
  if (code === 1) return [isDay ? '🌤️' : '🌙', 'Peu nuageux'];
  if (code === 2) return ['⛅', 'Partiellement nuageux'];
  if (code === 3) return ['☁️', 'Couvert'];
  if (code <= 48) return ['🌫️', 'Brouillard'];
  if (code <= 57) return ['🌦️', 'Bruine'];
  if (code <= 67) return ['🌧️', 'Pluie'];
  if (code <= 77) return ['🌨️', 'Neige'];
  if (code <= 82) return ['🌧️', 'Averses'];
  if (code <= 86) return ['🌨️', 'Averses de neige'];
  return ['⛈️', 'Orage'];
}

const temp = (celsius) => `${Math.round(store.settings.tempUnit === 'f' ? celsius * 9 / 5 + 32 : celsius)}°`;

async function load(city) {
  const hit = cache[city.id];
  if (hit && Date.now() - hit.t < CACHE_MS) return hit.d;
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({
    latitude: city.lat, longitude: city.lon, timezone: 'auto', forecast_days: 7,
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day',
    hourly: 'temperature_2m,weather_code,precipitation_probability,is_day',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
  });
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error('Open-Meteo ' + res.status);
  const d = await res.json();
  cache[city.id] = { t: Date.now(), d };
  // Ne garde en cache que les villes encore présentes.
  cache = Object.fromEntries(Object.entries(cache).filter(([id]) => state.cities.some((c) => c.id === id)));
  store.set('weatherCache', cache);
  return d;
}

// ── Rendu ──

function renderButton(city, d) {
  const [ico] = d ? describe(d.current.weather_code, d.current.is_day) : ['⛅'];
  $('#weather-icon').textContent = ico;
  $('#weather-temp').textContent = d ? temp(d.current.temperature_2m) : '–';
  $('#weather-city').textContent = city ? city.name : 'Météo';
}

function renderCities() {
  const active = activeCity();
  $('#weather-cities').replaceChildren(...state.cities.map((c) => el('button', {
    type: 'button', class: 'chip', 'aria-selected': String(c === active),
    onclick: (e) => { if (e.target.closest('.chip-x')) return; state.active = c.id; save(); refresh(); },
  }, c.name, el('span', {
    class: 'chip-x', role: 'button', tabindex: '0', title: `Retirer ${c.name}`, 'aria-label': `Retirer ${c.name}`,
    onclick: () => removeCity(c.id),
    onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); removeCity(c.id); } },
  }, icon('close')))));
}

function renderBody(d) {
  const body = $('#weather-body');
  if (!d) {
    body.replaceChildren(el('p', { class: 'muted', text: activeCity() ? 'Météo indisponible pour le moment. Vérifiez votre connexion.' : 'Ajoutez une ville ou utilisez votre position pour afficher la météo.' }));
    return;
  }
  const cur = d.current;
  const [ico, label] = describe(cur.weather_code, cur.is_day);

  const start = Math.max(0, d.hourly.time.findIndex((t) => t.slice(0, 13) === cur.time.slice(0, 13)));
  const hours = d.hourly.time.slice(start, start + 24).map((t, i) => {
    const k = start + i;
    const rain = d.hourly.precipitation_probability?.[k];
    return el('li', {},
      el('span', { text: i === 0 ? 'Maint.' : `${Number(t.slice(11, 13))} h` }),
      el('span', { class: 'wx-ico', text: describe(d.hourly.weather_code[k], d.hourly.is_day?.[k] ?? 1)[0] }),
      el('span', { text: temp(d.hourly.temperature_2m[k]) }),
      el('span', { class: 'wx-rain', text: rain >= 20 ? `${rain} %` : '' }));
  });

  const days = d.daily.time.map((t, i) => {
    const rain = d.daily.precipitation_probability_max?.[i];
    return el('li', {},
      el('span', { text: i === 0 ? "Aujourd'hui" : new Date(t + 'T12:00:00').toLocaleDateString(locale(), { weekday: 'long' }) }),
      el('span', { text: describe(d.daily.weather_code[i])[0] }),
      el('span', { class: 'wx-rain', text: rain != null ? `${rain} %` : '' }),
      el('span', { class: 'wx-minmax' }, el('span', { class: 'muted', text: temp(d.daily.temperature_2m_min[i]) }), ' / ', temp(d.daily.temperature_2m_max[i])));
  });

  body.replaceChildren(
    el('div', { class: 'wx-now' },
      el('span', { class: 'wx-ico', text: ico }),
      el('div', {},
        el('b', { text: temp(cur.temperature_2m) }),
        el('div', { text: label }),
        el('div', { class: 'muted', text: `Ressenti ${temp(cur.apparent_temperature)} · Humidité ${cur.relative_humidity_2m} % · Vent ${Math.round(cur.wind_speed_10m)} km/h` }))),
    el('p', { class: 'legend', text: 'Heure par heure' }),
    el('ul', { class: 'wx-hours' }, hours),
    el('p', { class: 'legend', text: '7 jours' }),
    el('ul', { class: 'wx-days' }, days));
}

async function refresh() {
  const city = activeCity();
  renderCities();
  if (!city) { renderButton(null, null); renderBody(null); return; }
  let d = cache[city.id]?.d || null;
  renderButton(city, d);
  renderBody(d);
  try {
    d = await load(city);
  } catch (e) {
    console.warn('Onze : météo indisponible', e);
  }
  if (activeCity() === city) { renderButton(city, d); renderBody(d); }
}

// ── Villes ──

function addCity(city) {
  state.cities = state.cities.filter((c) => c.id !== city.id);
  state.cities.push(city);
  state.active = city.id;
  save(); refresh();
}

function removeCity(id) {
  state.cities = state.cities.filter((c) => c.id !== id);
  if (state.active === id) state.active = state.cities[0]?.id || null;
  save(); refresh();
}

function locate(silent) {
  if (!navigator.geolocation) { if (!silent) toast('La géolocalisation n\'est pas disponible.'); return; }
  navigator.geolocation.getCurrentPosition(
    (pos) => addCity({ id: 'geo', name: 'Ma position', lat: +pos.coords.latitude.toFixed(3), lon: +pos.coords.longitude.toFixed(3) }),
    () => { if (!silent) toast('Position introuvable. Ajoutez une ville à la main.'); },
    { timeout: 8000, maximumAge: 3600000 });
}

async function searchCity(query) {
  const results = $('#weather-results');
  results.replaceChildren(el('li', { class: 'muted', text: 'Recherche…' }));
  try {
    const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
    url.search = new URLSearchParams({ name: query, count: 5, language: lang(), format: 'json' });
    const data = await (await fetch(url)).json();
    if (!data.results?.length) { results.replaceChildren(el('li', { class: 'muted', text: 'Aucune ville trouvée.' })); return; }
    results.replaceChildren(...data.results.map((r) => el('li', {},
      el('button', {
        type: 'button', class: 'grow lst',
        onclick: () => {
          addCity({ id: 'c' + r.id, name: r.name, lat: r.latitude, lon: r.longitude });
          results.replaceChildren();
          $('#weather-query').value = '';
        },
      }, el('span', {}, r.name, el('span', { class: 'sub', text: [r.admin1, r.country].filter(Boolean).join(', ') }))))));
  } catch {
    results.replaceChildren(el('li', { class: 'muted', text: 'Recherche impossible. Vérifiez votre connexion.' }));
  }
}

export async function init() {
  state = { ...state, ...(await store.get('weatherCities', {})) };
  cache = await store.get('weatherCache', {});

  $('#weather-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const query = $('#weather-query').value.trim();
    if (query) searchCity(query);
  });
  $('#weather-locate').addEventListener('click', () => locate(false));
  onSettings((path) => { if (touches(path, 'tempUnit')) refresh(); });
  setInterval(refresh, CACHE_MS);

  if (state.cities.length) refresh();
  else { refresh(); locate(true); }
}
