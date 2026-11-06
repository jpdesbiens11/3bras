// Planification de la semaine et règle des 3 semaines (R-07, R-08, R-09). Repris de Gordon Rams.ai.
import { S, DAYS, GAP_DAYS, render, toast, errText } from './etat.js?v=1.6.0';
import { majRecette } from './donnees.js?v=1.6.0';

export function tooSoon(r) { if (!r.last) return false; const d = Math.abs((new Date(S.weekStart) - new Date(r.last + 'T12:00:00')) / 864e5); return d < GAP_DAYS; }
export const isFixed = (id) => Object.values(S.fixed || {}).includes(id);
export const recentFor = (id) => !isFixed(id) && ((S.recent && S.recent.has(id)) || (S.byId[id] && tooSoon(S.byId[id])));

const daysSince = (d) => (d ? (Date.now() - new Date(d).getTime()) / 864e5 : 999);
function score(r, dayIdx) {
  let s = Math.random() * 2;
  if (r.statut === 'Au livre') s += 4;
  if (r.complete) s += 3;
  if (dayIdx === 0 || dayIdx >= 5) { if (!r.weeknight) s += 1; } // dimanche, vendredi, samedi : on a le temps
  else if (r.weeknight) s += 3; else s -= 2;
  if (daysSince(r.last) < 42) s -= 1;
  if (r.note) s += (r.note - 6) / 2;
  return s;
}
export function pickFor(dayIdx, plan, exclude = new Set()) {
  const used = new Set(plan.filter(Boolean));
  const prots = new Set(plan.map((id, i) => (i !== dayIdx && id && S.byId[id] ? S.byId[id].prot : null)).filter(Boolean));
  const fresh = (r) => !(S.recent && S.recent.has(r.id)) && !tooSoon(r);
  const ok = (r) => !used.has(r.id) && !exclude.has(r.id) && !isFixed(r.id);
  let pool = S.recipes.filter((r) => ok(r) && fresh(r));
  if (!pool.length) pool = S.recipes.filter(ok); // livre trop petit : on relâche la règle
  const varied = pool.filter((r) => !r.prot || !prots.has(r.prot));
  if (varied.length) pool = varied;
  if (!pool.length) return null;
  pool.sort((a, b) => score(b, dayIdx) - score(a, dayIdx));
  return pool[0].id;
}
export function draftWeek() {
  const plan = DAYS.map(() => null), keep = S.pins || new Set();
  DAYS.forEach((d, i) => {
    if (!S.on[i]) return;
    if (S.fixed[i]) { plan[i] = S.fixed[i]; keep.add(i); } else if (keep.has(i) && S.plan[i]) plan[i] = S.plan[i];
  });
  S.pins = new Set([...keep].filter((i) => S.on[i] && plan[i]));
  DAYS.forEach((d, i) => { if (S.on[i] && !plan[i]) plan[i] = pickFor(i, plan); });
  S.plan = plan; S.saved = false; S.prov.lines = null; S.swapped = DAYS.map(() => new Set());
}
export function swap(i) {
  S.swapped = S.swapped || DAYS.map(() => new Set()); S.pins.delete(i);
  if (S.plan[i]) S.swapped[i].add(S.plan[i]);
  const p = [...S.plan]; p[i] = null;
  let next = pickFor(i, p, S.swapped[i]);
  if (!next) { S.swapped[i] = new Set(); next = pickFor(i, p, new Set([S.plan[i]])); }
  if (next) { S.plan[i] = next; S.saved = false; S.prov.lines = null; render(); }
}
export function toggleDay(i) {
  S.on[i] = !S.on[i];
  if (S.on[i]) { if (!S.plan[i]) { S.plan[i] = S.fixed[i] || pickFor(i, S.plan); if (S.fixed[i]) S.pins.add(i); } } else { S.plan[i] = null; S.pins.delete(i); }
  S.saved = false; S.prov.lines = null; render();
}
export function setDay(i, id) { S.plan[i] = id; S.on[i] = true; S.pins.add(i); S.saved = false; S.prov.lines = null; }
export async function setFixed(i, id) { // id=null : retirer le jour fixe de ce jour
  const old = S.fixed[i]; if (old === id) return;
  try {
    if (old && S.byId[old]) { await majRecette(S.byId[old], { 'Jour fixe': '' }); }
    if (id && S.byId[id]) {
      const prev = S.byId[id].fixe; if (prev >= 0 && prev !== i) delete S.fixed[prev];
      await majRecette(S.byId[id], { 'Jour fixe': DAYS[i] }); S.fixed[i] = id;
    } else delete S.fixed[i];
    toast(id ? `${S.byId[id].name} : chaque ${DAYS[i].toLowerCase()}.` : `Plus de recette fixe le ${DAYS[i].toLowerCase()}.`);
  } catch (e) { toast('Le classeur n\'a pas enregistré le jour fixe : ' + errText(e)); }
  render();
}
