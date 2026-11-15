// Onze — fond d'écran : Unsplash (avec clé) → Wikimedia Commons → Lorem Picsum → dégradé (hors ligne).
// La photo suivante est choisie et préchargée à l'avance pour s'afficher instantanément.
import { store, onSettings, touches } from './storage.js';
import { $, $$, dayKey, debounce, el, icon, pad, pick, toast } from './utils.js';
import * as idb from './idb.js';

/** Thèmes proposés dans les réglages → mots-clés envoyés à Unsplash. */
const THEMES = {
  nature: 'nature landscape', montagne: 'mountains', mer: 'ocean coast', foret: 'forest', ville: 'city skyline',
  desert: 'desert dunes', etoiles: 'night sky stars', architecture: 'architecture', minimal: 'minimal landscape', animaux: 'wildlife',
};
const UTM = '?utm_source=onze_nouvel_onglet&utm_medium=referral';
const NET_TIMEOUT = 8000; // au-delà, on passe à la source suivante (puis au dégradé)
const IMG_TIMEOUT = 15000;

let state = { current: null, next: null, nextSource: '', key: '', source: '' };
let favs = [];
let banned = [];
let layers = [];
let activeLayer = 0;
let objectUrl = null;
let thumbUrls = [];

const saveState = () => store.set('bg', state);
const unsplashKey = () => store.settings.unsplashKey.trim();

function targetSize() {
  const w = Math.min(3840, Math.max(1280, Math.ceil((screen.width * devicePixelRatio) / 320) * 320));
  return { w, h: Math.round((w * screen.height) / screen.width) };
}

/** Période d'affichage courante selon la fréquence choisie. */
function periodKey() {
  const freq = store.settings.photoFrequency;
  const now = new Date();
  if (freq === 'tab') return '';
  if (freq === 'hour') return `${dayKey(now)}-${pad(now.getHours())}`;
  return dayKey(now);
}

// ── Sources ──

async function fetchUnsplash() {
  const themes = store.settings.photoThemes.filter((t) => THEMES[t]);
  const url = new URL('https://api.unsplash.com/photos/random');
  url.searchParams.set('orientation', 'landscape');
  url.searchParams.set('content_filter', 'high');
  if (themes.length) url.searchParams.set('query', THEMES[pick(themes)]);
  const res = await fetch(url, { headers: { Authorization: `Client-ID ${unsplashKey()}`, 'Accept-Version': 'v1' }, signal: AbortSignal.timeout(NET_TIMEOUT) });
  if (!res.ok) throw new Error('Unsplash ' + res.status);
  const p = await res.json();
  const { w } = targetSize();
  return {
    id: 'unsplash:' + p.id,
    url: `${p.urls.raw}&w=${w}&q=80&auto=format&fit=max`,
    thumb: p.urls.thumb,
    author: p.user.name,
    authorUrl: p.user.links.html + UTM,
    location: p.location?.name || '',
    via: 'Unsplash',
    ping: p.links.download_location,
  };
}

/** Thèmes → catégories d'« images remarquables » de Wikimedia Commons (photos primées, licences libres). */
const COMMONS = {
  nature: ['landscapes', 'lakes', 'waterfalls'], montagne: ['mountains', 'volcanoes'], mer: ['beaches', 'coasts'],
  foret: ['forests'], ville: ['cityscapes', 'skylines'], desert: ['landscapes', 'sunsets'], etoiles: ['astronomy', 'sunsets'],
  architecture: ['architecture'], minimal: ['sunsets', 'lakes'], animaux: ['landscapes'],
};
const stripHtml = (html) => new DOMParser().parseFromString(html || '', 'text/html').body.textContent.replace(/\s+/g, ' ').trim();

