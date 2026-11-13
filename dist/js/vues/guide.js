// Mise en place guidée (D-G-051, D-G-053, D-G-056), différente de la visite dessinée (D-G-047) : de l'accueil (connexion
// Google) jusqu'à l'étape 2 du souper de lundi. À chaque étape, un doigt fait le chemin à l'écran, environ 1 seconde par
// toucher (guide-doigt.js) : il touche les vrais boutons (👥 Compte, 01 Livre, Trier…) pour qu'on voie comment s'y rendre,
// puis il mime le geste à faire, sans rien écrire. La personne fait les actions qui écrivent dans son classeur (kits,
// stock, tri, approbation) ; le guide passe seul à la suite quand c'est fait. La bulle montre le fil d'Ariane depuis
// l'accueil, ◀ ▶ ×, « Revoir le chemin », « Écouter » (voix du téléphone) et « Plus lent », en gros caractères.
// Une personne nouvelle le voit dès l'accueil ; il se reprend après un rechargement ; Compte → « Lancer le guide » le relance.
import { S, $ } from '../etat.js?v=1.23.0';
import { el, ico, vider } from '../el.js?v=1.23.0';
import { ETAPES, ANCIENNES, base, filDe, prochainToucher, val } from './guide-etapes.js?v=1.23.0';
import * as D from './guide-doigt.js?v=1.23.0';

export { souperDuGuide } from './guide-etapes.js?v=1.23.0';
const CLE = 'superchef-guide', FIN = 'superchef-guide-fin', VITESSE = 'superchef-guide-vitesse', VOIX = 'superchef-guide-voix';
const ecranL = () => Math.min(window.innerWidth, document.documentElement.clientWidth || Infinity, window.visualViewport?.width || Infinity);
const ecranH = () => Math.min(window.innerHeight, window.visualViewport?.height || Infinity);
const lireCle = (k) => { try { return localStorage.getItem(k); } catch (_) { return null; } };
const ecrireCle = (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (_) { /* stockage absent */ } };
/** Les étapes de cet appareil (« Adapter avec Gemini » seulement quand Gemini est là). */
const liste = () => ETAPES.filter((e) => !e.si || e.si());
export const nbEtapesGuide = () => liste().length;

let NAV = { ecran() {}, fermer() {} };
/** app.js donne au guide de quoi ouvrir les écrans (pas d'import circulaire). */
export function initGuide(nav) { NAV = nav; }

let G = null;   // { i, base, deja, vu, sel, route, toucher, mime, evite }
let reduite = false, minuterie = null, jeton = 0;
let lent = lireCle(VITESSE) === 'lent', voix = lireCle(VOIX) === '1';
D.setLent(lent);
const lire = () => { try { return JSON.parse(lireCle(CLE) || 'null'); } catch (_) { return null; } };
const garder = () => ecrireCle(CLE, G ? JSON.stringify({ id: liste()[G.i].id }) : null);
const fini = () => lireCle(FIN) === '1';
const marquerFini = (v) => ecrireCle(FIN, v ? '1' : null);
const indexDe = (g) => { const id = g && (g.id || ANCIENNES[g.i]); return id ? liste().findIndex((e) => e.id === id) : -1; };
const sansCompte = (e) => !S.ctx && e.id !== 'connexion';
const titreDe = (e) => (sansCompte(e) ? 'Reconnecte-toi' : val(e.titre));
const texteDe = (e) => (sansCompte(e) ? 'Touche le bouton de connexion : ta mise en place reprend là où tu étais.'
  : S.ctx && e.id === 'connexion' ? 'C\'est fait : ton compte Google est branché.' : val(e.texte));

