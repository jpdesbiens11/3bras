// Mise en place guidée (D-G-051, D-G-053) : après la connexion Google, différente de la visite marketing (D-G-047).
// 10 étapes. À chaque étape, le guide ouvre lui-même le bon écran (Compte, Stock, Livre, Garde-manger, Semaine, Provigo,
// Au poêle), encadre
// la partie à utiliser (projecteur + bulle) et dit quoi faire et comment. La personne fait les actions qui écrivent dans
// son classeur (kits, stock, tri, approbation) ; le guide passe seul à la suite quand c'est fait. ◀ ▶ en haut à droite
// de la bulle pour reculer ou avancer à volonté. Il finit à l'étape 1 du souper de lundi, au poêle. Il démarre seul quand le livre est vide, se reprend après un
// rechargement, et Compte → « Lancer le guide » le relance.
import { S, $ } from '../etat.js?v=1.21.0';
import { el, ico, vider } from '../el.js?v=1.21.0';

const CLE = 'superchef-guide', FIN = 'superchef-guide-fin';
// ce qui se voit vraiment (au téléphone, une page plus large que l'écran agrandit innerWidth)
const ecranL = () => Math.min(window.innerWidth, document.documentElement.clientWidth || Infinity, window.visualViewport?.width || Infinity);
const ecranH = () => Math.min(window.innerHeight, window.visualViewport?.height || Infinity);
const auLivre = () => (S.book || []).filter((r) => r.statut === 'Au livre').length;
const planTexte = () => (S.plan || []).map((id, i) => (S.on?.[i] ? id || '' : '')).join('|');
const val = (v) => (typeof v === 'function' ? v() : v);
const SEM = { vue: 'semaine' };
/** Le souper de lundi (sinon le premier souper complet de la semaine) : la mise en place finit à son étape 1. */
export function souperDuGuide() {
  const ok = (i) => S.on?.[i] && S.plan?.[i] && S.byId?.[S.plan[i]]?.complete;
  const i = ok(1) ? 1 : (S.plan || []).findIndex((x, k) => ok(k));
  return i >= 0 ? { id: S.plan[i], jour: ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'][i], nom: S.byId[S.plan[i]].name } : null;
}
const souper = () => souperDuGuide() || { id: '', jour: 'lundi', nom: 'ton souper' };

// 10 étapes, de l'ouverture du livre à l'étape 1 du souper de lundi (demande de JP).
const ETAPES = [
  { groupe: 'Kits', ecran: { compte: true }, bulle: 'bas', titre: 'Choisis tes kits, puis ajoute-les', fait: (b) => S.book.length > b.livre,
    cible: () => ($('#kitchoix [aria-pressed="true"]') ? '#chargerkits' : '#kitchoix'),
    texte: 'Touche un ou plusieurs kits de 10 recettes (un crochet apparaît), puis « Ajouter » : les recettes s\'écrivent dans ton classeur Google.' },
  { groupe: 'Kits', ecran: { stock: true }, titre: 'Ton stock de base', cible: '#stock-ajouter', fait: () => !!$('#stock-voir'),
    texte: 'Sel, huile, farine, riz… Décoche ce que tu n\'as pas, puis touche « Ajouter » : ces articles ne seront jamais sur ta liste d\'épicerie.' },
  { groupe: '01 · Livre', ecran: { vue: 'tri', mode: 'tri' }, bulle: 'haut', titre: 'Trie tes nouvelles recettes', cible: '.tri-wrap',
    fait: (b) => auLivre() >= b.aulivre + 3 || (S.tri.list && S.tri.idx >= S.tri.list.length),
    texte: 'Glisse la fiche à droite (ou « Au livre ») pour la garder, à gauche pour la déclasser, vers le bas pour la retravailler. Garde-en au moins 3.' },
  { groupe: '02 · Garde-manger', ecran: { vue: 'livre' }, info: true, titre: 'Ajoute ce qu\'il y a au frigo', cible: '#addinv',
    texte: 'Ton stock de base est déjà là, par zone. Écris un article (« lait 2 % ») et « Ajouter » : ce que tu as ne sera pas sur ta liste d\'épicerie.' },
  { groupe: '03 · Semaine', ecran: SEM, info: true, titre: 'Ta semaine est pigée', cible: '.daytog',
    texte: 'Touche un jour pour l\'ajouter ou l\'enlever. Sur chaque souper : « Choisir » le prend dans ton livre, « Piger » en propose un autre, « PDF » le partage.' },
  { groupe: '03 · Semaine', ecran: SEM, titre: 'Déplace un souper', cible: () => ($('#deplacer') ? '[data-dpenregistrer]' : '.week .day[data-jour] .dname'),
    fait: (b) => !$('#deplacer') && planTexte() !== b.plan,
    texte: 'Tiens un souper 2 secondes (une barre jaune se remplit), glisse-le sur un autre soir et relâche. Puis « Enregistrer ».' },
  { groupe: '03 · Semaine', ecran: SEM, titre: 'Approuve ta semaine', cible: '#save', fait: () => S.saved && (S.planRows || []).some((r) => r['Recette id']),
    texte: 'Touche « Approuver la semaine » : elle s\'enregistre dans ton classeur Google et ta liste d\'épicerie se prépare.' },
  { groupe: '04 · Provigo', ecran: { vue: 'provigo' }, info: true, titre: 'Ta liste d\'épicerie est prête', cible: '.dept',
    texte: 'Par rayon, moins ce que tu as déjà. En magasin, coche ce que tu prends. « J\'en ai » retire un article ; « Au garde-manger » le garde pour toujours.' },
  { groupe: '05 · Au poêle', ecran: { vue: 'poele' }, titre: () => `Lundi soir : ${souper().nom}`, cible: () => `.pick [data-cook="${souper().id}"]`,
    fait: () => S.view === 'poele' && !!S.cook?.id,
    texte: () => `C'est le souper de ${souper().jour}. Touche-le pour allumer le rond : la recette s'ouvre étape par étape.` },
  { groupe: '05 · Au poêle', ecran: { vue: 'poele', cuisiner: () => souper().id }, info: true, fin: true, bulle: 'bas', titre: 'Étape 1 : on cuisine !', cible: '#cook .stage',
    texte: 'Lis l\'étape, coche ce qu\'il te faut « Pour cette étape », lance le minuteur s\'il y en a un, puis glisse vers la gauche pour la suite. Bon souper, chef !' }
];
export const NB_ETAPES_GUIDE = ETAPES.length;

let NAV = { ecran() {} };
/** app.js donne au guide de quoi ouvrir les écrans (pas d'import circulaire). */
export function initGuide(nav) { NAV = nav; }

let G = null;   // { i, base, deja, vu }
let reduite = false;   // la bulle ne garde que sa barre (◀ ▶), pour voir ce qu'elle cachait
let minuterie = null;
const lire = () => { try { return JSON.parse(localStorage.getItem(CLE) || 'null'); } catch (_) { return null; } };
const garder = () => { try { G ? localStorage.setItem(CLE, JSON.stringify({ i: G.i })) : localStorage.removeItem(CLE); } catch (_) { /* stockage absent */ } };
const fini = () => { try { return localStorage.getItem(FIN) === '1'; } catch (_) { return false; } };
const marquerFini = (v) => { try { v ? localStorage.setItem(FIN, '1') : localStorage.removeItem(FIN); } catch (_) { /* stockage absent */ } };
const base = () => ({ livre: (S.book || []).length, aulivre: auLivre(), plan: planTexte() });

export const guideActif = () => !!G;
/** À la connexion : reprendre un guide en cours, ou démarrer quand le livre est vide (une fois). */
export function guideConnexion() {
  const g = lire();
  if (g && ETAPES[g.i]) { aller(g.i); return; }
  if (!S.book.length && !fini()) demarrerGuide();
}
export function demarrerGuide() { marquerFini(false); aller(0); }
export function quitterGuide() { G = null; garder(); marquerFini(true); clearInterval(minuterie); minuterie = null; $('#guide')?.remove(); }
/** Aller à une étape : le guide ouvre lui-même son écran. Une action déjà faite n'avance pas toute seule. */
function aller(i) {
  if (i >= ETAPES.length) { quitterGuide(); return; }
  const e = ETAPES[Math.max(0, i)];
  if (S.ctx) { try { NAV.ecran(e.ecran || {}); } catch (err) { console.warn(err); } }
  const b = base();
  G = { i: Math.max(0, i), base: b, deja: !e.info && !!e.fait?.(b), vu: false };
  garder(); dessiner();
  if (!minuterie) minuterie = setInterval(tic, 250);
}

/** Clics de la bulle (et du bouton de Compte) ; vrai si le bouton lui appartient. */
export function clicGuide(b) {
  if (b.id === 'guidebtn') { demarrerGuide(); return true; }
  if (!G) return false;
  const d = b.dataset;
  if (d.gdquitter !== undefined) quitterGuide();
  else if (d.gdsuivant !== undefined || d.gdpasser !== undefined) aller(G.i + 1);
  else if (d.gdprec !== undefined) aller(G.i - 1);
  else if (d.gdreduire !== undefined) { reduite = !reduite; dessiner(); }
  else return false;
  return true;
}

/** La zone visée, si elle est à l'écran et pas cachée sous une feuille. */
function cibleDe(e) {
  const sel = val(e.cible);
  const n = sel && document.querySelector(sel);
  if (!n) return null;
  const r = n.getBoundingClientRect();
  if (!r.width && !r.height) return null;
  // au milieu de la partie visible (une grande zone peut dépasser l'écran)
  const H = ecranH(), W = ecranL();
  const x = (Math.max(r.left, 0) + Math.min(r.right, W)) / 2, y = (Math.max(r.top, 0) + Math.min(r.bottom, H)) / 2;
  const dessus = r.bottom > 0 && r.top < H && r.right > 0 && r.left < W ? document.elementFromPoint(x, y) : null;
  const cache = dessus && !n.contains(dessus) && !dessus.closest('#guide');
  return { n, r, cache, horsEcran: !dessus };
}
function tic() {
  if (!G) return;
  const n = $('#guide'); if (!n) return;
  const e = ETAPES[G.i];
  n.hidden = !!$('#visite') || (!!$('#deplacer') && !/^Déplace/.test(val(e.titre)));
  if (!S.ctx) { placer(n, null); return; }
  if (!e.info && e.fait && !G.deja && e.fait(G.base)) { aller(G.i + 1); return; }
  if (G.deja && e.fait && !e.fait(G.base)) G.deja = false;
  const c = cibleDe(e);
  const sel = val(e.cible);
  if (G.sel !== sel) { G.sel = sel; G.vu = false; }
  if (c && !G.vu) {
    G.vu = true;
    // une zone plus haute que l'écran montre son début (sous la barre du haut) ; une petite zone se centre
    const H = ecranH(), grand = c.r.height > H * 0.6;
    const aVoir = grand ? c.r.top < 60 || c.r.top > H * 0.45 : c.horsEcran || c.r.top < 70 || c.r.bottom > H - 40;
    if (aVoir) {
      // marge de défilement : sous la barre de la feuille, ou sous l'en-tête de la page (plus haut au téléphone)
      const haut = c.n.closest('.sheet') ? 72 : Math.max(72, ($('header')?.getBoundingClientRect().height || 0) + 16);
      c.n.style.scrollMarginTop = `${Math.round(haut)}px`;
      const loin = Math.abs(c.r.top - H / 2) > H * 1.5;          // loin : on y saute ; près : on y glisse
      c.n.scrollIntoView({ block: grand ? 'start' : 'center', behavior: loin ? 'auto' : 'smooth' });
    }
  }
  placer(n, c && !c.cache ? c : null, e.bulle);
}
// cote : pour une zone plus haute que l'écran, le bord où mettre la bulle (« bas » : le haut de la zone reste visible)
function placer(n, c, cote) {
  const anneau = n.querySelector('.gd-anneau'), bulle = n.querySelector('.gd-bulle');
  if (!anneau || !bulle) return;
  anneau.hidden = !c;
  const H = ecranH(), W = ecranL(), bh = bulle.offsetHeight, bw = Math.min(360, W - 24);
  let top, left = Math.max(12, Math.min(W - bw - 12, c ? c.r.left + c.r.width / 2 - bw / 2 : (W - bw) / 2));
  if (c) {
    const m = 6;
    Object.assign(anneau.style, { top: `${c.r.top - m}px`, left: `${c.r.left - m}px`, width: `${c.r.width + 2 * m}px`, height: `${c.r.height + 2 * m}px` });
    // sous la zone, sinon au-dessus ; une zone trop haute : la bulle se met du côté où il reste le plus de place
    top = c.r.bottom + 14 + bh < H - 8 ? c.r.bottom + 14 : c.r.top - 14 - bh > 8 ? c.r.top - 14 - bh
      : cote === 'bas' ? H - bh - 8 : cote === 'haut' ? 8 : c.r.top > H - c.r.bottom ? 8 : H - bh - 8;
  } else top = H - bh - 16;
  Object.assign(bulle.style, { top: `${Math.max(8, Math.min(H - bh - 8, top))}px`, bottom: 'auto', left: `${left}px`, width: `${bw}px` });   // toujours à l'écran
}
function dessiner() {
  if (!G) return;
  let n = $('#guide');
  if (!n) { n = el('div', { id: 'guide', class: 'guide' }); document.body.append(n); }
  const e = ETAPES[G.i], sans = !S.ctx, dernier = G.i === ETAPES.length - 1;
  vider(n).append(
    el('div', { class: 'gd-anneau', 'aria-hidden': 'true', hidden: true }),
    el('div', { class: `gd-bulle${reduite ? ' reduite' : ''}`, role: 'dialog', 'aria-live': 'polite', 'aria-labelledby': 'gd-h', 'data-new': '1.20.0-guide' },
      el('div', { class: 'gd-tete' },
        el('button', { class: 'gd-reduire', type: 'button', 'data-gdreduire': '', 'aria-expanded': String(!reduite), 'aria-label': reduite ? 'Agrandir la bulle' : 'Réduire la bulle' },
          el('span', { class: 'label' }, reduite ? `${G.i + 1}/${ETAPES.length} · ${sans ? 'Reconnecte-toi' : val(e.titre)}` : `Mise en place · ${G.i + 1} sur ${ETAPES.length} · ${e.groupe}`), el('span', { class: 'gd-chevron', 'aria-hidden': 'true' }, reduite ? '▴' : '▾')),
        el('div', { class: 'gd-fleches', role: 'group', 'aria-label': 'Naviguer dans la mise en place' },
          el('button', { class: 'btn icon', type: 'button', 'data-gdprec': '', disabled: G.i === 0, 'aria-label': 'Étape précédente' }, ico('left')),
          el('button', { class: 'btn icon', type: 'button', 'data-gdsuivant': '', disabled: dernier, 'aria-label': 'Étape suivante' }, ico('right')),
          el('button', { class: 'btn icon', type: 'button', 'data-gdquitter': '', 'aria-label': 'Quitter la mise en place guidée' }, '×'))),
      el('div', { class: 'gd-barre', 'aria-hidden': 'true' }, el('i', { style: `width:${Math.round(((G.i + 1) / ETAPES.length) * 100)}%` })),
      el('h3', { id: 'gd-h' }, sans ? 'Reconnecte-toi' : val(e.titre)),
      el('p', {}, sans ? 'pour continuer ta mise en place là où tu étais.' : val(e.texte)),
      !sans && el('div', { class: 'gd-acts' },
        e.info ? el('button', { class: 'btn primary', type: 'button', 'data-gdsuivant': '' }, e.fin ? [ico('check'), 'Terminer'] : ['Suivant', ico('right')])
          : G.deja ? el('span', { class: 'gd-attente' }, ico('check'), 'Déjà fait : ▶ pour continuer')
            : el('span', { class: 'gd-attente' }, ico('play'), 'À toi de jouer'),
        !e.info && !G.deja && el('button', { class: 'gd-passer', type: 'button', 'data-gdpasser': '' }, 'Passer cette étape'))));
  placer(n, sans ? null : (() => { const c = cibleDe(e); return c && !c.cache ? c : null; })(), e.bulle);
}
window.addEventListener('resize', () => G && tic());
document.addEventListener('scroll', () => G && tic(), true);
