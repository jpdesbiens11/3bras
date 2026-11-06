// Feuille Compte : connexion, classeur, import (R-02). Même gabarit que les feuilles de Gordon Rams.ai.
import { S, $, toast } from '../etat.js?v=1.6.1';
import { el, ico, vider } from '../el.js?v=1.6.1';
import { lienClasseur, lienDossier } from '../store.js?v=1.6.1';
import { valider, importer } from '../import.js?v=1.6.1';
import { CONFIG } from '../config.js?v=1.6.1';

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
      el('h4', { id: 'kits', 'data-new': '1.3.0-kits' }, 'Kits de départ'),
      el('p', { style: 'color:var(--muted);max-width:60ch;margin:0 0 10px' }, S.book.length
        ? 'Ajoute un ou plusieurs kits de 10 recettes classiques à ton livre. Ce qui est déjà là n\'est pas dédoublé.'
        : 'Ton livre est vide. Choisis un ou plusieurs kits de 10 recettes classiques pour démarrer : tu les trieras ensuite dans le Livre.'),
      el('div', { class: 'tseg modes', id: 'kitchoix' }, KITS.map((k) => el('button', { class: 'btn', type: 'button', 'data-kit': k.id, 'aria-pressed': String(!S.book.length) }, k.nom))),
      el('p', { class: 'hint', id: 'kitdesc' }, KITS.map((k) => `${k.nom} : ${k.description}`).join(' · ')),
      el('div', { class: 'add-acts' }, el('button', { class: 'btn primary', id: 'chargerkits', type: 'button' }, ico('plus'), 'Ajouter les kits choisis')),
      el('div', { class: 'import-res', id: 'kit-res', 'aria-live': 'polite' }),
      el('h4', { id: 'importer' }, 'Importer des recettes'),
      el('p', { style: 'color:var(--muted);max-width:60ch;margin:0' }, 'Choisis un fichier d\'import 3Bras (.json). Tout est vérifié avant d\'écrire, et ré-importer le même fichier ne crée pas de doublons.'),
      el('div', { class: 'pick addf' }, el('label', { class: 'btn primary pickbtn' }, ico('file'), 'Choisir le fichier',
        el('input', { id: 'fichier-import', class: 'pickin', type: 'file', accept: '.json,application/json', 'aria-label': 'Choisir le fichier d\'import' }))),
      res,
      el('div', { class: 'sheet-acts' },
        el('button', { class: 'btn', id: 'deconnexion' }, 'Se déconnecter'),
        el('span', { class: 'label' }, `3Bras v${CONFIG.version}`))));
  if (surImporter) $('#kits')?.scrollIntoView();
}
// Les kits sont publiés avec l'app (dist/kits/), mêmes règles que tout fichier d'import.
export const KITS = [
  { id: 'quebecois', nom: 'Québécois', description: 'les classiques de chez nous' },
  { id: 'vege', nom: 'Végé', description: 'des soupers sans viande qui plaisent à tout le monde' },
  { id: 'asiatique', nom: 'Asiatique', description: 'les incontournables des sautés, currys et nouilles' }
];
export async function chargerKits(apres) {
  const choisis = [...document.querySelectorAll('[data-kit][aria-pressed="true"]')].map((b) => b.dataset.kit);
  const res = $('#kit-res'); if (!res) return;
  if (!choisis.length) { vider(res).append(el('p', { class: 'hint' }, 'Choisis au moins un kit.')); return; }
  const go = $('#chargerkits'); if (go) go.disabled = true;
  const st = el('p', { class: 'label' }, 'Lecture des kits…'); vider(res).append(st);
  try {
    let total = 0, deja = 0;
    for (const id of choisis) {
      const rep = await fetch(`kits/${id}.json?v=${CONFIG.version}`);
      if (!rep.ok) throw new Error(`kit ${id} introuvable`);
      const v = valider(await rep.text());
      if (!v.ok) throw new Error(`kit ${id} invalide : ${v.erreurs[0]}`);
      st.textContent = `Ajout du kit ${KITS.find((k) => k.id === id).nom}…`;
      const r = await importer(S.ctx.drive, S.ctx.classeurId, v.donnees);
      total += r.creees.recettes; deja += r.deja.recettes;
    }
    vider(res).append(el('p', {}, `${total} recettes ajoutées à ton livre${deja ? ` (${deja} déjà là)` : ''}. Elles sont « À trier » : passe-les dans 01 Livre, mode Trier.`));
    toast(`${total} recettes ajoutées`); await apres();
  } catch (e) {
    vider(res).append(el('div', { class: 'notice warn' }, ico('alert'), el('p', {}, `Oups : ${e.message}. Réessaie : rien ne sera dédoublé.`)));
  }
  if (go) go.disabled = false;
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
