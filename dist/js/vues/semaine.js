// 03 · Semaine : plan, choix, desserts, approbation (R-07 à R-09). Repris de Gordon Rams.ai.
import { S, $, DAYS, MOIS, dayDate, weekLabel, norm, toast, errText, render } from '../etat.js?v=1.11.0';
import { el, ico, vider } from '../el.js?v=1.11.0';
import { savePlan as ecrirePlan } from '../donnees.js?v=1.11.0';
import { pickFor, setDay, setFixed, recentFor } from '../planif.js?v=1.11.0';
import { panelHead, frameEmpty, skeleton, starRow, recipeMeta, chips, dname } from './commun.js?v=1.11.0';

export function viewWeek() {
  const out = [panelHead('03 · Plan de semaine', weekLabel(), 'Dimanche au mercredi par défaut ; ajoute un soir au besoin. Choisis toi-même un souper (une fois ou chaque semaine), puis pige le reste. Aucune recette des 3 dernières semaines, sauf les fixes.')];
  out.push(el('div', { class: 'daytog', role: 'group', 'aria-label': 'Soirs à planifier' },
    DAYS.map((d, i) => el('button', { class: 'btn', 'data-dtog': i, 'aria-pressed': String(S.on[i]) }, ico(S.on[i] ? 'check' : 'plus'), d.slice(0, 3)))));
  if (S.loading) return [...out, el('div', { class: 'week' }, DAYS.filter((d, i) => S.on[i]).map(() => skeleton()))];
  if (!S.recipes.length) return [...out, frameEmpty('Aucun souper Au livre ou À trier dans le classeur pour l\'instant. Importe tes recettes depuis le bouton Compte, en haut.')];
  out.push(el('div', { class: 'week' }, DAYS.map((d, i) => {
    if (!S.on[i]) return null;
    const id = S.plan[i], r = id && S.byId[id], left = dname(d, dayDate(i), MOIS);
    if (!r) {
      return el('div', { class: 'frame day' }, left,
        el('div', {}, el('h3', {}, id ? 'Fiche hors sélection' : 'Rien de choisi'), el('div', { class: 'meta' }, el('span', {}, id ? 'Cette recette n\'est plus Au livre ni À trier.' : 'Plus de candidats disponibles.'))),
        el('div', { class: 'acts' }, el('button', { class: 'btn', 'data-pick': i }, ico('fork'), 'Choisir'),
          el('button', { class: 'btn icon', 'data-swap': i, 'aria-label': `Piger le souper du ${d}` }, ico('shuffle'))));
    }
    const pinTag = S.fixed[i] === r.id ? el('span', { class: 'chip acc' }, ico('check'), `Chaque ${d.toLowerCase()}`)
      : S.pins.has(i) ? el('span', { class: 'chip acc' }, ico('check'), 'Choisi par toi') : null;
    return el('div', { class: 'frame day' }, left,
      el('div', { style: 'min-width:0' },
        el('button', { class: 'title-btn', 'data-preview': r.id, 'data-day': i, 'aria-label': `Voir la recette ${r.name}` }, el('h3', {}, r.name), el('span', { class: 'peek' }, ico('right'), 'Voir la recette')),
        starRow(r), recipeMeta(r), pinTag && el('div', { class: 'chips' }, pinTag), chips(r)),
      el('div', { class: 'acts' },
        el('button', { class: 'btn', 'data-pick': i, 'aria-label': `Choisir le souper du ${d}` }, ico('fork'), 'Choisir'),
        el('button', { class: 'btn', 'data-swap': i, 'aria-label': `Piger un autre souper le ${d}` }, ico('shuffle'), 'Piger'),
        el('button', { class: 'btn', 'data-cook': r.id, disabled: !r.complete, title: r.complete ? null : 'Fiche à compléter' }, ico('flame'), 'Au poêle')));
  })));
  out.push(el('div', { class: 'dess-head' }, el('h3', { class: 'label' }, 'Desserts de la semaine'),
    el('button', { class: 'btn', id: 'adddess' }, ico('plus'), `Dessert (${(S.desserts || []).length})`)));
  out.push((S.dess || []).length ? el('div', { class: 'week' }, S.dess.map((x) => {
    const r = S.byId[x.id], left = dname(DAYS[x.day], dayDate(x.day), MOIS);
    if (!r) return el('div', { class: 'frame day dess' }, left, el('div', {}, el('h3', {}, 'Dessert introuvable')), el('div', { class: 'acts' }, el('button', { class: 'btn', 'data-ddel': x.id }, 'Retirer')));
    return el('div', { class: 'frame day dess' }, left,
      el('div', { style: 'min-width:0' },
        el('button', { class: 'title-btn', 'data-preview': r.id, 'aria-label': `Voir la recette ${r.name}` }, el('h3', {}, r.name), el('span', { class: 'peek' }, ico('right'), 'Voir la recette')),
        starRow(r), recipeMeta(r),
        el('div', { class: 'chips' }, el('span', { class: 'chip acc' }, `Dessert · prévu ${DAYS[x.day].toLowerCase()}`), r.isNew && el('span', { class: 'chip' }, 'New'))),
      el('div', { class: 'acts' }, el('button', { class: 'btn', 'data-ddel': r.id, 'aria-label': `Retirer ${r.name}` }, 'Retirer'),
        el('button', { class: 'btn', 'data-cook': r.id, disabled: !r.complete }, ico('flame'), 'Au poêle')));
  })) : el('p', { class: 'hint', style: 'margin:0 0 8px' }, 'Aucun dessert prévu. Touche « Dessert » pour voir tous les desserts du livre.'));
  out.push(el('div', { class: 'week-foot' },
    el('button', { class: 'btn primary', id: 'save', disabled: S.saving || S.saved }, ico('save'), S.saving ? 'Enregistrement…' : S.saved ? 'Semaine approuvée' : 'Approuver la semaine'),
    el('button', { class: 'btn', id: 'redraw' }, ico('dice'), S.pins.size ? 'Piger le reste' : 'Piger une autre semaine'),
    el('span', { class: 'status' }, S.saved && S.planRows.length ? 'Synchronisée avec ton classeur.' : S.saved ? '' : 'Brouillon : touche un souper pour voir la recette, puis approuve.')));
  out.push(el('p', { class: 'label', style: 'margin-top:22px' }, 'Le frigo et l\'inventaire entreront dans le choix quand l\'écran Livre sera livré.'));
  return out;
}

