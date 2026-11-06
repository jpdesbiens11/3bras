// 02 · Garde-manger (R-06). Repris de Gordon Rams.ai.
import { S, ZONES, toast, errText, render } from '../etat.js?v=1.4.0';
import { el } from '../el.js?v=1.4.0';
import { majQuantite, ajouterArticle } from '../donnees.js?v=1.4.0';
import { deptOf, zoneOf } from '../cuisine.js?v=1.4.0';
import { panelHead, skeleton, noticeWarn, frameEmpty } from './commun.js?v=1.4.0';

export function viewInv() {
  const out = [panelHead('02 · Garde-manger', 'Garde-manger', 'Frigo, garde-manger, épices et outils. L\'épicerie cochée s\'ajoute, les soupers cuisinés se retirent.'),
    el('form', { class: 'frame add-form', id: 'addinv' },
      el('input', { id: 'inv-name', placeholder: 'Ajouter un article (ex. lait 2 %)', 'aria-label': 'Article', autocomplete: 'off' }),
      el('select', { id: 'inv-zone', 'aria-label': 'Zone' }, el('option', { value: '' }, 'Zone auto'), ZONES.map((z) => el('option', {}, z))),
      el('button', { class: 'btn primary', type: 'submit' }, 'Ajouter'))];
  if (S.inv.err) return [...out, noticeWarn(S.inv.err)];
  if (S.loading || !S.inv.items) return [...out, skeleton()];
  if (!S.inv.items.length) return [...out, frameEmpty('L\'inventaire est vide. Ajoute ce que tu as sous la main, ou coche ton épicerie dans Provigo : les articles s\'ajoutent tout seuls.')];
  return [...out, ...ZONES.map((z) => {
    const its = S.inv.items.filter((i) => i.zone === z); if (!its.length) return null;
    return el('div', { class: 'zone' }, el('h3', {}, z, el('small', {}, `${its.filter((i) => i.qty > 0).length} en stock`)),
      its.map((i) => el('div', { class: `inv-row ${i.qty > 0 || i.essential ? '' : 'zero'}` },
        el('div', { class: 'nm' }, i.name, i.essential && [' ', el('span', { class: 'chip acc' }, 'Essentiel')], i.dept && el('small', {}, i.dept + (i.unit ? ' · ' + i.unit : ''))),
        el('div', { class: 'qty' },
          el('button', { class: 'btn icon', 'data-qty': i.id, 'data-d': '-1', 'aria-label': `Retirer un ${i.name}` }, '−'), el('b', {}, String(i.qty)),
          el('button', { class: 'btn icon', 'data-qty': i.id, 'data-d': '1', 'aria-label': `Ajouter un ${i.name}` }, '+')))));
  })];
}

export async function setQty(it, q) {
  q = Math.max(0, Math.round(q * 10) / 10); const prev = it.qty; it.qty = q; render();
  try { await majQuantite(it, q); } catch (e) { it.qty = prev; render(); toast(errText(e)); }
}
export async function addInv(name, zone, qty = 1) {
  name = String(name || '').trim(); if (!name) return null;
  const dept = deptOf(name); zone = zone || zoneOf(dept);
  try { const it = await ajouterArticle(name, zone, dept, qty); render(); return it; } catch (e) { toast(errText(e)); return null; }
}
