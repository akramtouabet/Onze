// Onze — langue de l'interface.
// Le français est la langue source : les textes sont écrits en français dans la page et le code.
// Pour une autre langue, un dictionnaire (js/i18n-<langue>.js) associe chaque texte français à sa
// traduction ; la page est traduite au chargement, puis à chaque ajout de texte.
// Ajouter une langue : créer js/i18n-xx.js sur le modèle de i18n-en.js, ajouter « xx » à LANGS
// et une <option> dans Réglages → Général.

export const LANGS = ['fr', 'en'];
const LOCALES = { fr: 'fr-FR', en: 'en-US' };
const ATTRS = ['title', 'aria-label', 'placeholder', 'alt'];
/** Zones de texte saisi par l'utilisateur : jamais traduites. */
const USER_TEXT = '[contenteditable], textarea, .task-text, #quote, #mantra, #focus-text, #name';

let texts = null; // { 'texte français': 'traduction' }
let patterns = []; // [[RegExp, 'traduction avec $1' | fonction]]

export const lang = () => document.documentElement.lang || 'fr';

/** Langue régionale pour les dates et les nombres : celle du navigateur si elle correspond. */
export function locale() {
  const browser = navigator.language || '';
  return browser.toLowerCase().startsWith(lang()) ? browser : LOCALES[lang()] || 'fr-FR';
}

function translate(source) {
  if (!texts) return source;
  const key = source.replace(/\s+/g, ' ').trim();
  if (!key) return source;
  let out = texts[key];
  if (out === undefined) {
    for (const [regex, replacement] of patterns) {
      if (regex.test(key)) { out = key.replace(regex, replacement); break; }
    }
  }
  if (out === undefined) return source;
  // Conserve les espaces autour du texte (ils séparent les éléments voisins).
  return source.match(/^\s*/)[0] + out + source.match(/\s*$/)[0];
}

/** Traduit un texte français ; les {variables} sont remplacées après traduction. */
export function t(source, vars) {
  let out = translate(source);
  if (vars) for (const [name, value] of Object.entries(vars)) out = out.replaceAll(`{${name}}`, String(value));
  return out;
}

function translateText(node) {
  if (node.parentElement?.closest(USER_TEXT)) return;
  const out = translate(node.nodeValue);
  if (out !== node.nodeValue) node.nodeValue = out;
}

function translateAttrs(element) {
  for (const attr of ATTRS) {
    const value = element.getAttribute(attr);
    if (!value) continue;
    const out = translate(value);
    if (out !== value) element.setAttribute(attr, out);
  }
}

function translateTree(root) {
  if (root.nodeType === Node.TEXT_NODE) { translateText(root); return; }
  if (root.nodeType !== Node.ELEMENT_NODE || root.matches('script, style, svg')) return;
  translateAttrs(root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === Node.TEXT_NODE) translateText(node); else translateAttrs(node);
  }
}

/** À appeler une fois, avant d'afficher quoi que ce soit. */
export async function initI18n(wanted) {
  const code = LANGS.includes(wanted) ? wanted : 'fr';
  document.documentElement.lang = code;
  if (code === 'fr') return;
  try {
    const module = await import(`./i18n-${code}.js`);
    texts = module.TEXTS;
    patterns = module.PATTERNS || [];
  } catch (e) {
    console.warn('Onze : dictionnaire de langue introuvable', e);
    document.documentElement.lang = 'fr';
    return;
  }
  document.title = translate(document.title);
  translateTree(document.body);
  new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'characterData') translateText(m.target);
      else if (m.type === 'attributes') translateAttrs(m.target);
      else m.addedNodes.forEach(translateTree);
    }
  }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}
