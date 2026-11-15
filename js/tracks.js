// Onze — musique : un morceau embarqué (en boucle) et des radios en direct, classées par pays.
// Partagé par le nouvel onglet, la fenêtre de l'icône et le service worker.

export const TRACKS = {
  lullaby: { name: 'Lullaby', url: 'audio/lullaby.mp3', loop: true },
  fip: { name: 'Radio FIP', url: 'https://icecast.radiofrance.fr/fip-midfi.mp3' },
  fipjazz: { name: 'FIP Jazz', url: 'https://icecast.radiofrance.fr/fipjazz-midfi.mp3' },
  fipgroove: { name: 'FIP Groove', url: 'https://icecast.radiofrance.fr/fipgroove-midfi.mp3' },
  classique: { name: 'France Musique', url: 'https://icecast.radiofrance.fr/francemusique-midfi.mp3' },
  loungefm: { name: 'LoungeFM', url: 'https://stream.lounge.fm/digital.mp3' },
  classicfm: { name: 'Classic FM', url: 'https://media-ice.musicradio.com/ClassicFMMP3' },
  paradise: { name: 'Radio Paradise', url: 'https://stream.radioparadise.com/mp3-128' },
  mellow: { name: 'Paradise Mellow', url: 'https://stream.radioparadise.com/mellow-128' },
  kexp: { name: 'KEXP', url: 'https://kexp-mp3-128.streamguys1.com/kexp128.mp3' },
};

/** Onglet « Musique » : morceaux embarqués. */
export const MUSIC = ['lullaby'];

/** Onglet « Radio » : stations par pays (nom du pays en français, traduit à l'affichage). */
export const RADIOS = [
  { country: 'France', ids: ['fip', 'fipjazz', 'fipgroove', 'classique'] },
  { country: 'Autriche', ids: ['loungefm'] },
  { country: 'Royaume-Uni', ids: ['classicfm'] },
  { country: 'États-Unis', ids: ['paradise', 'mellow', 'kexp'] },
];

export const isRadio = (id) => RADIOS.some((group) => group.ids.includes(id));

export const DEFAULT_MUSIC_LEVEL = 0.7;
export const DEFAULT_VOLUME = 0.6;