async function fetchCommons() {
  const themes = store.settings.photoThemes.filter((t) => COMMONS[t]);
  const category = pick(COMMONS[themes.length ? pick(themes) : 'nature']);
  // Wikimedia ne sert que des largeurs standard : 1920 px, ou 3840 px pour les écrans très denses.
  const width = targetSize().w > 2200 ? 3840 : 1920;
  const query = (randomStart) => {
    const url = new URL('https://commons.wikimedia.org/w/api.php');
    url.search = new URLSearchParams({
      action: 'query', format: 'json', origin: '*',
      generator: 'categorymembers', gcmtitle: `Category:Featured pictures of ${category}`, gcmtype: 'file',
      gcmlimit: '30', gcmsort: 'timestamp', gcmdir: 'newer',
      prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: String(width),
      iiextmetadatafilter: 'Artist|LicenseShortName',
    });
    // Point de départ aléatoire dans l'historique de la catégorie, pour varier les photos.
    if (randomStart) {
      const from = Date.UTC(2009, 0, 1);
      url.searchParams.set('gcmstart', new Date(from + Math.random() * (Date.now() - from)).toISOString());
    }
    return fetch(url, { signal: AbortSignal.timeout(NET_TIMEOUT) }).then((r) => (r.ok ? r.json() : Promise.reject(new Error('Commons ' + r.status))));
  };
  const usable = (data) => Object.values(data.query?.pages || {}).filter((p) => {
    const i = p.imageinfo?.[0];
    return i && i.mime === 'image/jpeg' && i.width >= 1600 && i.width / i.height >= 1.3 && i.width / i.height <= 2.4;
  });
  let pages = usable(await query(true));
  if (!pages.length) pages = usable(await query(false));
  const candidates = pages.filter((p) => !banned.includes('commons:' + p.pageid));
  if (!candidates.length) throw new Error('Commons : aucune photo utilisable');
  const page = pick(candidates);
  const info = page.imageinfo[0];
  const image = info.thumburl || info.url;
  const license = info.extmetadata?.LicenseShortName?.value || '';
  return {
    id: 'commons:' + page.pageid,
    url: image,
    thumb: image.replace(/\/\d+px-/, '/330px-'),
    author: stripHtml(info.extmetadata?.Artist?.value).slice(0, 60) || 'Wikimedia Commons',
    authorUrl: info.descriptionurl,
    location: page.title.replace(/^File:/, '').replace(/\.[a-z]+$/i, '').replace(/_/g, ' ').slice(0, 70),
    via: license ? `Wikimedia Commons, ${license}` : 'Wikimedia Commons',
  };
}

async function fetchPicsum() {
  const { w, h } = targetSize();
  const seed = Math.random().toString(36).slice(2, 10);
  try {
    const res = await fetch(`https://picsum.photos/seed/${seed}/info`, { signal: AbortSignal.timeout(NET_TIMEOUT) });
    if (res.ok) {
      const info = await res.json();
      return {
        id: 'picsum:' + info.id,
        url: `https://picsum.photos/id/${info.id}/${w}/${h}.jpg`,
        thumb: `https://picsum.photos/id/${info.id}/240/150.jpg`,
        author: info.author, authorUrl: info.url, location: '', via: 'Picsum',
      };
    }
  } catch { /* hors ligne : on tente quand même l'adresse directe, le cache peut répondre */ }
  return {
    id: 'picsum:s-' + seed,
    url: `https://picsum.photos/seed/${seed}/${w}/${h}.jpg`,
    thumb: `https://picsum.photos/seed/${seed}/240/150.jpg`,
    author: 'Lorem Picsum', authorUrl: 'https://picsum.photos', location: '', via: '',
  };
}

