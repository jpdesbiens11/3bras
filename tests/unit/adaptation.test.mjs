// D-G-033 : adapter une recette avec Gemini, garder l'originale, y revenir.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { consigneAdaptation, valeursAdaptees, valeursOriginales, valeursActuelles, RACCOURCIS } from '../../dist/js/adaptation.js';
import { parseTexte, ficheTexte } from '../../dist/js/lecture.js';
import { ficheDeLigne } from '../../dist/js/cuisine.js';

const ROW = { id: 'r-gratin', Nom: 'Gratin', 'Ingrédients': '## Base\n30 ml de beurre\n4 pommes de terre', 'Étapes': 'Fondre le beurre.\nCuire 30 minutes.', Portions: '4', 'Temps total (min)': '45', 'Tâches sous-chef': 'Laver les patates', 'À vérifier': '', Originale: '', Adaptations: '' };
const RECETTE = { name: 'Gratin', type: 'Souper', prot: 'Végé', portions: 4, time: 45, ingText: ROW['Ingrédients'], stepsText: ROW['Étapes'], sous: ROW['Tâches sous-chef'] };

test('D-G-033 : la fiche envoyée à Gemini se relit à l\'identique', () => {
  const texte = ficheTexte(RECETTE, ficheDeLigne(RECETTE));
  const r = parseTexte(texte, 'Dessert');
  assert.equal(r.nom, 'Gratin');
  assert.equal(r.type, 'Souper');
  assert.equal(r.portions, 4);
  assert.equal(r.temps, 45);
  assert.deepEqual(r.ingredients, [{ groupe: 'Base', items: ['30 ml de beurre', '4 pommes de terre'] }]);
  assert.deepEqual(r.etapes, ['Fondre le beurre.', 'Cuire 30 minutes.']);
  assert.deepEqual(r.sous, ['Laver les patates']);
  const c = consigneAdaptation(texte, 'Pour 6 portions.');
  assert.match(c, /« Pour 6 portions\. »/);
  assert.ok(c.includes(texte));
  assert.match(c, /CHANGEMENTS/);
  assert.equal(RACCOURCIS[0][0], 'Quantités dans les étapes');
});

test('D-G-033 : la version adaptée remplace la recette, l\'originale est gardée une fois', () => {
  const res = parseTexte('FICHE SUPERCHEF\nNom : Gratin\nPortions : 6\nTemps total : 50 min\n\nINGRÉDIENTS\n- 45 ml de beurre\n- 6 pommes de terre\n\nÉTAPES\n1. Fondre 45 ml de beurre.\n2. Cuire 35 minutes.\n\nCHANGEMENTS\n- Quantités pour 6\n- Cuisson +5 min', 'Souper');
  assert.deepEqual(res.changements, ['Quantités pour 6', 'Cuisson +5 min']);
  const v = valeursAdaptees(ROW, res, 'Pour 6 portions.', '2026-11-12');
  assert.deepEqual(v['Ingrédients'], ['45 ml de beurre', '6 pommes de terre']);
  assert.deepEqual(v['Étapes'], ['Fondre 45 ml de beurre.', 'Cuire 35 minutes.']);
  assert.equal(v.Portions, 6);
  assert.equal(v['Temps total (min)'], 50);
  assert.equal(v.Adaptations, '2026-11-12 · Pour 6 portions. → Quantités pour 6 ; Cuisson +5 min');
  assert.deepEqual(JSON.parse(v.Originale), { le: '2026-11-12', 'Ingrédients': ROW['Ingrédients'], 'Étapes': ROW['Étapes'], Portions: '4', 'Temps total (min)': '45', 'Tâches sous-chef': 'Laver les patates' });
  assert.ok(!('Tâches sous-chef' in v), 'sous-chef gardé quand Gemini n\'en donne pas');

  // Deuxième adaptation : l'originale n'est pas écrasée, l'historique s'allonge.
  const deja = { ...ROW, Originale: v.Originale, Adaptations: v.Adaptations };
  const v2 = valeursAdaptees(deja, res, 'Moins salé.', '2026-11-13');
  assert.ok(!('Originale' in v2));
  assert.equal(v2.Adaptations.split('\n').length, 2);
});

