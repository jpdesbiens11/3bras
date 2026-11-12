// 02 · Garde-manger (R-06). Repris de Gordon Rams.ai.
// D-G-043 : filtres (recherche, zone, état) et mode « Modifier » (nom, zone, rayon, essentiel, supprimer,
// fusionner les doublons probables). Tout s'écrit dans l'onglet Inventaire du classeur.
import { S, $, ZONES, DEPTS, norm, toast, errText, render } from '../etat.js?v=1.20.1';
import { el, ico } from '../el.js?v=1.20.1';
import { majQuantite, ajouterArticle, majArticle, supprimerArticle, remettreArticle, fusionnerArticles } from '../donnees.js?v=1.20.1';
import { deptOf, zoneOf } from '../cuisine.js?v=1.20.1';
import { couvre } from '../stock.js?v=1.20.1';
import { panelHead, skeleton, noticeWarn, frameEmpty } from './commun.js?v=1.20.1';

const ETATS = [['tous', 'Tous'], ['stock', 'En stock'], ['epuises', 'Épuisés'], ['essentiels', 'Essentiels']];
const F = () => (S.inv.f ||= { q: '', zone: '', etat: 'tous', edit: false });
const garder = (i) => { const f = F(), q = norm(f.q).trim();
  return (!q || norm(i.name).includes(q)) && (!f.zone || i.zone === f.zone)
    && (f.etat === 'tous' || (f.etat === 'stock' && (i.qty > 0 || i.essential)) || (f.etat === 'epuises' && i.qty <= 0 && !i.essential) || (f.etat === 'essentiels' && i.essential)); };

// Doublon probable : même nom, ou un nom qui contient tous les mots de l'autre (« Huile d'olive » / « huile olive »).
export function doublonDe(it, items) {
  for (const x of items) { if (x === it) return null; if (norm(x.name).trim() === norm(it.name).trim() || couvre(x.name, it.name) || couvre(it.name, x.name)) return x; }
  return null;
}

const puce = (attrs, txt, on) => el('button', { type: 'button', class: 'btn', 'aria-pressed': String(!!on), ...attrs }, txt);
function filtres(n, total) {
  const f = F();
  return el('div', { class: 'frame inv-filtres' },
    el('div', { class: 'inv-ligne' },
      el('input', { id: 'inv-q', type: 'search', value: f.q, placeholder: 'Chercher un article', 'aria-label': 'Chercher un article', autocomplete: 'off' }),
      puce({ id: 'inv-edit', 'data-new': '1.13.0-modifier' }, f.edit ? 'Terminer' : 'Modifier', f.edit)),
    el('div', { class: 'raccourcis', role: 'group', 'aria-label': 'Zone' }, puce({ 'data-invzonef': '' }, 'Toutes les zones', !f.zone), ZONES.map((z) => puce({ 'data-invzonef': z }, z, f.zone === z))),
    el('div', { class: 'raccourcis', role: 'group', 'aria-label': 'État' }, ETATS.map(([k, l]) => puce({ 'data-invetat': k }, l, f.etat === k))),
    el('p', { class: 'label' }, n === total ? `${total} article${total > 1 ? 's' : ''}` : `${n} sur ${total} articles`));
}

function ligneNormale(i) {
  return el('div', { class: `inv-row ${i.qty > 0 || i.essential ? '' : 'zero'}` },
    el('div', { class: 'nm' }, i.name, i.essential && [' ', el('span', { class: 'chip acc' }, 'Essentiel')], i.dept && el('small', {}, i.dept + (i.unit ? ' · ' + i.unit : ''))),
    el('div', { class: 'qty' },
      el('button', { class: 'btn icon', 'data-qty': i.id, 'data-d': '-1', 'aria-label': `Retirer un ${i.name}` }, '−'), el('b', {}, String(i.qty)),
      el('button', { class: 'btn icon', 'data-qty': i.id, 'data-d': '1', 'aria-label': `Ajouter un ${i.name}` }, '+')));
}
function ligneEdition(i) {
  const d = doublonDe(i, S.inv.items);
  return el('div', { class: 'inv-edit' },
    el('div', { class: 'inv-ligne' },
      el('input', { 'data-invnom': i.id, value: i.name, 'aria-label': `Nom de ${i.name}`, autocomplete: 'off' }),
      el('button', { class: 'btn icon danger', type: 'button', 'data-invdel': i.id, 'aria-label': `Supprimer ${i.name}`, title: 'Supprimer' }, '×')),
    el('div', { class: 'inv-ligne' },
      el('select', { 'data-invzone': i.id, 'aria-label': `Zone de ${i.name}` }, ZONES.map((z) => el('option', { value: z, selected: z === i.zone }, z))),
      el('select', { 'data-invdept': i.id, 'aria-label': `Rayon de ${i.name}` }, el('option', { value: '' }, 'Rayon ?'), DEPTS.map((x) => el('option', { value: x, selected: x === i.dept }, x))),
      el('label', { class: 'gen-coche' }, el('input', { type: 'checkbox', 'data-invess': i.id, checked: i.essential }), 'Essentiel')),
    d && el('p', { class: 'hint inv-double' }, `Doublon possible de « ${d.name} » (${d.zone}, ${d.qty}). `,
      el('button', { class: 'btn', type: 'button', 'data-invfus': i.id, 'data-dans': d.id }, `Fusionner dans « ${d.name} »`)));
}