export const guideActif = () => !!G;
/** Au chargement de la page : reprendre un guide en cours ; une personne nouvelle (aucun compte gardé) le voit dès l'accueil. */
export function guideDemarrage({ nouveau }) {
  const k = indexDe(lire());
  if (k >= 0) aller(k);
  else if (nouveau && !fini()) aller(0);
}
/** À la connexion : continuer le guide, ou le démarrer quand le livre est vide. Vrai si le guide prend la main. */
export function guideConnexion() {
  const k = G ? G.i : indexDe(lire()), id = liste()[k]?.id;
  if (id === 'connexion' && S.book.length) { quitterGuide(); return false; }      // un livre déjà rempli : rien à mettre en place
  if (id) { aller(id === 'connexion' ? k + 1 : k); return true; }
  if (!S.book.length && !fini()) { aller(1); return true; }
  return false;
}
/** Compte → « Lancer le guide » : déjà connecté, on part des kits. */
export function demarrerGuide() { marquerFini(false); aller(S.ctx ? 1 : 0); }
export function quitterGuide() {
  jeton++; D.annuler(); taire();
  G = null; garder(); marquerFini(true); clearInterval(minuterie); minuterie = null; $('#guide')?.remove();
}

/** Aller à une étape : le doigt fait le chemin jusqu'à son écran, puis mime le geste. Une action déjà faite n'avance pas seule. */
function aller(i, { chemin = true } = {}) {
  const L = liste();
  if (i >= L.length) { quitterGuide(); return; }
  const k = Math.max(0, i), e = L[k], j = jeton = D.nouveau();
  taire();
  const b = base();
  G = { i: k, base: b, deja: !e.info && !!e.fait?.(b), vu: false, route: false };
  garder(); dessiner();
  if (!minuterie) minuterie = setInterval(tic, 250);
  parcourir(e, j, chemin);
}
async function parcourir(e, j, chemin) {
  try {
    if (S.ctx && e.ecran) {
      NAV.fermer(e.ecran);                                            // fiche, choix, partage… : fermés sans détour
      if (chemin) {
        for (let n = 0, t; n < 8 && (t = prochainToucher(e.ecran)); n++) {
          const b = document.querySelector(t.sel);
          if (!b || !b.getClientRects().length) break;
          Object.assign(G, { route: true, toucher: t }); D.bouclier(true); dessiner();
          await D.toucher(b, { j, cliquer: true, avant: (r) => { G.evite = r; tic(); } });
        }
      }
      if (j !== jeton) return;
      NAV.ecran(e.ecran);                                             // filet : l'écran voulu, même si un toucher n'a pas pris
    }
  } catch (err) {
    if (err !== D.ANNULE) console.warn(err);
    if (j !== jeton) return;
  }
  if (j !== jeton || !G) return;
  D.bouclier(false);
  G.base = base(); G.deja = !e.info && !!e.fait?.(G.base);
  Object.assign(G, { route: false, toucher: null, evite: null, vu: false });
  dessiner(); tic(); parler();
  try {
    await D.attendre(500, j);
    const gestes = sansCompte(e) ? [] : (val(e.geste) || []).filter(Boolean);
    G.mime = gestes.length > 0;
    for (const g of gestes) await D.geste(g, j);
    await D.cacher(j);                                                // sans geste aussi : le doigt ne reste pas en plan
  } catch (err) { if (err !== D.ANNULE) console.warn(err); }
  if (G && j === jeton) G.mime = false;
}
/** ↻ Revoir le chemin : l'écran de l'étape d'avant (un autre écran), puis le doigt refait le trajet et le geste. */
function revoir() {
  const L = liste(), e = L[G.i];
  if (S.ctx && e.ecran) {
    const ici = filDe(e).join('›'), avant = L.slice(0, G.i).reverse().find((x) => x.ecran && filDe(x).join('›') !== ici);
    jeton = D.nouveau();
    try { NAV.ecran(avant ? avant.ecran : { vue: e.ecran.vue || S.view }); } catch (err) { console.warn(err); }
  }
  aller(G.i);
}

