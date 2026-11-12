// « Adapter avec Gemini » (D-G-033) : la famille retouche une recette (« moins sucré », « pour 6 »,
// « quantités dans les étapes »), comme dans les commentaires d'un site de recettes, mais dans l'app.
import { S, $, norm, iso, toast, errText } from '../etat.js?v=1.12.0';
import { el, ico, vider } from '../el.js?v=1.12.0';
import { getRecipe, majRecette } from '../donnees.js?v=1.12.0';
import { parseTexte, ficheTexte } from '../lecture.js?v=1.12.0';
import { convertirAvecGemini, erreurIA } from '../ia.js?v=1.12.0';
import { RACCOURCIS, RACCOURCIS_CUISSON, consigneAdaptation, valeursAdaptees, valeursOriginales, valeursActuelles } from '../adaptation.js?v=1.12.0';

let A = null; // { id, demande, busy, result, cuisson, etape }
const raccourcis = () => (A?.cuisson ? [...RACCOURCIS_CUISSON, ...RACCOURCIS] : RACCOURCIS);
const LISTE = 'position:static;padding:0;overflow:visible;background:transparent';

export const adaptOuvert = () => !!A;
// cuisson : ouvert depuis Au poêle (D-G-036) ; etape : l'étape où la famille est rendue.
export function openAdapt(id, { cuisson = false, etape = null } = {}) { A = { id, demande: '', busy: false, result: null, cuisson, etape }; paint(); $('#adapt-q')?.focus(); }
export function closeAdapt() { A = null; $('#adaptsheet')?.remove(); document.body.style.overflow = $('#sheet') ? 'hidden' : ''; }
function statut(msg, err) { const s = $('#adapt-status'); if (s) { s.textContent = msg || ''; s.classList.toggle('err', !!err); } }

export function ajouterRaccourci(i) {
  const t = $('#adapt-q'), r = raccourcis()[+i]; if (!t || !r) return;
  t.value = t.value.trim() ? `${t.value.trim()} ${r[1]}` : r[1]; t.focus();
  try { t.setSelectionRange(t.value.length, t.value.length); } catch (_) { /* champ sans curseur */ }
}

function paint() {
  let n = $('#adaptsheet');
  if (!n) { n = el('div', { id: 'adaptsheet', class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'adapt-h' }); document.body.append(n); }
  document.body.style.overflow = 'hidden';
  const r = S.byId[A.id] || { name: 'Recette' };
  vider(n).append(
    el('div', { class: 'sheet-bar' }, el('div', { class: 'wrap' }, el('span', { class: 'label' }, 'Adapter la recette'),
      el('button', { class: 'btn icon', 'data-adaptclose': '', 'aria-label': 'Fermer' }, ico('left')))),
    el('div', { class: 'wrap' }, el('h2', { id: 'adapt-h' }, r.name),
      el('p', { style: 'color:var(--muted);max-width:60ch;margin:0' }, A.cuisson
        ? `Tu es à l'étape ${A.etape || 1}. Dis à Gemini ce qui change (un ingrédient qui manque, moins de temps…) : tu choisis ensuite de cuisiner cette version ce soir seulement, ou de remplacer la recette.`
        : 'Dis à Gemini ce que vous changez, comme dans un commentaire de recette. Tu vois le résultat avant de l\'enregistrer, et la recette originale reste gardée dans ton classeur.'),
      el('form', { class: 'addf', id: 'adaptform' },
        el('div', {}, el('label', { for: 'adapt-q' }, 'Ce que tu veux changer'),
          el('textarea', { id: 'adapt-q', value: A.demande, placeholder: 'Ex. moins de sucre, du bacon dans la sauce, pour 6 portions…' })),
        el('div', { class: 'raccourcis', role: 'group', 'aria-label': 'Raccourcis' }, raccourcis().map(([l], i) => el('button', { type: 'button', class: 'btn', 'data-adaptchip': String(i) }, l))),
        el('div', { class: 'add-acts' }, el('button', { class: 'btn primary', id: 'adapt-go', type: 'submit', disabled: A.busy }, ico('chef'), A.busy ? 'Gemini adapte…' : 'Adapter avec Gemini')),
        el('div', { class: 'add-status', id: 'adapt-status', 'aria-live': 'polite' })),
      el('div', { id: 'adapt-prev' }, A.result && apercu())));
}

