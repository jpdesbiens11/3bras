// 01 · Livre : parcourir et trier par glissement (R-03). Repris de Gordon Rams.ai.
import { S, $, TYPES, norm, starsOf, toast, errText, render } from '../etat.js?v=1.6.1';
import { el, ico } from '../el.js?v=1.6.1';
import { majRecette, rebuildPools } from '../donnees.js?v=1.6.1';
import { panelHead, skeleton, noticeWarn } from './commun.js?v=1.6.1';

function viewBook() {
  const L = S.lib, q = norm(L.q || ''), book = S.book || [];
  const types = ['Tous', ...TYPES.filter((t) => book.some((r) => r.type === t))];
  const stats = ['Tous', 'Au livre', 'À trier', 'À retravailler', 'Déclassée'];
  const list = book.filter((r) => (L.type === 'Tous' || r.type === L.type) && (L.statut === 'Tous' || r.statut === L.statut) && (!q || norm(r.name).includes(q)))
    .sort((a, b) => (starsOf(b) - starsOf(a)) || a.name.localeCompare(b.name, 'fr'));
  return [
    el('div', { class: 'field' }, el('label', { for: 'lib-q' }, 'Chercher'), el('input', { id: 'lib-q', type: 'search', placeholder: 'Nom de la recette…', value: L.q, autocomplete: 'off' })),
    el('div', { class: 'tseg filt' }, types.map((t) => el('button', { class: 'btn', 'data-libtype': t, 'aria-pressed': String(L.type === t) }, `${t} `, el('small', {}, String(t === 'Tous' ? book.length : book.filter((r) => r.type === t).length))))),
    el('div', { class: 'tseg filt' }, stats.map((t) => el('button', { class: 'btn', 'data-libstat': t, 'aria-pressed': String(L.statut === t) }, t))),
    el('p', { class: 'label', style: 'margin:12px 0 6px' }, `${list.length} recette${list.length > 1 ? 's' : ''}`),
    el('div', { class: 'picklist', id: 'liblist' }, list.slice(0, 250).map((r) => {
      const n = starsOf(r);
      return el('button', { class: 'pickrow', 'data-preview': r.id }, el('b', {}, r.name),
        el('small', {}, [n ? '★'.repeat(n) + '☆'.repeat(5 - n) : '', r.type || 'Sans type', r.statut, r.prot, r.time ? Math.round(r.time) + ' min' : '', r.isNew ? 'New' : ''].filter(Boolean).join(' · ')));
    }))
  ];
}

export function viewTri() {
  const nTri = (S.book || []).filter((r) => r.statut === 'À trier').length;
  const out = [panelHead('01 · Livre de recettes', 'Livre', S.lib.mode === 'browse' ? 'Parcours tes recettes, ouvre-les et change leurs étiquettes (type, statut, protéine, outils…).' : 'Glisse à droite pour le livre, à gauche pour déclasser, vers le bas pour retravailler.'),
    el('div', { class: 'tseg modes' },
      el('button', { class: 'btn', 'data-libmode': 'browse', 'aria-pressed': String(S.lib.mode === 'browse') }, `Parcourir (${(S.book || []).length})`),
      el('button', { class: 'btn', 'data-libmode': 'tri', 'aria-pressed': String(S.lib.mode === 'tri') }, `Trier (${nTri} à trier)`))];
  if (S.lib.mode === 'browse') return [...out, ...(S.loading ? [skeleton()] : viewBook())];
  if (S.tri.err) return [...out, noticeWarn(S.tri.err)];
  if (!S.tri.list) return [...out, skeleton('height:260px')];
  const c = S.tri.list[S.tri.idx];
  if (!c) return [...out, el('div', { class: 'frame later-panel' }, el('h3', { style: 'font-size:1.6rem;text-transform:uppercase' }, 'Livre trié'), el('p', {}, 'Plus aucune fiche à trier. Beau travail, chef.'))];
  const meta = [c.type, c.prot, c.time && Math.round(c.time) + ' min', c.source].filter(Boolean);
  return [...out, el('div', { class: 'tri-wrap' },
    el('div', { class: 'tri-count' }, `${S.tri.idx + 1} sur ${S.tri.list.length}`),
    el('div', { class: 'frame tri-card', id: 'tricard' }, el('span', { class: 'tri-hint', id: 'trihint' }),
      el('div', { class: 'label' }, c.complete ? 'Fiche complète' : 'Fiche à compléter'),
      el('h3', {}, c.name), el('div', { class: 'meta' }, meta.map((m) => el('span', {}, m))),
      el('div', { class: 'chips' }, c.weeknight && el('span', { class: 'chip' }, 'Soir de semaine'), !c.complete && el('span', { class: 'chip warn' }, 'Fiche à compléter')),
      el('p', { style: 'margin-top:auto;display:flex;gap:10px;flex-wrap:wrap;align-items:center' }, el('button', { class: 'btn', 'data-preview': c.id }, ico('right'), 'Ouvrir et changer les étiquettes'))),
    el('div', { class: 'tri-legend' },
      el('button', { class: 'btn', 'data-decide': 'Déclassée' }, ico('left'), 'Déclassée', el('small', {}, 'à gauche')),
      el('button', { class: 'btn', 'data-decide': 'À retravailler' }, ico('reset'), 'À retravailler', el('small', {}, 'vers le bas')),
      el('button', { class: 'btn', 'data-decide': 'Au livre' }, ico('check'), 'Au livre', el('small', {}, 'à droite'))))];
}

