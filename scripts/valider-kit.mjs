// Vérifie un kit de départ : node scripts/valider-kit.mjs dist/kits/<id>.json
// Mêmes règles que tout import (valider), plus celles des kits (D-G-025, D-G-038).
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { valider, estKitRepas } from '../dist/js/import.js';
import { TYPES, PROTS, CUIS, OUTILS } from '../dist/js/etat.js';

const SOURCES = ['Famille', 'Ricardo', 'Di Stasio', 'Recettes du Québec', 'Labriski', 'Trois fois par jour', 'Web autre'];
export async function verifierKit(chemin) {
  const id = basename(chemin, '.json'), err = [];
  const brut = JSON.parse(await readFile(chemin, 'utf8'));
  const v = valider(brut); err.push(...v.erreurs);
  if (brut.kit?.id !== id) err.push(`kit.id doit valoir « ${id} »`);
  if (!brut.kit?.nom || !brut.kit?.description) err.push('kit.nom et kit.description requis');
  const rec = brut.recettes || [];
  if (rec.length !== 10) err.push(`10 recettes attendues, ${rec.length} trouvées`);
  const noms = new Set();
  rec.forEach((r, i) => {
    const o = `${r.Nom || `recettes[${i}]`}`;
    if (!String(r.id).startsWith(`k-${id}-`)) err.push(`${o} : id doit commencer par k-${id}-`);
    if (noms.has(r.Nom)) err.push(`${o} : nom en double`); noms.add(r.Nom);
    if (!TYPES.includes(r.Type)) err.push(`${o} : Type « ${r.Type} » non permis`);
    if (r.Type === 'Dessert' ? !['', 'Aucune'].includes(r['Protéine'] ?? '') && !PROTS.includes(r['Protéine']) : !PROTS.includes(r['Protéine'])) err.push(`${o} : Protéine « ${r['Protéine']} » non permise`);
    if (!CUIS.includes(r.Cuisine)) err.push(`${o} : Cuisine « ${r.Cuisine} » non permise`);
    for (const t of String(r.Outils || '').split(',').map((x) => x.trim()).filter(Boolean)) if (!OUTILS.includes(t)) err.push(`${o} : outil « ${t} » non permis`);
    if (!SOURCES.includes(r.Source)) err.push(`${o} : Source « ${r.Source} » non permise`);
    if (r.Statut !== 'À trier') err.push(`${o} : Statut doit être « À trier »`);
    if (r['Fiche complète'] !== true) err.push(`${o} : Fiche complète doit être true`);
    if (!/^https:\/\/\S+$/.test(r['Lien source'] || '')) err.push(`${o} : Lien source https requis`);
    if (!Number.isInteger(r['Temps total (min)']) || r['Temps total (min)'] < 5) err.push(`${o} : Temps total (min) entier requis`);
    if (r['Soir de semaine'] !== (r['Temps total (min)'] <= 45)) err.push(`${o} : Soir de semaine doit valoir (temps ≤ 45)`);
    if (!Number.isInteger(r.Portions) || r.Portions < 1) err.push(`${o} : Portions entier requis`);
    const ing = (r['Ingrédients'] || []).filter((l) => !l.startsWith('## '));
    if (ing.length < 4) err.push(`${o} : au moins 4 ingrédients`);
    if ((r['Étapes'] || []).length < 3) err.push(`${o} : au moins 3 étapes`);
    if (!(r['Tâches sous-chef'] || []).length || r['Tâches sous-chef'].length > 3) err.push(`${o} : 1 à 3 tâches sous-chef`);
    if (!Array.isArray(r.Notes) || !r.Notes.length) err.push(`${o} : Notes (inspiration) requises`);
    if (estKitRepas(r)) err.push(`${o} : recette de kit repas refusée (R-15)`);
    if ((r['Étapes'] || []).some((e) => /\d+\s*°\s*F/.test(e) && !/°\s*C/.test(e))) err.push(`${o} : température en °C puis °F`);
  });
  return err;
}
if (process.argv[1] && process.argv[1].endsWith('valider-kit.mjs')) {
  let ko = 0;
  for (const f of process.argv.slice(2)) { const e = await verifierKit(f); ko += e.length; console.log(e.length ? `✗ ${f}\n  - ${e.join('\n  - ')}` : `✓ ${f}`); }
  process.exit(ko ? 1 : 0);
}
