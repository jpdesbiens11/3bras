// Mise en place guidée (D-G-056) : le doigt qui montre le chemin. Il va jusqu'au vrai bouton, l'allume, appuie et le
// touche, comme une personne qui navigue à une vitesse raisonnable : environ 1 seconde par toucher (2 s en « Plus lent »).
// Il mime aussi les gestes à faire (toucher, glisser une fiche, tenir 2 secondes) sans rien toucher pour vrai.
// Web Animations (CSSOM, permis par la CSP), aucune bibliothèque (P-1). Mouvement réduit : le doigt ne voyage pas,
// il apparaît sur le bouton, qui s'allume une seconde avant d'être touché.
import { $ } from '../etat.js?v=1.23.0';
import { el } from '../el.js?v=1.23.0';

const NS = 'http://www.w3.org/2000/svg';
const POINTE = { x: 17, y: 3 };                    // le bout de l'index, dans le dessin de 52 × 58
export const ANNULE = Symbol('guide annulé');
let lent = false, jeton = 0, pos = null;
const vivantes = new Set(), aRetablir = [];
export const setLent = (v) => { lent = !!v; };
const f = () => (lent ? 2 : 1);
export const reduit = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } };
const ecranH = () => Math.min(window.innerHeight, window.visualViewport?.height || Infinity);
const ecranL = () => Math.min(window.innerWidth, document.documentElement.clientWidth || Infinity, window.visualViewport?.width || Infinity);

/** Un nouveau jeton arrête tout ce que le doigt faisait. */
export function nouveau() { annuler(); return jeton; }
export function annuler() {
  jeton++;
  for (const a of vivantes) { try { a.cancel(); } catch (_) { /* déjà finie */ } }
  vivantes.clear();
  while (aRetablir.length) { try { aRetablir.pop()(); } catch (_) { /* nœud parti */ } }
  document.querySelectorAll('.gd-vise').forEach((n) => n.classList.remove('gd-vise'));
  $('#gd-doigt')?.classList.remove('vu');
  bouclier(false);
}
const verif = (j) => { if (j !== jeton) throw ANNULE; };
export const attendre = (ms, j) => new Promise((ok, non) => setTimeout(() => (j === jeton ? ok() : non(ANNULE)), ms));
function animer(n, images, opts, j) {
  const a = n.animate(images, { fill: 'forwards', ...opts });
  vivantes.add(a);
  return a.finished.then(() => { vivantes.delete(a); verif(j); return a; }, () => { vivantes.delete(a); throw ANNULE; });
}

/** Pendant le chemin, l'écran ne prend pas les touchers (la bulle, oui). */
export function bouclier(on) {
  const b = $('#gd-bouclier');
  if (on && !b) document.body.append(el('div', { id: 'gd-bouclier', 'aria-hidden': 'true' }));
  if (!on && b) b.remove();
}

function doigt() {
  let d = $('#gd-doigt');
  if (d) return d;
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('viewBox', '0 0 52 58'); s.setAttribute('aria-hidden', 'true');
  for (const [cls, dd] of [
    ['gd-main', 'M12 26 V8 a5 5 0 0 1 10 0 V22 a4.5 4.5 0 0 1 9 1 V25 a4.5 4.5 0 0 1 9 1.5 V28 a4 4 0 0 1 8 1.5 V38 c0 9 -6 16 -15 16 h-6 c-6 0 -9 -3 -12 -8 l-7 -11 a3.6 3.6 0 0 1 5.6 -4.4 Z'],
    ['gd-pli', 'M22 22 V31 M31 25 V32 M40 28 V33']]) {
    const p = document.createElementNS(NS, 'path'); p.setAttribute('class', cls); p.setAttribute('d', dd); s.append(p);
  }
  d = el('div', { id: 'gd-doigt', 'aria-hidden': 'true' }, el('i', { class: 'gd-onde' }), s);
  document.body.append(d);
  return d;
}
const tr = (p) => `translate(${Math.round(p.x - POINTE.x)}px, ${Math.round(p.y - POINTE.y)}px)`;
function poser(p) { const d = doigt(); d.style.transform = tr(p); pos = p; }

