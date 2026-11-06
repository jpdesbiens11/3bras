// Import puis lecture du livre, Google simulé.
import { test, expect } from '@playwright/test';
import { brancher } from './outils.mjs';

const FICHIER = {
  format: '3ebras-import', version: 1, schema: 2, genere_le: '2026-11-06', source: 'test',
  recettes: [
    { id: 'r-a', Nom: 'Brochettes de bœuf', Type: 'Souper', Statut: 'Au livre', Protéine: 'Bœuf', 'Temps total (min)': 30,
      Portions: 8, Source: 'Ricardo', 'Lien source': 'https://www.ricardocuisine.com/recettes/7294',
      Ingrédients: ['## Marinade', '75 ml d\'huile d\'olive', '2 gousses d\'ail', '## Brochettes', '1 kg de bœuf'],
      Étapes: ['Mélanger la marinade.', 'Griller 4 minutes par côté.'], 'Tâches sous-chef': ['Enfiler les cubes'] },
    { id: 'r-b', Nom: 'Pad thaï', Type: 'Souper', Statut: 'À trier', Protéine: 'Poulet', 'À vérifier': 'Portions à confirmer',
      Ingrédients: ['200 g de nouilles de riz'], Étapes: ['Tremper les nouilles.'] },
    { id: 'r-c', Nom: '<img src=x onerror=alert(1)>', Type: 'Dessert', Statut: 'À trier' },
    { id: 'r-d', Nom: 'Vieux pâté', Type: 'Souper', Statut: 'Déclassée' },
    { id: 'r-k', Nom: 'Bol Goodfood', Type: 'Souper', Statut: 'À trier' }
  ],
  plans: [], inventaire: [{ id: 'i-1', Nom: 'Ail', Zone: 'Garde-manger' }], bilans: []
};

test('R-02 + R-03 : importer le fichier puis lire une fiche', async ({ page }, info) => {
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  page.on('dialog', () => erreurs.push('dialog ouvert : injection exécutée'));
  await brancher(page);
  await page.goto('./');
  await page.getByRole('button', { name: 'Se connecter avec Google' }).click();
  await page.getByRole('button', { name: 'Importer', exact: true }).click();

  await page.locator('#fichier-import').setInputFiles({ name: 'import.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(FICHIER)) });
  await expect(page.getByText('Le fichier est valide.')).toBeVisible();
  await page.getByRole('button', { name: 'Importer dans mon classeur' }).click();
  await expect(page.getByRole('heading', { name: 'Import terminé.' })).toBeVisible();
  await expect(page.getByText('Créés : 4 recettes')).toBeVisible();
  await expect(page.getByText('1 recette de kit repas ignorée')).toBeVisible();
  await page.screenshot({ path: `tests/captures/${info.project.name}-import.png`, fullPage: true });

  await page.getByRole('button', { name: 'Ouvrir le livre' }).click();
  await expect(page.getByText('3 sur 4 recettes')).toBeVisible();          // déclassée cachée par défaut
  await expect(page.getByText('<img src=x onerror=alert(1)>')).toBeVisible(); // affiché comme texte
  await page.getByRole('searchbox').fill('ail');
  await expect(page.getByText('1 sur 4 recettes')).toBeVisible();          // trouve par ingrédient
  await page.getByRole('searchbox').fill('');
  await page.getByRole('combobox', { name: 'Statut' }).selectOption('Au livre');
  await page.getByRole('button', { name: /Brochettes de bœuf/ }).click();
  await expect(page.getByRole('heading', { name: 'Brochettes de bœuf', level: 2 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Marinade', level: 4 })).toBeVisible();
  await expect(page.getByRole('link', { name: 'voir la recette d\'origine' })).toHaveAttribute('href', /^https:\/\/www\.ricardocuisine\.com/);
  await page.screenshot({ path: `tests/captures/${info.project.name}-fiche.png`, fullPage: true });
  expect(erreurs).toEqual([]);
});
