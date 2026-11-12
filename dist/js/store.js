// Bibliothèque SuperChef.ai dans le Drive de la personne (R-01).
// Trouve le dossier et le classeur créés par l'app, ou les crée.

import { TYPE_DOSSIER, TYPE_CLASSEUR } from './drive.js?v=1.11.0';
import { ONGLETS, SOUS_DOSSIERS, VERSION_SCHEMA, plageEntete, colonnesManquantes, onglet, lettre } from './schema.js?v=1.11.0';

export async function ouvrirOuCreer(drive, { nomDossier, nomClasseur, version }, etape = () => {}) {
  etape('recherche');
  const [classeurs, dossiers] = await Promise.all([
    drive.chercher({ role: 'livre', type: TYPE_CLASSEUR }),
    drive.chercher({ role: 'dossier', type: TYPE_DOSSIER })
  ]);
  if (classeurs.length) {
    const reparation = await reparerEntetes(drive, classeurs[0].id);   // D-G-042 : avant toute migration ou écriture
    const migration = await migrerSchema(drive, classeurs[0].id);
    const [classeur, dossier] = await Promise.all([
      renommerAncien(drive, classeurs[0], nomClasseur),
      dossiers[0] ? renommerAncien(drive, dossiers[0], nomDossier) : null
    ]);
    return { nouveau: false, classeur, dossier, migration, reparation };
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

// D-G-030 : le dossier et le classeur qui portent encore un ancien nom par défaut prennent le nom
// SuperChef.ai. Un nom choisi par la personne n'est jamais touché ; un échec de renommage ne bloque rien.
export const ANCIENS_NOMS = Object.freeze(['3eBras', '3Bras', '3eBras — Livre', '3Bras — Livre']);
async function renommerAncien(drive, fichier, nom) {
  if (!nom || !ANCIENS_NOMS.includes(fichier.name)) return fichier;
  try { return { ...fichier, ...await drive.renommer(fichier.id, nom) }; } catch { return fichier; }
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
      ['cree_par', `SuperChef.ai ${version}`],
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

export const ONGLETS_DONNEES = Object.freeze(['Recettes', 'Plans de semaine', 'Inventaire', 'Bilans']);

// D-G-042 : prépare ou répare la ligne de titres des onglets de données avant d'écrire.
// - onglet absent : recréé avec ses titres ; 1re ligne vide : titres remis ;
// - 1re ligne effacée (des données remontées en ligne 1, ex. « k-quebecois-… ») : une ligne est insérée en haut
//   et les titres y sont remis, sans rien perdre ;
// - titres renommés à la main : rien n'est écrasé (comme D-G-015), c'est signalé.
const ID_DONNEE = /^[a-z]-[A-Za-z0-9-]{1,80}$/;
export async function reparerEntetes(drive, id, titres = ONGLETS_DONNEES) {
  const info = await drive.lireClasseur(id);
  const feuilles = new Map(info.sheets.map((s) => [s.properties.title, s.properties.sheetId]));
  const absents = titres.filter((t) => !feuilles.has(t));
  if (absents.length) await drive.majClasseur(id, absents.map((t) => ({ addSheet: { properties: { title: t, gridProperties: { frozenRowCount: 1 } } } })));
  const presents = titres.filter((t) => feuilles.has(t));
  const lus = presents.length ? await drive.lirePlusieurs(id, presents.map((t) => plageEntete(onglet(t)))) : { valueRanges: [] };
  const inserer = [], titresAEcrire = [...absents], rapport = { recrees: absents, remises: [], inserees: [], modifiees: [] };
  presents.forEach((t, i) => {
    const a1 = String(lus.valueRanges?.[i]?.values?.[0]?.[0] ?? '').trim();
    if (a1 === 'id') return;
    if (!a1) { titresAEcrire.push(t); rapport.remises.push(t); }
    else if (ID_DONNEE.test(a1)) {
      inserer.push({ insertDimension: { range: { sheetId: feuilles.get(t), dimension: 'ROWS', startIndex: 0, endIndex: 1 }, inheritFromBefore: false } });
      titresAEcrire.push(t); rapport.inserees.push(t);
    } else rapport.modifiees.push(t);
  });
  if (inserer.length) await drive.majClasseur(id, inserer);
  if (titresAEcrire.length) await drive.ecrireValeurs(id, titresAEcrire.map((t) => { const o = onglet(t); return { range: plageEntete(o), values: [o.colonnes] }; }));
  return rapport;
}
export const texteReparation = (r) => {
  if (!r) return '';
  const faits = [...r.recrees, ...r.remises, ...r.inserees];
  return [faits.length ? `Classeur réparé : ligne de titres remise dans ${faits.join(', ')}.` : '',
    r.modifiees.length ? `Titres modifiés à la main dans ${r.modifiees.join(', ')} : l'app ne les écrase pas ; remets « id » en A1.` : ''].filter(Boolean).join(' ');
};

// D-G-040 : « Recommencer à neuf » — vide les onglets de données et remet leur ligne de titres au schéma
// courant (un onglet supprimé est recréé). Le classeur, le dossier et l'onglet Schéma restent. Pas de copie.
export async function reinitialiser(drive, id, titres = ONGLETS_DONNEES) {
  const info = await drive.lireClasseur(id);
  const presents = new Set(info.sheets.map((s) => s.properties.title));
  const ajouts = titres.filter((t) => !presents.has(t)).map((t) => ({ addSheet: { properties: { title: t, gridProperties: { frozenRowCount: 1 } } } }));
  if (ajouts.length) await drive.majClasseur(id, ajouts);
  const avant = titres.filter((t) => presents.has(t));
  if (avant.length) await drive.viderValeurs(id, avant.map((t) => `'${t}'`));
  await drive.ecrireValeurs(id, titres.map((t) => { const o = onglet(t); return { range: plageEntete(o), values: [o.colonnes] }; }));
}

// Lit un onglet entier en objets { colonne: valeur, _ligne: n° de ligne dans Sheets }.
export async function lireOnglet(drive, id, titre) {
  const lu = await drive.lireValeurs(id, `'${titre}'`);
  return enObjets(lu.values || []);
}

export function enObjets(valeurs) {
  const [entete = [], ...lignes] = valeurs;
  const out = [];
  lignes.forEach((l, i) => {
    if (!l.some((v) => v !== '')) return;
    const o = Object.fromEntries(entete.map((c, j) => [c, l[j] ?? '']));
    Object.defineProperty(o, '_ligne', { value: i + 2, writable: true, enumerable: false });
    out.push(o);
  });
  return out;
}

// Lit plusieurs onglets d'un seul appel.
export async function lireOnglets(drive, id, titres) {
  const lu = await drive.lirePlusieurs(id, titres.map((t) => `'${t}'`));
  return Object.fromEntries(titres.map((t, i) => [t, enObjets(lu.valueRanges?.[i]?.values || [])]));
}

// N-07 : écrit des colonnes d'une ligne repérée par son id, après avoir relu la cellule id.
// Si la ligne a bougé (autre appareil), on retrouve l'id dans la colonne A ; s'il a disparu, on refuse.
export async function ecrireParId(drive, id, titre, obj, valeurs) {
  const o = onglet(titre);
  let ligne = obj._ligne;
  const lu = ligne ? await drive.lireValeurs(id, `'${titre}'!A${ligne}:A${ligne}`) : null;
  if (!ligne || lu?.values?.[0]?.[0] !== obj.id) {
    const col = await drive.lireValeurs(id, `'${titre}'!A:A`);
    const k = (col.values || []).findIndex((l) => l[0] === obj.id);
    if (k < 1) { const e = new Error(`ligne ${obj.id} introuvable`); e.conflit = true; throw e; }
    ligne = k + 1; obj._ligne = ligne;
  }
  const donnees = Object.entries(valeurs).map(([c, v]) => {
    const j = o.colonnes.indexOf(c);
    if (j < 0) throw new Error(`colonne inconnue ${c}`);
    const a = lettre(j + 1);
    return { range: `'${titre}'!${a}${ligne}:${a}${ligne}`, values: [[valeurCellule(v)]] };
  });
  await drive.ecrireValeurs(id, donnees);
  Object.assign(obj, Object.fromEntries(Object.entries(valeurs).map(([c, v]) => [c, valeurCellule(v)])));
}

// Ajoute une ligne et renvoie l'objet avec son numéro de ligne.
export async function ajouterUn(drive, id, titre, obj) {
  const rep = await ajouterObjets(drive, id, titre, [obj]);
  const m = /![A-Z]+(\d+)/.exec(rep?.updates?.updatedRange || '');
  const o = Object.fromEntries(onglet(titre).colonnes.map((c) => [c, valeurCellule(obj[c])]));
  Object.defineProperty(o, '_ligne', { value: m ? Number(m[1]) : null, writable: true, enumerable: false });
  return o;
}

// Ajoute des objets à la fin d'un onglet, dans l'ordre de ses colonnes.
export function ajouterObjets(drive, id, titre, objets) {
  if (!objets.length) return Promise.resolve(null);
  const o = onglet(titre);
  const lignes = objets.map((obj) => o.colonnes.map((c) => valeurCellule(obj[c])));
  return drive.ajouterValeurs(id, `'${titre}'!A1`, lignes);
}

export function valeurCellule(v) {
  if (v === undefined || v === null) return '';
  if (Array.isArray(v)) return v.join('\n');
  if (typeof v === 'boolean') return v ? 'oui' : 'non';
  return String(v);
}

// Le propriétaire et sa dernière connexion sont notés dans l'onglet Schéma du classeur (dans son Drive).
export async function noterProprietaire(drive, id, { courriel, version }) {
  const lu = await drive.lireValeurs(id, "'Schéma'!A2:B40");
  const lignes = lu.values || [];
  const valeurs = { proprietaire: courriel, derniere_connexion: new Date().toISOString().slice(0, 10), derniere_version: version };
  let fin = lignes.length + 2;
  const donnees = Object.entries(valeurs).filter(([, v]) => v).map(([cle, v]) => {
    const i = lignes.findIndex((l) => l[0] === cle);
    const ligne = i >= 0 ? i + 2 : fin++;
    return { range: `'Schéma'!A${ligne}:B${ligne}`, values: [[cle, v]] };
  });
  if (donnees.length) await drive.ecrireValeurs(id, donnees);
}

export const lienClasseur = (id) => `https://docs.google.com/spreadsheets/d/${encodeURIComponent(id)}/edit`;
export const lienDossier = (id) => `https://drive.google.com/drive/folders/${encodeURIComponent(id)}`;
