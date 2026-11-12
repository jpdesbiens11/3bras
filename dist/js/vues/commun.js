// Morceaux d'interface partagés : étoiles, méta, puces, étiquettes. Repris de Gordon Rams.ai.
import { S, DAYS, TYPES, PROTS, CUIS, OUTILS, starsOf, starLabel, toolsOf, toast, errText, render, renderSheet } from '../etat.js?v=1.17.0';
import { el, ico, svgEtoile } from '../el.js?v=1.17.0';
import { majRecette, rebuildPools } from '../donnees.js?v=1.17.0';
import { recentFor } from '../planif.js?v=1.17.0';

export const panelHead = (label, titre, texte, ...extra) => el('div', { class: 'panel-head' },
  el('div', {}, el('div', { class: 'label' }, label), el('h2', {}, titre), texte && el('p', {}, texte)), ...extra);
export const noticeWarn = (msg, ...extra) => el('div', { class: 'notice warn' }, ico('alert'), el('p', {}, msg), ...extra);
export const skeleton = (style) => el('div', { class: 'skeleton', style });
export const frameEmpty = (...kids) => el('div', { class: 'frame empty' }, ...kids);

export function starRow(r) {
  if (!r || !r.id) return null;
  const n = starsOf(r);
  return el('div', { class: 'stars', role: 'group', 'aria-label': `Note : ${n ? n + ' étoile' + (n > 1 ? 's' : '') + ' sur 5' : 'pas encore notée'}` },
    [1, 2, 3, 4, 5].map((k) => el('button', { type: 'button', class: `star ${k <= n ? 'on' : ''}`, 'data-star': r.id, 'data-n': k,
      'aria-label': `${k} étoile${k > 1 ? 's' : ''} sur 5`, 'aria-pressed': String(k <= n) }, svgEtoile())),
    n ? null : el('span', { class: 'stars-hint' }, 'À noter'));
}
export function recipeMeta(r) {
  return el('div', { class: 'meta' },
    r.prot && el('span', {}, ico('flame'), r.prot),
    r.time && el('span', {}, ico('clock'), `${Math.round(r.time)} min`),
    r.portions && el('span', {}, ico('users'), `${Math.round(r.portions)} portions`));
}
export function chips(r) {
  return el('div', { class: 'chips' },
    r.statut === 'Au livre' && el('span', { class: 'chip acc' }, 'Au livre'),
    r.adaptee && el('span', { class: 'chip acc' }, 'Version de famille'),
    (r.statut === 'Déclassée' || r.statut === 'À retravailler') && el('span', { class: 'chip warn' }, r.statut),
    r.weeknight && el('span', { class: 'chip' }, 'Soir de semaine'),
    r.portions && r.portions >= 6 && el('span', { class: 'chip' }, 'Restes pour les lunchs'),
    !r.complete && el('span', { class: 'chip warn' }, 'Fiche à compléter'),
    S.view === 'semaine' && recentFor(r.id) && el('span', { class: 'chip warn' }, 'Déjà servi il y a moins de 3 semaines'));
}