export async function savePlan() {
  if (S.saving) return;
  S.saving = true; render();
  try { await ecrirePlan(); S.saved = true; toast('Semaine approuvée et enregistrée dans ton classeur'); }
  catch (e) { toast(errText(e)); }
  S.saving = false; render();
}

/* ---------- feuilles : choisir soi-même, desserts ---------- */
function feuille(id) {
  let n = $('#' + id);
  if (!n) { n = el('div', { id, class: 'sheet', role: 'dialog', 'aria-modal': 'true' }); document.body.append(n); document.body.style.overflow = 'hidden'; }
  return n;
}
const barre = (texte, attr) => el('div', { class: 'sheet-bar' }, el('div', { class: 'wrap' }, el('span', { class: 'label' }, texte), el('button', { class: 'btn icon', [attr]: '', 'aria-label': 'Fermer' }, ico('left'))));
const libererScroll = () => { if (!S.preview && !$('#addsheet') && !$('#picksheet') && !$('#dsheet') && !$('#comptesheet')) document.body.style.overflow = ''; };

export function openPicker(i) { S.picker = { day: i, q: '', every: !!S.fixed[i] }; renderPicker(true); }
export function closePicker() { S.picker = null; $('#picksheet')?.remove(); libererScroll(); }
function renderPicker(first) {
  const p = S.picker; if (!p) return closePicker();
  const n = feuille('picksheet'), d = DAYS[p.day], fx = S.fixed[p.day] && S.byId[S.fixed[p.day]];
  vider(n).append(barre(`${d} · Choisir le souper`, 'data-pickclose'),
    el('div', { class: 'wrap' }, el('h2', {}, `Souper du ${d.toLowerCase()}`),
      el('label', { class: 'every' }, el('input', { type: 'checkbox', id: 'pick-every', checked: p.every }),
        el('span', {}, `Chaque semaine le ${d.toLowerCase()}`, el('small', {}, 'La recette revient toute seule, sans la règle des 3 semaines.'))),
      fx && el('div', { class: 'fixnote' }, ico('check'), el('span', {}, 'Fixe en ce moment : ', el('b', {}, fx.name)), el('button', { class: 'btn', 'data-unfix': p.day }, 'Retirer')),
      el('div', { class: 'field' }, el('label', { for: 'pick-q' }, 'Chercher'), el('input', { id: 'pick-q', type: 'search', placeholder: 'Nom de la recette…', value: p.q, autocomplete: 'off' })),
      el('div', { class: 'picklist', id: 'picklist' }, pickList())));
  if (first) setTimeout(() => $('#pick-q')?.focus(), 30);
}
export function pickList() {
  const p = S.picker, q = norm(p.q || '');
  const pool = Object.values(S.all).filter((r) => r.statut !== 'Déclassée' && (!q || norm(r.name).includes(q)))
    .sort((a, b) => (b.statut === 'Au livre') - (a.statut === 'Au livre') || a.name.localeCompare(b.name, 'fr'));
  if (!pool.length) return [el('p', { class: 'hint' }, 'Aucune recette trouvée.')];
  return pool.slice(0, 80).map((r) => {
    const where = S.plan.indexOf(r.id);
    return el('button', { class: 'pickrow', 'data-pickid': r.id }, el('b', {}, r.name), el('small', {}, [r.statut, r.time ? Math.round(r.time) + ' min' : '',
      r.fixe >= 0 ? 'chaque ' + DAYS[r.fixe].toLowerCase() : '', where >= 0 && where !== p.day ? 'déjà prévu ' + DAYS[where].toLowerCase() : '',
      recentFor(r.id) ? 'servi il y a moins de 3 semaines' : ''].filter(Boolean).join(' · ')));
  });
}
export async function choosePick(id) {
  const i = S.picker.day, every = $('#pick-every')?.checked;
  const other = S.plan.indexOf(id); if (other >= 0 && other !== i) { S.plan[other] = null; S.pins.delete(other); if (S.on[other]) S.plan[other] = pickFor(other, S.plan, new Set([id])); }
  setDay(i, id); closePicker(); render();
  if (every) await setFixed(i, id); else if (S.fixed[i] && S.fixed[i] !== id) toast(`Cette semaine seulement. ${S.byId[S.fixed[i]].name} reste fixe le ${DAYS[i].toLowerCase()}.`);
}