test('D-G-033 : revenir à l\'originale, puis annuler', () => {
  const v = valeursAdaptees(ROW, parseTexte('INGRÉDIENTS\n- 1 patate\n\nÉTAPES\n1. Cuire.', 'Souper'), 'Simplifier', '2026-11-12');
  const adaptee = { ...ROW, ...v, 'Ingrédients': '1 patate', 'Étapes': 'Cuire.' };
  const retour = valeursOriginales(adaptee, '2026-11-14');
  assert.equal(retour['Ingrédients'], ROW['Ingrédients']);
  assert.equal(retour['Étapes'], ROW['Étapes']);
  assert.equal(retour.Portions, '4');
  assert.match(retour.Adaptations, /2026-11-14 · retour à la recette originale$/);
  assert.equal(valeursActuelles(adaptee)['Ingrédients'], '1 patate');
  assert.equal(valeursOriginales(ROW, '2026-11-14'), null, 'rien de gardé');
  assert.equal(valeursOriginales({ ...ROW, Originale: '{pas du json' }, '2026-11-14'), null);
  assert.equal(valeursOriginales({ ...ROW, Originale: '["x"]' }, '2026-11-14'), null);
});

test('D-G-036 : au poêle, la consigne dit à quelle étape la famille est rendue', async () => {
  const { RACCOURCIS_CUISSON } = await import('../../dist/js/adaptation.js');
  const c = consigneAdaptation('FICHE SUPERCHEF', 'Il me manque la crème', 3);
  assert.match(c, /rendue à l'étape 3\. Ne change pas les étapes déjà faites \(1 à 2\)/);
  const c1 = consigneAdaptation('FICHE SUPERCHEF', 'Il me manque la crème', 1);
  assert.match(c1, /rendue à l'étape 1\. Garde le même nombre d'étapes/);
  assert.doesNotMatch(consigneAdaptation('FICHE SUPERCHEF', 'Moins sucré.'), /rendue à l'étape/);
  assert.deepEqual(RACCOURCIS_CUISSON.map(([l]) => l), ['Il me manque…', 'Remplacer…', 'Moins de temps']);
});

test('D-G-044 : la fiche modifiée à la main garde l\'originale une fois et note le changement', async () => {
  const { valeursTexte, valeursOriginales } = await import('../../dist/js/adaptation.js');
  const v = valeursTexte(ROW, { ing: ['## Base', '45 ml de beurre'], etapes: ['Fondre le beurre 2 minutes.'], sous: [] }, '2026-11-12');
  assert.deepEqual(v['Ingrédients'], ['## Base', '45 ml de beurre']);
  assert.equal(v['Fiche complète'], true);
  assert.equal(v.Adaptations, '2026-11-12 · modifiée à la main');
  assert.equal(JSON.parse(v.Originale)['Ingrédients'], ROW['Ingrédients']);
  const apres = { ...ROW, ...v, 'Ingrédients': v['Ingrédients'].join('\n') };
  assert.ok(!('Originale' in valeursTexte(apres, { ing: ['x'], etapes: ['y'], sous: [] }, '2026-11-13')), 'originale gardée une seule fois');
  assert.equal(valeursOriginales(apres, '2026-11-14')['Ingrédients'], ROW['Ingrédients']);
});

test('D-G-044 : doublons de recettes, du même type seulement', async () => {
  const { doublonRecette } = await import('../../dist/js/doublons.js');
  const b = [{ name: 'Poulet au beurre', type: 'Souper' }, { name: 'Pouding chômeur', type: 'Dessert' }, { name: 'Poulet au beurre (butter chicken)', type: 'Souper' }, { name: 'pouding chomeur', type: 'Souper' }];
  assert.equal(doublonRecette(b[2], b), b[0]);
  assert.equal(doublonRecette(b[3], b), null, 'même nom mais autre type');
  assert.equal(doublonRecette(b[0], b), null);
});
