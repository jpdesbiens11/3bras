// 06 · Bilan : noter les soupers de la semaine dernière (R-13). Repris de Gordon Rams.ai.
import { S, MOIS, iso, starsOf, starLabel, toast, errText, render } from '../etat.js?v=1.9.0';
import { el, ico } from '../el.js?v=1.9.0';
import { majRecette, rebuildPools, ajouterBilan, semainePrecedente } from '../donnees.js?v=1.9.0';
import { panelHead, skeleton, noticeWarn, frameEmpty, starRow } from './commun.js?v=1.9.0';

export function loadBilan() {
  const prev = new Date(S.weekStart); prev.setDate(prev.getDate() - 7);
  const fri = new Date(prev); fri.setDate(fri.getDate() + 6);
  S.bil.week = prev;
  const ids = new Set(semainePrecedente(prev));
  Object.values(S.all).forEach((r) => { if (r.last && r.last >= iso(prev) && r.last <= iso(fri)) ids.add(r.id); });
  S.bil.items = [...ids].filter((id) => S.all[id]);
  S.bil.items.forEach((id) => { const r = S.all[id]; S.bil.form[id] = S.bil.form[id] || { fac: 7, rest: 'Un peu', real: r.time ? Math.round(r.time) : '' }; });
}
const verdict = (g) => (g >= 8 ? 'Au livre' : g >= 6 ? 'À retravailler' : 'Déclassée');
export async function saveBilan(id) {
  const r = S.all[id], f = S.bil.form[id], n = starsOf(r); if (!n) { toast('Donne d\'abord des étoiles à la recette.'); return; }
  const g = n * 2, st = verdict(g);
  const btn = document.querySelector(`[data-bsave="${CSS.escape(id)}"]`); if (btn) btn.disabled = true;
  try {
    await majRecette(r, { 'Facilité /10': f.fac, 'Note globale /10': g, 'Étoiles': starLabel(n), Restes: f.rest, Statut: st });
    const w = iso(S.bil.week);
    await ajouterBilan({ id: `b-${w}-${id}`.slice(0, 80), Date: iso(new Date()), 'Recette id': id, 'Note /10': g, Titre: `${r.name} · semaine du ${w}`,
      'Étoiles': starLabel(n), 'Facilité /10': f.fac, Restes: f.rest, 'Temps prévu (min)': r.time ? Math.round(r.time) : '',
      'Temps réel (min)': f.real !== '' && !Number.isNaN(+f.real) ? +f.real : '' });
    S.bil.done[id] = st; rebuildPools();
    toast(`${r.name} : ${st}`); render();
  } catch (e) { if (btn) btn.disabled = false; toast(errText(e)); }
}
const stepper = (id, k, v, label) => el('div', { class: 'field' }, el('label', {}, label), el('div', { class: 'qty' },
  el('button', { class: 'btn icon', 'data-bf': id, 'data-k': k, 'data-d': '-1', 'aria-label': `${label} moins` }, '−'), el('b', {}, String(v)),
  el('button', { class: 'btn icon', 'data-bf': id, 'data-k': k, 'data-d': '1', 'aria-label': `${label} plus` }, '+')));

export function viewBilan() {
  const out = [panelHead('06 · Bilan', 'Bilan', 'Avant le prochain plan : comment se sont passés les soupers de la semaine dernière ?')];
  if (S.bil.err) return [...out, noticeWarn(S.bil.err)];
  if (S.loading || !S.bil.items) return [...out, skeleton()];
  if (!S.bil.items.length) return [...out, frameEmpty(`Aucun souper planifié ni cuisiné la semaine du ${S.bil.week.getDate()} ${MOIS[S.bil.week.getMonth()]}. Le bilan se remplira après ta première semaine avec SuperChef.ai.`)];
  return [...out, ...S.bil.items.map((id) => {
    const r = S.all[id], f = S.bil.form[id], n = starsOf(r), done = S.bil.done[id];
    return el('div', { class: `frame bil ${done ? 'done' : ''}` }, el('h3', {}, r.name),
      el('div', { class: 'field' }, el('label', {}, 'Note de la famille'), starRow(r)),
      stepper(id, 'fac', f.fac, 'Facilité /10'),
      el('div', { class: 'field' }, el('label', {}, 'Restes'), el('div', { class: 'seg' }, ['Assiettes léchées', 'Un peu', 'Beaucoup'].map((x) => el('button', { class: 'btn', 'data-brest': id, 'data-v': x, 'aria-pressed': String(f.rest === x) }, x)))),
      el('div', { class: 'field' }, el('label', { for: `real-${id}` }, 'Temps réel (min)', r.time && [' ', el('small', { style: 'color:var(--muted)' }, `prévu ${Math.round(r.time)}`)]),
        el('input', { id: `real-${id}`, 'data-breal': id, type: 'number', inputmode: 'numeric', min: '0', value: String(f.real), style: 'width:96px' })),
      el('div', { class: 'field' }, el('span', { class: 'verdict' }, done ? 'Enregistré : ' + done : n ? 'Verdict : ' + verdict(n * 2) : 'Donne des étoiles pour avoir le verdict'),
        el('button', { class: 'btn primary', 'data-bsave': id, disabled: !!done || !n }, ico('save'), 'Enregistrer')));
  })];
}
