import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creerDrive, ErreurGoogle } from '../../dist/js/drive.js';
import { ouvrirOuCreer } from '../../dist/js/store.js';
import { ONGLETS, lettre, VERSION_SCHEMA } from '../../dist/js/schema.js';
import { creerDriveSimule } from './drive-simule.mjs';

const OPTS = { nomDossier: '3eBras', nomClasseur: '3eBras — Livre', version: '1.0.0' };
const preparer = (jeton = 'jeton-test') => {
  const sim = creerDriveSimule();
  const drive = creerDrive({ jetonValide: async () => jeton, fetch: sim.fetch });
  return { sim, drive };
};

test('R-01 : première visite, crée dossier, sous-dossiers et classeur', async () => {
  const { sim, drive } = preparer();
  const etapes = [];
  const r = await ouvrirOuCreer(drive, OPTS, (e) => etapes.push(e));
  assert.equal(r.nouveau, true);
  assert.deepEqual(etapes, ['recherche', 'creation']);
  const noms = sim.fichiers.map((f) => f.name).sort();
  assert.deepEqual(noms, ['3eBras', '3eBras — Livre', 'Exports', 'Fiches', 'Photos']);
  const dossier = sim.fichiers.find((f) => f.name === '3eBras');
  for (const f of sim.fichiers.filter((x) => x !== dossier)) assert.deepEqual(f.parents, [dossier.id]);
});

test('R-01 : onglets et en-têtes écrits, version de schéma notée', async () => {
  const { sim, drive } = preparer();
  const r = await ouvrirOuCreer(drive, OPTS);
  const c = sim.classeurs.get(r.classeur.id);
  assert.deepEqual(c.sheets.map((s) => s.properties.title), ONGLETS.map((o) => o.titre));
  assert.deepEqual(c.onglets.Recettes[0], ONGLETS[0].colonnes);
  assert.deepEqual(c.onglets['Schéma'][1], ['version_schema', String(VERSION_SCHEMA)]);
});

test('R-01 : deuxième visite, retrouve le classeur sans rien recréer', async () => {
  const { sim, drive } = preparer();
  const premier = await ouvrirOuCreer(drive, OPTS);
  const avant = sim.fichiers.length;
  const second = await ouvrirOuCreer(drive, OPTS);
  assert.equal(second.nouveau, false);
  assert.equal(second.classeur.id, premier.classeur.id);
  assert.equal(sim.fichiers.length, avant);
});

test('N-04 : chaque appel porte le jeton, et seulement vers les API Google', async () => {
  const { sim, drive } = preparer();
  await ouvrirOuCreer(drive, OPTS);
  for (const a of sim.appels) {
    assert.equal(a.auth, 'Bearer jeton-test');
    assert.match(new URL(a.url).host, /^(www|sheets)\.googleapis\.com$/);
  }
});

test('jeton refusé : erreur Google claire', async () => {
  const { drive } = preparer('mauvais');
  await assert.rejects(ouvrirOuCreer(drive, OPTS), (e) => e instanceof ErreurGoogle && e.statut === 401);
});

test('lettre de colonne', () => {
  assert.equal(lettre(1), 'A');
  assert.equal(lettre(17), 'Q');
  assert.equal(lettre(52), 'AZ');
  assert.equal(lettre(27), 'AA');
});
