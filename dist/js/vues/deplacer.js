// 03 · Semaine : déplacer les soupers d'un soir à l'autre avant d'approuver (D-G-049).
// Tenir un souper 2 secondes (ou « Déplacer ») ouvre la vue compacte des 7 soirs, titres seulement. Sans lever le doigt,
// on le glisse : le soir visé montre l'échange en direct, et au relâchement le souper s'y dépose (les deux soirs
// échangent). On jongle autant qu'on veut, au doigt, à la souris, ou en touchant un souper puis un soir (clavier).
// « Enregistrer » revient à la semaine, en brouillon : il faut approuver la semaine pour l'écrire dans le classeur.
import { S, $, DAYS, MOIS, dayDate, render, toast } from '../etat.js?v=1.23.2';
import { el, ico, vider } from '../el.js?v=1.23.2';
import { dname } from './commun.js?v=1.23.2';
import { echanger, differences } from '../deplacement.js?v=1.23.2';

export const TENIR_MS = 2000;
let R = null;   // { plan, on, pins, depart, choisi, annonce }
let G = null;   // glisser : { pid, de, sur, x0, y0, x, y, actif, fantome }
let T = null;   // tenir : { pid, jour, x0, y0, carte, minuterie }
let sansClic = null;   // { jour, jusqua } : le clic du même geste, sur la case de départ, est ignoré

export const deplacerOuvert = () => !!R;
const nom = (id) => (id && S.byId[id] ? S.byId[id].name : '');
const vibrer = (ms) => { try { navigator.vibrate?.(ms); } catch (_) { /* pas de vibreur */ } };

export function ouvrirDeplacer() {
  R = { plan: [...S.plan], on: [...S.on], pins: new Set(S.pins), depart: [...S.plan], choisi: null, annonce: '' };
  dessiner(true);
}
export function fermerDeplacer() {
  G?.fantome?.remove(); G = null; R = null; $('#deplacer')?.remove();
  document.body.style.overflow = (S.preview || $('#sheet')) ? 'hidden' : '';
}
function enregistrer() {
  const change = differences(S.plan, R.plan).length > 0;
  if (change) { S.plan = R.plan; S.on = R.on; S.pins = R.pins; S.saved = false; S.prov.lines = null; }
  fermerDeplacer(); render();
  toast(change ? 'Nouvel ordre gardé. Approuve la semaine pour l\'enregistrer dans ton classeur.' : 'Rien n\'a changé.');
}
function deposer(de, sur) {
  const avant = R.plan;
  Object.assign(R, echanger(R, de, sur));
  const d = differences(avant, R.plan).filter(([, , b]) => b);
  R.annonce = d.map(([i, , b]) => `${nom(b)} : ${DAYS[i].toLowerCase()}`).join(' · ');
  vibrer(15);
}

function dessiner(neuf = false) {
  let n = $('#deplacer');
  if (!n) { n = el('div', { id: 'deplacer', class: 'sheet deplacer', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'dp-h' }); document.body.append(n); }
  document.body.style.overflow = 'hidden';
  const vue = G && G.actif && G.sur !== null && G.sur !== G.de ? echanger(R, G.de, G.sur) : R;   // aperçu en direct
  const change = differences(R.depart, R.plan).length > 0;
  const haut = n.scrollTop;
  vider(n).append(
    el('div', { class: 'sheet-bar' }, el('div', { class: 'wrap' }, el('span', { class: 'label' }, 'Déplacer les soupers'),
      el('button', { class: 'btn icon', type: 'button', 'data-dpannuler': '', 'aria-label': 'Annuler et revenir à la semaine' }, '×'))),
    el('div', { class: 'wrap dp-corps', 'data-new': '1.18.0-deplacer' },
      el('h2', { id: 'dp-h' }, 'Glisse un souper vers un autre soir'),
      el('p', { class: 'hint' }, 'Tiens un souper et glisse-le : il se dépose sur le soir choisi au relâchement, et les deux soirs échangent. Ou touche un souper, puis le soir voulu.'),
      el('ol', { class: 'dp-liste' }, DAYS.map((d, i) => {
        const id = vue.plan[i], r = id && S.byId[id];
        const cls = ['dp-case', r ? 'pleine' : 'libre', G?.actif && G.sur === i ? 'cible' : '', G?.actif && G.de === i ? 'source' : '', R.choisi === i ? 'choisie' : ''].filter(Boolean).join(' ');
        return el('li', { class: 'dp-ligne' }, dname(d, dayDate(i), MOIS),
          el('button', { class: cls, type: 'button', 'data-dpjour': String(i), 'aria-pressed': R.choisi === i ? 'true' : null,
            'aria-label': r ? `${d} : ${r.name}${R.choisi === i ? ' (choisi, touche un autre soir)' : ''}` : `${d} : ${vue.on[i] ? 'rien de choisi' : 'soir libre'}` },
          r ? [el('span', { class: 'dp-poignee', 'aria-hidden': 'true' }, ico('move')), el('span', { class: 'dp-titre' }, r.name),
            S.fixed[i] === id && el('small', {}, `chaque ${d.toLowerCase()}`)]
            : el('span', { class: 'dp-vide' }, vue.on[i] ? 'Rien de choisi' : 'Soir libre')));
      })),
      el('p', { class: 'dp-annonce', 'aria-live': 'polite' }, R.annonce || ''),
      el('div', { class: 'dp-pied' },
        el('button', { class: 'btn primary', type: 'button', 'data-dpenregistrer': '' }, ico('check'), 'Enregistrer'),
        el('button', { class: 'btn', type: 'button', 'data-dpannuler': '' }, 'Annuler')),
      el('p', { class: 'hint' }, change ? 'Enregistrer revient à la semaine, en brouillon : approuve-la ensuite pour l\'écrire dans ton classeur Google.'
        : 'Rien n\'a bougé pour l\'instant.')));
  n.scrollTop = haut;
  if (neuf && !G) n.querySelector('[data-dpjour]')?.focus({ preventScroll: true });
}

