// Schéma du classeur « 3eBras — Livre ».
// P-4 : on ajoute des colonnes à la fin, on n'en renomme ni n'en retire jamais.
// Chaque ligne a un id stable ; les plans et bilans pointent vers cet id.
// Version 2 (1.1.0) : colonnes reprises de Notion ajoutées à la fin de chaque onglet.

export const VERSION_SCHEMA = 2;

export const ONGLETS = Object.freeze([
  {
    titre: 'Recettes',
    colonnes: ['id', 'Nom', 'Type', 'Statut', 'Protéine', 'Cuisine', 'Soir de semaine',
      'Temps total (min)', 'Portions', 'Jour fixe', 'Dernière fois cuisinée',
      'Note globale /10', 'Outils', 'Étiquettes', 'Source', 'Ingrédients', 'Étapes',
      // v2
      'Facilité /10', 'Étoiles', 'Restes', 'Tâches sous-chef', 'À vérifier',
      'Fiche complète', 'Lien source', 'Notes', 'ID Notion', 'ID Evernote']
  },
  {
    titre: 'Plans de semaine',
    colonnes: ['id', 'Semaine du', 'Jour', 'Recette id', 'Épinglé', 'Dessert', 'Notes',
      // v2
      'Titre', 'Déjà à la maison']
  },
  {
    titre: 'Inventaire',
    colonnes: ['id', 'Nom', 'Zone', 'Quantité', 'Unité', 'Déjà à la maison',
      // v2
      'Département', 'Essentiel']
  },
  {
    titre: 'Bilans',
    colonnes: ['id', 'Date', 'Recette id', 'Note /10', 'Commentaire',
      // v2
      'Titre', 'Étoiles', 'Facilité /10', 'Restes', 'Temps prévu (min)', 'Temps réel (min)']
  },
  {
    titre: 'Schéma',
    colonnes: ['clé', 'valeur']
  }
]);

export const SOUS_DOSSIERS = Object.freeze(['Fiches', 'Photos', 'Exports']);

export const onglet = (titre) => ONGLETS.find((o) => o.titre === titre);

// Lettre de colonne (1 → A, 27 → AA).
export function lettre(n) {
  let s = '';
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

export function plageEntete(o) {
  return `'${o.titre}'!A1:${lettre(o.colonnes.length)}1`;
}

// Colonnes à ajouter à un en-tête existant (migration additive).
// Refuse si l'en-tête existant n'est pas un préfixe du schéma : on ne renomme jamais.
export function colonnesManquantes(o, entete) {
  const prefixe = o.colonnes.slice(0, entete.length);
  if (prefixe.some((c, i) => c !== entete[i])) {
    throw new Error(`En-tête inattendu dans « ${o.titre} » : la migration additive est impossible.`);
  }
  return o.colonnes.slice(entete.length);
}