export async function setStars(id, n) {
  const r = S.byId[id]; if (!r) return;
  if (starsOf(r) === n) n = 0; // retoucher la même étoile : enlève la note
  const before = r.note; r.note = n ? n * 2 : null; render(); if (S.preview) renderSheet();
  try { await majRecette(r, { 'Note globale /10': n ? n * 2 : '', 'Étoiles': starLabel(n) }); } catch (e) {
    r.note = before; render(); if (S.preview) renderSheet(); toast('Le classeur n\'a pas enregistré la note : ' + errText(e)); return;
  }
  const want = !n ? null : n <= 2 ? 'Déclassée' : n === 3 ? 'À retravailler' : 'Au livre';
  if (want && r.statut !== want) toast(`${r.name} : ${n} étoile${n > 1 ? 's' : ''}.`, { label: want === 'Déclassée' ? 'Déclasser' : want === 'Au livre' ? 'Mettre au livre' : 'À retravailler', fn: () => setStatut(id, want) });
  else toast(`${r.name} : ${n ? n + ' étoile' + (n > 1 ? 's' : '') : 'note enlevée'}.`);
}
export async function setStatut(id, statut) {
  const r = S.byId[id]; if (!r) return; const before = r.statut; r.statut = statut;
  rebuildPools(); render(); if (S.preview) renderSheet();
  try { await majRecette(r, { Statut: statut }); rebuildPools(); toast(`${r.name} : ${statut}`); } catch (e) { r.statut = before; rebuildPools(); render(); toast('Le classeur n\'a pas enregistré le statut : ' + errText(e)); }
}
export async function setTag(id, prop, v) {
  const r = S.byId[id]; if (!r) return;
  const before = { ...r }; let val;
  if (prop === 'Type') { r.type = v; val = v; }
  else if (prop === 'Protéine') { r.prot = r.prot === v ? null : v; val = r.prot || ''; }
  else if (prop === 'Cuisine') { r.cuisine = r.cuisine === v ? null : v; val = r.cuisine || ''; }
  else if (prop === 'Soir de semaine') { r.weeknight = !r.weeknight; val = r.weeknight; }
  else if (prop === 'Outils') { const t = new Set(toolsOf(r)); t.has(v) ? t.delete(v) : t.add(v); r.tools = [...t]; val = r.tools.join(', '); }
  else if (prop === 'Étiquettes') { r.isNew = !r.isNew; val = r.isNew ? 'New' : ''; }
  else return;
  rebuildPools(); render(); if (S.preview) renderSheet();
  try { await majRecette(r, { [prop]: val }); rebuildPools(); toast(`${r.name} : ${prop.toLowerCase()} mis à jour`); } catch (e) {
    Object.assign(r, before); rebuildPools(); render(); if (S.preview) renderSheet(); toast('Le classeur n\'a pas enregistré : ' + errText(e));
  }
}
export function tagEditor(r) {
  if (!r || !r.id) return null;
  const seg = (prop, opts, cur) => el('div', { class: 'tseg' }, opts.map((o) => el('button', { type: 'button', class: 'btn', 'data-tag': prop, 'data-v': o,
    'aria-pressed': String(Array.isArray(cur) ? cur.includes(o) : cur === o) }, o)));
  const champ = (lbl, ...k) => el('div', { class: 'tfield' }, el('span', { class: 'lbl' }, lbl), ...k);
  return el('details', { class: 'tagedit', open: !!(S.preview && S.preview.edit) }, el('summary', {}, ico('check'), 'Étiquettes de la recette'),
    champ('Type', seg('Type', TYPES, r.type)),
    champ('Statut', el('div', { class: 'tseg' }, ['Au livre', 'À trier', 'À retravailler', 'Déclassée'].map((o) => el('button', { type: 'button', class: 'btn', 'data-setstatut': o, 'aria-pressed': String(r.statut === o) }, o)))),
    champ('Protéine', seg('Protéine', PROTS, r.prot)),
    champ('Cuisine', seg('Cuisine', CUIS, r.cuisine)),
    champ('Outils', seg('Outils', OUTILS, toolsOf(r))),
    champ('Autres', el('div', { class: 'tseg' },
      el('button', { type: 'button', class: 'btn', 'data-tag': 'Soir de semaine', 'data-v': '1', 'aria-pressed': String(!!r.weeknight) }, 'Soir de semaine (45 min ou moins)'),
      el('button', { type: 'button', class: 'btn', 'data-tag': 'Étiquettes', 'data-v': 'New', 'aria-pressed': String(!!r.isNew) }, 'New'))));
}
export const dname = (d, dt, MOIS) => el('div', { class: 'dname' }, el('b', {}, d.slice(0, 3)), el('small', {}, `${dt.getDate()} ${MOIS[dt.getMonth()].slice(0, 4)}.`));
export const jourCourt = (i) => DAYS[i].slice(0, 3);