/** Clics de la vue compacte ; vrai si le bouton lui appartient. */
export function clicDeplacer(b) {
  const d = b.dataset;
  if (b.id === 'deplacer-btn') { ouvrirDeplacer(); return true; }
  if (!R) return false;
  if (d.dpannuler !== undefined) fermerDeplacer();
  else if (d.dpenregistrer !== undefined) enregistrer();
  else if (d.dpjour !== undefined) {                        // toucher un souper, puis un soir
    const i = +d.dpjour;
    if (R.choisi === null) { if (R.plan[i]) { R.choisi = i; R.annonce = `${nom(R.plan[i])} : touche le soir où le mettre.`; } }
    else if (R.choisi === i) { R.choisi = null; R.annonce = ''; }
    else { deposer(R.choisi, i); R.choisi = null; }
    dessiner();
    $(`#deplacer [data-dpjour="${i}"]`)?.focus({ preventScroll: true });
  } else return false;
  return true;
}

/* ---------- au doigt et à la souris ---------- */
function annulerTenir() { if (!T) return; clearTimeout(T.minuterie); T.carte.classList.remove('tenir'); T = null; }
function lever() {
  G.fantome = el('div', { class: 'dp-fantome', 'aria-hidden': 'true' }, ico('move'), nom(R.plan[G.de]));
  document.body.append(G.fantome); placer(); dessiner();
}
function placer() { if (G?.fantome) G.fantome.style.transform = `translate(${Math.round(G.x)}px, ${Math.round(G.y)}px) translate(-50%, -65%)`; }
function caseSous(x, y) { const c = document.elementFromPoint(x, y)?.closest?.('#deplacer [data-dpjour]'); return c ? +c.dataset.dpjour : null; }
function defiler(y) { const n = $('#deplacer'); if (!n) return; if (y < 90) n.scrollTop -= 10; else if (y > window.innerHeight - 90) n.scrollTop += 10; }
function activer() {
  const t = T; T = null; if (!t) return;
  t.carte.classList.remove('tenir');
  ouvrirDeplacer();
  G = { pid: t.pid, de: t.jour, sur: t.jour, x0: t.x0, y0: t.y0, x: t.x, y: t.y, actif: true };
  vibrer(30); lever();
}
function finir(e, annule) {
  const g = G; G = null; g.fantome?.remove();
  if (!g.actif) return;                                      // pas bougé : le clic fera « toucher pour choisir »
  sansClic = { jour: String(g.de), jusqua: Date.now() + 400 };
  if (!annule && g.sur !== null && g.sur !== g.de) deposer(g.de, g.sur);
  if (R) dessiner();
}

document.addEventListener('pointerdown', (e) => {
  if (e.button > 0) return;
  const c = R && e.target.closest?.('#deplacer [data-dpjour]');
  if (c) { const i = +c.dataset.dpjour; if (R.plan[i]) G = { pid: e.pointerId, de: i, sur: i, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, actif: false }; return; }
  if (R || S.view !== 'semaine') return;
  const carte = e.target.closest?.('.week .day[data-jour]');
  if (!carte || e.target.closest('.acts')) return;
  annulerTenir();
  T = { pid: e.pointerId, jour: +carte.dataset.jour, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, carte, minuterie: setTimeout(activer, TENIR_MS) };
  carte.classList.add('tenir');
});
document.addEventListener('pointermove', (e) => {
  if (T && e.pointerId === T.pid) { if (Math.hypot(e.clientX - T.x0, e.clientY - T.y0) > 12) annulerTenir(); else { T.x = e.clientX; T.y = e.clientY; } return; }
  if (!G || e.pointerId !== G.pid) return;
  G.x = e.clientX; G.y = e.clientY;
  if (!G.actif) { if (Math.hypot(G.x - G.x0, G.y - G.y0) < 6) return; G.actif = true; R.choisi = null; lever(); }
  placer(); defiler(G.y);
  const sur = caseSous(G.x, G.y);
  if (sur !== G.sur) { G.sur = sur; dessiner(); }
});
document.addEventListener('pointerup', (e) => {
  if (T && e.pointerId === T.pid) { annulerTenir(); return; }   // relâché avant 2 s : le toucher reste un toucher
  if (G && e.pointerId === G.pid) finir(e, false);
});
document.addEventListener('pointercancel', (e) => {
  if (T && e.pointerId === T.pid) annulerTenir();
  if (G && e.pointerId === G.pid) finir(e, true);
});
// Pendant qu'on glisse, le doigt ne fait pas défiler la page (sinon le navigateur annule le geste).
document.addEventListener('touchmove', (e) => { if (G) e.preventDefault(); }, { passive: false });
document.addEventListener('contextmenu', (e) => { if (T || G) e.preventDefault(); });
// Le relâchement d'un glisser ne doit pas « toucher » ce qui est dessous.
document.addEventListener('click', (e) => {
  const c = sansClic; if (!c) return;
  sansClic = null;
  if (Date.now() < c.jusqua && e.target.closest?.('[data-dpjour]')?.dataset.dpjour === c.jour) { e.stopPropagation(); e.preventDefault(); }
}, true);
