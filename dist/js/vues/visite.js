// Visite guidée (D-G-047) : les fonctions de l'app dans l'ordre où on s'en sert, en petites scènes dessinées
// au trait (SVG animé en CSS, aucune bibliothèque, P-1). Elle s'ouvre à chaque chargement de la page (rechargement
// compris, 1.18.0) tant que « Ne plus montrer » n'est pas coché (gardé sur l'appareil) ; « Visite guidée » à l'accueil
// et Compte → « Revoir la visite » la relancent.
import { $ } from '../etat.js?v=1.22.1';
import { el, ico, vider } from '../el.js?v=1.22.1';

const CLE = 'superchef-visite';
const NS = 'http://www.w3.org/2000/svg';
function s(tag, a = {}, ...kids) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(a)) {
    if (v === null || v === undefined) continue;
    if (k === 'delai') n.style.setProperty('--d', `${v}s`);          // CSSOM : permis par la CSP
    else n.setAttribute(k, String(v));
  }
  for (const c of kids.flat()) if (c) n.append(typeof c === 'string' ? document.createTextNode(c) : c);
  return n;
}
const dessin = (...k) => s('svg', { viewBox: '0 0 320 180', class: 'vis-svg', 'aria-hidden': 'true' }, ...k);
const boite = (x, y, w, h, cls = 'v-papier', r = 8, extra = {}) => s('rect', { x, y, width: w, height: h, rx: r, class: cls, ...extra });
const txt = (x, y, t, cls = 'v-txt', extra = {}) => s('text', { x, y, class: cls, 'text-anchor': 'middle', ...extra }, t);
const trait = (d, cls = 'v-trait', extra = {}) => s('path', { d, class: cls, ...extra });
const lignes = (x, y, w, n, pas = 12) => Array.from({ length: n }, (_, k) => trait(`M${x} ${y + k * pas} H${x + w - (k % 2) * 14}`, 'v-fin'));
const logo = (x, y, t) => s('g', { transform: `translate(${x} ${y}) scale(${t})` },
  s('rect', { x: 3, y: 3, width: 26, height: 26, rx: 4, class: 'v-jaune' }),
  trait('M10.5 18 C7 18 6.2 13.1 9.6 12.1 C9.2 8.7 12.8 7.3 14.6 9.1 C15.6 6.1 19.8 6.3 20.6 9.3 C22.6 7.5 26 9.1 25.2 12.3 C28 13.5 27 18 23.5 18 Z', 'v-blanc-trait'),
  trait('M11 18 V25 H23 V18', 'v-blanc-trait'), trait('M18 19 L14.6 22.4 H17.2 L15.6 25.6', 'v-eclair'));
const coche = (x, y, delai) => trait(`M${x} ${y} l5 5 l9 -10`, 'v-trait v-coche', { delai });
const etoile = (cx, cy, r, cls, delai) => {
  const p = Array.from({ length: 10 }, (_, k) => { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r; return `${(cx + rr * Math.cos(a)).toFixed(1)} ${(cy + rr * Math.sin(a)).toFixed(1)}`; });
  return trait(`M${p.join(' L')} Z`, cls, { delai });
};

