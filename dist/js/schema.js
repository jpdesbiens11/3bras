// Schéma du classeur « 3eBras — Livre ».
// P-4 : on ajoute des colonnes à la fin, on n'en renomme ni n'en retire jamais.
// Chaque ligne a un id stable ; les plans et bilans pointent vers cet id.

export const VERSION_SCHEMA = 1;

export const ONGLETS = Object.freeze([
  {
    titre: 'Recettes',
    colonnes: ['id', 'Nom', 'Type', 'Statut', 'Protéine', 'Cuisine', 'Soir de semaine',
      'Temps total (min)', 'Portions', 'Jour fixe', 'Dernière fois cuisinée',
      'Note globale /10', 'Outils', 'Étiquettes', 'Source', 'Ingrédients', 'Étapes']
  },
  {
    titre: 'Plans de semaine',
    colonnes: ['id', 'Semaine du', 'Jour', 'Recette id', 'Épinglé', 'Dessert', 'Notes']
  },
  {
    titre: 'Inventaire',
    colonnes: ['id', 'Nom', 'Zone', 'Quantité', 'Unité', 'Déjà à la maison']
  },
  {
    titre: 'Bilans',
    colonnes: ['id', 'Date', 'Recette id', 'Note /10', 'Commentaire']
  },
  {
    titre: 'Schéma',
    colonnes: ['clé', 'valeur']
  }
]);

export const SOUS_DOSSIERS = Object.freeze(['Fiches', 'Photos', 'Exports']);

// Lettre de colonne (1 → A, 27 → AA).
export function lettre(n) {
  let s = '';
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

export function plageEntete(onglet) {
  return `'${onglet.titre}'!A1:${lettre(onglet.colonnes.length)}1`;
}
