// Aperçu d'une recette et « déjà à la maison ». Repris de Gordon Rams.ai.
import { S, $, DAYS, norm, toast, errText, render } from '../etat.js?v=1.3.0';
import { el, ico, vider } from '../el.js?v=1.3.0';
import { getRecipe, saveHave } from '../donnees.js?v=1.3.0';
import { ingKey, invMatch, isStaple, neverBuy } from '../cuisine.js?v=1.3.0';
import { lienClasseur } from '../store.js?v=1.3.0';
import { starRow, recipeMeta, chips, tagEditor, noticeWarn } from './commun.js?v=1.3.0';

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
  }
  const lien = /^https:\/\/\S+$/.test(r.lien || '') ? r.lien : '';
  vider(n).append(
    el('div', { class: 'sheet-bar' }, el('div', { class: 'wrap' }, el('span', { class: 'label' }, `${p.day !== null ? DAYS[p.day] + ' · ' : ''}Aperçu de la recette`),
      el('button', { class: 'btn icon', 'data-partager': p.id, 'aria-label': `Partager la recette ${r.name}`, title: 'Partager', 'data-new': '1.2.2-partager' }, ico('share')),
      el('button', { class: 'btn icon', 'data-close': '', 'aria-label': 'Fermer l\'aperçu' }, ico('left')))),
    el('div', { class: 'wrap' }, el('h2', {}, r.name), r.id && [starRow(r), recipeMeta(r), chips(r), tagEditor(r)], body,
      el('div', { class: 'sheet-acts' },
        p.day !== null && el('button', { class: 'btn', 'data-sheetswap': p.day }, ico('shuffle'), 'Échanger ce souper'),
        r.complete && el('button', { class: 'btn', 'data-cook': p.id }, ico('flame'), 'Au poêle'),
        lien && el('a', { class: 'btn', href: lien, target: '_blank', rel: 'noopener noreferrer' }, 'Recette d\'origine'),
        S.ctx && el('a', { class: 'btn', href: lienClasseur(S.ctx.classeurId), target: '_blank', rel: 'noopener' }, 'Ouvrir le classeur'),
        el('button', { class: 'btn primary', 'data-close': '' }, 'Retour à la semaine'))));
  paintHaveCount();
  if (neuf) n.querySelector('[data-close]')?.focus();
}

// Partager une recette (texte lisible partout : texto, courriel, Messenger…). Rien ne passe par un serveur à nous.
export function texteRecette(id) {
  const r = S.byId[id]; if (!r) return '';
  const d = getRecipe(id);
  const meta = [r.time && `${Math.round(r.time)} min`, r.portions && `${Math.round(r.portions)} portions`].filter(Boolean).join(' · ');
  const out = [r.name, meta, ''];
  if (d.ing.length) {
    out.push('INGRÉDIENTS'); let g = null;
    d.ing.forEach((x) => { if (x.group && x.group !== g) { g = x.group; out.push('', x.group); } out.push(`- ${x.text}`); });
    out.push('');
  }
  if (d.steps.length) { out.push('ÉTAPES'); d.steps.forEach((s, i) => out.push(`${i + 1}. ${s}`)); out.push(''); }
  if (/^https:\/\/\S+$/.test(r.lien || '')) out.push(`Source : ${r.lien}`);
  out.push('Partagé avec 3Bras · Besoin de Renfort Au Souper');
  return out.filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n').trim();
}
export async function partagerRecette(id) {
  const r = S.byId[id]; if (!r) return;
  const text = texteRecette(id);
  try {
    if (navigator.share) { await navigator.share({ title: r.name, text }); return; }
    await navigator.clipboard.writeText(text);
    toast('Recette copiée : colle-la dans un texto ou un courriel.');
  } catch (e) {
    if (e && e.name === 'AbortError') return; // partage annulé
    try { await navigator.clipboard.writeText(text); toast('Recette copiée : colle-la dans un texto ou un courriel.'); } catch (_) { toast('Le partage n\'est pas disponible sur cet appareil.'); }
  }
}