const SCENES = [
  { titre: 'Bienvenue dans SuperChef.ai', texte: 'Ton livre de recettes vit dans ton Google Drive, dans un classeur à toi. L\'app planifie la semaine, fait la liste d\'épicerie et te guide au poêle.',
    dessin: () => dessin(boite(30, 20, 74, 140, 'v-papier', 12), logo(49, 30, 1.1), ...lignes(44, 82, 46, 5),
      trait('M112 92 C150 62 180 62 206 88', 'v-trait v-flux'), trait('M198 80 L207 89 L195 93', 'v-trait'),
      boite(212, 38, 86, 104), boite(212, 38, 86, 20, 'v-jaune', 8), ...[0, 1, 2, 3].map((k) => boite(222, 66 + k * 18, 66, 10, 'v-ligne v-pop', 3, { delai: 0.4 + k * 0.25 })),
      txt(67, 174, 'Ton téléphone', 'v-petit'), txt(255, 162, 'Ton Drive', 'v-petit')) },
  { etape: 'Compte', titre: 'Démarre ton livre', texte: 'Touche le bouton Compte, en haut. Choisis des kits de recettes (Survie, Mexicain, Québécois…), puis ton stock de base. Tout s\'écrit dans ton classeur.',
    dessin: () => dessin(...['Survie', 'Mexicain', 'Québécois'].map((k, i) => s('g', { class: 'v-tombe', delai: i * 0.35 }, boite(40 + i * 82, 18, 72, 44, i === 0 ? 'v-jaune' : 'v-papier'), txt(76 + i * 82, 45, k))),
      trait('M70 128 Q160 106 250 128 V164 Q160 142 70 164 Z', 'v-papier'), trait('M160 116 V152', 'v-trait'),
      ...lignes(86, 134, 58, 2, 10), ...lignes(176, 132, 58, 2, 10), txt(160, 98, '↓', 'v-txt v-gros')) },
  { etape: '01 · Livre', titre: 'Trie tes nouvelles recettes', texte: 'Glisse une fiche à droite pour le livre, à gauche pour la déclasser, vers le bas pour la retravailler. « Modifier » corrige les infos en tout temps.',
    dessin: () => dessin(txt(48, 96, '← Déclassée', 'v-petit'), txt(276, 96, 'Au livre →', 'v-petit'), txt(160, 172, '↓ À retravailler', 'v-petit'),
      s('g', { class: 'v-glisse' }, boite(118, 26, 84, 118), boite(118, 26, 84, 34, 'v-jaune', 8), txt(160, 48, 'À trier'), ...lignes(130, 78, 60, 4))) },
  { etape: '02 · Garde-manger', titre: 'Ton garde-manger', texte: 'Ce que tu as au frigo, au congélateur, au garde-manger et aux épices. Filtre, cherche, et « Modifier » pour fusionner les doublons.',
    dessin: () => dessin(boite(28, 16, 264, 152), trait('M28 70 H292 M28 120 H292', 'v-trait'),
      ...[[48, 34], [92, 40], [136, 30], [186, 38], [230, 32], [60, 84], [112, 90], [170, 86], [222, 92]].map(([x, y], k) => boite(x, y, 30, 70 - y + (y > 60 ? 50 : 0) - 6, k % 3 ? 'v-papier v-pop' : 'v-jaune v-pop', 5, { delai: k * 0.18 })),
      txt(80, 150, 'Frigo', 'v-petit'), txt(160, 150, 'Garde-manger', 'v-petit'), txt(244, 150, 'Épices', 'v-petit')) },
  { etape: '03 · Semaine', titre: 'Pige ta semaine', texte: 'L\'app pige les soupers sans répéter une recette des 3 dernières semaines. Choisis ceux que tu veux, pige le reste, puis approuve.',
    dessin: () => dessin(...['DIM', 'LUN', 'MAR', 'MER'].map((j, i) => s('g', { class: 'v-retourne', delai: 0.3 + i * 0.3 }, boite(20 + i * 72, 22, 64, 88), txt(52 + i * 72, 40, j), ...lignes(30 + i * 72, 62, 44, 3, 11))),
      s('g', { class: 'v-de' }, boite(60, 124, 40, 40, 'v-papier', 8), ...[[70, 134], [90, 154], [80, 144]].map(([x, y]) => s('circle', { cx: x, cy: y, r: 3.2, class: 'v-point' }))),
      s('g', { class: 'v-pouls' }, boite(150, 128, 130, 32, 'v-bleu', 9), txt(215, 149, 'Approuver', 'v-blanc'))) },
  { etape: '04 · Provigo', titre: 'L\'épicerie par rayon', texte: 'La liste se fait seule, moins ce que tu as déjà. Coche en magasin. « Au garde-manger » : tu en as toujours, il ne revient plus.',
    dessin: () => dessin(boite(70, 12, 180, 158), txt(160, 34, 'Fruits et légumes', 'v-petit'),
      ...[0, 1, 2, 3, 4].map((k) => s('g', {}, boite(86, 46 + k * 24, 14, 14, 'v-papier', 3), coche(88, 52 + k * 24, 0.5 + k * 0.45), trait(`M110 ${53 + k * 24} H${222 - (k % 2) * 30}`, 'v-fin v-raye', { delai: 0.6 + k * 0.45 })))) },
  { etape: '05 · Au poêle', titre: 'Cuisine une étape à la fois', texte: 'La bonne portion à chaque étape et les minuteurs en un toucher. Il manque un ingrédient ? « Adapter avec Gemini », pour ce soir ou pour de bon.',
    dessin: () => dessin(...[0, 1, 2].map((k) => trait(`M${70 + k * 20} 58 C${64 + k * 20} 48 ${76 + k * 20} 42 ${70 + k * 20} 30`, 'v-trait v-vapeur', { delai: k * 0.5 })),
      trait('M44 70 H136 V118 C136 130 128 138 116 138 H64 C52 138 44 130 44 118 Z', 'v-papier'), trait('M36 70 H144 M30 84 H44 M136 84 H150', 'v-trait'),
      s('circle', { cx: 236, cy: 84, r: 34, class: 'v-cercle' }), s('circle', { cx: 236, cy: 84, r: 34, class: 'v-minuteur' }), txt(236, 89, '12:00'),
      s('g', { class: 'v-brille' }, etoile(286, 34, 9, 'v-jaune')), txt(236, 152, 'Adapter avec Gemini', 'v-petit')) },
  { etape: '06 · Bilan', titre: 'Note tes soupers', texte: 'À la fin de la semaine, donne des étoiles aux soupers cuisinés. L\'app pige plus souvent vos favoris.',
    dessin: () => dessin(...[0, 1, 2, 3, 4].map((k) => etoile(80 + k * 40, 70, 16, k < 4 ? 'v-etoile' : 'v-papier', 0.3 + k * 0.3)),
      s('circle', { cx: 160, cy: 138, r: 26, class: 'v-papier' }), s('circle', { cx: 160, cy: 138, r: 16, class: 'v-fin-cercle' }),
      trait('M118 116 V160 M112 116 V130 M124 116 V130 M112 130 H124', 'v-trait'), trait('M202 116 C212 126 210 140 202 144 V160', 'v-trait')) },
  { etape: '+ Recette', titre: 'Ajoute tes propres recettes', texte: 'Une photo, un lien, un PDF ou du texte : Gemini en fait une fiche. Pas de recette ? « Crée-la avec Gemini ». Bon appétit, chef !',
    dessin: () => dessin(boite(30, 26, 74, 128, 'v-papier', 12), s('circle', { cx: 67, cy: 86, r: 16, class: 'v-papier' }), s('circle', { cx: 67, cy: 86, r: 7, class: 'v-trait' }),
      boite(30, 26, 74, 128, 'v-flash', 12), trait('M114 90 H176', 'v-trait v-flux'), trait('M168 82 L177 90 L168 98', 'v-trait'),
      s('g', { class: 'v-pop', delai: 0.6 }, boite(186, 30, 104, 124), boite(186, 30, 104, 26, 'v-jaune', 8), txt(238, 48, 'Fiche'), ...lignes(198, 74, 80, 5)),
      s('g', { class: 'v-brille' }, etoile(286, 26, 10, 'v-jaune'))) }
];
export const NB_SCENES = SCENES.length;

