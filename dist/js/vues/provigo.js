// 04 · Provigo : liste d'épicerie par rayon (R-10, R-11). Repris de Gordon Rams.ai.
import { S, DEPTS, iso, norm, weekLabel, render } from '../etat.js?v=1.12.0';
import { el, ico } from '../el.js?v=1.12.0';
import { getRecipe } from '../donnees.js?v=1.12.0';
import { ingKey, niceName, deptOf, invMatch, isStaple, neverBuy } from '../cuisine.js?v=1.12.0';
import { frozen } from './fiche.js?v=1.12.0';
import { setQty, addInv } from './garde-manger.js?v=1.12.0';
import { panelHead, skeleton, noticeWarn, frameEmpty } from './commun.js?v=1.12.0';

// R-11 : les cases cochées restent sur le téléphone, par semaine (aucune recette ni jeton).
const provKey = () => 'superchef-provigo-' + iso(S.weekStart);
function loadChecked() { try { S.prov.checked = JSON.parse(localStorage.getItem(provKey()) || '{}'); } catch (_) { S.prov.checked = {}; } }
function saveChecked() { try { localStorage.setItem(provKey(), JSON.stringify(S.prov.checked)); } catch (_) {} }

export function buildProvigo() {
  S.prov.err = null; loadChecked();
  const ids = [...S.plan.filter(Boolean), ...(S.dess || []).map((x) => x.id)];
  const pages = ids.map((id) => ({ id, d: getRecipe(id) }));
  const map = {};
  pages.forEach(({ id, d }) => d.ing.forEach((x) => {
    const k = ingKey(x.text); if (!k) return;
    (map[k] = map[k] || { key: k, name: niceName(x.text), dept: deptOf(x.text), lines: [], recipes: new Set() });
    map[k].lines.push(x.text); map[k].recipes.add(S.byId[id] ? S.byId[id].name : '');
  }));
  S.prov.lines = Object.values(map).map((l) => ({ ...l, recipes: [...l.recipes], home: (() => {
    const full = norm(l.lines[0] || l.key).replace(/[’']/g, ' ');
    if (neverBuy(l.key)) return { name: /^eau|glacon/.test(norm(l.key)) ? 'Eau du robinet' : 'Vin ou bière : pas au Provigo', qty: 'toujours' };
    if (isStaple(l.key) || isStaple(full.split(/,(?!\d)/)[0])) return { name: 'Riz, pâtes ou bouillon', qty: 'toujours' };
    const m = invMatch(l.key); return m && m.essential ? m : null;
  })() }));
  S.prov.missing = pages.filter((p) => !p.d.ing.length).map((p) => (S.byId[p.id] ? S.byId[p.id].name : '?'));
  render();
}
export async function toggleGrocery(key) {
  const l = (S.prov.lines || []).find((x) => x.key === key); if (!l) return;
  const on = !S.prov.checked[key]; S.prov.checked[key] = on; saveChecked(); render();
  const m = invMatch(key);
  if (on) { if (m) await setQty(m, m.qty + 1); else await addInv(l.name); } else if (m && m.qty > 0) await setQty(m, m.qty - 1);
}

export function viewProvigo() {
  const out = [panelHead('04 · Épicerie', 'Provigo', `Les soupers et desserts de la ${weekLabel().toLowerCase()}, moins ce qui est déjà à la maison.`,
    el('button', { class: 'btn', id: 'rebuild' }, ico('reset'), 'Recalculer'))];
  if (!S.plan.filter(Boolean).length) return [...out, frameEmpty('Planifie d\'abord ta semaine dans l\'écran Semaine.')];
  if (S.prov.err) return [...out, noticeWarn(S.prov.err)];
  if (!S.prov.lines) return [...out, skeleton(), el('p', { class: 'label', style: 'margin-top:10px' }, 'Lecture des fiches de la semaine…')];
  if (S.prov.missing && S.prov.missing.length) out.push(noticeWarn(`Sans liste d'ingrédients : ${S.prov.missing.join(', ')}. Ces soupers ne sont pas dans la liste.`));
  const had = (l) => !l.home && S.have.has(l.key);
  const buy = S.prov.lines.filter((l) => !l.home && !had(l)), home = S.prov.lines.filter((l) => l.home), mine = S.prov.lines.filter(had);
  if (frozen()) out.push(el('p', { class: 'hint', style: 'margin:0 0 10px' }, 'Ouvre une recette de la semaine pour cocher ce que tu as déjà, ou touche « J\'en ai » ici : les deux listes se suivent.'));
  const left = buy.filter((l) => !S.prov.checked[l.key]).length;
  out.push(el('p', { class: 'label' }, `${left} article${left > 1 ? 's' : ''} à prendre`));
  DEPTS.forEach((d) => {
    const ls = buy.filter((l) => l.dept === d); if (!ls.length) return;
    out.push(el('div', { class: 'dept' }, el('h3', {}, d, el('small', {}, String(ls.length))), ls.map((l) => el('div', { class: 'glrow' },
      el('label', { class: `gl ${S.prov.checked[l.key] ? 'on' : ''}` }, el('input', { type: 'checkbox', 'data-gro': l.key, checked: !!S.prov.checked[l.key] }),
        el('div', { class: 't' }, el('span', {}, l.name), el('small', {}, `${l.lines.join(' · ')} · ${l.recipes.join(', ')}`))),
      frozen() && el('button', { class: 'btn havebtn', 'data-havebtn': l.key, 'aria-label': `J'ai déjà ${l.name}` }, 'J\'en ai')))));
  });
  if (mine.length) out.push(el('div', { class: 'frame home-list mine' }, el('b', {}, `Coché comme déjà au frigo (${mine.length})`),
    mine.map((l) => el('div', { class: 'mrow' }, el('span', {}, l.name, el('small', {}, l.recipes.join(', '))),
      el('button', { class: 'btn', 'data-havebtn': l.key, 'aria-label': `Remettre ${l.name} sur la liste` }, 'Remettre')))));
  if (home.length) out.push(el('details', { class: 'frame home-list' }, el('summary', {}, `Déjà à la maison (${home.length})`),
    home.map((l) => el('div', {}, `${l.name} · ${l.home.name}${l.home.essential ? ' (essentiel)' : l.home.qty === 'toujours' ? '' : ' × ' + l.home.qty}`))));
  return out;
}
