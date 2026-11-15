// Onze — sons d'ambiance générés avec la Web Audio API, et choix de la musique (voir music.js).
import { store, onSettings, touches } from './storage.js';
import { $, $$, el, toast } from './utils.js';
import { music } from './music.js';
import { TRACKS } from './tracks.js';
import { mountMusicPicker } from './music-ui.js';
import { t } from './i18n.js';

const SOUNDS = [
  { id: 'rain', name: 'Pluie' },
  { id: 'forest', name: 'Forêt' },
  { id: 'cafe', name: 'Café' },
  { id: 'white', name: 'Bruit blanc' },
];
let ctx = null;
let master = null;
const buffers = {};
const playing = {}; // id → { gain, stop }
let levels = { rain: 0.6, forest: 0.5, cafe: 0.5, white: 0.35 };

// ── Briques sonores ──

/** Bruit blanc, rose ou brun dans un tampon de 4 secondes joué en boucle. */
function noise(type) {
  if (!buffers[type]) {
    const length = ctx.sampleRate * 4;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0, b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      if (type === 'white') data[i] = white * 0.5;
      else if (type === 'brown') { last = (last + 0.02 * white) / 1.02; data[i] = last * 3.5; }
      else { // rose (approximation de Paul Kellet)
        b0 = 0.99765 * b0 + white * 0.0990460;
        b1 = 0.96300 * b1 + white * 0.2965164;
        b2 = 0.57000 * b2 + white * 1.0526913;
        data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.2;
      }
    }
    buffers[type] = buffer;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffers[type];
  source.loop = true;
  source.start();
  return source;
}

function filter(type, frequency, q = 0.7) {
  const node = ctx.createBiquadFilter();
  node.type = type;
  node.frequency.value = frequency;
  node.Q.value = q;
  return node;
}

function gain(value) {
  const node = ctx.createGain();
  node.gain.value = value;
  return node;
}

/** Oscillateur lent qui module un paramètre (souffle du vent, brouhaha). */
function lfo(frequency, depth, target) {
  const osc = ctx.createOscillator();
  osc.frequency.value = frequency;
  osc.connect(gain(depth)).connect(target);
  osc.start();
  return osc;
}

/** Répète une action à intervalles aléatoires ; renvoie la fonction d'arrêt. */
function randomly(minMs, maxMs, action) {
  let timer;
  const loop = () => { action(); timer = setTimeout(loop, minMs + Math.random() * (maxMs - minMs)); };
  timer = setTimeout(loop, minMs * Math.random());
  return () => clearTimeout(timer);
}

function chirp(out) {
  const count = 2 + Math.floor(Math.random() * 4);
  const base = 2400 + Math.random() * 2200;
  for (let i = 0; i < count; i++) {
    const t = ctx.currentTime + i * (0.13 + Math.random() * 0.06);
    const osc = ctx.createOscillator();
    const g = gain(0);
    osc.frequency.setValueAtTime(base, t);
    osc.frequency.exponentialRampToValueAtTime(base * (1.15 + Math.random() * 0.3), t + 0.05);
    osc.frequency.exponentialRampToValueAtTime(base * 0.9, t + 0.11);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + 0.14);
  }
}

function clink(out) {
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = gain(0);
  osc.frequency.value = 1800 + Math.random() * 1800;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.025, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
  osc.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + 0.4);
}

