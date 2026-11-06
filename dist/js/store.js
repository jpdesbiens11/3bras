// Bibliothèque 3eBras dans le Drive de la personne (R-01).
// Trouve le dossier et le classeur créés par l'app, ou les crée.

import { TYPE_DOSSIER, TYPE_CLASSEUR } from './drive.js?v=1.0.2';
import { ONGLETS, SOUS_DOSSIERS, VERSION_SCHEMA, plageEntete } from './schema.js?v=1.0.2';

export async function ouvrirOuCreer(drive, { nomDossier, nomClasseur, version }, etape = () => {}) {
  etape('recherche');
  const [classeurs, dossiers] = await Promise.all([
    drive.chercher({ role: 'livre', type: TYPE_CLASSEUR }),
    drive.chercher({ role: 'dossier', type: TYPE_DOSSIER })
  ]);
  if (classeurs.length) {
    return { nouveau: false, classeur: classeurs[0], dossier: dossiers[0] || null };
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

export const lienClasseur = (id) => `https://docs.google.com/spreadsheets/d/${encodeURIComponent(id)}/edit`;
export const lienDossier = (id) => `https://drive.google.com/drive/folders/${encodeURIComponent(id)}`;
