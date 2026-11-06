// Feuille Compte : connexion, classeur, import (R-02). Même gabarit que les feuilles de Gordon Rams.ai.
import { S, $, toast } from '../etat.js?v=1.2.0';
import { el, ico, vider } from '../el.js?v=1.2.0';
import { lienClasseur, lienDossier } from '../store.js?v=1.2.0';
import { valider, importer } from '../import.js?v=1.2.0';
import { CONFIG } from '../config.js?v=1.2.0';

export function openCompte(surImporter) {
  if ($('#comptesheet')) return;
  const n = el('div', { id: 'comptesheet', class: 'sheet', role: 'dialog', 'aria-modal': 'true' });
  document.body.append(n); document.body.style.overflow = 'hidden';
  const c = S.ctx;
  const res = el('div', { class: 'import-res', id: 'import-res', 'aria-live': 'polite' });
  vider(n).append(
    el('div', { class: 'sheet-bar' }, el('div', { class: 'wrap' }, el('span', { class: 'label' }, 'Compte et import'),
      el('button', { class: 'btn icon', 'data-compteclose': '', 'aria-label': 'Fermer' }, ico('left')))),
    el('div', { class: 'wrap' }, el('h2', {}, 'Ton classeur'),
      el('div', { class: 'compte' },
        c.courriel && el('div', { class: 'mrow' }, el('span', {}, 'Connecté', el('small', {}, c.courriel))),
        el('div', { class: 'mrow' }, el('span', {}, 'Bibliothèque', el('small', {}, `${S.book.length} recettes · ${S.inv.items?.length || 0} articles`)),
          el('a', { class: 'btn', href: lienClasseur(c.classeurId), target: '_blank', rel: 'noopener' }, 'Classeur'),
          c.dossier && el('a', { class: 'btn', href: lienDossier(c.dossier.id), target: '_blank', rel: 'noopener' }, 'Dossier')),
        c.messageMigration && el('p', { class: 'hint' }, c.messageMigration)),
      el('h4', { id: 'importer' }, 'Importer des recettes'),
      el('p', { style: 'color:var(--muted);max-width:60ch;margin:0' }, 'Choisis un fichier d\'import 3eBras (.json). Tout est vérifié avant d\'écrire, et ré-importer le même fichier ne crée pas de doublons.'),
      el('div', { class: 'pick addf' }, el('label', { class: 'btn primary pickbtn' }, ico('file'), 'Choisir le fichier',
        el('input', { id: 'fichier-import', class: 'pickin', type: 'file', accept: '.json,application/json', 'aria-label': 'Choisir le fichier d\'import' }))),
      res,
      el('div', { class: 'sheet-acts' },
        el('button', { class: 'btn', id: 'deconnexion' }, 'Se déconnecter'),
        el('span', { class: 'label' }, `3eBras v${CONFIG.version}`))));
  if (surImporter) $('#importer')?.scrollIntoView();
}
export function closeCompte() { $('#comptesheet')?.remove(); if (!S.preview && !$('#picksheet') && !$('#dsheet')) document.body.style.overflow = ''; }

export async function lireImport(fichier, apres) {
  const res = $('#import-res'); if (!res || !fichier) return;
  vider(res);
  if (fichier.size > 20 * 1024 * 1024) { res.append(el('div', { class: 'notice warn' }, ico('alert'), el('p', {}, 'Ce fichier est trop gros (plus de 20 Mo).'))); return; }
  const v = valider(await fichier.text());
  if (!v.ok) {
    res.append(el('div', { class: 'notice warn' }, ico('alert'), el('p', {}, 'Ce fichier ne passe pas la vérification. Rien n\'a été écrit.')),
      el('ul', { class: 'erreurs' }, v.erreurs.slice(0, 20).map((e) => el('li', {}, e))));
    return;
  }
  const d = v.donnees;
  const go = el('button', { class: 'btn primary', id: 'lancer-import' }, ico('save'), 'Importer dans mon classeur');
  res.append(el('p', {}, 'Le fichier est valide. Il contient :'),
    el('ul', {}, el('li', {}, `${d.recettes.length} recettes`), el('li', {}, `${d.plans.length} lignes de plans de semaine`),
      el('li', {}, `${d.inventaire.length} articles d'inventaire`), el('li', {}, `${d.bilans.length} bilans`)), go);
  go.addEventListener('click', async () => {
    go.disabled = true;
    const st = el('p', { class: 'label' }, 'Écriture dans le classeur…'); vider(res).append(st);
    try {
      const r = await importer(S.ctx.drive, S.ctx.classeurId, d, (t) => { st.textContent = `Écriture dans le classeur… ${t}`; });
      const c = r.creees, k = r.deja;
      vider(res).append(el('h4', {}, 'Import terminé.'), el('ul', {},
        el('li', {}, `Créés : ${c.recettes} recettes, ${c.plans} lignes de plan, ${c.inventaire} articles, ${c.bilans} bilans.`),
        el('li', {}, `Déjà présents (ignorés) : ${k.recettes} recettes, ${k.plans} lignes de plan, ${k.inventaire} articles.`),
        r.kits.length && el('li', {}, `${r.kits.length} recette${r.kits.length > 1 ? 's' : ''} de kit repas refusée${r.kits.length > 1 ? 's' : ''} (R-15) : ${r.kits.join(', ')}`),
        el('li', {}, `${r.aVerifier.length} recettes marquées « à vérifier ».`)));
      toast('Import terminé'); await apres();
    } catch (e) {
      vider(res).append(el('div', { class: 'notice warn' }, ico('alert'), el('p', {}, `Oups, ça a brûlé un peu : ${e.message}. Relance l'import : rien ne sera dédoublé.`)));
    }
  });
}