/** Le point à toucher : le centre de la partie visible (une grande zone : son haut). */
export function centre(n) {
  const r = n.getBoundingClientRect(), H = ecranH(), W = ecranL();
  const haut = Math.max(r.top, 0), bas = Math.min(r.bottom, H);
  return { x: (Math.max(r.left, 0) + Math.min(r.right, W)) / 2, y: haut + Math.min((bas - haut) / 2, 60), r };
}
/** Fait défiler jusqu'au bouton s'il n'est pas bien à l'écran (sous l'en-tête ou la barre de la feuille). */
async function montrer(n, j) {
  if (n.closest('header')) return;                                     // l'en-tête est collant : toujours visible
  const H = ecranH(), r = n.getBoundingClientRect(), feuille = n.closest('.sheet');
  const haut = (feuille ? feuille.querySelector('.sheet-bar') : $('header'))?.getBoundingClientRect().bottom || 0;
  if (r.top >= haut + 8 && Math.min(r.bottom, r.top + 120) <= H - 8) return;
  n.style.scrollMarginTop = `${Math.round(haut + 16)}px`;
  n.scrollIntoView({ block: r.height > H * 0.5 ? 'start' : 'center', behavior: reduit() ? 'auto' : 'smooth' });
  let y = null;
  for (let k = 0; k < 24; k++) { await attendre(50, j); const t = n.getBoundingClientRect().top; if (t === y) break; y = t; }
}
/** Le doigt voyage en courbe douce jusqu'au point (environ 0,5 s, 1 s en « Plus lent »). */
async function voyager(p, j) {
  const d = doigt(), H = ecranH(), W = ecranL();
  if (!d.classList.contains('vu')) { poser(pos || { x: W * 0.62, y: H + 40 }); d.classList.add('vu'); }
  if (reduit()) { poser(p); await attendre(120, j); return; }
  const a = pos || p, dx = p.x - a.x, dy = p.y - a.y, dist = Math.hypot(dx, dy);
  if (dist < 4) return;
  const c = { x: a.x + dx / 2 - dy * 0.18, y: a.y + dy / 2 + dx * 0.18 };   // point de contrôle : un léger arc, comme une main
  const images = Array.from({ length: 13 }, (_, k) => {
    const t = k / 12, u = 1 - t;
    return { transform: tr({ x: u * u * a.x + 2 * u * t * c.x + t * t * p.x, y: u * u * a.y + 2 * u * t * c.y + t * t * p.y }) };
  });
  await animer(d, images, { duration: (dist < 60 ? 280 : 520) * f(), easing: 'cubic-bezier(.45,.05,.3,1)' }, j);
  poser(p);
  for (const x of d.getAnimations()) x.cancel();
}
async function appuyer(j, onde = true) {
  const d = doigt();
  const enfonce = animer(d.querySelector('svg'), [{ transform: 'scale(1)' }, { transform: 'scale(.84)' }], { duration: 130 * f(), easing: 'ease-out' }, j);
  if (onde && !reduit()) animer(d.querySelector('.gd-onde'), [{ transform: 'scale(.2)', opacity: 0.95 }, { transform: 'scale(1.5)', opacity: 0 }], { duration: 420 * f(), easing: 'ease-out' }, j).catch(() => {});
  await enfonce;
}
async function relacher(j) {
  const s = doigt().querySelector('svg');
  await animer(s, [{ transform: 'scale(.84)' }, { transform: 'scale(1)' }], { duration: 120 * f(), easing: 'ease-in' }, j);
  for (const x of s.getAnimations()) x.cancel();
}
function viser(n) { n.classList.add('gd-vise'); aRetablir.push(() => n.classList.remove('gd-vise')); }
/** Remet ce qu'un geste a changé depuis k (classe, fiche déplacée, texte d'indice). */
function retablir(k) { while (aRetablir.length > k) { try { aRetablir.pop()(); } catch (_) { /* nœud parti */ } } }

/**
 * Un toucher : défiler au besoin, aller au bouton, l'allumer, appuyer, le toucher pour vrai (cliquer) ou pour faire semblant.
 * Environ 1 seconde ; avant(r) reçoit la zone du bouton avant que le doigt parte (la bulle se met ailleurs).
 */