export function openDessert() { const today = new Date().getDay(); S.dpick = { q: '', day: S.on[today] ? today : S.on.indexOf(true) }; renderDessert(); }
export function closeDessert() { S.dpick = null; $('#dsheet')?.remove(); libererScroll(); }
export function renderDessert() {
  const p = S.dpick; if (!p) return closeDessert();
  vider(feuille('dsheet')).append(barre(`Desserts · ${S.desserts.length} dans le livre`, 'data-dclose'),
    el('div', { class: 'wrap' }, el('h2', {}, 'Choisir un dessert'),
      el('div', {}, el('span', { class: 'lbl' }, 'Pour quel soir ?'), el('div', { class: 'daytog', style: 'margin:8px 0 0' },
        DAYS.map((d, i) => el('button', { class: 'btn', 'data-dday': i, 'aria-pressed': String(p.day === i) }, d.slice(0, 3))))),
      el('div', { class: 'field', style: 'margin-top:14px' }, el('label', { for: 'd-q' }, 'Chercher'), el('input', { id: 'd-q', type: 'search', placeholder: 'Nom du dessert…', value: p.q, autocomplete: 'off' })),
      el('div', { class: 'picklist', id: 'dlist' }, dessertList())));
}
export function dessertList() {
  const q = norm(S.dpick.q || ''), chosen = new Set((S.dess || []).map((x) => x.id));
  const list = S.desserts.filter((r) => !q || norm(r.name).includes(q)).sort((a, b) => (b.isNew - a.isNew) || a.name.localeCompare(b.name, 'fr'));
  if (!list.length) return [el('p', { class: 'hint' }, 'Aucun dessert trouvé.')];
  return list.map((r) => el('div', { class: 'drow' },
    el('button', { class: 'pickrow', 'data-dadd': r.id }, el('b', {}, r.name), el('small', {}, [r.isNew ? 'New' : '', r.tools.includes('Air fryer') ? 'Air fryer' : '',
      r.time ? Math.round(r.time) + ' min' : '', r.statut, chosen.has(r.id) ? 'déjà cette semaine' : ''].filter(Boolean).join(' · '))),
    el('button', { class: 'btn icon', 'data-preview': r.id, 'aria-label': `Voir la recette ${r.name}` }, ico('right'))));
}
export function addDessert(id) {
  const day = S.dpick.day; S.dess = (S.dess || []).filter((x) => x.id !== id); S.dess.push({ id, day }); S.dess.sort((a, b) => a.day - b.day);
  S.saved = false; S.prov.lines = null; closeDessert(); render();
  toast(`${S.byId[id].name} : dessert du ${DAYS[day].toLowerCase()}.`);
}
export function removeDessert(id) { S.dess = (S.dess || []).filter((x) => x.id !== id); S.saved = false; S.prov.lines = null; render(); }