/** Choisit une photo selon la source réglée, en évitant la photo courante et les photos écartées. */
async function choose(excludeId) {
  const source = store.settings.photoSource;
  if (source === 'custom') {
    const ids = await idb.photoKeys();
    const pool = ids.filter((id) => 'custom:' + id !== excludeId);
    if (ids.length) { const id = pick(pool.length ? pool : ids); return { id: 'custom:' + id, custom: id }; }
  }
  if (source === 'favorites' && favs.length) {
    const pool = favs.filter((f) => f.id !== excludeId);
    return { ...pick(pool.length ? pool : favs) };
  }
  let last = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    let photo = null;
    if (unsplashKey()) {
      try { photo = await fetchUnsplash(); } catch (e) { console.warn('Onze : Unsplash indisponible, repli sur Wikimedia Commons', e); }
    }
    if (!photo) {
      try { photo = await fetchCommons(); } catch (e) { console.warn('Onze : Wikimedia Commons indisponible, repli sur Picsum', e); }
    }
    photo ??= await fetchPicsum();
    last = photo;
    if (!banned.includes(photo.id) && photo.id !== excludeId) return photo;
  }
  return last;
}

// ── Affichage ──

const preload = (url) => new Promise((resolve) => {
  const img = new Image();
  const timer = setTimeout(() => { img.src = ''; resolve(false); }, IMG_TIMEOUT);
  img.onload = () => { clearTimeout(timer); resolve(true); };
  img.onerror = () => { clearTimeout(timer); resolve(false); };
  img.src = url;
});

async function resolveUrl(photo) {
  if (!photo.custom) return photo.url;
  const record = await idb.getPhoto(photo.custom).catch(() => null);
  return record ? URL.createObjectURL(record.blob) : null;
}

async function show(photo) {
  const url = await resolveUrl(photo);
  if (!url || !(await preload(url))) {
    if (url && photo.custom) URL.revokeObjectURL(url);
    return false;
  }
  const incoming = layers[1 - activeLayer];
  incoming.style.backgroundImage = `url("${url.replace(/"/g, '%22')}")`;
  incoming.classList.add('visible');
  layers[activeLayer].classList.remove('visible');
  activeLayer = 1 - activeLayer;
  const previous = objectUrl;
  objectUrl = photo.custom ? url : null;
  if (previous) setTimeout(() => URL.revokeObjectURL(previous), 2000);

  state.current = photo;
  renderCredit();
  // Unsplash demande de signaler l'affichage d'une photo.
  if (photo.ping && unsplashKey()) fetch(photo.ping, { headers: { Authorization: `Client-ID ${unsplashKey()}` } }).catch(() => {});
  return true;
}

function showGradient() {
  layers.forEach((l) => l.classList.remove('visible'));
  state.current = null;
  renderCredit();
}

async function prefetchNext() {
  try {
    const photo = await choose(state.current?.id);
    if (!photo) return;
    if (!photo.custom && !(await preload(photo.url))) return; // image injoignable : on ne la retient pas
    state.next = photo;
    state.nextSource = store.settings.photoSource;
    saveState();
  } catch (e) {
    console.warn('Onze : préchargement impossible', e);
  }
}

/** Passe à la photo suivante (préchargée si possible). */
async function rotate() {
  const source = store.settings.photoSource;
  const previous = state.current;
  let candidate = state.next && state.nextSource === source && !banned.includes(state.next.id) ? state.next : null;
  state.next = null;

  let ok = candidate ? await show(candidate) : false;
  if (!ok) {
    // Pas de photo préchargée, ou elle ne se charge plus (source en panne) : on en choisit une nouvelle.
    const fresh = await choose(previous?.id).catch(() => null);
    ok = fresh ? await show(fresh) : false;
  }
  if (!ok && previous) ok = await show(previous); // hors ligne : la photo précédente est sans doute en cache
  if (!ok) showGradient();

  state.key = periodKey();
  state.source = source;
  saveState();
  prefetchNext();
}

// ── Crédit et actions ──

const isFav = () => !!state.current && favs.some((f) => f.id === state.current.id);

function renderCredit() {
  const photo = state.current;
  const author = $('#credit-author');
  author.removeAttribute('href');
  if (!photo) author.textContent = 'Dégradé Onze';
  else if (photo.custom) author.textContent = 'Photo personnelle';
  else {
    author.textContent = `${photo.author}${photo.via ? ' · ' + photo.via : ''}`;
    if (photo.authorUrl) author.href = photo.authorUrl;
  }
  $('#credit-location').textContent = photo?.location || '';
  const online = !!photo && !photo.custom;
  $('#photo-fav').hidden = !online;
  $('#photo-ban').hidden = !online;
  $('#photo-fav').setAttribute('aria-pressed', String(isFav()));
}

