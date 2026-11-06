import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTexte, parseLoose } from '../../dist/js/lecture.js';

test('texte collé avec sections : nom, groupes, ingrédients, étapes, portions, temps', () => {
  const r = parseTexte(`Poulet au citron
Portions : 4
Préparation : 15 min
Cuisson : 25 min

Ingrédients
Marinade :
- 2 c. à soupe d'huile d'olive
- 1 citron
Plat :
- 4 hauts de cuisse de poulet

Préparation
1. Mélanger la marinade.
2. Cuire le poulet 25 minutes.
   Servir chaud.`, 'Souper');
  assert.equal(r.nom, 'Poulet au citron');
  assert.deepEqual(r.ingredients.map((g) => g.groupe), ['Marinade', 'Plat']);
  assert.deepEqual(r.ingredients[0].items, ['2 c. à soupe d\'huile d\'olive', '1 citron']);
  assert.deepEqual(r.etapes, ['Mélanger la marinade.', 'Cuire le poulet 25 minutes. Servir chaud.']);
  assert.equal(r.portions, 4);
  assert.equal(r.temps, 40);
  assert.equal(r.proteine, 'Poulet');
});

test('texte sans sections : quantités = ingrédients, phrases = étapes', () => {
  const r = parseTexte('Salade rapide\n2 tomates\n1 concombre\nCouper les légumes et mélanger.', 'Accompagnement');
  assert.deepEqual(r.ingredients[0].items, ['2 tomates', '1 concombre']);
  assert.deepEqual(r.etapes, ['Couper les légumes et mélanger.']);
});

test('réponse de Claude collée, avec ou sans bloc de code', () => {
  assert.equal(parseLoose('Voici :\n```json\n{"nom":"Pad thaï"}\n```').nom, 'Pad thaï');
  assert.equal(parseLoose('bla {"nom":"X","etapes":[]} bla').nom, 'X');
  assert.equal(parseLoose('pas du json'), null);
});

test('Fiche 3Bras du projet Claude : toutes les propriétés sont lues', async () => {
  const { readFileSync } = await import('node:fs');
  const doc = readFileSync(new URL('../../docs/projet-claude-3bras.md', import.meta.url), 'utf8');
  const fiche = doc.split('```')[1];                     // l'exemple des instructions du projet
  const r = parseTexte(fiche, 'Dessert');
  assert.equal(r.nom, 'Pâté chinois');
  assert.equal(r.type, 'Souper');
  assert.equal(r.proteine, 'Bœuf');
  assert.equal(r.cuisine, 'Québécoise');
  assert.equal(r.portions, 4);
  assert.equal(r.temps, 80);
  assert.deepEqual(r.outils, ['Four']);
  assert.equal(r.source_cat, 'Ricardo');
  assert.equal(r.lien, 'https://www.ricardocuisine.com/recettes/5541-pate-chinois');
  assert.deepEqual(r.ingredients.map((g) => [g.groupe, g.items.length]), [['Purée', 3], ['Étages', 3]]);
  assert.equal(r.etapes.length, 6);
  assert.equal(r.etapes[5], 'Cuire au four 30 minutes.');
  assert.deepEqual(r.sous, ['Ouvrir la boîte de maïs avec un adulte', 'Étendre la purée avec une spatule']);
  assert.equal(r.a_verifier, ''); // « (rien…) » = rien à vérifier
});
