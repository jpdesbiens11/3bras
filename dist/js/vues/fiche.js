// Aperçu d'une recette et « déjà à la maison ». Repris de Gordon Rams.ai.
import { S, $, DAYS, norm, toast, errText, render } from '../etat.js?v=1.18.0';
import { el, ico, vider } from '../el.js?v=1.18.0';
import { getRecipe, saveHave } from '../donnees.js?v=1.18.0';
import { ingKey, invMatch, isStaple, neverBuy } from '../cuisine.js?v=1.18.0';
import { lienClasseur } from '../store.js?v=1.18.0';
import { starRow, recipeMeta, chips, tagEditor, noticeWarn } from './commun.js?v=1.18.0';
import { iaDisponible } from '../ia.js?v=1.18.0';

export const weekIds = () => new Set([...S.plan.filter(Boolean), ...(S.dess || []).map((x) => x.id)]);
export const frozen = () => !!(S.saved && S.planRows.length);
function ingHome(text) { // ce que l'app sait déjà : base, eau, inventaire
  const k = ingKey(text), full = norm(text).replace(/[’']/g, ' ');
  if (neverBuy(k)) return 'Jamais acheté';
  if (isStaple(k) || isStaple(full.split(/,(?!\d)/)[0])) return 'Base';
  const m = (S.inv.items || []).length ? invMatch(k) : null;
  return m && m.essential ? 'Essentiel' : ''; // seuls les essentiels (longue conservation) sont précochés
}
let haveTimer = null;
export function toggleHave(key, on) {
  if (!frozen()) { toast('Approuve d\'abord la semaine pour cocher ce que tu as déjà.'); render(); return; }
  if (on === undefined) on = !S.have.has(key);
  on ? S.have.add(key) : S.have.delete(key);
  document.querySelectorAll(`[data-have="${CSS.escape(key)}"]`).forEach((n) => { if (n.type === 'checkbox') n.checked = on; n.closest('.hv')?.classList.toggle('on', on); });
  paintHaveCount();
  if (S.view === 'provigo') render();
  clearTimeout(haveTimer);
  haveTimer = setTimeout(() => saveHave().catch((e) => toast('Le classeur n\'a pas enregistré tes cochés : ' + errText(e))), 1200);
}
function paintHaveCount() {
  const n = $('#havecount'); if (!n || !S.preview || !S.preview.data) return;
  const k = S.preview.data.ing.filter((x) => S.have.has(ingKey(x.text))).length;
  n.textContent = k ? `${k} déjà au frigo ou au congélateur` : '';
}

export function openPreview(id, day) {
  S.preview = { id, day: day === undefined || day === '' || day === null ? null : +day, data: null, err: null, edit: S.view === 'tri' };
  try { S.preview.data = getRecipe(id); } catch (e) { S.preview.err = errText(e); }
  renderSheet();
}
export function closePreview() { S.preview = null; renderSheet(); }

export function renderSheet() {
  let n = $('#sheet');
  if (!S.preview) { n?.remove(); document.body.style.overflow = ($('#dsheet') || $('#picksheet') || $('#addsheet') || $('#comptesheet')) ? 'hidden' : ''; return; }
  const neuf = !n;
  if (!n) { n = el('div', { id: 'sheet', class: 'sheet', role: 'dialog', 'aria-modal': 'true' }); document.body.append(n); }
  document.body.style.overflow = 'hidden';
  const p = S.preview, r = S.byId[p.id] || { name: 'Recette' }, d = p.data;
  const body = [];
  if (p.err) body.push(noticeWarn(p.err));
  else if (!d.ing.length && !d.steps.length) body.push(noticeWarn('Cette fiche n\'a pas encore d\'ingrédients ni d\'étapes dans ton classeur.'));
  else {
    let g = null;
    const inWeek = weekIds().has(p.id);
    const tete = (x, tag) => (x.group && x.group !== g ? (g = x.group, el(tag, { class: 'grp' }, x.group)) : null);
    if (inWeek && frozen()) {
      body.push(el('h4', {}, 'Ingrédients'), el('p', { class: 'hint', style: 'margin:0 0 8px' }, 'Coche ce que tu as déjà au frigo ou au congélateur : ça sort de la liste Provigo. ', el('b', { id: 'havecount' })),
        el('div', { class: 'hvlist' }, d.ing.map((x) => {
          const k = ingKey(x.text), auto = ingHome(x.text), on = S.have.has(k);
          return [tete(x, 'div'), auto
            ? el('div', { class: 'hv auto' }, el('span', { class: 'hvbox', 'aria-hidden': 'true' }, ico('check')), el('span', {}, x.text, el('small', {}, `${auto} : jamais sur la liste`)))
            : el('label', { class: `hv ${on ? 'on' : ''}` }, el('input', { type: 'checkbox', 'data-have': k, checked: on }), el('span', {}, x.text))];
        })));
    } else {
      body.push(el('h4', {}, 'Ingrédients'), inWeek && el('p', { class: 'hint', style: 'margin:0 0 8px' }, 'Approuve la semaine pour cocher ce que tu as déjà à la maison.'),
        el('ul', {}, d.ing.map((x) => [tete(x, 'li'), el('li', {}, x.text)])));
    }
    body.push(el('h4', {}, 'Étapes'), el('ol', {}, d.steps.map((s) => el('li', {}, s))),
      d.sous.length && el('h4', {}, 'Tâches sous-chef'), d.sous.length && el('ul', {}, d.sous.map((s) => el('li', {}, s))));
    const histo = String(r.row?.Adaptations || '').split('\n').map((l) => l.trim()).filter(Boolean);
    if (histo.length) body.push(el('details', { class: 'histo' }, el('summary', {}, `Adaptations de la famille (${histo.length})`), el('ul', {}, histo.map((l) => el('li', {}, l)))));
  }
  const lien = /^https:\/\/\S+$/.test(r.lien || '') ? r.lien : '';
  vider(n).append(
    el('div', { class: 'sheet-bar' }, el('div', { class: 'wrap' }, el('span', { class: 'label' }, `${p.day !== null ? DAYS[p.day] + ' · ' : ''}Aperçu de la recette`),
      el('button', { class: 'btn icon', 'data-partager': p.id, 'aria-label': `Partager la recette ${r.name} en PDF`, title: 'Partager en PDF', 'data-new': '1.17.0-partage-pdf' }, ico('share')),
      el('button', { class: 'btn icon', 'data-close': '', 'aria-label': 'Fermer l\'aperçu' }, ico('left')))),
    el('div', { class: 'wrap' }, el('h2', {}, r.name), r.id && [starRow(r), recipeMeta(r), chips(r), tagEditor(r)], body,
      el('div', { class: 'sheet-acts' },
        p.day !== null && el('button', { class: 'btn', 'data-sheetswap': p.day }, ico('shuffle'), 'Échanger ce souper'),
        r.complete && el('button', { class: 'btn', 'data-cook': p.id }, ico('flame'), 'Au poêle'),
        S.ctx && iaDisponible() && d && (d.ing.length || d.steps.length) && el('button', { class: 'btn', 'data-adapt': p.id, 'data-new': '1.8.0-adapter' }, ico('chef'), 'Adapter avec Gemini'),
        S.ctx && r.id && el('button', { class: 'btn', 'data-textedit': p.id, 'data-new': '1.14.0-texte' }, ico('file'), 'Modifier le texte'),
        S.ctx && r.adaptee && el('button', { class: 'btn', 'data-adaptrevert': p.id }, ico('reset'), 'Revenir à l\'originale'),
        lien && el('a', { class: 'btn', href: lien, target: '_blank', rel: 'noopener noreferrer' }, 'Recette d\'origine'),
        S.ctx && el('a', { class: 'btn', href: lienClasseur(S.ctx.classeurId), target: '_blank', rel: 'noopener' }, 'Ouvrir le classeur'),
        el('button', { class: 'btn primary', 'data-close': '' }, 'Retour à la semaine'))));
  paintHaveCount();
  if (neuf) n.querySelector('[data-close]')?.focus();
}
