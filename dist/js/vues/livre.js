// Vue Livre (R-03) : chercher, filtrer, lire une fiche. Lecture seule en 1.1.0.
import { el, vider } from '../el.js?v=1.1.0';
import { T } from '../textes.js?v=1.1.0';
import { lireOnglet } from '../store.js?v=1.1.0';

const FILTRES = ['Type', 'Statut', 'Protéine'];

export async function vueLivre(ctx, zone) {
  zone.append(el('p', { class: 'travail', role: 'status' }, el('span', { class: 'roue', 'aria-hidden': 'true' }), T.livreChargement));
  if (!ctx.recettes) ctx.recettes = await lireOnglet(ctx.drive, ctx.classeurId, 'Recettes');
  vider(zone);
  const recettes = ctx.recettes;
  if (!recettes.length) {
    zone.append(el('h2', {}, T.livreVideTitre), el('p', {}, T.livreVide),
      el('button', { class: 'bouton principal', type: 'button', onclick: () => ctx.aller('importer') }, T.allerImporter));
    return;
  }

  const etat = { q: '', Type: '', Statut: 'sauf-declassees', Protéine: '', choisie: null };
  const liste = el('ul', { class: 'liste-recettes', 'aria-label': T.livreListe });
  const fiche = el('article', { class: 'fiche', 'aria-live': 'polite' });
  const compte = el('p', { class: 'aide compte' });

  const recherche = el('input', { type: 'search', class: 'champ', placeholder: T.livreRecherche,
    'aria-label': T.livreRecherche, oninput: (e) => { etat.q = e.target.value; rendreListe(); } });
  const selects = FILTRES.map((f) => {
    const valeurs = [...new Set(recettes.map((r) => r[f]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
    const options = [el('option', { value: '' }, `${f} : tous`)];
    if (f === 'Statut') options.push(el('option', { value: 'sauf-declassees', selected: true }, T.saufDeclassees));
    options.push(...valeurs.map((v) => el('option', { value: v }, v)));
    return el('select', { class: 'champ', 'aria-label': f, onchange: (e) => { etat[f] = e.target.value; rendreListe(); } }, options);
  });

  function correspond(r) {
    const q = normaliser(etat.q);
    if (q && !normaliser(`${r.Nom} ${r.Ingrédients} ${r.Étiquettes} ${r.Cuisine}`).includes(q)) return false;
    if (etat.Statut === 'sauf-declassees') { if (r.Statut === 'Déclassée') return false; } else if (etat.Statut && r.Statut !== etat.Statut) return false;
    return ['Type', 'Protéine'].every((f) => !etat[f] || r[f] === etat[f]);
  }

  function rendreListe() {
    const visibles = recettes.filter(correspond).sort((a, b) => a.Nom.localeCompare(b.Nom, 'fr'));
    compte.textContent = T.livreCompte(visibles.length, recettes.length);
    vider(liste).append(...visibles.map((r) => el('li', {},
      el('button', { type: 'button', class: `item-recette${etat.choisie === r.id ? ' choisie' : ''}`,
        'aria-current': etat.choisie === r.id ? 'true' : false,
        onclick: () => { etat.choisie = r.id; rendreFiche(r); rendreListe(); } },
      el('span', { class: 'item-nom' }, r.Nom),
      el('span', { class: 'item-meta' }, [r.Type, r.Protéine, r['Temps total (min)'] && `${r['Temps total (min)']} min`, r.Statut].filter(Boolean).join(' · '))))));
  }

  function rendreFiche(r) {
    vider(fiche).append(...construireFiche(r, () => { etat.choisie = null; vider(fiche); zone.classList.remove('fiche-ouverte'); rendreListe(); }));
    zone.classList.add('fiche-ouverte');
    fiche.querySelector('h2')?.focus();
  }

  zone.append(
    el('div', { class: 'colonne-liste' },
      el('div', { class: 'filtres' }, recherche, ...selects), compte, liste),
    fiche);
  rendreListe();
}

function construireFiche(r, fermer) {
  const meta = [r.Type, r.Protéine, r.Cuisine, r['Temps total (min)'] && `${r['Temps total (min)']} min`,
    r.Portions && `${r.Portions} portions`, r.Statut, r.Étoiles].filter(Boolean);
  const lien = /^https:\/\/[^\s]+$/.test(r['Lien source'] || '') ? r['Lien source'] : '';
  return [
    el('button', { type: 'button', class: 'bouton discret retour', onclick: fermer }, T.retourListe),
    el('h2', { tabindex: '-1' }, r.Nom),
    el('p', { class: 'item-meta' }, meta.join(' · ')),
    r['À vérifier'] && el('p', { class: 'avis-doux' }, `${T.aVerifier} ${r['À vérifier']}`),
    section(T.ingredients, lignes(r.Ingrédients), 'ul'),
    section(T.etapes, lignes(r.Étapes), 'ol'),
    section(T.sousChef, lignes(r['Tâches sous-chef']), 'ul'),
    r.Notes && el('section', {}, el('h3', {}, T.notes), ...lignes(r.Notes).map((l) => el('p', {}, l))),
    (r.Source || lien) && el('p', { class: 'aide' }, `${T.source} ${r.Source || ''} `,
      lien && el('a', { href: lien, target: '_blank', rel: 'noopener noreferrer' }, T.voirSource))
  ];
}

function section(titre, items, type) {
  if (!items.length) return null;
  const blocs = [];
  let courant = el(type, {});
  for (const l of items) {
    if (l.startsWith('## ')) {
      if (courant.childElementCount) blocs.push(courant);
      blocs.push(el('h4', {}, l.slice(3)));
      courant = el(type, {});
    } else {
      courant.append(el('li', {}, l));
    }
  }
  if (courant.childElementCount) blocs.push(courant);
  return el('section', {}, el('h3', {}, titre), ...blocs);
}

const lignes = (t) => String(t || '').split('\n').map((l) => l.trim()).filter(Boolean);
const normaliser = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