export function loadTri(force) {
  if (S.tri.list && !force) return;
  const a = (S.book || []).filter((r) => r.statut === 'À trier');
  S.tri.list = a.map((r) => ({ id: r.id, name: r.name, type: r.type, prot: r.prot, source: r.row.Source, time: r.time, complete: r.complete, weeknight: r.weeknight }))
    .sort((x, y) => (y.complete - x.complete) || ((x.type === 'Souper' ? 0 : 1) - (y.type === 'Souper' ? 0 : 1)) || String(x.name).localeCompare(y.name, 'fr'));
  S.tri.idx = 0;
}
export async function decide(statut) {
  const c = S.tri.list && S.tri.list[S.tri.idx]; if (!c) return;
  S.tri.idx++; S.tri.last = { c, statut }; render();
  try {
    await majRecette(S.byId[c.id], { Statut: statut }); rebuildPools();
    toast(`${c.name} : ${statut}`, { label: 'Annuler', fn: undoTri });
  } catch (e) { S.tri.idx--; render(); toast(errText(e)); }
}
async function undoTri() {
  const l = S.tri.last; if (!l) return; S.tri.last = null;
  try { await majRecette(S.byId[l.c.id], { Statut: 'À trier' }); rebuildPools(); S.tri.idx = Math.max(0, S.tri.idx - 1); render(); toast('Remis à trier'); } catch (e) { toast(errText(e)); }
}

/* glisser une fiche de tri */
let tx = null, ty = null, tdx = 0, tdy = 0;
document.addEventListener('pointerdown', (e) => { const c = e.target.closest('#tricard'); if (!c || e.target.closest('a,button')) return; tx = e.clientX; ty = e.clientY; tdx = tdy = 0; c.classList.add('drag'); c.setPointerCapture && c.setPointerCapture(e.pointerId); });
document.addEventListener('pointermove', (e) => {
  if (tx === null) return; const c = $('#tricard'); if (!c) return; tdx = e.clientX - tx; tdy = e.clientY - ty;
  c.style.transform = `translate(${tdx}px,${Math.max(0, tdy)}px) rotate(${tdx / 20}deg)`;
  const h = $('#trihint'); const d = Math.abs(tdx) > Math.max(0, tdy) ? (tdx > 0 ? 'Au livre' : 'Déclassée') : (tdy > 0 ? 'À retravailler' : '');
  if (h) { h.textContent = d; h.style.opacity = Math.min(1, Math.max(Math.abs(tdx), tdy) / 110); h.style.color = d === 'Déclassée' ? 'var(--warn)' : 'var(--accent-ink)'; }
});
document.addEventListener('pointerup', () => {
  if (tx === null) return; tx = null; const c = $('#tricard'); if (!c) return; c.classList.remove('drag');
  if (Math.abs(tdx) > 90 && Math.abs(tdx) > tdy) decide(tdx > 0 ? 'Au livre' : 'Déclassée');
  else if (tdy > 90) decide('À retravailler');
  else c.style.transform = '';
});