function apercu() {
  const res = A.result, d = getRecipe(A.id);
  const avant = new Set([...d.ing.map((x) => norm(x.text)), ...d.steps.map((s) => norm(s))]);
  const ligne = (t) => el('li', { class: avant.has(norm(t)) ? null : 'neuf' }, t);
  const meta = [res.portions && `${res.portions} portions`, res.temps && `${res.temps} min`].filter(Boolean);
  return el('div', { class: 'frame adapt-res' },
    res.changements.length && [el('h4', {}, 'Ce qui change'), el('ul', { class: 'chg' }, res.changements.map((c) => el('li', {}, c)))],
    meta.length && el('div', { class: 'meta' }, meta.map((m) => el('span', {}, m))),
    el('div', { class: 'sheet', style: LISTE },
      el('h4', {}, 'Ingrédients'), el('ul', {}, res.ingredients.map((g) => [g.groupe && el('li', { class: 'grp' }, g.groupe), g.items.map(ligne)])),
      el('h4', {}, 'Étapes'), el('ol', {}, res.etapes.map(ligne)),
      res.a_verifier && el('p', { class: 'hint' }, `À vérifier : ${res.a_verifier}`)),
    el('p', { class: 'hint' }, 'Les lignes marquées d\'un trait sont nouvelles ou changées.'),
    el('p', { class: 'hint' }, '« Ce soir » : on cuisine cette version, rien ne change dans le livre. « Remplacer » : elle devient la version de famille, l\'originale est gardée.'),
    el('div', { class: 'add-acts' },
      el('button', { class: `btn${A.cuisson ? ' primary' : ''}`, id: 'adapt-soir', type: 'button' }, ico('flame'), 'Cuisiner cette version ce soir'),
      el('button', { class: `btn${A.cuisson ? '' : ' primary'}`, id: 'adapt-save', type: 'button' }, ico('save'), 'Remplacer la recette'),
      el('button', { class: 'btn', type: 'button', 'data-adaptclose': '' }, 'Annuler')));
}

export async function adapter() {
  if (!A || A.busy) return;
  const demande = ($('#adapt-q')?.value || '').trim();
  if (!demande) { statut('Écris ce que tu veux changer, ou touche un raccourci.', true); return; }
  const r = S.byId[A.id]; if (!r) return;
  Object.assign(A, { demande, busy: true, result: null }); paint(); statut('Gemini adapte la recette…');
  try {
    const base = A.cuisson && S.cook.id === A.id && S.cook.data ? S.cook.data : getRecipe(A.id); // au poêle : la version en cours
    const sortie = await convertirAvecGemini(consigneAdaptation(ficheTexte(r, base), demande, A.cuisson ? A.etape : null), [], '', { rapide: true });
    const res = parseTexte(String(sortie || '').replace(/```\w*\n?/g, ''), r.type || 'Souper');
    if (!res.ingredients.length || !res.etapes.length) throw { local: 'Gemini n\'a pas renvoyé une recette complète. Reformule ta demande et réessaie.' };
    if (!A) return;
    Object.assign(A, { busy: false, result: res }); paint(); statut('Voici la version adaptée. Vérifie-la, puis remplace la recette.');
  } catch (e) {
    if (!A) return;
    A.busy = false; paint(); statut(e && e.local ? e.local : erreurIA(e), true);
  }
}

export async function saveAdapt(apres) {
  if (!A || !A.result) return;
  const r = S.byId[A.id], btn = $('#adapt-save'); if (btn) btn.disabled = true; statut('Enregistrement dans ton classeur…');
  try {
    await majRecette(r, valeursAdaptees(r.row, A.result, A.demande, iso(new Date())));
    const { id, cuisson } = A; closeAdapt(); apres(id, cuisson);
    toast('Recette adaptée. L\'originale reste gardée dans ton classeur.');
  } catch (e) { if (btn) btn.disabled = false; statut(errText(e), true); }
}

// D-G-036 : cuisiner la version adaptée ce soir, sans rien écrire dans le livre.
export function cuisinerCeSoir(apres) {
  if (!A || !A.result) return;
  const { id, result, demande } = A; closeAdapt(); apres(id, result, demande);
  toast('Version de ce soir : ton livre n\'a pas changé.');
}

export async function revenirOriginale(id, apres) {
  const r = S.byId[id], v = r && valeursOriginales(r.row, iso(new Date()));
  if (!v) { toast('Aucune recette originale n\'est gardée pour celle-ci.'); return; }
  const avant = valeursActuelles(r.row);
  try {
    await majRecette(r, v); apres(id);
    toast('Recette originale remise.', { label: 'Annuler', fn: () => majRecette(r, avant).then(() => apres(id)).catch((e) => toast(errText(e))) });
  } catch (e) { toast(errText(e)); }
}
