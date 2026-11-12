// Vérifie le découpage étapes ↔ ingrédients des kits (D-G-050) : node scripts/verifier-etapes.mjs [dist/kits/<id>.json …]
// Pour chaque recette : ingrédients qu'aucune étape ne nomme, lignes en double dans un même groupe, et étapes où
// deux lignes du même ingrédient (deux groupes) tombent ensemble. Sortie 1 s'il reste un problème.
import { readFile, readdir } from 'node:fs/promises';
import { ficheDeLigne, stepPlan, ingKey } from '../dist/js/cuisine.js';
import { norm } from '../dist/js/etat.js';

export function problemesRecette(r) {
  const d = ficheDeLigne({ ingText: (r['Ingrédients'] || []).join('\n'), stepsText: (r['Étapes'] || []).join('\n'), sous: '' });
  const { per, extra } = stepPlan(d), out = [];
  for (const k of extra) out.push(`aucune étape ne nomme « ${d.ing[k].text} »`);
  const vus = new Map();
  d.ing.forEach((x, k) => { const c = `${x.group || ''}|${norm(x.text)}`; if (vus.has(c)) out.push(`« ${x.text} » en double dans le groupe ${x.group || '(sans groupe)'}`); vus.set(c, k); });
  per.forEach((l, si) => {
    const cles = l.map((k) => ingKey(d.ing[k].text));
    const doubles = [...new Set(cles.filter((c, j) => cles.indexOf(c) !== j))];
    for (const c of doubles) out.push(`étape ${si + 1} : « ${c} » y tombe ${cles.filter((x) => x === c).length} fois`);
  });
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dossier = new URL('../dist/kits/', import.meta.url).pathname;
  const fichiers = process.argv.slice(2).length ? process.argv.slice(2) : (await readdir(dossier)).filter((f) => f.endsWith('.json') && f !== 'stock-base.json').map((f) => dossier + f);
  let total = 0, recettes = 0;
  for (const f of fichiers) {
    const kit = JSON.parse(await readFile(f, 'utf8'));
    for (const r of kit.recettes || []) {
      recettes++;
      const p = problemesRecette(r);
      if (p.length) { total += p.length; console.log(`${kit.kit?.id} · ${r.Nom}`); for (const x of p) console.log(`   - ${x}`); }
    }
  }
  console.log(`${recettes} recettes, ${total} problème${total > 1 ? 's' : ''}`);
  process.exitCode = total ? 1 : 0;
}