export function viewInv() {
  const out = [panelHead('02 · Garde-manger', 'Garde-manger', 'Frigo, garde-manger, épices et outils. L\'épicerie cochée s\'ajoute, les soupers cuisinés se retirent.'),
    el('form', { class: 'frame add-form', id: 'addinv' },
      el('input', { id: 'inv-name', placeholder: 'Ajouter un article (ex. lait 2 %)', 'aria-label': 'Article', autocomplete: 'off' }),
      el('select', { id: 'inv-zone', 'aria-label': 'Zone' }, el('option', { value: '' }, 'Zone auto'), ZONES.map((z) => el('option', {}, z))),
      el('button', { class: 'btn primary', type: 'submit' }, 'Ajouter'))];
  if (S.inv.err) return [...out, noticeWarn(S.inv.err)];
  if (S.loading || !S.inv.items) return [...out, skeleton()];
  if (!S.inv.items.length) return [...out, frameEmpty('L\'inventaire est vide. Ajoute ce que tu as sous la main, choisis ton stock de base dans Compte, ou coche ton épicerie dans Provigo : les articles s\'ajoutent tout seuls.')];
  const vus = S.inv.items.filter(garder), f = F();
  out.push(filtres(vus.length, S.inv.items.length));
  if (!vus.length) return [...out, frameEmpty('Aucun article ne correspond à ces filtres.')];
  return [...out, ...ZONES.map((z) => {
    const its = vus.filter((i) => i.zone === z); if (!its.length) return null;
    return el('div', { class: 'zone' }, el('h3', {}, z, el('small', {}, `${its.filter((i) => i.qty > 0).length} en stock`)), its.map(f.edit ? ligneEdition : ligneNormale));
  })];
}

/* ---------- filtres et mode Modifier ---------- */
export function filtrerInv(cle, v) { const f = F(); if (cle === 'q') f.q = v; else if (cle === 'zone') f.zone = v; else if (cle === 'etat') f.etat = v; else if (cle === 'edit') f.edit = !f.edit; render(); }
const article = (id) => (S.inv.items || []).find((i) => i.id === id);
export async function modifierArticle(id, champ, valeur) {
  const it = article(id); if (!it) return;
  const col = { nom: 'Nom', zone: 'Zone', dept: 'Département', ess: 'Essentiel' }[champ];
  if (champ === 'nom') { valeur = String(valeur || '').trim(); if (!valeur || valeur === it.name) { render(); return; } }
  try { await majArticle(it, { [col]: valeur }); toast(`« ${it.name} » mis à jour`); } catch (e) { toast(errText(e)); }
  render();
}
export async function supprimerInv(id) {
  const it = article(id); if (!it) return;
  const row = { ...it.row };
  try {
    await supprimerArticle(it); render();
    toast(`« ${it.name} » supprimé`, { label: 'Annuler', fn: () => remettreArticle(row).then(render).catch((e) => toast(errText(e))) });
  } catch (e) { toast(errText(e)); render(); }
}
export async function fusionnerInv(id, dansId) {
  const double = article(id), garde = article(dansId); if (!double || !garde) return;
  try { await fusionnerArticles(garde, double); toast(`« ${double.name} » fusionné dans « ${garde.name} » (${garde.qty})`); } catch (e) { toast(errText(e)); }
  render();
}
/* ---------- quantités et ajouts ---------- */
export async function setQty(it, q) {
  q = Math.max(0, Math.round(q * 10) / 10); const prev = it.qty; it.qty = q; render();
  try { await majQuantite(it, q); } catch (e) { it.qty = prev; render(); toast(errText(e)); }
}
export async function addInv(name, zone, qty = 1, essentiel = false) {
  name = String(name || '').trim(); if (!name) return null;
  const dept = deptOf(name); zone = zone || zoneOf(dept);
  try { const it = await ajouterArticle(name, zone, dept, qty, essentiel); render(); return it; } catch (e) { toast(errText(e)); return null; }
}
export const focusInvQ = (pos) => { const i = $('#inv-q'); if (i) { i.focus(); try { i.setSelectionRange(pos, pos); } catch (_) {} } };