/** Clics de la bulle (et du bouton de Compte) ; vrai si le bouton lui appartient. */
export function clicGuide(b) {
  if (b.id === 'guidebtn') { demarrerGuide(); return true; }
  if (!G) return false;
  const d = b.dataset;
  if (d.gdquitter !== undefined) quitterGuide();
  else if (d.gdsuivant !== undefined || d.gdpasser !== undefined) aller(G.i + 1);
  else if (d.gdprec !== undefined) aller(G.i - 1);
  else if (d.gdsauter !== undefined) aller(G.i, { chemin: false });
  else if (d.gdrevoir !== undefined) revoir();
  else if (d.gdreduire !== undefined) { reduite = !reduite; dessiner(); }
  else if (d.gdlent !== undefined) { lent = !lent; ecrireCle(VITESSE, lent ? 'lent' : null); D.setLent(lent); dessiner(); }
  else if (d.gdvoix !== undefined) { voix = !voix; ecrireCle(VOIX, voix ? '1' : null); voix ? parler(true) : taire(); dessiner(); }
  else return false;
  return true;
}
// Un vrai toucher pendant que le doigt mime : le doigt s'efface et laisse faire.
document.addEventListener('pointerdown', (ev) => {
  if (G?.mime && !ev.target.closest?.('#guide')) { jeton = D.nouveau(); G.mime = false; }
}, true);

/* ---------- 🔊 la voix du téléphone (synthèse vocale du navigateur, rien d'externe) ---------- */
const peutParler = () => 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
function parler(force) {
  if (!G || !(voix || force) || !peutParler()) return;
  const e = liste()[G.i];
  const t = `${titreDe(e)}. ${texteDe(e)}`.replace(/[«»⋮≡✓👥]/gu, ' ').replace(/\s+/g, ' ').replace(/ ([.,])/g, '$1').trim();
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(t), fr = speechSynthesis.getVoices().filter((v) => /^fr/i.test(v.lang));
    const v = fr.find((x) => /CA/i.test(x.lang)) || fr[0];
    if (v) u.voice = v;
    u.lang = v?.lang || 'fr-CA'; u.rate = lent ? 0.8 : 0.92;
    speechSynthesis.speak(u);
  } catch (_) { /* voix absente */ }
}
function taire() { try { if (peutParler()) speechSynthesis.cancel(); } catch (_) { /* voix absente */ } }

