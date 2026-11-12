import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creerDrive, ErreurGoogle } from '../../dist/js/drive.js';
import { ouvrirOuCreer } from '../../dist/js/store.js';
import { ONGLETS, lettre, VERSION_SCHEMA } from '../../dist/js/schema.js';
import { creerDriveSimule } from './drive-simule.mjs';

const OPTS = { nomDossier: 'SuperChef.ai', nomClasseur: 'SuperChef.ai — Livre', version: '1.0.0' };
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
  assert.deepEqual(noms, ['Exports', 'Fiches', 'Photos', 'SuperChef.ai', 'SuperChef.ai — Livre']);
  const dossier = sim.fichiers.find((f) => f.name === 'SuperChef.ai');
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

// D-G-030 : un livre créé sous 3eBras/3Bras est retrouvé par son étiquette et prend le nom SuperChef.ai.
const V1_MIN = { Recettes: ['id', 'Nom'], 'Plans de semaine': ['id'], Inventaire: ['id'], Bilans: ['id'], 'Schéma': ['clé', 'valeur'] };

test('D-G-030 : un livre 3eBras retrouvé prend le nom SuperChef.ai, sans rien recréer', async () => {
  const sim = creerDriveSimule();
  const id = sim.classeurV1(V1_MIN);
  const drive = creerDrive({ jetonValide: async () => 'jeton-test', fetch: sim.fetch });
  const avant = sim.fichiers.length;
  const r = await ouvrirOuCreer(drive, OPTS);
  assert.equal(r.nouveau, false);
  assert.equal(r.classeur.id, id);
  assert.equal(r.classeur.name, 'SuperChef.ai — Livre');
  assert.equal(r.dossier.name, 'SuperChef.ai');
  assert.deepEqual(sim.fichiers.map((f) => f.name).sort(), ['SuperChef.ai', 'SuperChef.ai — Livre']);
  assert.equal(sim.fichiers.length, avant);
  assert.equal(sim.fichiers.find((f) => f.id === id).appProperties['3ebras'], 'livre', 'étiquette technique gardée');
});

test('D-G-030 : un nom choisi par la personne n\'est jamais touché', async () => {
  const sim = creerDriveSimule();
  const id = sim.classeurV1(V1_MIN);
  sim.fichiers.find((f) => f.id === id).name = 'Recettes de la famille';
  const drive = creerDrive({ jetonValide: async () => 'jeton-test', fetch: sim.fetch });
  const r = await ouvrirOuCreer(drive, OPTS);
  assert.equal(r.classeur.name, 'Recettes de la famille');
  assert.equal(sim.appels.filter((a) => a.methode === 'PATCH' && a.url.includes(id)).length, 0);
});

test('D-G-030 : un renommage refusé par Google ne bloque pas l\'ouverture du livre', async () => {
  const sim = creerDriveSimule();
  const id = sim.classeurV1(V1_MIN);
  const fetch = (url, o = {}) => (o.method === 'PATCH' ? Promise.resolve(new Response('{}', { status: 403 })) : sim.fetch(url, o));
  const drive = creerDrive({ jetonValide: async () => 'jeton-test', fetch });
  const r = await ouvrirOuCreer(drive, OPTS);
  assert.equal(r.classeur.id, id);
  assert.equal(r.classeur.name, '3eBras — Livre');
});

// D-G-040 : Recommencer à neuf.
test('D-G-040 : recommencer vide les 4 onglets de données et remet les titres, même effacés', async () => {
  const { reinitialiser } = await import('../../dist/js/store.js');
  const { sim, drive } = preparer();
  const r = await ouvrirOuCreer(drive, OPTS);
  const c = sim.classeurs.get(r.classeur.id);
  c.onglets.Recettes = [['k-quebecois-pate', 'Pâté chinois']];                   // 1re ligne de titres effacée
  c.onglets.Inventaire.push(['i-sel', 'Sel']);
  c.onglets['Plans de semaine'].push(['p-1', '2026-11-08']);
  delete c.onglets.Bilans; c.sheets = c.sheets.filter((s) => s.properties.title !== 'Bilans'); // onglet supprimé
  const schemaAvant = JSON.stringify(c.onglets['Schéma']);
  await reinitialiser(drive, r.classeur.id);
  for (const o of ONGLETS.filter((x) => x.titre !== 'Schéma')) assert.deepEqual(c.onglets[o.titre], [o.colonnes], o.titre);
  assert.equal(JSON.stringify(c.onglets['Schéma']), schemaAvant, 'onglet Schéma intact');
  assert.equal(sim.fichiers.length, 5, 'aucun fichier créé ni supprimé');
  const second = await ouvrirOuCreer(drive, OPTS);
  assert.equal(second.nouveau, false);
  assert.equal(second.classeur.id, r.classeur.id);
});
