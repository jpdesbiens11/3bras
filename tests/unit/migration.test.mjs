import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creerDrive } from '../../dist/js/drive.js';
import { ouvrirOuCreer, lireOnglet } from '../../dist/js/store.js';
import { ONGLETS, VERSION_SCHEMA, colonnesManquantes, onglet } from '../../dist/js/schema.js';
import { creerDriveSimule } from './drive-simule.mjs';

const OPTS = { nomDossier: 'SuperChef.ai', nomClasseur: 'SuperChef.ai — Livre', version: '1.1.0' };
const V1 = {
  Recettes: ['id', 'Nom', 'Type', 'Statut', 'Protéine', 'Cuisine', 'Soir de semaine', 'Temps total (min)', 'Portions', 'Jour fixe', 'Dernière fois cuisinée', 'Note globale /10', 'Outils', 'Étiquettes', 'Source', 'Ingrédients', 'Étapes'],
  'Plans de semaine': ['id', 'Semaine du', 'Jour', 'Recette id', 'Épinglé', 'Dessert', 'Notes'],
  Inventaire: ['id', 'Nom', 'Zone', 'Quantité', 'Unité', 'Déjà à la maison'],
  Bilans: ['id', 'Date', 'Recette id', 'Note /10', 'Commentaire'],
  'Schéma': ['clé', 'valeur']
};

test('P-4 : un classeur v1 passe en v2 en ajoutant des colonnes à la fin seulement', async () => {
  const sim = creerDriveSimule();
  const id = sim.classeurV1(V1);
  // Une recette déjà saisie à la main en v1 doit survivre intacte.
  sim.classeurs.get(id).onglets.Recettes.push(['r-1', 'Pâté chinois', 'Souper']);
  const drive = creerDrive({ jetonValide: async () => 'jeton-test', fetch: sim.fetch });

  const r = await ouvrirOuCreer(drive, OPTS);
  assert.deepEqual(r.migration, { avant: 1, apres: VERSION_SCHEMA, ajouts: 10 + 2 + 2 + 6 });
  const c = sim.classeurs.get(id);
  for (const o of ONGLETS) {
    assert.deepEqual(c.onglets[o.titre][0], o.colonnes, o.titre);
    assert.deepEqual(c.onglets[o.titre][0].slice(0, V1[o.titre].length), V1[o.titre], `${o.titre} : préfixe v1 intact`);
  }
  assert.deepEqual(c.onglets.Recettes[1].slice(0, 3), ['r-1', 'Pâté chinois', 'Souper']);
  assert.deepEqual(c.onglets['Schéma'][1], ['version_schema', '2']);
  assert.equal(c.onglets['Schéma'].length, 4, 'pas de ligne de version en double');

  const rec = await lireOnglet(drive, id, 'Recettes');
  assert.equal(rec[0].Nom, 'Pâté chinois');
  assert.equal(rec[0]['Tâches sous-chef'], '');
});

test('P-4 : deuxième ouverture, rien à migrer', async () => {
  const sim = creerDriveSimule();
  sim.classeurV1(V1);
  const drive = creerDrive({ jetonValide: async () => 'jeton-test', fetch: sim.fetch });
  await ouvrirOuCreer(drive, OPTS);
  const avant = sim.appels.length;
  const r = await ouvrirOuCreer(drive, OPTS);
  assert.equal(r.migration.ajouts, 0);
  assert.ok(!sim.appels.slice(avant).some((a) => a.methode === 'POST'), 'aucune écriture');
});

test('P-4 : un en-tête renommé à la main bloque la migration au lieu d\'écraser', () => {
  const entete = [...V1.Recettes]; entete[1] = 'Titre';
  assert.throws(() => colonnesManquantes(onglet('Recettes'), entete), /migration additive est impossible/);
});