export async function toucher(n, { j, cliquer = false, avant } = {}) {
  verif(j);
  const k = aRetablir.length;
  await montrer(n, j);
  const c = centre(n);
  avant?.(c.r);
  await voyager(c, j);
  viser(n);
  await attendre((reduit() ? 760 : 150) * f(), j);
  await appuyer(j);
  if (cliquer) n.click();
  await relacher(j);
  retablir(k);
  await attendre(110 * f(), j);
}

/** Glisser pour faire semblant : la fiche suit le doigt, puis revient à sa place (rien n'est décidé). */
async function glisser(n, { dx = 0, dy = 0, suit = true, indice, texte }, j) {
  const k = aRetablir.length;
  await montrer(n, j);
  const c = centre(n), d = doigt(), h = indice && $(indice);
  await voyager(c, j);
  await appuyer(j, false);
  if (h) {
    const avant = [h.textContent, h.style.opacity];
    h.textContent = texte || ''; h.style.opacity = '1';
    aRetablir.push(() => { h.textContent = avant[0]; h.style.opacity = avant[1]; });
  }
  const fin = { x: c.x + dx, y: c.y + dy }, ms = (reduit() ? 10 : 760) * f();
  const loin = `translate(${Math.round(dx * 0.9)}px, ${Math.round(Math.max(0, dy))}px) rotate(${(dx / 20).toFixed(1)}deg)`;
  if (suit && !reduit()) aRetablir.push(() => n.getAnimations().forEach((a) => a.cancel()));
  await Promise.all([
    animer(d, [{ transform: tr(c) }, { transform: tr(fin) }], { duration: ms, easing: 'ease-in-out' }, j),
    suit && !reduit() ? animer(n, [{ transform: 'none' }, { transform: loin }], { duration: ms, easing: 'ease-in-out' }, j) : null
  ]);
  poser(fin); for (const x of d.getAnimations()) x.cancel();
  await attendre(260 * f(), j);
  await relacher(j);
  if (suit && !reduit()) {
    for (const x of n.getAnimations()) x.cancel();
    await animer(n, [{ transform: loin }, { transform: 'none' }], { duration: 300, easing: 'cubic-bezier(.3,1.35,.5,1)' }, j);
    for (const x of n.getAnimations()) x.cancel();
  }
  retablir(k);
}

/** Tenir 2 secondes (la vraie barre jaune se remplit), puis glisser vers un autre soir, pour faire semblant. */
async function tenir(n, vers, j) {
  const k = aRetablir.length;
  await montrer(n, j);
  const c = centre(n), carte = n.closest('.day') || n;
  await voyager(c, j);
  await appuyer(j, false);
  carte.classList.add('tenir'); aRetablir.push(() => carte.classList.remove('tenir'));
  await attendre(2000, j);                                              // la vraie durée, même en « Plus lent »
  retablir(k);
  if (vers) await voyager(centre(vers), j);
  await attendre(200 * f(), j);
  await relacher(j);
}

/** Un coin de l'écran, hors de la page : le menu du navigateur (⋮ en haut à droite, Partager en bas…). */
async function coin(ou, j) {
  const H = ecranH(), W = ecranL();
  const p = { 'haut-droite': { x: W - 18, y: 14 }, bas: { x: W / 2, y: H - 14 }, 'bas-droite': { x: W - 22, y: H - 14 } }[ou] || { x: W - 18, y: 14 };
  await voyager(p, j);
  await appuyer(j);
  await relacher(j);
  await attendre(500 * f(), j);
}

/** Un geste mimé : { toucher: sel } | { glisser: sel, dx, dy, indice, texte } | { tenir: sel, vers: sel } | { coin: 'haut-droite' }. */
export async function geste(g, j) {
  verif(j);
  const q = (s) => (typeof s === 'string' ? document.querySelector(s) : s);
  if (g.coin) return coin(g.coin, j);
  const n = q(g.toucher || g.glisser || g.tenir);
  if (!n || !n.getClientRects().length) return;
  if (g.toucher) return toucher(n, { j });
  if (g.glisser) return glisser(n, g, j);
  return tenir(n, q(g.vers), j);
}
/** Le doigt s'efface (il reprendra de là au prochain chemin). */
export async function cacher(j) {
  await attendre(300, j);
  $('#gd-doigt')?.classList.remove('vu');
}