function toggleFav() {
  const photo = state.current;
  if (!photo || photo.custom) return;
  if (isFav()) favs = favs.filter((f) => f.id !== photo.id);
  else { favs.push({ ...photo, ping: undefined }); toast('Photo ajoutée à vos favorites.'); }
  store.set('photoFavs', favs);
  renderCredit(); renderLibrary();
}

function ban() {
  const photo = state.current;
  if (!photo || photo.custom) return;
  banned.push(photo.id);
  favs = favs.filter((f) => f.id !== photo.id);
  store.set('photoBanned', banned);
  store.set('photoFavs', favs);
  toast('Cette photo ne sera plus affichée.');
  renderLibrary();
  rotate();
}

// ── Bibliothèque (réglages) ──

function thumb(src, label, onRemove) {
  return el('div', { class: 'thumb' },
    el('img', { src, alt: '', loading: 'lazy' }),
    el('button', { type: 'button', 'aria-label': label, title: label, onclick: onRemove }, icon('close')));
}

async function renderLibrary() {
  thumbUrls.forEach((u) => URL.revokeObjectURL(u));
  thumbUrls = [];
  const records = await idb.allPhotos().catch(() => []);
  $('#custom-photos').replaceChildren(...records.map((r) => {
    const url = URL.createObjectURL(r.blob);
    thumbUrls.push(url);
    return thumb(url, `Supprimer ${r.name || 'cette image'}`, async () => {
      await idb.removePhoto(r.id);
      renderLibrary();
      if (state.current?.custom === r.id) rotate();
    });
  }));
  $('#fav-photos').replaceChildren(...favs.map((f) => thumb(f.thumb || f.url, 'Retirer des favorites', () => {
    favs = favs.filter((x) => x.id !== f.id);
    store.set('photoFavs', favs);
    renderCredit(); renderLibrary();
  })));
  $('#banned-count').textContent = banned.length ? `${banned.length} photo${banned.length > 1 ? 's' : ''} écartée${banned.length > 1 ? 's' : ''}` : 'Aucune photo écartée';
  $('#banned-reset').disabled = !banned.length;
}

async function importFiles(files) {
  const images = [...files].filter((f) => f.type.startsWith('image/'));
  if (!images.length) return;
  for (const file of images) await idb.addPhoto(file, file.name);
  toast(`${images.length} image${images.length > 1 ? 's' : ''} importée${images.length > 1 ? 's' : ''}.`);
  renderLibrary();
  if (store.settings.photoSource !== 'custom') store.setPath('photoSource', 'custom');
  else rotate();
}

export async function init() {
  layers = $$('#bg .bg-layer');
  $('#photo-fav').addEventListener('click', toggleFav);
  $('#photo-ban').addEventListener('click', ban);
  $('#photo-next').addEventListener('click', rotate);
  $('#photo-import').addEventListener('change', (e) => { importFiles(e.target.files); e.target.value = ''; });
  $('#banned-reset').addEventListener('click', () => { banned = []; store.set('photoBanned', banned); renderLibrary(); });

  const refresh = debounce(() => { state.next = null; rotate(); }, 900);
  onSettings((path) => { if (touches(path, 'photoSource', 'photoThemes', 'unsplashKey') && path !== '*') refresh(); });
  $('#settings').addEventListener('panel:open', renderLibrary);
  renderCredit();

  state = { ...state, ...(await store.get('bg', {})) };
  favs = await store.get('photoFavs', []);
  banned = await store.get('photoBanned', []);

  const sameContext = state.current && state.source === store.settings.photoSource
    && store.settings.photoFrequency !== 'tab' && state.key === periodKey();
  if (sameContext && (await show(state.current))) {
    if (!state.next) prefetchNext();
  } else {
    await rotate();
  }
}