const lire = (st, k) => { try { return st.getItem(k); } catch (_) { return null; } };
export const visiteCachee = () => lire(localStorage, CLE) === 'cachee';
export const peutMontrerVisite = () => !visiteCachee();
export function cacherVisite(on) { try { on ? localStorage.setItem(CLE, 'cachee') : localStorage.removeItem(CLE); } catch (_) { /* stockage absent */ } }

let V = null; // { i }
export const visiteOuverte = () => !!V;
export function openVisite(i = 0) { V = { i: 0 }; allerScene(i); }
export function closeVisite() { V = null; $('#visite')?.remove(); document.body.style.overflow = ($('#comptesheet') || $('#sheet')) ? 'hidden' : ''; }
export function pasVisite(delta) { if (V) allerScene(V.i + delta); }
export function allerScene(i) {
  if (!V) return;
  V.i = Math.max(0, Math.min(SCENES.length - 1, +i || 0));
  let n = $('#visite');
  if (!n) { n = el('div', { id: 'visite', class: 'sheet visite', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'vis-h' }); document.body.append(n); }
  document.body.style.overflow = 'hidden';
  const sc = SCENES[V.i], dernier = V.i === SCENES.length - 1;
  vider(n).append(
    el('div', { class: 'sheet-bar' }, el('div', { class: 'wrap' }, el('span', { class: 'label' }, `Visite guidée · ${V.i + 1} sur ${SCENES.length}`),
      el('button', { class: 'btn icon', type: 'button', 'data-visclose': '', 'aria-label': 'Fermer la visite' }, '×'))),
    el('div', { class: 'wrap vis-corps' },
      el('div', { class: 'vis-scene', id: 'vis-scene' },
        el('div', { class: 'frame vis-dessin' }, sc.dessin()),
        sc.etape && el('span', { class: 'chip acc vis-etape' }, sc.etape),
        el('h2', { id: 'vis-h' }, sc.titre), el('p', { class: 'vis-texte' }, sc.texte)),
      el('div', { class: 'vis-points', role: 'group', 'aria-label': 'Scènes de la visite' }, SCENES.map((x, k) =>
        el('button', { type: 'button', 'data-visgo': String(k), 'aria-label': `Scène ${k + 1} : ${x.titre}`, 'aria-current': k === V.i ? 'step' : null }))),
      el('div', { class: 'vis-nav' },
        el('button', { class: 'btn', type: 'button', 'data-vispas': '-1', disabled: V.i === 0 }, ico('left'), 'Précédent'),
        dernier ? el('button', { class: 'btn primary', type: 'button', 'data-visclose': '' }, ico('check'), 'C\'est parti')
          : el('button', { class: 'btn primary', type: 'button', 'data-vispas': '1' }, 'Suivant', ico('right'))),
      el('label', { class: 'vis-plus' }, el('input', { type: 'checkbox', id: 'vis-plus', checked: visiteCachee() }), 'Ne plus montrer cette visite'),
      !dernier && el('button', { class: 'vis-passer', type: 'button', 'data-visclose': '' }, 'Passer la visite')));
  n.scrollTop = 0;
}

/* glisser la scène vers la gauche ou la droite */
let gx = null;
document.addEventListener('pointerdown', (e) => { gx = e.target.closest && e.target.closest('#vis-scene') ? e.clientX : null; });
document.addEventListener('pointerup', (e) => { if (gx === null || !V) return; const dx = e.clientX - gx; gx = null; if (Math.abs(dx) > 60) pasVisite(dx < 0 ? 1 : -1); });
