// 05 · Au poêle : mode cuisine (R-12). Repris de Gordon Rams.ai.
import { S, $, DAYS, iso, toast, errText, render } from '../etat.js?v=1.10.0';
import { el, ico, svgGrand } from '../el.js?v=1.10.0';
import { getRecipe, majRecette } from '../donnees.js?v=1.10.0';
import { stepPlan, stepDurations, isBlocking, sousFor, ingKey, invMatch, portionDansEtape, ficheDeLigne } from '../cuisine.js?v=1.10.0';
import { iaDisponible } from '../ia.js?v=1.10.0';
import { SOUNDS, soundKey, wakeOn, fmt } from '../minuteurs.js?v=1.10.0';
import { setQty } from './garde-manger.js?v=1.10.0';
import { panelHead, noticeWarn } from './commun.js?v=1.10.0';

export function openCook(id) {
  S.cook = { id, data: null, idx: 0, loading: false, err: null };
  const data = getRecipe(id);
  if (!data.steps.length) S.cook.err = 'Cette fiche n\'a pas encore d\'étapes dans ton classeur. On la complète d\'abord dans le livre.';
  else S.cook.data = data;
  render(); wakeOn();
}
// D-G-036 : « Cuisiner cette version ce soir » — la recette adaptée sert au poêle sans rien écrire dans le livre.
const garderEtape = (data) => Math.min(S.cook.id ? S.cook.idx : 0, Math.max(0, data.steps.length - 1));
export function cuisinerVersion(id, res, demande) {
  const livre = getRecipe(id);
  const data = ficheDeLigne({
    ingText: res.ingredients.flatMap((g) => [g.groupe ? `## ${g.groupe}` : null, ...g.items]).filter(Boolean).join('\n'),
    stepsText: res.etapes.join('\n'), sous: (res.sous.length ? res.sous : livre.sous).join('\n')
  });
  const idx = S.cook.id === id ? garderEtape(data) : 0;
  S.cook = { id, data, idx, loading: false, err: null, soir: { demande, changements: res.changements || [] } };
  render(); wakeOn();
}
// Recharge la recette du livre (après « Remettre » ou après « Remplacer la recette »), à la même étape.
export function chargerLivre() {
  if (!S.cook.id) return;
  const data = getRecipe(S.cook.id);
  Object.assign(S.cook, { data, idx: garderEtape(data), soir: null, got: null });
  render();
}
const cookSlides = () => (S.cook.data ? S.cook.data.steps.length + 1 : 0); // étapes + fourchette
export function go(delta) {
  const n = cookSlides(); if (!n) return;
  const next = Math.min(n - 1, Math.max(0, S.cook.idx + delta));
  if (next === S.cook.idx) return;
  S.cook.idx = next; render();
}
export async function served() {
  const r = S.byId[S.cook.id]; if (!r) return;
  const btn = $('#served'); if (btn) btn.disabled = true;
  try {
    await majRecette(r, { 'Dernière fois cuisinée': iso(new Date()) });
    toast('Noté dans ton classeur : cuisiné aujourd\'hui');
    if (btn) { btn.replaceChildren(ico('check'), 'C\'est noté'); }
  } catch (e) { toast(errText(e)); if (btn) btn.disabled = false; }
}
function cookInvMatches() {
  const d = S.cook.data; if (!d || !S.inv.items) return [];
  const seen = new Set(), out = [];
  d.ing.forEach((x) => { const m = invMatch(ingKey(x.text)); if (m && m.qty > 0 && !m.essential && !seen.has(m.id)) { seen.add(m.id); out.push(m); } });
  return out;
}
export async function applyInvOff() {
  const boxes = [...document.querySelectorAll('[data-invoff]')].filter((b) => b.checked);
  const btn = $('#invoff'); if (btn) btn.disabled = true;
  for (const b of boxes) { const it = (S.inv.items || []).find((i) => i.id === b.dataset.invoff); if (it) await setQty(it, it.qty - 1); }
  toast(boxes.length ? `Inventaire mis à jour (${boxes.length})` : 'Rien à retirer');
}