/** Chaque ambiance branche ses sources sur « out » et renvoie de quoi tout arrêter. */
const BUILDERS = {
  white(out) {
    const src = noise('white');
    src.connect(filter('lowpass', 9000)).connect(gain(0.5)).connect(out);
    return [src];
  },
  rain(out) {
    const drops = noise('pink');
    drops.connect(filter('highpass', 450)).connect(filter('lowpass', 7500)).connect(gain(1.1)).connect(out);
    const rumble = noise('brown');
    rumble.connect(filter('lowpass', 220)).connect(gain(0.45)).connect(out);
    return [drops, rumble];
  },
  forest(out) {
    const wind = noise('brown');
    const windGain = gain(0.55);
    wind.connect(filter('lowpass', 650)).connect(windGain).connect(out);
    const sway = lfo(0.09, 0.2, windGain.gain);
    const leaves = noise('white');
    const leavesGain = gain(0.035);
    leaves.connect(filter('bandpass', 4200, 0.5)).connect(leavesGain).connect(out);
    const rustle = lfo(0.15, 0.02, leavesGain.gain);
    return [wind, sway, leaves, rustle, randomly(2200, 7000, () => chirp(out))];
  },
  cafe(out) {
    const murmur = noise('brown');
    murmur.connect(filter('lowpass', 380)).connect(gain(0.85)).connect(out);
    const chatter = noise('pink');
    const chatterGain = gain(0.5);
    chatter.connect(filter('bandpass', 750, 0.8)).connect(chatterGain).connect(out);
    const waveA = lfo(0.7, 0.16, chatterGain.gain);
    const waveB = lfo(2.3, 0.1, chatterGain.gain);
    return [murmur, chatter, waveA, waveB, randomly(2500, 9000, () => clink(out))];
  },
};

// ── Lecture ──

function ensureContext() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  ctx = new AudioContext();
  master = gain(store.settings.soundVolume);
  master.connect(ctx.destination);
}

function play(id) {
  ensureContext();
  const out = gain(0);
  out.connect(master);
  const parts = BUILDERS[id](out);
  out.gain.setValueAtTime(0, ctx.currentTime);
  out.gain.linearRampToValueAtTime(levels[id], ctx.currentTime + 0.8);
  playing[id] = {
    gain: out,
    stop() {
      out.gain.cancelScheduledValues(ctx.currentTime);
      out.gain.setValueAtTime(out.gain.value, ctx.currentTime);
      out.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
      setTimeout(() => {
        parts.forEach((p) => (typeof p === 'function' ? p() : p.stop()));
        out.disconnect();
      }, 600);
    },
  };
}

function toggle(id) {
  if (playing[id]) { playing[id].stop(); delete playing[id]; }
  else play(id);
  renderState();
}

let picker = null;

function renderState() {
  $$('#sound-list .chip').forEach((b) => b.setAttribute('aria-pressed', String(!!playing[b.dataset.sound])));
  picker?.update();
  $('.tools [data-widget="sounds"]').classList.toggle('active', Object.keys(playing).length > 0 || !!music.current());
}

export async function init() {
  levels = { ...levels, ...(await store.get('soundLevels', {})) };

  $('#sound-list').replaceChildren(...SOUNDS.map((s) => el('li', {},
    el('button', { type: 'button', class: 'chip', 'aria-pressed': 'false', dataset: { sound: s.id }, text: s.name, onclick: () => toggle(s.id) }),
    el('input', {
      type: 'range', min: '0', max: '1', step: '0.01', value: String(levels[s.id]), 'aria-label': `Volume ${t(s.name)}`,
      oninput: (e) => {
        levels[s.id] = Number(e.target.value);
        playing[s.id]?.gain.gain.setTargetAtTime(levels[s.id], ctx.currentTime, 0.05);
        store.set('soundLevels', levels);
      },
    }))));

  picker = mountMusicPicker($('#music-list'));
  const musicLevel = $('#music-level');
  musicLevel.addEventListener('input', () => music.setLevel(Number(musicLevel.value)));
  await music.init(({ failedId }) => {
    if (document.activeElement !== musicLevel) musicLevel.value = String(music.level());
    renderState();
    if (failedId) toast(t('Impossible de lire « {name} » pour le moment.', { name: TRACKS[failedId]?.name || '' }));
  });

  onSettings((path) => {
    if (touches(path, 'soundVolume') && master) master.gain.setTargetAtTime(store.settings.soundVolume, ctx.currentTime, 0.05);
  });
}
