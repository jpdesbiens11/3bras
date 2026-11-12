import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creerDrive } from '../../dist/js/drive.js';
import { ouvrirOuCreer, lireOnglet } from '../../dist/js/store.js';
import { valider, importer, estKitRepas, FORMAT } from '../../dist/js/import.js';
import { creerDriveSimule } from './drive-simule.mjs';

const fichier = (extra = {}) => ({
  format: FORMAT, version: 1, schema: 2, genere_le: '2026-11-06', source: 'test',
  recettes: [
    { id: 'r-a', Nom: 'Pâté chinois', Type: 'Souper', Statut: 'Au livre', 'Soir de semaine': true,
      Ingrédients: ['## Base', '500 g de bœuf haché', '1 oignon'], Étapes: ['Faire revenir.', 'Gratiner.'] },
    { id: 'r-b', Nom: 'Pad thaï', Type: 'Souper', Statut: 'À trier', 'À vérifier': 'Portions à confirmer' },
    { id: 'r-k', Nom: 'Poulet Goodfood', Type: 'Souper', Statut: 'À trier' }
  ],
  plans: [{ id: 'p-1', 'Semaine du': '2026-11-08', Jour: 'Dimanche', 'Recette id': 'r-a' }],
  inventaire: [{ id: 'i-1', Nom: 'Ail', Zone: 'Garde-manger', Essentiel: true }],
  bilans: [],
  ...extra
});

const preparer = async () => {
  const sim = creerDriveSimule();
  const drive = creerDrive({ jetonValide: async () => 'jeton-test', fetch: sim.fetch });
  const b = await ouvrirOuCreer(drive, { nomDossier: 'SuperChef.ai', nomClasseur: 'SuperChef.ai — Livre', version: '1.1.0' });
  return { sim, drive, id: b.classeur.id };
};

test('R-02 : un fichier valide passe', () => {
  const v = valider(JSON.stringify(fichier()));
  assert.deepEqual(v.erreurs, []);
  assert.equal(v.donnees.recettes.length, 3);
});

test('R-02 : refus clair des fichiers douteux, sans rien écrire', () => {
  assert.match(valider('pas du json').erreurs[0], /JSON/);
  assert.match(valider({ format: 'autre' }).erreurs[0], /SuperChef.ai/);
  const v = valider(fichier({
    recettes: [
      { id: 'r-a', Nom: 'X', '<img onerror>': 1 },
      { id: 'r-a', Nom: 'Doublon' },
      { id: 'mauvais id!', Nom: 'Y' },
      { id: 'r-c', Nom: '' },
      { id: 'r-d', Nom: 'Z', Ingrédients: { objet: true } },
      { id: 'r-e', Nom: 'Long', Étapes: 'x'.repeat(46000) }
    ],
    plans: [{ id: 'p-1', 'Recette id': 'r-inconnue' }]
  }));
  assert.equal(v.ok, false);
  const tout = v.erreurs.join('\n');
  for (const motif of [/colonne inconnue/, /id en double/, /id invalide/, /Nom manquant/, /type non permis/, /trop long/, /r-inconnue absente/]) assert.match(tout, motif);
  assert.match(valider(fichier({ schema: 99 })).erreurs[0], /schéma 99/);
});

test('R-15 : les kits repas sont repérés', () => {
  assert.equal(estKitRepas({ Nom: 'Poulet Goodfood' }), true);
  assert.equal(estKitRepas({ Nom: 'Bol', Source: 'Chef Cook It' }), true);
  assert.equal(estKitRepas({ Nom: 'Pâté chinois', Source: 'Famille' }), false);
  assert.equal(estKitRepas({ Nom: 'Biscuits', Notes: 'cookies' }), false);
});

test('R-02 : import, rapport, puis ré-import sans doublon', async () => {
  const { sim, drive, id } = await preparer();
  const { donnees } = valider(fichier());
  const r1 = await importer(drive, id, donnees);
  assert.deepEqual(r1.creees, { recettes: 2, plans: 1, inventaire: 1, bilans: 0 });
  assert.deepEqual(r1.kits, ['Poulet Goodfood']);
  assert.deepEqual(r1.aVerifier, ['Pad thaï']);

  const rec = await lireOnglet(drive, id, 'Recettes');
  assert.deepEqual(rec.map((r) => r.Nom), ['Pâté chinois', 'Pad thaï']);
  assert.equal(rec[0].Ingrédients, '## Base\n500 g de bœuf haché\n1 oignon');
  assert.equal(rec[0]['Soir de semaine'], 'oui');
  const inv = await lireOnglet(drive, id, 'Inventaire');
  assert.equal(inv[0].Essentiel, 'oui');

  const r2 = await importer(drive, id, donnees);
  assert.deepEqual(r2.creees, { recettes: 0, plans: 0, inventaire: 0, bilans: 0 });
  assert.equal(sim.classeurs.get(id).onglets.Recettes.length, 3, 'en-tête + 2 recettes, pas plus');
});

test('D-G-030 : les fichiers « 3ebras-import » d\'avant SuperChef.ai restent acceptés', () => {
  assert.equal(FORMAT, 'superchef-import');
  assert.deepEqual(valider(fichier({ format: '3ebras-import' })).erreurs, []);
  assert.deepEqual(valider(fichier({ format: 'superchef-import' })).erreurs, []);
});
