// Bibliothèque 3eBras dans le Drive de la personne (R-01).
// Trouve le dossier et le classeur créés par l'app, ou les crée.

import { TYPE_DOSSIER, TYPE_CLASSEUR } from './drive.js?v=1.1.0';
import { ONGLETS, SOUS_DOSSIERS, VERSION_SCHEMA, plageEntete, colonnesManquantes, onglet } from './schema.js?v=1.1.0';

export async function ouvrirOuCreer(drive, { nomDossier, nomClasseur, version }, etape = () => {}) {
  etape('recherche');
  const [classeurs, dossiers] = await Promise.all([
    drive.chercher({ role: 'livre', type: TYPE_CLASSEUR }),
    drive.chercher({ role: 'dossier', type: TYPE_DOSSIER })
  ]);
  if (classeurs.length) {
    const migration = await migrerSchema(drive, classeurs[0].id);
    return { nouveau: false, classeur: classeurs[0], dossier: dossiers[0] || null, migration };
  }

  etape('creation');
  const dossier = dossiers[0] || await drive.creerFichier({ nom: nomDossier, type: TYPE_DOSSIER, role: 'dossier' });
  if (!dossiers[0]) {
    for (const nom of SOUS_DOSSIERS) {
      await drive.creerFichier({ nom, type: TYPE_DOSSIER, parent: dossier.id, role: `sous-dossier:${nom}` });
    }
  }
  const classeur = await drive.creerFichier({ nom: nomClasseur, type: TYPE_CLASSEUR, parent: dossier.id, role: 'livre' });
  await preparerOnglets(drive, classeur.id, version);
  return { nouveau: true, classeur, dossier };
}

export async function preparerOnglets(drive, id, version) {
  const info = await drive.lireClasseur(id);
  const premier = info.sheets[0].properties.sheetId;
  const gele = { frozenRowCount: 1 };
  const requetes = ONGLETS.map((o, i) => i === 0
    ? { updateSheetProperties: {
        properties: { sheetId: premier, title: o.titre, gridProperties: gele },
        fields: 'title,gridProperties.frozenRowCount' } }
    : { addSheet: { properties: { title: o.titre, index: i, gridProperties: gele } } });
  await drive.majClasseur(id, requetes);

  const donnees = ONGLETS.map((o) => ({ range: plageEntete(o), values: [o.colonnes] }));
  donnees.push({
    range: "'Schéma'!A2:B4",
    values: [
      ['version_schema', String(VERSION_SCHEMA)],
      ['cree_par', `3eBras ${version}`],
      ['cree_le', new Date().toISOString().slice(0, 10)]
    ]
  });
  await drive.ecrireValeurs(id, donnees);
}

// P-4 : met un classeur existant à la version de schéma courante en ajoutant
// les colonnes manquantes à la fin de chaque en-tête. Ne renomme ni ne retire rien.
export async function migrerSchema(drive, id) {
  const lu = await drive.lireValeurs(id, "'Schéma'!A2:B20");
  const lignes = lu.values || [];
  const idx = lignes.findIndex((l) => l[0] === 'version_schema');
  const avant = Number(idx >= 0 ? lignes[idx][1] : 1);
  if (avant >= VERSION_SCHEMA) return { avant, apres: avant, ajouts: 0 };

  const onglets = ONGLETS.filter((o) => o.titre !== 'Schéma');
  const entetes = await drive.lirePlusieurs(id, onglets.map(plageEntete));
  const donnees = [];
  let ajouts = 0;
  onglets.forEach((o, i) => {
    const entete = entetes.valueRanges?.[i]?.values?.[0] || [];
    const manquantes = colonnesManquantes(o, entete);
    if (manquantes.length) {
      ajouts += manquantes.length;
      donnees.push({ range: plageEntete(o), values: [[...entete, ...manquantes]] });
    }
  });
  const ligne = idx >= 0 ? idx + 2 : lignes.length + 2;
  donnees.push({ range: `'Schéma'!A${ligne}:B${ligne}`, values: [['version_schema', String(VERSION_SCHEMA)]] });
  await drive.ecrireValeurs(id, donnees);
  return { avant, apres: VERSION_SCHEMA, ajouts };
}

// Lit un onglet entier en objets { colonne: valeur }.
export async function lireOnglet(drive, id, titre) {
  const lu = await drive.lireValeurs(id, `'${titre}'`);
  const [entete = [], ...lignes] = lu.values || [];
  return lignes.filter((l) => l.some((v) => v !== '')).map((l) =>
    Object.fromEntries(entete.map((c, i) => [c, l[i] ?? ''])));
}

// Ajoute des objets à la fin d'un onglet, dans l'ordre de ses colonnes.
export function ajouterObjets(drive, id, titre, objets) {
  if (!objets.length) return Promise.resolve(null);
  const o = onglet(titre);
  const lignes = objets.map((obj) => o.colonnes.map((c) => valeurCellule(obj[c])));
  return drive.ajouterValeurs(id, `'${titre}'!A1`, lignes);
}

function valeurCellule(v) {
  if (v === undefined || v === null) return '';
  if (Array.isArray(v)) return v.join('\n');
  if (typeof v === 'boolean') return v ? 'oui' : 'non';
  return String(v);
}

export const lienClasseur = (id) => `https://docs.google.com/spreadsheets/d/${encodeURIComponent(id)}/edit`;
export const lienDossier = (id) => `https://drive.google.com/drive/folders/${encodeURIComponent(id)}`;