/** La zone visée, si elle est à l'écran et pas cachée sous une feuille. */
function cibleDe(e) {
  const sel = sansCompte(e) ? '#connexion' : val(e.cible);
  const n = sel && document.querySelector(sel);
  if (!n) return null;
  const r = n.getBoundingClientRect();
  if (!r.width && !r.height) return null;
  const H = ecranH(), W = ecranL();
  const x = (Math.max(r.left, 0) + Math.min(r.right, W)) / 2, y = (Math.max(r.top, 0) + Math.min(r.bottom, H)) / 2;
  const dessus = r.bottom > 0 && r.top < H && r.right > 0 && r.left < W ? document.elementFromPoint(x, y) : null;
  const cache = dessus && !n.contains(dessus) && !dessus.closest('#guide');
  return { n, r, cache, horsEcran: !dessus };
}
function tic() {
  if (!G) return;
  const n = $('#guide'); if (!n) return;
  const L = liste(), e = L[G.i];
  n.hidden = !!$('#visite') || (!!$('#deplacer') && e.id !== 'deplacer');
  if (n.hidden && G.mime) { jeton = D.nouveau(); G.mime = false; }
  if (G.route) { placer(n, null); return; }
  if (S.ctx && S.loading) return;
  if (!sansCompte(e) && !e.info && e.fait && !G.deja && e.fait(G.base)) {
    if (G.i < L.length - 1) { aller(G.i + 1); return; }
    G.deja = true; dessiner();                                         // la dernière étape : « Terminer »
  }
  if (G.deja && e.fait && !e.fait(G.base)) { G.deja = false; dessiner(); }
  const c = cibleDe(e), sel = sansCompte(e) ? '#connexion' : val(e.cible);
  if (G.sel !== sel) { G.sel = sel; G.vu = false; }
  if (c && !G.vu) {
    G.vu = true;
    // une zone plus haute que l'écran montre son début (sous la barre du haut) ; une petite zone se centre
    const H = ecranH(), grand = c.r.height > H * 0.6;
    const aVoir = grand ? c.r.top < 60 || c.r.top > H * 0.45 : c.horsEcran || c.r.top < 70 || c.r.bottom > H - 40;
    if (aVoir) {
      const haut = c.n.closest('.sheet') ? 72 : Math.max(72, ($('header')?.getBoundingClientRect().height || 0) + 16);
      c.n.style.scrollMarginTop = `${Math.round(haut)}px`;
      const loin = Math.abs(c.r.top - H / 2) > H * 1.5;          // loin : on y saute ; près : on y glisse
      c.n.scrollIntoView({ block: grand ? 'start' : 'center', behavior: loin || D.reduit() ? 'auto' : 'smooth' });
    }
  }
  placer(n, c && !c.cache ? c : null, e.bulle);
}
// cote : pour une zone plus haute que l'écran, le bord où mettre la bulle (« bas » : le haut de la zone reste visible)
function placer(n, c, cote) {
  const anneau = n.querySelector('.gd-anneau'), bulle = n.querySelector('.gd-bulle');
  if (!anneau || !bulle) return;
  anneau.hidden = !c;
  n.classList.toggle('en-route', !!G?.route);
  const H = ecranH(), W = ecranL(), bh = bulle.offsetHeight, bw = Math.min(400, W - 24);
  let top, left = Math.max(12, Math.min(W - bw - 12, c ? c.r.left + c.r.width / 2 - bw / 2 : (W - bw) / 2));
  if (G?.route) {
    const r = G.evite;                                                   // en chemin : la bulle laisse la place au doigt
    top = r && r.top + r.height / 2 < H / 2 ? H - bh - 12 : 12;
  } else if (c) {
    const m = 6;
    Object.assign(anneau.style, { top: `${c.r.top - m}px`, left: `${c.r.left - m}px`, width: `${c.r.width + 2 * m}px`, height: `${c.r.height + 2 * m}px` });
    // sous la zone, sinon au-dessus ; une zone trop haute : la bulle se met du côté où il reste le plus de place
    top = c.r.bottom + 14 + bh < H - 8 ? c.r.bottom + 14 : c.r.top - 14 - bh > 8 ? c.r.top - 14 - bh
      : cote === 'bas' ? H - bh - 8 : cote === 'haut' ? 8 : c.r.top > H - c.r.bottom ? 8 : H - bh - 8;
  } else top = H - bh - 16;
  Object.assign(bulle.style, { top: `${Math.max(8, Math.min(H - bh - 8, top))}px`, bottom: 'auto', left: `${left}px`, width: `${bw}px` });   // toujours à l'écran
}

