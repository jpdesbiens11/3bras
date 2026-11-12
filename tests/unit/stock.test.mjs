// D-G-039 : stock de base — essentiels et ingrédients des recettes, à cocher, vers l'onglet Inventaire.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nomsArticles, articlesDeRecettes, preparerStock, lignesInventaire, fichierStock, couvre } from '../../dist/js/stock.js';
import { creerDrive } from '../../dist/js/drive.js';
import { ouvrirOuCreer, lireOnglet } from '../../dist/js/store.js';
import { importer } from '../../dist/js/import.js';
import { ZONES, DEPTS } from '../../dist/js/etat.js';
import { creerDriveSimule } from './drive-simule.mjs';

const BASE = JSON.parse(readFileSync(new URL('../../dist/kits/stock-base.json', import.meta.url), 'utf8')).articles;

test('D-G-039 : la liste des essentiels est propre (zones, rayons, sans doublon)', () => {
  assert.ok(BASE.length >= 50, `${BASE.length} essentiels`);
  assert.equal(new Set(BASE.map((a) => a.Nom)).size, BASE.length);
  for (const a of BASE) { assert.ok(ZONES.includes(a.Zone), a.Nom); assert.ok(DEPTS.includes(a['Département']), a.Nom); assert.equal(typeof a.Essentiel, 'boolean'); }
});

test('D-G-039 : noms d\'articles tirés des lignes d\'ingrédients', () => {
  assert.deepEqual(nomsArticles('30 ml (2 c. à soupe) d\'huile d\'olive'), ['Huile d\'olive']);
  assert.deepEqual(nomsArticles('Sel et poivre'), ['Sel', 'Poivre']);
  assert.deepEqual(nomsArticles('Pincée de muscade moulue'), ['Muscade moulue']);
  assert.deepEqual(nomsArticles('500 ml (2 tasses) d\'eau froide'), []);
  assert.deepEqual(nomsArticles('15 ml (1 c. à soupe) de gochujang ou sriracha'), ['Gochujang']);
  assert.ok(couvre('Farine tout usage', 'Farine tout usage non blanchie'));
  assert.ok(!couvre('Huile d\'olive', 'Huile de sésame'));
});

test('D-G-039 : essentiels cochés, ingrédients des recettes à cocher, inventaire existant respecté', () => {
  const recettes = [
    { ingText: '## Sauce\n30 ml d\'huile d\'olive\n15 ml de sauce de poisson\n2 ml de cumin moulu\n1 oignon' },
    { ingText: '15 ml de sauce de poisson\nSel et poivre\n250 ml de bouillon de poulet' }
  ];
  const de = articlesDeRecettes(recettes);
  assert.deepEqual(de.map((a) => [a.Nom, a.recettes]).slice(0, 2), [['Sauce de poisson', 2], ['Bouillon de poulet', 1]].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fr')));
  const liste = preparerStock(BASE, de, (nom) => nom === 'Sel');
  const par = Object.fromEntries(liste.map((a) => [a.Nom, a]));
  assert.equal(par.Sel.deja, true); assert.equal(par.Sel.choisi, false);
  assert.equal(par['Huile d\'olive'].choisi, true); assert.equal(par['Huile d\'olive'].recettes, 1);
  assert.equal(par['Sauce de poisson'].source, 'recettes'); assert.equal(par['Sauce de poisson'].choisi, false);
  assert.ok(!par.Oignon, 'les légumes frais ne viennent pas des recettes');
  const rows = lignesInventaire(liste.filter((a) => a.choisi));
  assert.ok(rows.every((r) => r.id.startsWith('i-base-') && r['Quantité'] === 1));
  assert.deepEqual(fichierStock(rows, '2026-11-12').erreurs, []);
});

test('D-G-039 : ajouter le stock deux fois n\'ajoute rien de plus à l\'onglet Inventaire', async () => {
  const sim = creerDriveSimule();
  const drive = creerDrive({ jetonValide: async () => 'jeton-test', fetch: sim.fetch });
  const { classeur } = await ouvrirOuCreer(drive, { nomDossier: 'SuperChef.ai', nomClasseur: 'SuperChef.ai — Livre', version: '1.11.0' });
  const rows = lignesInventaire(preparerStock(BASE, []).filter((a) => a.choisi));
  const r1 = await importer(drive, classeur.id, fichierStock(rows, '2026-11-12').donnees);
  const r2 = await importer(drive, classeur.id, fichierStock(rows, '2026-11-12').donnees);
  assert.equal(r1.creees.inventaire, BASE.length);
  assert.equal(r2.creees.inventaire, 0);
  const inv = await lireOnglet(drive, classeur.id, 'Inventaire');
  assert.equal(inv.length, BASE.length);
  assert.equal(inv.find((l) => l.Nom === 'Sel').Essentiel, 'oui');
});
