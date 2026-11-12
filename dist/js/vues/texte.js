// D-G-044 : modifier à la main le texte d'une fiche (ingrédients, étapes, sous-chef). L'originale est gardée
// comme avec « Adapter » (colonne Originale, une seule fois), et « Revenir à l'originale » la remet.
import { S, $, iso, toast, errText } from '../etat.js?v=1.18.0';
import { el, ico, vider } from '../el.js?v=1.18.0';
import { majRecette } from '../donnees.js?v=1.18.0';
import { valeursTexte } from '../adaptation.js?v=1.18.0';

let X = null; // { id }
export const texteOuvert = () => !!X;
export function closeTexte() { X = null; $('#textsheet')?.remove(); document.body.style.overflow = $('#sheet') ? 'hidden' : ''; }
const lignes = (t) => String(t || '').split('\n').map((x) => x.trim()).filter(Boolean);
function statut(msg, err) { const s = $('#tx-status'); if (s) { s.textContent = msg || ''; s.classList.toggle('err', !!err); } }

export function openTexte(id) {
  const r = S.byId[id]; if (!r) return;
  X = { id };
  let n = $('#textsheet');
  if (!n) { n = el('div', { id: 'textsheet', class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'tx-h' }); document.body.append(n); }
  document.body.style.overflow = 'hidden';
  const zone = (id2, lbl, val, aide) => el('div', {}, el('label', { for: id2 }, lbl), el('textarea', { id: id2, value: val, class: 'tx-zone' }), aide && el('p', { class: 'hint' }, aide));
  vider(n).append(
    el('div', { class: 'sheet-bar' }, el('div', { class: 'wrap' }, el('span', { class: 'label' }, 'Modifier le texte'),
      el('button', { class: 'btn icon', 'data-txclose': '', 'aria-label': 'Fermer' }, ico('left')))),
    el('div', { class: 'wrap' }, el('h2', { id: 'tx-h' }, r.name),
      el('p', { style: 'color:var(--muted);max-width:60ch;margin:0' }, 'Corrige la fiche à ta façon. La recette originale reste gardée dans ton classeur, et « Revenir à l\'originale » la remet.'),
      el('div', { class: 'addf' },
        zone('tx-ing', 'Ingrédients (un par ligne)', r.ingText, 'Une ligne « ## Sauce » ouvre un groupe d\'ingrédients.'),
        zone('tx-eta', 'Étapes (une par ligne)', r.stepsText, 'Écris les durées en minutes (« Cuire 20 minutes ») : Au poêle en fait des minuteurs.'),
        zone('tx-sous', 'Tâches sous-chef (une par ligne)', r.sous)),
      el('div', { class: 'add-acts' },
        el('button', { class: 'btn primary', id: 'tx-save', type: 'button' }, ico('save'), 'Enregistrer'),
        el('button', { class: 'btn', type: 'button', 'data-txclose': '' }, 'Annuler')),
      el('div', { class: 'add-status', id: 'tx-status', 'aria-live': 'polite' })));
  $('#tx-ing')?.focus();
}

export async function saveTexte(apres) {
  if (!X) return;
  const r = S.byId[X.id]; if (!r) return;
  const t = { ing: lignes($('#tx-ing')?.value), etapes: lignes($('#tx-eta')?.value), sous: lignes($('#tx-sous')?.value) };
  if (!t.ing.length && !t.etapes.length) { statut('Écris au moins un ingrédient ou une étape.', true); return; }
  const b = $('#tx-save'); if (b) b.disabled = true; statut('Enregistrement dans ton classeur…');
  try {
    await majRecette(r, valeursTexte(r.row, t, iso(new Date())));
    const id = X.id; closeTexte(); apres(id);
    toast('Fiche enregistrée. L\'originale reste gardée dans ton classeur.');
  } catch (e) { if (b) b.disabled = false; statut(errText(e), true); }
}
