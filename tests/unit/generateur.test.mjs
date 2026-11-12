// D-G-035 : recettes de départ avec Claude — consigne, réponse collée, liste à cocher, import sans doublon.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { consigneGenerateur, lireReponse, preparerChoix, fichierImport, DEMANDE_VIDE } from '../../dist/js/generateur.js';
import { creerDrive } from '../../dist/js/drive.js';
import { ouvrirOuCreer, lireOnglet } from '../../dist/js/store.js';
import { importer, FORMAT } from '../../dist/js/import.js';
import { creerDriveSimule } from './drive-simule.mjs';
import { REPONSE_CLAUDE as REPONSE, ficheClaude as fiche } from '../e2e/fixture.mjs';

test('D-G-035 : la consigne reprend les choix de la famille et le format des fiches', () => {
  const c = consigneGenerateur({ ...DEMANDE_VIDE, cuisines: ['Italienne', 'Mexicaine', 'Klingon'], motsCles: 'mijoteuse,  réconfortant', nombre: 5, portions: 6, eviter: 'noix' }, ['Pâté chinois', 'Pâté chinois', 'Tacos']);
  assert.match(c, /Prépare 5 recettes/);
  assert.match(c, /Cuisines : Italienne, Mexicaine\n/);                 // seules les cuisines connues
  assert.match(c, /Mots-clés : mijoteuse, réconfortant/);
  assert.match(c, /- 6 portions par recette/);
  assert.match(c, /45 minutes ou moins/);
  assert.match(c, /À éviter.*: noix/);
  assert.match(c, /ne les propose pas : Pâté chinois ; Tacos\n/);
  assert.match(c, /UN SEUL bloc de code/);
  assert.match(c, /FICHE SUPERCHEF\nNom : …/);
  assert.match(c, /quantité utilisée/);                                  // D-G-032
  assert.doesNotMatch(consigneGenerateur({ ...DEMANDE_VIDE, nombre: 999 }), /999/);
  assert.doesNotMatch(consigneGenerateur(DEMANDE_VIDE), /ne les propose pas/);
});

test('D-G-035 : la réponse de Claude collée telle quelle devient une liste à cocher', () => {
  const { fiches, json } = lireReponse(REPONSE);
  assert.equal(json, null);
  assert.equal(fiches.length, 4);
  assert.equal(fiches[0].r.nom, 'Sauce bolognaise mijotée');
  assert.deepEqual(fiches[0].r.ingredients.map((g) => g.groupe), ['Sauce', 'Viande']);
  assert.deepEqual(fiches.map((f) => f.valide), [true, true, true, false]);

  const items = preparerChoix(fiches, ['Pâté chinois test'], { lot: 'Italienne · mijoteuse', jour: '2026-11-12' });
  assert.deepEqual(items.map((x) => [x.choisi, x.deja, x.kit]), [[true, false, false], [false, true, false], [false, false, true], [false, false, false]]);
  const row = items[0].row;
  assert.equal(row.id, 'g-sauce-bolognaise-mijotee');
  assert.equal(row.Statut, 'À trier');
  assert.equal(row.Cuisine, 'Italienne');
  assert.equal(row['Soir de semaine'], true);
  assert.deepEqual(row['Ingrédients'].slice(0, 2), ['## Sauce', '796 ml (28 oz) de tomates broyées']);
  assert.match(row.Notes[0], /Créée avec Claude \(Italienne · mijoteuse, 2026-11-12\)/);
  const v = fichierImport(items.filter((x) => x.row).map((x) => x.row), '2026-11-12');
  assert.deepEqual(v.erreurs, []);
});

test('D-G-035 : deux fiches du même nom gardent des ids distincts', () => {
  const { fiches } = lireReponse(`${fiche('Chili')}\n${fiche('Chili')}`);
  const items = preparerChoix(fiches, [], { lot: 'x', jour: '2026-11-12' });
  assert.deepEqual(items.map((x) => x.row.id), ['g-chili', 'g-chili-2']);
});

