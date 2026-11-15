// Onze — connexion Google et synchronisation des données.
// Les données sont enregistrées dans un fichier JSON de l'espace privé de l'application
// sur Google Drive (« appDataFolder »), invisible dans les fichiers de l'utilisateur.
// Fusion : pour chaque donnée (tâches, notes…), la version modifiée le plus récemment l'emporte.
import { store, SYNC_KEYS } from './storage.js';
import { $, debounce, toast } from './utils.js';
import { locale, t } from './i18n.js';

const FILE = 'onze-data.json';
const API = 'https://www.googleapis.com';
const SCOPES = 'openid email profile https://www.googleapis.com/auth/drive.appdata';
const hasIdentity = !!globalThis.chrome?.identity?.launchWebAuthFlow;

let auth = null; // { token, exp, email, name, picture, lastSync }
let syncing = false;
let lastError = '';

const saveAuth = () => (auth ? store.set('cloudAuth', auth) : store.remove('cloudAuth'));

// ── Authentification (OAuth 2, flux implicite via chrome.identity) ──

async function authorize(interactive) {
  const clientId = store.settings.googleClientId.trim();
  if (!clientId) throw new Error(t('Renseignez d\'abord votre identifiant client OAuth (étapes dans le README).'));
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: clientId,
    response_type: 'token',
    redirect_uri: chrome.identity.getRedirectURL(),
    scope: SCOPES,
    prompt: interactive ? 'select_account' : 'none',
    ...(!interactive && auth?.email ? { login_hint: auth.email } : {}),
  });
  const redirect = await chrome.identity.launchWebAuthFlow({ url: url.toString(), interactive });
  const params = new URLSearchParams(new URL(redirect).hash.slice(1));
  const token = params.get('access_token');
  if (!token) throw new Error(params.get('error') || t('Connexion refusée'));
  auth = { ...auth, token, exp: Date.now() + (Number(params.get('expires_in') || 3600) - 90) * 1000 };
}

/** Jeton valide ; renouvelé en silence quand il a expiré (dure une heure). */
async function getToken() {
  if (auth?.token && Date.now() < auth.exp) return auth.token;
  await authorize(false);
  await saveAuth();
  return auth.token;
}

async function api(path, options = {}) {
  const token = await getToken();
  const res = await fetch(API + path, { ...options, headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) } });
  if (res.status === 401) { auth.token = null; throw new Error(t('Session Google expirée')); }
  if (!res.ok) throw new Error(t('Google Drive a répondu {status}', { status: res.status }));
  return res;
}

// ── Synchronisation ──

