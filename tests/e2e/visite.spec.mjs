// D-G-047, D-G-056 : visite dessinée sur demande (accueil, « Revoir la visite ») ; D-G-046 : thème Carnet par défaut.
import { test, expect } from '@playwright/test';
import { brancher } from './outils.mjs';
import { LIVRE } from './fixture.mjs';

function surveiller(page) {
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
  return erreurs;
}

test('D-G-056 : la visite ne s\'ouvre plus seule ; « Visite guidée » l\'ouvre et elle se parcourt', async ({ page }, info) => {
  const P = info.project.name, erreurs = surveiller(page);
  await brancher(page);
  await page.addInitScript(() => { try { localStorage.setItem('superchef-visite', 'cachee'); } catch (_) {} });   // clé de 1.16 à 1.22
  await page.goto('./');
  await expect(page.getByRole('button', { name: 'Se connecter avec Google' })).toBeVisible();
  await expect(page.locator('#visite')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('superchef-visite'))).toBeNull();   // l'ancienne clé est retirée
  await page.getByRole('button', { name: 'Visite guidée' }).click();
  const v = page.getByRole('dialog', { name: 'Bienvenue dans SuperChef.ai' });
  await expect(v).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-skin', 'carnet');      // D-G-046 : Carnet par défaut
  await expect(page.locator('#visite .vis-points button')).toHaveCount(9);
  await expect(page.getByLabel('Ne plus montrer cette visite')).toHaveCount(0);
  await page.screenshot({ path: `tests/captures/${P}-visite-1.png` });

  // Suivant / Précédent / flèches du clavier / points
  await page.getByRole('button', { name: 'Suivant' }).click();
  await expect(page.getByRole('heading', { name: 'Démarre ton livre' })).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('heading', { name: 'Trie tes nouvelles recettes' })).toBeVisible();
  await page.getByRole('button', { name: 'Précédent' }).click();
  await expect(page.getByRole('heading', { name: 'Démarre ton livre' })).toBeVisible();
  await page.getByRole('button', { name: /Scène 7 :/ }).click();
  await expect(page.getByRole('heading', { name: 'Cuisine une étape à la fois' })).toBeVisible();
  await expect(page.getByText('Visite guidée · 7 sur 9')).toBeVisible();
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `tests/captures/${P}-visite-7.png` });
  await page.getByRole('button', { name: /Scène 9 :/ }).click();
  await expect(page.getByRole('button', { name: 'Suivant' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Passer la visite' })).toHaveCount(0);
  await page.getByRole('button', { name: 'C\'est parti' }).click();
  await expect(page.locator('#visite')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Se connecter avec Google' })).toBeVisible();
  await expect(page.locator('#visite')).toHaveCount(0);                            // pas à chaque chargement
  await page.getByRole('button', { name: 'Visite guidée' }).click();
  await page.getByRole('button', { name: 'Passer la visite' }).click();
  await expect(page.locator('#visite')).toHaveCount(0);
  expect(erreurs).toEqual([]);
});

test('D-G-047 : « Revoir la visite » dans Compte, « Fermer la visite » la ferme', async ({ page }) => {
  const erreurs = surveiller(page);
  await brancher(page);
  await page.goto('./');
  await expect(page.locator('#visite')).toHaveCount(0);
  await page.getByRole('button', { name: 'Se connecter avec Google' }).click();
  await expect(page.locator('#comptesheet')).toBeVisible();
  await page.locator('#fichier-import').setInputFiles({ name: 'livre.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(LIVRE)) });
  await page.locator('#lancer-import').click();
  await expect(page.getByRole('heading', { name: 'Import terminé.' })).toBeVisible();
  await page.getByRole('button', { name: 'Revoir la visite' }).click();
  await expect(page.locator('#comptesheet')).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Bienvenue dans SuperChef.ai' })).toBeVisible();
  await page.getByRole('button', { name: 'Fermer la visite' }).click();
  await expect(page.locator('#visite')).toHaveCount(0);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
  expect(erreurs).toEqual([]);
});

test('D-G-046 : Carnet devient le thème de tout appareil une fois ; un choix fait ensuite est gardé', async ({ page }) => {
  await brancher(page);
  await page.addInitScript(() => { if (sessionStorage.getItem('deja')) return; sessionStorage.setItem('deja', '1'); localStorage.setItem('superchef-skin', 'magazine'); localStorage.setItem('superchef-theme-carnet', '1'); });
  await page.goto('./');
  await expect(page.locator('html')).toHaveAttribute('data-skin', 'carnet');
  await expect(page.locator('#skin')).toHaveValue('carnet');
  await page.locator('#skin').selectOption('ardoise');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-skin', 'ardoise');
  expect(await page.evaluate(() => localStorage.getItem('superchef-theme-carnet'))).toBeNull();
});
