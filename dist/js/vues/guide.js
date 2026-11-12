// Mise en place guidée (D-G-051) : après la connexion Google, différente de la visite marketing (D-G-047).
// Le guide ouvre le chemin, met en évidence la bonne partie de l'interface (projecteur + bulle) et attend que la
// personne fasse l'action ; il passe seul à la suite. Kits et stock de base → Livre → Garde-manger → Semaine → Provigo :
// à la fin, la première semaine est en place et la liste d'épicerie est prête. Il démarre seul quand le livre est vide,
// se reprend après un rechargement, et Compte → « Mise en place guidée » le relance.
import { S, $ } from '../etat.js?v=1.20.0';
import { el, ico, vider } from '../el.js?v=1.20.0';

const CLE = 'superchef-guide', FIN = 'superchef-guide-fin';
const auLivre = () => (S.book || []).filter((r) => r.statut === 'Au livre').length;
const planTexte = () => (S.plan || []).map((id, i) => (S.on?.[i] ? id || '' : '')).join('|');
const feuille = () => $('#comptesheet') || $('#stocksheet') || $('#sheet') || $('#addsheet') || $('#picksheet') || $('#dsheet') || $('#partage');
const vue = (v) => S.view === v && !feuille();

const ETAPES = [
  { id: 'compte', groupe: 'Kits', titre: 'Ouvre ton Compte', texte: 'Tout commence ici : tes kits de recettes et ton stock de base.', cible: '#comptebtn', fait: () => !!$('#comptesheet') },
  { id: 'kits', groupe: 'Kits', titre: 'Choisis tes kits', texte: 'Touche un ou plusieurs kits de 10 recettes (Survie, Québécois, Mexicain…) : un crochet apparaît.', cible: '#kitchoix',
    fait: (b) => !!$('#kitchoix [aria-pressed="true"]') || S.book.length > b.livre },
  { id: 'ajout', groupe: 'Kits', titre: 'Ajoute-les à ton livre', texte: 'Les recettes s\'écrivent dans ton classeur Google, « À trier ».', cible: '#chargerkits', fait: (b) => S.book.length > b.livre },
  { id: 'stock', groupe: 'Kits', titre: 'Ton stock de base', texte: 'Sel, huile, farine, riz… ce que tu as toujours. Touche « Choisir mon stock de base ».', cible: '#ouvrirstock', fait: () => !!$('#stocksheet') },
  { id: 'stockajout', groupe: 'Kits', titre: 'Coche ce que tu as', texte: 'Décoche ce que tu n\'as pas, puis ajoute : ces articles ne seront jamais sur ta liste d\'épicerie.', cible: '#stock-ajouter',
    fait: () => !!$('#stock-voir') },
  { id: 'fermer', groupe: 'Kits', titre: 'Ferme le Compte', texte: 'Ton livre et ton garde-manger sont prêts. Ferme cette feuille pour trier tes recettes.',
    cible: () => ($('#stocksheet') ? '[data-stockclose]' : '[data-compteclose]'), fait: () => !$('#comptesheet') && !$('#stocksheet') },
  { id: 'livre', groupe: 'Livre', titre: 'Va au Livre', texte: 'L\'étape 01 : tes nouvelles recettes t\'attendent.', cible: '[data-go="tri"]', fait: () => vue('tri') },
  { id: 'mode', groupe: 'Livre', titre: 'Passe en mode Trier', texte: 'Tes nouvelles recettes sont « À trier ». Touche « Trier » pour les voir une à une.',
    cible: '[data-libmode="tri"]', fait: () => vue('tri') && S.lib?.mode === 'tri' },
  { id: 'trier', groupe: 'Livre', titre: 'Trie quelques recettes', texte: 'Glisse la fiche à droite (ou touche « Au livre ») pour la garder, à gauche pour la déclasser. Garde-en au moins 3.',
    cible: () => ($('.tri-wrap') ? '.tri-wrap' : '.tri-legend'), fait: (b) => auLivre() >= b.aulivre + 3 || (S.tri.list && S.tri.idx >= S.tri.list.length) },
  { id: 'garde', groupe: 'Garde-manger', titre: 'Va au Garde-manger', texte: 'L\'étape 02 : ce que tu as à la maison.', cible: '[data-go="livre"]', fait: () => vue('livre') },
  { id: 'gardevoir', groupe: 'Garde-manger', titre: 'Ajoute ce qu\'il y a au frigo', info: true,
    texte: 'Ton stock de base est là, par zone. Ajoute ce que tu as au frigo cette semaine : ça ne sera pas sur la liste. Filtre et « Modifier » pour fusionner les doublons.', cible: '#addinv' },
  { id: 'semaine', groupe: 'Semaine', titre: 'Va à la Semaine', texte: 'L\'étape 03 : on planifie tes soupers.', cible: '[data-go="semaine"]', fait: () => vue('semaine') },
  { id: 'soirs', groupe: 'Semaine', titre: 'Choisis tes soirs', info: true, texte: 'Dimanche à mercredi par défaut. Touche un jour pour l\'ajouter ou l\'enlever.', cible: '.daytog' },
  { id: 'piger', groupe: 'Semaine', titre: 'Pige ou choisis', info: true,
    texte: '« Piger » change un souper, « Choisir » le prend dans ton livre. Touche le nom d\'un souper pour voir la recette.', cible: '.week .day[data-jour]' },
  { id: 'deplacer', groupe: 'Semaine', titre: 'Déplace un souper', texte: 'Tiens un souper 2 secondes, glisse-le sur un autre soir et relâche. Puis « Enregistrer ».',
    cible: () => ($('#deplacer') ? '[data-dpenregistrer]' : '.week .day[data-jour] .dname'), fait: (b) => !$('#deplacer') && planTexte() !== b.plan },
  { id: 'approuver', groupe: 'Semaine', titre: 'Approuve ta semaine', texte: 'Elle s\'enregistre dans ton classeur Google et la liste d\'épicerie se prépare.', cible: '#save',
    fait: () => vue('semaine') && S.saved && (S.planRows || []).some((r) => r['Recette id']) },
  { id: 'provigo', groupe: 'Provigo', titre: 'Va au Provigo', texte: 'L\'étape 04 : ta liste d\'épicerie.', cible: '[data-go="provigo"]', fait: () => vue('provigo') },
  { id: 'liste', groupe: 'Provigo', titre: 'Ta liste est prête, chef !', info: true, fin: true,
    texte: 'Par rayon, moins ce que tu as. En magasin, coche ce que tu prends. « J\'en ai » retire un article ; « Au garde-manger » le garde pour toujours. Ta première semaine est en place : bon Provigo !', cible: '.dept' }
];
export const NB_ETAPES_GUIDE = ETAPES.length;