async function upload(fileId, body) {
  const json = JSON.stringify(body);
  if (fileId) {
    return api(`/upload/drive/v3/files/${fileId}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: json });
  }
  const boundary = 'onze' + Date.now();
  const metadata = JSON.stringify({ name: FILE, parents: ['appDataFolder'] });
  const multipart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${json}\r\n--${boundary}--`;
  return api('/upload/drive/v3/files?uploadType=multipart', { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body: multipart });
}

/** Recharge la page pour afficher les données reçues, sans interrompre une saisie en cours. */
export function reloadSoon(message = t('Données mises à jour depuis votre compte Google.')) {
  toast(message);
  const attempt = () => {
    const a = document.activeElement;
    const editing = a && (a.matches('input:not([type="checkbox"]), textarea, select') || a.isContentEditable);
    if (editing) setTimeout(attempt, 2000); else location.reload();
  };
  setTimeout(attempt, 1200);
}

export async function sync({ manual = false } = {}) {
  if (!auth || syncing) return;
  syncing = true;
  lastError = '';
  render();
  try {
    const query = encodeURIComponent(`name='${FILE}'`);
    const list = await (await api(`/drive/v3/files?spaces=appDataFolder&fields=files(id)&q=${query}`)).json();
    const fileId = list.files?.[0]?.id || null;
    const remote = fileId ? await (await api(`/drive/v3/files/${fileId}?alt=media`)).json() : { v: 1, keys: {} };
    remote.keys ??= {};

    const meta = { ...store.syncMeta() };
    const pulled = [];
    let pushed = false;
    for (const key of SYNC_KEYS) {
      const value = await store.get(key);
      // Donnée locale jamais horodatée (créée avant la connexion) : envoyée seulement si le compte n'en a pas.
      const localTime = meta[key] || (value !== undefined ? 1 : 0);
      const remoteTime = remote.keys[key]?.t || 0;
      if (remoteTime > localTime) {
        await store.set(key, remote.keys[key].v, { silent: true });
        meta[key] = remoteTime;
        pulled.push(key);
      } else if (localTime > remoteTime && value !== undefined) {
        remote.keys[key] = { t: localTime, v: value };
        meta[key] = localTime;
        pushed = true;
      }
    }
    if (pushed) await upload(fileId, { ...remote, v: 1, updatedAt: new Date().toISOString() });

    // Conserve les horodatages des modifications faites pendant la synchronisation.
    const latest = store.syncMeta();
    for (const key of Object.keys(latest)) meta[key] = Math.max(meta[key] || 0, latest[key] || 0);
    await store.setSyncMeta(meta);

    auth.lastSync = Date.now();
    await saveAuth();
    if (pulled.length) reloadSoon();
    else if (manual) toast(t('Synchronisation terminée.'));
  } catch (e) {
    console.warn('Onze : synchronisation impossible', e);
    lastError = e.message || t('Erreur inconnue');
    if (manual) toast(t('Synchronisation impossible : {error}', { error: lastError }), 5000);
  } finally {
    syncing = false;
    render();
  }
}

// ── Compte ──

async function signIn() {
  if (!hasIdentity) { toast(t('La connexion Google n\'est disponible qu\'une fois l\'extension installée dans Chrome.'), 5000); return; }
  try {
    store.flush();
    await authorize(true);
    const profile = await (await api('/oauth2/v3/userinfo')).json();
    auth = { ...auth, email: profile.email, name: profile.name || profile.email, picture: profile.picture || '' };
    await saveAuth();
    render();
    await sync({ manual: true });
  } catch (e) {
    console.warn('Onze : connexion Google impossible', e);
    toast(t('Connexion impossible : {error}', { error: e.message || t('vérifiez l\'identifiant client et l\'URI de redirection') }), 6000);
  }
}

async function signOut() {
  const token = auth?.token;
  auth = null;
  await saveAuth();
  render();
  if (token) {
    fetch('https://oauth2.googleapis.com/revoke', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `token=${encodeURIComponent(token)}`,
    }).catch(() => {});
  }
  toast(t('Déconnecté. Vos données restent sur cet appareil.'));
}

function ago(time) {
  const minutes = Math.round((Date.now() - time) / 60000);
  if (minutes < 1) return t('à l\'instant');
  if (minutes < 60) return t('il y a {n} min', { n: minutes });
  const hours = Math.round(minutes / 60);
  return hours < 24 ? t('il y a {n} h', { n: hours }) : t('le {date}', { date: new Date(time).toLocaleDateString(locale()) });
}

function render() {
  $('#cloud-out').hidden = !!auth;
  $('#cloud-in').hidden = !auth;
  $('#cloud-redirect').textContent = hasIdentity ? chrome.identity.getRedirectURL() : t('Affichée une fois l\'extension chargée dans Chrome.');
  if (!auth) return;
  const avatar = $('#cloud-avatar');
  if (auth.picture) avatar.src = auth.picture; else avatar.removeAttribute('src');
  $('#cloud-name').textContent = auth.name === auth.email ? auth.email : `${auth.name} · ${auth.email}`;
  $('#cloud-status').textContent = syncing ? t('Synchronisation…')
    : lastError ? t('Erreur : {error}', { error: lastError })
    : auth.lastSync ? t('Dernière synchronisation : {when}', { when: ago(auth.lastSync) }) : t('Pas encore synchronisé');
  $('#cloud-sync').disabled = syncing;
}

export async function init() {
  auth = await store.get('cloudAuth', null);

  $('#cloud-signin').addEventListener('click', signIn);
  $('#cloud-signout').addEventListener('click', signOut);
  $('#cloud-sync').addEventListener('click', () => sync({ manual: true }));
  $('#settings').addEventListener('panel:open', render);

  const auto = debounce(() => { if (auth && store.settings.cloudAuto) sync(); }, 4000);
  document.addEventListener('data-changed', auto);
  render();
  if (auth && hasIdentity && store.settings.cloudAuto) setTimeout(sync, 1500);
}
