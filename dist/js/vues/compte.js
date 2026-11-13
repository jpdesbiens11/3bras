// Feuille Compte : connexion, classeur, import (R-02). Même gabarit que les feuilles de Gordon Rams.ai.
import { S, $, toast } from '../etat.js?v=1.23.1';
import { el, ico, vider } from '../el.js?v=1.23.1';
import { lienClasseur, lienDossier, reinitialiser, texteReparation } from '../store.js?v=1.23.1';
import { valider, importer } from '../import.js?v=1.23.1';
import { CONFIG } from '../config.js?v=1.23.1';
import { iaDisponible } from '../ia.js?v=1.23.1';

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
        el('div', { class: 'mrow' }, el('span', {}, 'Bibliothèque', el('small', { id: 'compte-biblio' }, texteBiblio())),
          el('a', { class: 'btn', href: lienClasseur(c.classeurId), target: '_blank', rel: 'noopener' }, 'Classeur'),
          c.dossier && el('a', { class: 'btn', href: lienDossier(c.dossier.id), target: '_blank', rel: 'noopener' }, 'Dossier')),
        c.messageMigration && el('p', { class: 'hint' }, c.messageMigration),
        el('div', { class: 'mrow' }, el('span', {}, 'Visite guidée', el('small', {}, 'Les fonctions de l\'app, dans l\'ordre où on s\'en sert.')),
          el('button', { class: 'btn', id: 'revoirvisite', type: 'button', 'data-new': '1.16.0-visite' }, ico('play'), 'Revoir la visite')),
        el('div', { class: 'mrow' }, el('span', {}, 'Mise en place guidée', el('small', {}, 'Pas à pas, des kits à ta première liste d\'épicerie.')),
          el('button', { class: 'btn', id: 'guidebtn', type: 'button', 'data-new': '1.20.0-guide' }, ico('chef'), 'Lancer le guide'))),
      el('h4', { id: 'kits', 'data-new': '1.3.0-kits' }, 'Kits de départ'),
      el('p', { style: 'color:var(--muted);max-width:60ch;margin:0 0 10px' }, S.book.length
        ? 'Touche un ou plusieurs kits de 10 recettes (un crochet apparaît), puis ajoute-les. Ce qui est déjà là n\'est pas dédoublé.'
        : 'Ton livre est vide. Touche un ou plusieurs kits de 10 recettes (un crochet apparaît), puis ajoute-les : tu les trieras ensuite dans le Livre.'),
      el('div', { class: 'kits', id: 'kitchoix', role: 'group', 'aria-label': 'Kits de départ' }, KITS.map((k) => el('button', { class: 'btn kit', type: 'button', 'data-kit': k.id, 'aria-pressed': 'false' }, el('b', {}, k.nom), el('small', {}, k.description)))),
      el('div', { class: 'add-acts' }, el('button', { class: 'btn primary', id: 'chargerkits', type: 'button', disabled: true }, ico('plus'), 'Choisis un ou plusieurs kits')),
      el('div', { class: 'import-res', id: 'kit-res', 'aria-live': 'polite' }),
      el('h4', { id: 'generer', 'data-new': '1.9.0-generateur' }, 'Créer des recettes'),
      el('p', { style: 'color:var(--muted);max-width:60ch;margin:0 0 10px' }, iaDisponible()
        ? 'Par cuisine ou par mots-clés. Avec Claude, l\'app écrit la consigne et tu colles sa réponse ; avec Gemini, tout se fait ici, automatiquement. Tu choisis ensuite ce qui entre dans ton livre.'
        : 'Par cuisine ou par mots-clés : l\'app écrit la consigne, Claude (Sonnet 5.5) écrit les fiches, tu colles sa réponse et tu choisis ce qui entre dans ton livre.'),
      el('div', { class: 'add-acts gen-choix' }, el('button', { class: 'btn', id: 'ouvrirgen', type: 'button' }, ico('chef'), 'Créer des recettes avec Claude'),
        iaDisponible() && el('button', { class: 'btn primary', id: 'ouvrirgengemini', type: 'button', 'data-new': '1.22.0-gemini-lot' }, ico('chef'), 'Créer des recettes avec Gemini')),
      el('h4', { id: 'stock', 'data-new': '1.11.0-stock' }, 'Stock de base'),
      el('p', { style: 'color:var(--muted);max-width:60ch;margin:0 0 10px' }, 'Coche ce que tu as à la maison, parmi les essentiels courants et les ingrédients de garde-manger de tes recettes. Ça s\'écrit dans l\'onglet Inventaire de ton classeur.'),
      el('div', { class: 'add-acts' }, el('button', { class: 'btn', id: 'ouvrirstock', type: 'button' }, ico('check'), 'Choisir mon stock de base')),
      el('h4', { id: 'importer' }, 'Importer des recettes'),
      el('p', { style: 'color:var(--muted);max-width:60ch;margin:0' }, 'Choisis un fichier d\'import SuperChef.ai (.json). Tout est vérifié avant d\'écrire, et ré-importer le même fichier ne crée pas de doublons.'),
      el('div', { class: 'pick addf' }, el('label', { class: 'btn primary pickbtn' }, ico('file'), 'Choisir le fichier',
        el('input', { id: 'fichier-import', class: 'pickin', type: 'file', accept: '.json,application/json', 'aria-label': 'Choisir le fichier d\'import' }))),
      res,
      el('h4', { id: 'neuf' }, 'Recommencer à neuf'),
      el('p', { style: 'color:var(--muted);max-width:60ch;margin:0 0 10px' }, 'Vide les recettes, l\'inventaire, les plans de semaine et les bilans de ton classeur, et remet les lignes de titres. Le classeur et le dossier restent les mêmes ; l\'app repart comme à ta première connexion. Aucune copie n\'est faite : seul l\'historique des versions de Google Sheets permet de revenir en arrière.'),
      el('div', { class: 'addf' }, el('div', {}, el('label', { for: 'neuf-mot' }, 'Écris RECOMMENCER pour confirmer'), el('input', { id: 'neuf-mot', autocomplete: 'off', autocapitalize: 'characters' }))),
      el('div', { class: 'add-acts' }, el('button', { class: 'btn danger', id: 'recommencer', type: 'button', disabled: true }, ico('alert'), 'Vider mon livre')),
      el('div', { class: 'import-res', id: 'neuf-res', 'aria-live': 'polite' }),
      el('div', { class: 'sheet-acts' },
        el('button', { class: 'btn', id: 'deconnexion' }, 'Se déconnecter'),
        el('span', { class: 'label' }, `SuperChef.ai v${CONFIG.version}`))));
  if (surImporter) $('#kits')?.scrollIntoView();
}
// Les kits sont publiés avec l'app (dist/kits/), mêmes règles que tout fichier d'import (D-G-025, D-G-038).
export const KITS = [
  { id: 'survie', nom: 'Survie : la base familiale', description: 'les soupers de semaine qui sauvent la soirée' },
  { id: 'quebecois', nom: 'Québécois', description: 'les classiques de chez nous' },
  { id: 'vege', nom: 'Végé', description: 'des soupers sans viande qui plaisent à tout le monde' },
  { id: 'mexicaine', nom: 'Mexicain', description: 'tacos du mardi, burritos et fajitas' },
  { id: 'asiatique', nom: 'Asiatique', description: 'sautés, currys et nouilles' },
  { id: 'moyen-orient', nom: 'Moyen-Orient', description: 'grillades, falafels et mezzés' },
  { id: 'indienne', nom: 'Inde', description: 'currys doux, dal et riz parfumé' },
  { id: 'russe', nom: 'Russe', description: 'les plats réconfortants d\'Europe de l\'Est' },
  { id: 'francaise', nom: 'Français', description: 'les grands plats de bistro et de famille' },
  { id: 'enfants', nom: 'Enfants', description: 'mets faciles et plats maison à congeler' }
];
const texteBiblio = () => `${S.book.length} recettes · ${S.inv.items?.length || 0} articles`;
// D-G-038 : la feuille Compte reste ouverte pendant un ajout ; son compteur suit le classeur relu.
export function majBiblio() { const n = $('#compte-biblio'); if (n) n.textContent = texteBiblio(); }
export function majKits() {
  const k = document.querySelectorAll('[data-kit][aria-pressed="true"]').length, b = $('#chargerkits'); if (!b) return;
  b.disabled = !k; vider(b).append(ico('plus'), k ? `Ajouter ${k} kit${k > 1 ? 's' : ''} (${k * 10} recettes)` : 'Choisis un ou plusieurs kits');
}
export async function chargerKits(apres) {
  const choisis = [...document.querySelectorAll('[data-kit][aria-pressed="true"]')].map((b) => b.dataset.kit);
  const res = $('#kit-res'); if (!res) return;
  if (!choisis.length) { vider(res).append(el('p', { class: 'hint' }, 'Choisis au moins un kit.')); return; }
  const go = $('#chargerkits'); if (go) go.disabled = true;
  const st = el('p', { class: 'label' }, 'Lecture des kits…'); vider(res).append(st);
  try {
    let total = 0, deja = 0, repare = ''; const attendus = [];
    for (const id of choisis) {
      const rep = await fetch(`kits/${id}.json?v=${CONFIG.version}`);
      if (!rep.ok) throw new Error(`kit ${id} introuvable`);
      const v = valider(await rep.text());
      if (!v.ok) throw new Error(`kit ${id} invalide : ${v.erreurs[0]}`);
      st.textContent = `Ajout du kit ${KITS.find((k) => k.id === id).nom}…`;
      const r = await importer(S.ctx.drive, S.ctx.classeurId, v.donnees);
      total += r.creees.recettes; deja += r.deja.recettes; attendus.push(...v.donnees.recettes.map((x) => x.id));
      repare = repare || texteReparation(r.reparation);
    }
    st.textContent = 'Relecture du classeur…';
    await apres();
    // D-G-038 : on relit le classeur et on vérifie que les recettes écrites y sont bien retrouvées.
    const lus = new Set(S.book.map((x) => x.id)), manquent = attendus.filter((id) => !lus.has(id)).length;
    vider(res).append(repare && el('p', { class: 'hint' }, repare), el('p', {}, `${total} recettes ajoutées${deja ? ` (${deja} déjà là)` : ''}. Ton livre compte maintenant ${S.book.length} recettes ; les nouvelles sont « À trier » dans 01 Livre.`),
      manquent ? el('div', { class: 'notice warn' }, ico('alert'), el('p', {}, `${manquent} recettes sont dans ton classeur, mais l'app ne les retrouve pas. Ouvre l'onglet Recettes : la 1re ligne doit garder les titres des colonnes (id, Nom, Type…).`)) : null,
      el('button', { class: 'btn', id: 'voirlivre', type: 'button' }, ico('right'), 'Voir le livre'));
    toast(`${total} recettes ajoutées`);
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
        el('li', {}, `${r.aVerifier.length} recettes marquées « à vérifier ».`),
        texteReparation(r.reparation) && el('li', {}, texteReparation(r.reparation))));
      toast('Import terminé'); await apres();
    } catch (e) {
      vider(res).append(el('div', { class: 'notice warn' }, ico('alert'), el('p', {}, `Oups, ça a brûlé un peu : ${e.message}. Relance l'import : rien ne sera dédoublé.`)));
    }
  });
}

// D-G-040 : Recommencer à neuf, seulement après « RECOMMENCER » tapé en toutes lettres.
export const motRecommencer = (v) => String(v || '').trim().toUpperCase() === 'RECOMMENCER';
export async function recommencer(apres) {
  if (!motRecommencer($('#neuf-mot')?.value)) return;
  const b = $('#recommencer'), res = $('#neuf-res'); if (b) b.disabled = true;
  vider(res).append(el('p', { class: 'label' }, 'On vide ton classeur…'));
  try {
    await reinitialiser(S.ctx.drive, S.ctx.classeurId);
    try { Object.keys(localStorage).filter((k) => k.startsWith('superchef-provigo-')).forEach((k) => localStorage.removeItem(k)); } catch (_) { /* stockage absent */ }
    await apres();
    closeCompte(); openCompte(true);
    toast('Ton livre est vide : choisis tes kits, puis ton stock de base.');
  } catch (e) {
    vider(res).append(el('div', { class: 'notice warn' }, ico('alert'), el('p', {}, `Oups : ${e.message}. Réessaie : l'app remet les lignes de titres à chaque fois.`)));
    if (b) b.disabled = false;
  }
}