let G = null;   // { i, base, vu }
let minuterie = null;
const lire = () => { try { return JSON.parse(localStorage.getItem(CLE) || 'null'); } catch (_) { return null; } };
const garder = () => { try { G ? localStorage.setItem(CLE, JSON.stringify({ i: G.i, base: G.base })) : localStorage.removeItem(CLE); } catch (_) { /* stockage absent */ } };
const fini = () => { try { return localStorage.getItem(FIN) === '1'; } catch (_) { return false; } };
const marquerFini = (v) => { try { v ? localStorage.setItem(FIN, '1') : localStorage.removeItem(FIN); } catch (_) { /* stockage absent */ } };

export const guideActif = () => !!G;
/** À la connexion : reprendre un guide en cours, ou démarrer quand le livre est vide (une fois). */
export function guideConnexion() {
  const g = lire();
  if (g && ETAPES[g.i]) { G = { i: g.i, base: g.base || base(), vu: false }; lancer(); return; }
  if (!S.book.length && !fini()) demarrerGuide();
}
export function demarrerGuide() { marquerFini(false); G = { i: 0, base: base(), vu: false }; garder(); lancer(); }
export function quitterGuide() { G = null; garder(); marquerFini(true); clearInterval(minuterie); minuterie = null; $('#guide')?.remove(); }
const base = () => ({ livre: (S.book || []).length, aulivre: auLivre(), plan: planTexte() });
function lancer() { clearInterval(minuterie); minuterie = setInterval(tic, 250); dessiner(); tic(); }
function aller(i) {
  if (i >= ETAPES.length) { quitterGuide(); return; }
  G = { i, base: base(), vu: false }; garder(); dessiner();
}