function actions(e, dernier) {
  if (G.route) {
    const t = G.toucher;
    return [el('p', { class: 'gd-route', role: 'status' }, el('span', { 'aria-hidden': 'true' }, '👆 '),
      t ? `Je touche « ${t.nom} »${t.pour ? ` pour ${t.pour}` : ''}…` : 'J\'y vais…'),
    el('div', { class: 'gd-acts' }, el('button', { class: 'gd-passer', type: 'button', 'data-gdsauter': '' }, 'Passer l\'animation'))];
  }
  if (sansCompte(e)) return [];
  const terminer = el('button', { class: 'btn primary', type: 'button', 'data-gdsuivant': '' }, ico('check'), 'Terminer');
  return [el('div', { class: 'gd-acts' },
    e.info ? (dernier ? terminer : el('button', { class: 'btn primary', type: 'button', 'data-gdsuivant': '' }, 'Suivant', ico('right')))
      : G.deja ? (dernier ? terminer : el('span', { class: 'gd-attente' }, ico('check'), 'Déjà fait : ▶ pour continuer'))
        : el('span', { class: 'gd-attente' }, ico('play'), 'À toi de jouer'),
    !e.info && !G.deja && el('button', { class: 'gd-passer', type: 'button', 'data-gdpasser': '' }, dernier ? 'Terminer' : 'Passer cette étape'))];
}
function dessiner() {
  if (!G) return;
  let n = $('#guide');
  if (!n) { n = el('div', { id: 'guide', class: 'guide' }); document.body.append(n); }
  const L = liste(), e = L[G.i], dernier = G.i === L.length - 1, titre = titreDe(e);
  const fil = ['Accueil', ...(sansCompte(e) ? [] : filDe(e))];
  vider(n).append(
    el('div', { class: 'gd-anneau', 'aria-hidden': 'true', hidden: true }),
    el('div', { class: `gd-bulle${reduite ? ' reduite' : ''}`, role: 'dialog', 'aria-live': 'polite', 'aria-labelledby': 'gd-h', 'data-new': '1.23.0-doigt' },
      el('div', { class: 'gd-tete' },
        el('button', { class: 'gd-reduire', type: 'button', 'data-gdreduire': '', 'aria-expanded': String(!reduite), 'aria-label': reduite ? 'Agrandir la bulle' : 'Réduire la bulle' },
          el('span', { class: 'label' }, reduite ? `${G.i + 1}/${L.length} · ${titre}` : `${G.i + 1} sur ${L.length} · ${e.groupe}`), el('span', { class: 'gd-chevron', 'aria-hidden': 'true' }, reduite ? '▴' : '▾')),
        el('div', { class: 'gd-fleches', role: 'group', 'aria-label': 'Naviguer dans la mise en place' },
          el('button', { class: 'btn icon', type: 'button', 'data-gdprec': '', disabled: G.i === 0, 'aria-label': 'Étape précédente' }, ico('left')),
          el('button', { class: 'btn icon', type: 'button', 'data-gdsuivant': '', disabled: dernier, 'aria-label': 'Étape suivante' }, ico('right')),
          el('button', { class: 'btn icon', type: 'button', 'data-gdquitter': '', 'aria-label': 'Quitter la mise en place guidée' }, '×'))),
      el('div', { class: 'gd-barre', 'aria-hidden': 'true' }, el('i', { style: `width:${Math.round(((G.i + 1) / L.length) * 100)}%` })),
      el('p', { class: 'gd-fil', 'aria-label': `Chemin : ${fil.join(', puis ')}` }, fil.map((x, k) => [k > 0 && el('span', { class: 'gd-sep', 'aria-hidden': 'true' }, '›'), el('span', {}, x)])),
      el('h3', { id: 'gd-h' }, titre),
      !G.route && el('p', { class: 'gd-texte' }, texteDe(e)),
      ...actions(e, dernier),
      el('div', { class: 'gd-outils', role: 'group', 'aria-label': 'Aides' },
        !G.route && el('button', { class: 'btn', type: 'button', 'data-gdrevoir': '', 'aria-label': 'Revoir le chemin' }, '↻ Revoir'),
        peutParler() && el('button', { class: 'btn', type: 'button', 'data-gdvoix': '', 'aria-pressed': String(voix) }, voix ? '🔊 Voix' : '🔈 Écouter'),
        el('button', { class: 'btn', type: 'button', 'data-gdlent': '', 'aria-pressed': String(lent) }, 'Plus lent'))));
  placer(n, G.route ? null : (() => { const c = cibleDe(e); return c && !c.cache ? c : null; })(), e.bulle);
}
window.addEventListener('resize', () => G && tic());
document.addEventListener('scroll', () => G && !G.route && tic(), true);