export function viewCook() {
  const planned = [...S.plan.map((id, i) => ({ id, i })), ...(S.dess || []).map((x) => ({ id: x.id, i: x.day }))].filter((x) => x.id && S.byId[x.id]);
  const out = [panelHead('05 · Au poêle', 'Mode cuisine', 'Glisse vers la gauche pour l\'étape suivante.'),
    el('div', { class: 'pick' }, planned.map((x) => el('button', { class: 'btn', 'data-cook': x.id, 'aria-pressed': String(S.cook.id === x.id), disabled: !S.byId[x.id].complete }, `${DAYS[x.i].slice(0, 3)} · ${S.byId[x.id].name}`)))];
  if (!S.cook.id) {
    const today = new Date().getDay(); const ti = S.on[today] ? today : -1;
    const sug = ti >= 0 && S.plan[ti] && S.byId[S.plan[ti]];
    return [...out, el('div', { class: 'frame later-panel' }, el('h3', { style: 'font-size:1.6rem;text-transform:uppercase' }, 'Qu\'est-ce qu\'on cuisine ?'),
      el('p', {}, sug ? `Ce soir, c'est ${sug.name}.` : 'Choisis un souper de la semaine ci-dessus. Seules les fiches complètes s\'ouvrent en mode cuisine.'),
      sug && sug.complete && el('p', {}, el('button', { class: 'btn primary', 'data-cook': sug.id }, ico('flame'), 'Allumer le rond')))];
  }
  const r = S.byId[S.cook.id] || { name: 'Recette' };
  if (S.cook.err) return [...out, noticeWarn(S.cook.err)];
  const d = S.cook.data, n = cookSlides(), idx = S.cook.idx, si = idx;
  let stage, band = null;
  if (idx === n - 1) {
    const ms = cookInvMatches();
    stage = el('div', { class: 'slide stage fork', style: 'padding:0' }, svgGrand('fork'), el('h3', {}, 'La fourchette'),
      el('p', {}, `${r.name} est servi. Bon appétit à la brigade.`),
      el('button', { class: 'btn primary', id: 'served' }, ico('check'), 'On a mangé ça ce soir'),
      el('p', { class: 'label' }, 'Inscrit la date dans Dernière fois cuisinée'),
      ms.length && el('div', { class: 'inv-off' }, el('div', { class: 'label' }, 'Retirer de l\'inventaire'),
        ms.map((m) => el('label', {}, el('input', { type: 'checkbox', 'data-invoff': m.id, checked: true }), m.name, ' ', el('small', { style: 'color:var(--muted)' }, `(${m.qty})`))),
        el('button', { class: 'btn', id: 'invoff' }, ico('check'), 'Mettre à jour l\'inventaire')));
  } else {
    const step = d.steps[si], plan = stepPlan(d), mine = plan.per[si], extra = si === 0 ? plan.extra : [], durs = stepDurations(step), block = isBlocking(step);
    S.cook.got = S.cook.got || new Set();
    // D-G-032 : un ingrédient partagé entre plusieurs étapes montre la portion de cette étape, sinon les autres étapes où il sert.
    const row = (k) => {
      const autres = (plan.usage[k] || []).filter((x) => x !== si), part = autres.length ? portionDansEtape(step, d.ing[k]) : null;
      const note = autres.length && [part ? `Sur ${d.ing[k].text}` : null, `Aussi à l'étape${autres.length > 1 ? 's' : ''} ${autres.map((x) => x + 1).join(', ').replace(/, (\d+)$/, ' et $1')}`].filter(Boolean).join(' · ');
      return el('label', { class: S.cook.got.has(k) ? 'on' : '' }, el('input', { type: 'checkbox', 'data-got': k, checked: S.cook.got.has(k) }),
        el('span', {}, part || d.ing[k].text, note && el('small', { class: 'partage' }, note)));
    };
    stage = el('div', { class: 'slide', style: 'display:flex;flex-direction:column;gap:18px' },
      el('div', { class: 'step-no' }, `Étape ${si + 1} sur ${d.steps.length}`),
      el('div', { class: 'step-text' }, step),
      (mine.length || extra.length) && el('div', { class: 'stepings' }, el('div', { class: 'label' }, 'Pour cette étape'), mine.map(row),
        extra.length && [el('div', { class: 'label', style: 'margin-top:8px' }, 'Aussi à prévoir'), extra.map(row)]),
      durs.length && el('div', { class: 'tstart' },
        durs.map((x) => el('button', { class: 'btn tbtn', 'data-tadd': x.secs, 'data-tlabel': `Étape ${si + 1} · ${x.lbl}` }, ico('clock'), `Lancer ${x.lbl}`)),
        el('p', { class: 'tnote' }, block ? 'Cette étape bloque la suite : attends la fin du minuteur avant de continuer.' : 'Le minuteur roule en arrière-plan : tu peux passer à l\'étape suivante.')));
    const task = sousFor(step, si, d.sous);
    if (task) band = el('div', { class: 'souschef' }, ico('chef'), el('div', {}, el('div', { class: 'label' }, 'Sous-chef, en parallèle'), el('p', {}, task)));
  }
  return [...out, el('div', { class: 'frame cook', id: 'cook' },
    el('div', { class: 'cook-top' }, el('span', { class: 'title' }, r.name), el('span', { class: 'lock', id: 'lock' }),
      el('span', { class: 'count' }, `${String(idx + 1).padStart(2, '0')}/${String(n).padStart(2, '0')}`)),
    el('div', { class: 'progress' }, Array.from({ length: n }, (_, k) => el('i', { class: k <= idx ? 'on' : '' }))),
    S.cook.soir && el('div', { class: 'soir' }, ico('chef'),
      el('div', {}, el('div', { class: 'label' }, 'Version de ce soir · pas dans le livre'), el('p', {}, [S.cook.soir.demande, ...S.cook.soir.changements].join(' · '))),
      el('button', { class: 'btn', id: 'remettre', type: 'button' }, 'Remettre la recette du livre')),
    el('div', { class: 'stage' }, stage), band,
    iaDisponible() && el('div', { class: 'cook-adapt' }, el('button', { class: 'btn', 'data-adapt': S.cook.id, 'data-adaptcook': '', type: 'button' }, ico('chef'), 'Adapter avec Gemini')),
    el('details', { class: 'tfree' }, el('summary', {}, ico('clock'), 'Autre minuteur et son'),
      el('div', { class: 'tfree-in' },
        el('div', { class: 'seg' }, [1, 3, 5, 10, 15, 20, 30].map((m) => el('button', { class: 'btn', 'data-tadd': m * 60, 'data-tlabel': `Minuteur ${m} min` }, `${m} min`))),
        el('div', { class: 'field' }, el('label', { for: 'snd' }, 'Son de fin'), el('div', { style: 'display:flex;gap:8px' },
          el('select', { id: 'snd' }, Object.entries(SOUNDS).map(([k, v]) => el('option', { value: k, selected: k === soundKey() }, v.nom))),
          el('button', { class: 'btn', id: 'sndtest', type: 'button' }, 'Essayer'))))),
    el('div', { class: 'cook-nav' },
      el('button', { class: 'btn', id: 'prev', disabled: idx === 0 }, ico('left'), 'Précédente'),
      el('button', { class: 'btn primary', id: 'next', disabled: idx === n - 1 }, idx === n - 2 ? 'À la fourchette' : 'Suivante', ico('right'))))];
}
export { fmt };
