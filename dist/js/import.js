// Fichier d'import 3Bras (R-02, D-G-003) : validation puis écriture dans le classeur.
// Le fichier est une donnée non fiable : on vérifie tout avant d'écrire une seule cellule.

import { ONGLETS, VERSION_SCHEMA } from './schema.js?v=1.2.1';
import { lireOnglet, ajouterObjets } from './store.js?v=1.2.1';

export const FORMAT = '3ebras-import';
const SECTIONS = { recettes: 'Recettes', plans: 'Plans de semaine', inventaire: 'Inventaire', bilans: 'Bilans' };
const MAX_CELLULE = 45000;           // Sheets plafonne une cellule à 50 000 caractères
const MAX_LIGNES = 5000;
const MOTIF_ID = /^[a-z]-[A-Za-z0-9-]{1,80}$/;
// R-15 : pas de recettes de kits repas dans le livre.
const KITS = /\b(good\s*food|goodfood|chef\s*cook\s*it|cook\s*it|hellofresh|hello\s*fresh)\b/i;

export function estKitRepas(r) {
  return KITS.test(`${r.Nom || ''} ${r.Source || ''} ${r['Lien source'] || ''} ${r.Notes || ''}`);
}

// Renvoie { ok, erreurs[], donnees } ; donnees = { recettes:[], plans:[], inventaire:[], bilans:[] }.
export function valider(brut) {
  const erreurs = [];
  let f;
  try { f = typeof brut === 'string' ? JSON.parse(brut) : brut; } catch { return { ok: false, erreurs: ['Ce fichier n\'est pas du JSON valide.'] }; }
  if (!f || typeof f !== 'object' || f.format !== FORMAT) return { ok: false, erreurs: ['Ce n\'est pas un fichier d\'import 3Bras.'] };
  if (!Number.isInteger(f.schema) || f.schema < 1 || f.schema > VERSION_SCHEMA) {
    erreurs.push(`Version de schéma ${f.schema} non prise en charge (max ${VERSION_SCHEMA}).`);
  }
  const donnees = {};
  const ids = new Set();
  for (const [cle, titre] of Object.entries(SECTIONS)) {
    const liste = f[cle] ?? [];
    if (!Array.isArray(liste)) { erreurs.push(`« ${cle} » doit être une liste.`); continue; }
    if (liste.length > MAX_LIGNES) { erreurs.push(`« ${cle} » : trop de lignes (${liste.length}).`); continue; }
    const colonnes = new Set(ONGLETS.find((o) => o.titre === titre).colonnes);
    donnees[cle] = [];
    liste.forEach((obj, i) => {
      const ou = `${cle}[${i}]`;
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) { erreurs.push(`${ou} : objet attendu.`); return; }
      if (typeof obj.id !== 'string' || !MOTIF_ID.test(obj.id)) { erreurs.push(`${ou} : id invalide.`); return; }
      if (ids.has(obj.id)) { erreurs.push(`${ou} : id en double (${obj.id}).`); return; }
      ids.add(obj.id);
      for (const [c, v] of Object.entries(obj)) {
        if (!colonnes.has(c)) { erreurs.push(`${ou} : colonne inconnue « ${c} ».`); continue; }
        const ok = v === null || ['string', 'number', 'boolean'].includes(typeof v)
          || (Array.isArray(v) && v.every((x) => typeof x === 'string'));
        if (!ok) { erreurs.push(`${ou}.${c} : type non permis.`); continue; }
        const long = Array.isArray(v) ? v.join('\n').length : String(v ?? '').length;
        if (long > MAX_CELLULE) erreurs.push(`${ou}.${c} : texte trop long (${long}).`);
      }
      if ((cle === 'recettes' || cle === 'inventaire') && !String(obj.Nom || '').trim()) erreurs.push(`${ou} : Nom manquant.`);
      donnees[cle].push(obj);
    });
  }
  const idsRecettes = new Set((donnees.recettes || []).map((r) => r.id));
  for (const [cle, champ] of [['plans', 'Recette id'], ['bilans', 'Recette id']]) {
    (donnees[cle] || []).forEach((p, i) => {
      if (p[champ] && !idsRecettes.has(p[champ])) erreurs.push(`${cle}[${i}] : recette ${p[champ]} absente du fichier.`);
    });
  }
  return { ok: erreurs.length === 0, erreurs, donnees };
}

// Écrit les lignes absentes du classeur. Ré-importer le même fichier ne crée rien de plus.
export async function importer(drive, classeurId, donnees, etape = () => {}) {
  const rapport = { creees: {}, deja: {}, kits: [], aVerifier: [] };
  for (const [cle, titre] of Object.entries(SECTIONS)) {
    etape(titre);
    const existants = new Set((await lireOnglet(drive, classeurId, titre)).map((l) => l.id));
    let nouvelles = (donnees[cle] || []).filter((o) => !existants.has(o.id));
    if (cle === 'recettes') {
      rapport.kits = nouvelles.filter(estKitRepas).map((r) => r.Nom);
      nouvelles = nouvelles.filter((r) => !estKitRepas(r));
      rapport.aVerifier = nouvelles.filter((r) => String(r['À vérifier'] || '').trim() || r['Fiche complète'] === false)
        .map((r) => r.Nom);
    }
    for (let i = 0; i < nouvelles.length; i += 50) {
      await ajouterObjets(drive, classeurId, titre, nouvelles.slice(i, i + 50));
    }
    rapport.creees[cle] = nouvelles.length;
    rapport.deja[cle] = (donnees[cle] || []).length - nouvelles.length - (cle === 'recettes' ? rapport.kits.length : 0);
  }
  return rapport;
}
