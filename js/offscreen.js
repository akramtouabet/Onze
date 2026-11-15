// Onze — lecteur de musique de la page cachée (« offscreen »).
// Reçoit ses ordres du service worker ; n'a accès qu'à chrome.runtime.

let audio = null;
let fadeTimer = 0;

function fade(player, to, ms, then) {
  const from = player.volume;
  const start = performance.now();
  clearInterval(fadeTimer);
  fadeTimer = setInterval(() => {
    const k = Math.min(1, (performance.now() - start) / ms);
    player.volume = Math.max(0, Math.min(1, from + (to - from) * k));
    if (k === 1) { clearInterval(fadeTimer); then?.(); }
  }, 40);
}

function release(player) {
  player.pause();
  player.removeAttribute('src');
  player.load();
}

function play({ url, loop, volume }) {
  if (audio) release(audio);
  const player = audio = new Audio(url);
  player.loop = loop;
  player.volume = 0;
  const failed = () => {
    if (audio !== player) return;
    audio = null;
    chrome.runtime.sendMessage({ target: 'background', cmd: 'failed' }).catch(() => {});
  };
  player.addEventListener('error', failed);
  player.play().then(() => { if (audio === player) fade(player, volume, 900); }, failed);
}

function stop() {
  if (!audio) return;
  const player = audio;
  audio = null;
  fade(player, 0, 500, () => release(player));
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.target !== 'offscreen') return;
  if (message.cmd === 'play') play(message);
  else if (message.cmd === 'stop') stop();
  else if (message.cmd === 'volume' && audio) { clearInterval(fadeTimer); audio.volume = Math.max(0, Math.min(1, message.volume)); }
});
