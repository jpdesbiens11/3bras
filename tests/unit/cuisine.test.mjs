// D-G-032 : un ingrédient partagé entre plusieurs étapes d'Au poêle montre la portion de chaque étape.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { portionDansEtape, keywords, stepPlan, ficheDeLigne } from '../../dist/js/cuisine.js';

const ing = (t) => ({ text: t, kw: keywords(t) });

test('D-G-032 : la portion écrite dans l\'étape est retrouvée telle qu\'écrite', () => {
  const cas = [
    ['Fondre 15 ml (1 c. à soupe) de beurre dans une poêle.', '30 ml (2 c. à soupe) de beurre', '15 ml (1 c. à soupe) de beurre'],
    ['Ajouter la moitié du fromage râpé.', '250 ml (1 tasse) de fromage râpé', 'la moitié du fromage'],
    ['Ajouter le reste du beurre et fouetter.', '30 ml de beurre', 'le reste du beurre'],
    ['Incorporer 125 ml de crème et mijoter 10 minutes.', '250 ml (1 tasse) de crème 35 %', '125 ml de crème'],
    ['Saupoudrer de 30 g de parmesan.', '60 g de parmesan', '30 g de parmesan']
  ];
  for (const [etape, ligne, attendu] of cas) assert.equal(portionDansEtape(etape, ing(ligne)), attendu, etape);
});

test('D-G-032 : sans quantité dans l\'étape, aucune portion inventée', () => {
  assert.equal(portionDansEtape('Faire revenir l\'oignon 5 minutes.', ing('1 oignon, haché')), null);
  assert.equal(portionDansEtape('Ajouter le beurre.', ing('30 ml de beurre')), null);
  assert.equal(portionDansEtape('Cuire 25 minutes.', ing('30 ml de beurre')), null);
});

test('D-G-032 : stepPlan dit à quelles étapes sert chaque ingrédient', () => {
  const d = ficheDeLigne({ ingText: '30 ml de beurre\n1 oignon', stepsText: 'Fondre 15 ml de beurre.\nAjouter l\'oignon.\nAjouter le reste du beurre.' });
  assert.deepEqual(stepPlan(d).usage, [[0, 2], [1]]);
});