/** Clics de la bulle (et du bouton de Compte) ; vrai si le bouton lui appartient. */
export function clicGuide(b) {
  if (b.id === 'guidebtn') { demarrerGuide(); return true; }
  if (!G) return false;
  const d = b.dataset;
  if (d.gdquitter !== undefined) quitterGuide();
  else if (d.gdsuivant !== undefined || d.gdpasser !== undefined) aller(G.i + 1);
  else return false;
  return true;
}

function cibleDe(e) {
  const sel = typeof e.cible === 'function' ? e.cible() : e.cible;
  const n = sel && document.querySelector(sel);
  if (!n) return null;
  const r = n.getBoundingClientRect();
  return r.width || r.height ? { n, r } : null;
}
function tic() {
  if (!G) return;
  const n = $('#guide'); if (!n) return;
  const e = ETAPES[G.i];
  n.hidden = !!$('#visite') || !!$('#deplacer') && e.id !== 'deplacer';
  if (!S.ctx) { placer(n, null); return; }
  if (!e.info && e.fait && e.fait(G.base)) { aller(G.i + 1); return; }
  const c = cibleDe(e);
  if (c && !G.vu) { G.vu = true; if (c.r.top < 70 || c.r.bottom > window.innerHeight - 40) c.n.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  placer(n, c);
}
function placer(n, c) {
  const anneau = n.querySelector('.gd-anneau'), bulle = n.querySelector('.gd-bulle');
  if (!anneau || !bulle) return;
  anneau.hidden = !c;
  const H = window.innerHeight, W = window.innerWidth, bh = bulle.offsetHeight, bw = Math.min(360, W - 24);
  let top, left = Math.max(12, Math.min(W - bw - 12, c ? c.r.left + c.r.width / 2 - bw / 2 : (W - bw) / 2));
  if (c) {
    const m = 6;
    Object.assign(anneau.style, { top: `${c.r.top - m}px`, left: `${c.r.left - m}px`, width: `${c.r.width + 2 * m}px`, height: `${c.r.height + 2 * m}px` });
    // sous la zone, sinon au-dessus ; une zone trop haute : la bulle se met du côté où il reste le plus de place
    top = c.r.bottom + 14 + bh < H - 8 ? c.r.bottom + 14 : c.r.top - 14 - bh > 8 ? c.r.top - 14 - bh : c.r.top > H - c.r.bottom ? 8 : H - bh - 8;
  } else top = H - bh - 16;
  Object.assign(bulle.style, { top: `${Math.max(8, top)}px`, bottom: 'auto', left: `${left}px`, width: `${bw}px` });
}
function dessiner() {
  if (!G) return;
  let n = $('#guide');
  if (!n) { n = el('div', { id: 'guide', class: 'guide' }); document.body.append(n); }
  const e = ETAPES[G.i], sans = !S.ctx;
  vider(n).append(
    el('div', { class: 'gd-anneau', 'aria-hidden': 'true', hidden: true }),
    el('div', { class: 'gd-bulle', role: 'dialog', 'aria-live': 'polite', 'aria-labelledby': 'gd-h', 'data-new': '1.20.0-guide' },
      el('div', { class: 'gd-tete' }, el('span', { class: 'label' }, `Mise en place · ${G.i + 1} sur ${ETAPES.length} · ${e.groupe}`),
        el('button', { class: 'btn icon', type: 'button', 'data-gdquitter': '', 'aria-label': 'Quitter la mise en place guidée' }, '×')),
      el('div', { class: 'gd-barre', 'aria-hidden': 'true' }, el('i', { style: `width:${Math.round(((G.i + 1) / ETAPES.length) * 100)}%` })),
      el('h3', { id: 'gd-h' }, sans ? 'Reconnecte-toi' : e.titre),
      el('p', {}, sans ? 'pour continuer ta mise en place là où tu étais.' : e.texte),
      !sans && el('div', { class: 'gd-acts' },
        e.info ? el('button', { class: 'btn primary', type: 'button', 'data-gdsuivant': '' }, e.fin ? [ico('check'), 'Terminer'] : ['Suivant', ico('right')])
          : el('span', { class: 'gd-attente' }, ico('play'), 'À toi de jouer'),
        !e.fin && el('button', { class: 'gd-passer', type: 'button', 'data-gdpasser': '' }, 'Passer cette étape'))));
  placer(n, sans ? null : cibleDe(e));        // placée tout de suite : pas d'éclair en haut à gauche
}
window.addEventListener('resize', () => G && tic());
document.addEventListener('scroll', () => G && tic(), true);
