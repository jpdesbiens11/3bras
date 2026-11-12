// « Stock de base » (D-G-039) : la personne coche ce qu'elle a à la maison ; seul ce qui est coché
// s'écrit dans l'onglet Inventaire du classeur. Rien n'est préchargé dans l'app.
import { S, $, ZONES, iso, toast } from '../etat.js?v=1.16.0';
import { el, ico, vider } from '../el.js?v=1.16.0';
import { importer } from '../import.js?v=1.16.0';
import { CONFIG } from '../config.js?v=1.16.0';
import { couvre, articlesDeRecettes, preparerStock, lignesInventaire, fichierStock } from '../stock.js?v=1.16.0';

let T = null; // { items, err }
export const stockOuvert = () => !!T;
export function closeStock() { T = null; $('#stocksheet')?.remove(); document.body.style.overflow = ($('#comptesheet') || $('#sheet')) ? 'hidden' : ''; }

export async function openStock() {
  T = { items: null, err: null }; paint();
  try {
    const rep = await fetch(`kits/stock-base.json?v=${CONFIG.version}`);
    if (!rep.ok) throw new Error('la liste des essentiels est introuvable');
    const base = (await rep.json()).articles || [];
    const existe = (nom) => (S.inv.items || []).some((i) => couvre(i.name, nom) || couvre(nom, i.name));
    if (T) T.items = preparerStock(base, articlesDeRecettes(S.book || []), existe);
  } catch (e) { if (T) T.err = e.message; }
  if (T) paint();
}

const nb = () => (T?.items || []).filter((a) => a.choisi).length;
const texteAjout = () => { const k = nb(); return k ? `Ajouter ${k} article${k > 1 ? 's' : ''} à l'inventaire` : 'Coche au moins un article'; };
export function cocherStock(i, on) { const a = T?.items?.[+i]; if (a && !a.deja) { a.choisi = on; const b = $('#stock-ajouter'); if (b) b.textContent = texteAjout(); } }
export function cocherTout(on) {
  (T?.items || []).forEach((a) => { if (!a.deja) a.choisi = on; });
  document.querySelectorAll('[data-stockpick]').forEach((c) => { const a = T.items[+c.dataset.stockpick]; c.checked = a.choisi; c.closest('.gen-item')?.classList.toggle('on', a.choisi); });
  const b = $('#stock-ajouter'); if (b) b.textContent = texteAjout();
}

const detail = (a) => [a.source === 'base' ? 'Essentiel courant' : null, a.recettes ? `dans ${a.recettes} recette${a.recettes > 1 ? 's' : ''} de ton livre` : null].filter(Boolean).join(' · ');
function paint() {
  let n = $('#stocksheet');
  if (!n) { n = el('div', { id: 'stocksheet', class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'stock-h' }); document.body.append(n); }
  document.body.style.overflow = 'hidden';
  const corps = [];
  if (T.err) corps.push(el('p', { class: 'hint err' }, `Oups : ${T.err}.`));
  else if (!T.items) corps.push(el('p', { class: 'label' }, 'Préparation de la liste…'));
  else {
    corps.push(el('div', { class: 'add-acts' },
      el('button', { class: 'btn', type: 'button', 'data-stocktout': '1' }, 'Tout cocher'),
      el('button', { class: 'btn', type: 'button', 'data-stocktout': '0' }, 'Tout décocher')));
    for (const z of ZONES) {
      const liste = T.items.map((a, i) => ({ a, i })).filter(({ a }) => a.Zone === z);
      if (!liste.length) continue;
      corps.push(el('section', { class: 'gen-etape' }, el('h3', {}, z),
        liste.map(({ a, i }) => el('div', { class: `gen-item${a.choisi ? ' on' : ''}` },
          el('label', {}, el('input', { type: 'checkbox', 'data-stockpick': i, checked: a.choisi, disabled: a.deja }),
            el('span', {}, el('b', {}, a.Nom), el('small', {}, a.deja ? 'Déjà dans ton inventaire' : detail(a))))))));
    }
    corps.push(el('div', { class: 'add-acts' }, el('button', { class: 'btn primary', id: 'stock-ajouter', type: 'button' }, ico('save'), texteAjout())),
      el('div', { id: 'stock-fin', 'aria-live': 'polite' }));
  }
  vider(n).append(
    el('div', { class: 'sheet-bar' }, el('div', { class: 'wrap' }, el('span', { class: 'label' }, 'Stock de base'),
      el('button', { class: 'btn icon', 'data-stockclose': '', 'aria-label': 'Fermer' }, ico('left')))),
    el('div', { class: 'wrap gen' }, el('h2', { id: 'stock-h' }, 'Ton stock de base'),
      el('p', { class: 'gen-intro' }, 'Coche ce que tu as à la maison. Les essentiels courants sont cochés ; les ingrédients de tes recettes ne le sont pas : coche ceux que tu as. Seul ce qui est coché s\'écrit dans l\'onglet Inventaire de ton classeur.'),
      ...corps));
}

export async function ajouterStock(apres) {
  const rows = lignesInventaire((T?.items || []).filter((a) => a.choisi && !a.deja)), fin = $('#stock-fin'), b = $('#stock-ajouter');
  if (!rows.length) { toast('Coche au moins un article.'); return; }
  const v = fichierStock(rows, iso(new Date()));
  if (!v.ok) { vider(fin).append(el('p', { class: 'hint err' }, `Ces articles ne passent pas la vérification : ${v.erreurs[0]}`)); return; }
  if (b) b.disabled = true; vider(fin).append(el('p', { class: 'label' }, 'Écriture dans ton classeur…'));
  try {
    const r = await importer(S.ctx.drive, S.ctx.classeurId, v.donnees);
    await apres();
    const k = r.creees.inventaire;
    vider(fin).append(el('p', {}, `${k} article${k > 1 ? 's' : ''} ajouté${k > 1 ? 's' : ''}${r.deja.inventaire ? ` (${r.deja.inventaire} déjà là)` : ''}. Ton inventaire compte maintenant ${(S.inv.items || []).length} articles.`),
      el('button', { class: 'btn', id: 'stock-voir', type: 'button' }, ico('right'), 'Voir le garde-manger'));
    toast(`${k} article${k > 1 ? 's' : ''} ajouté${k > 1 ? 's' : ''} à l'inventaire`);
  } catch (e) { vider(fin).append(el('p', { class: 'hint err' }, `Oups : ${e.message}. Réessaie : rien ne sera dédoublé.`)); }
  if (b) b.disabled = false;
}