test('D-G-035 : un fichier d\'import JSON collé est aussi accepté', () => {
  const { json } = lireReponse(JSON.stringify({ format: FORMAT, version: 1, schema: 2, recettes: [{ id: 'r-a', Nom: 'A', Type: 'Souper' }] }));
  assert.equal(json.ok, true);
  assert.equal(json.donnees.recettes[0].Nom, 'A');
  assert.equal(lireReponse('').fiches.length, 0);
});

test('D-G-035 : recoller la même réponse n\'ajoute rien de plus au classeur', async () => {
  const sim = creerDriveSimule();
  const drive = creerDrive({ jetonValide: async () => 'jeton-test', fetch: sim.fetch });
  const { classeur } = await ouvrirOuCreer(drive, { nomDossier: 'SuperChef.ai', nomClasseur: 'SuperChef.ai — Livre', version: '1.9.0' });
  const rows = () => preparerChoix(lireReponse(REPONSE).fiches, [], { lot: 'x', jour: '2026-11-12' }).filter((x) => x.choisi).map((x) => x.row);
  const r1 = await importer(drive, classeur.id, fichierImport(rows(), '2026-11-12').donnees);
  const r2 = await importer(drive, classeur.id, fichierImport(rows(), '2026-11-12').donnees);
  assert.equal(r1.creees.recettes, 2);
  assert.equal(r2.creees.recettes, 0);
  assert.equal(r2.deja.recettes, 2);
  assert.deepEqual((await lireOnglet(drive, classeur.id, 'Recettes')).map((l) => l.Nom), ['Sauce bolognaise mijotée', 'Pâté chinois test']);
});

test('D-G-045 : la consigne de création reprend la demande, le type et le garde-manger', async () => {
  const { consigneCreation } = await import('../../dist/js/generateur.js');
  const c = consigneCreation('  un pâté chinois végé   pour 6 ', 'Souper', ['Lentilles', 'Maïs en crème', 'Lentilles']);
  assert.match(c, /Demande : « un pâté chinois végé pour 6 »/);
  assert.match(c, /Type : Souper/);
  assert.match(c, /Au garde-manger \(utilise-en le plus possible, sans obligation\) : Lentilles, Maïs en crème\n/);
  assert.match(c, /FICHE SUPERCHEF\nNom : …/);
  assert.match(c, /Source : Gemini/);
  assert.match(c, /quantité utilisée/);
  assert.doesNotMatch(consigneCreation('chili', 'Inventé'), /Au garde-manger/);
  assert.match(consigneCreation('chili', 'Inventé'), /Type : Souper/);
});

test('D-G-054 : la consigne Gemini demande 5 fiches seules, sans lien inventé, signées Gemini', async () => {
  const { consigneGemini, PAR_LOT_GEMINI, lireReponse, preparerChoix } = await import('../../dist/js/generateur.js');
  const c = consigneGemini({ cuisines: ['Italienne'], motsCles: 'mijoteuse', type: 'Souper', nombre: 20, portions: 6, soirs: true, eviter: 'noix' }, ['Lasagne de la maison']);
  assert.equal(PAR_LOT_GEMINI, 5);
  assert.match(c, /Prépare 5 recettes/);
  assert.match(c, /Cuisines : Italienne/);
  assert.match(c, /mijoteuse/);
  assert.match(c, /noix/);
  assert.match(c, /Lasagne de la maison/);                                     // pas de recette déjà au livre
  assert.match(c, /Lien : \(laisse vide : n'invente aucun lien\)/);
  assert.match(c, /Source : Gemini/);
  assert.doesNotMatch(c, /Lien : https/);
  assert.doesNotMatch(c, /consulter le web/);
  const { fiches } = lireReponse('FICHE SUPERCHEF\nNom : Risotto test\nType : Souper\nPortions : 4\nTemps total : 40 min\nSource : Gemini\n\nINGRÉDIENTS\n- 300 g de riz arborio\n\nÉTAPES\n1. Cuire 18 minutes.\n\nSOUS-CHEF\n- Mesurer le riz');
  const [x] = preparerChoix(fiches, [], { lot: 'Italienne', jour: '2026-11-12', par: 'Gemini' });
  assert.match(x.row.Notes[0], /Créée avec Gemini \(Italienne, 2026-11-12\)/);
});
