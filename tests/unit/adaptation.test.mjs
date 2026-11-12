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
