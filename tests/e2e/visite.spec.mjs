// D-G-047 : visite guidée à l'ouverture, « Ne plus montrer », « Revoir la visite » ; D-G-046 : thème Carnet par défaut.
import { test, expect } from '@playwright/test';
import { brancher } from './outils.mjs';
import { LIVRE } from './fixture.mjs';

function surveiller(page) {
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
  return erreurs;
}

test('D-G-047 : la visite s\'ouvre, se parcourt et ne revient plus une fois cochée', async ({ page }, info) => {
  const P = info.project.name, erreurs = surveiller(page);
  await brancher(page, { visite: true });
  await page.goto('./');
  const v = page.getByRole('dialog', { name: 'Bienvenue dans SuperChef.ai' });
  await expect(v).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-skin', 'carnet');      // D-G-046 : Carnet par défaut
  await expect(page.locator('#visite .vis-points button')).toHaveCount(9);
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

  // Sans cocher : fermée, mais elle revient au prochain chargement, rechargement compris (Ctrl+Maj+R, 1.18.0).
  await page.getByRole('button', { name: 'C\'est parti' }).click();
  await expect(page.locator('#visite')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('#visite')).toBeVisible();
  await page.getByRole('button', { name: 'Passer la visite' }).click();
  await page.getByRole('button', { name: 'Visite guidée' }).click();               // relancée depuis l'accueil
  await expect(page.getByRole('dialog', { name: 'Bienvenue dans SuperChef.ai' })).toBeVisible();
  await page.keyboard.press('Escape');
  const p2 = await page.context().newPage();
  await brancher(p2, { visite: true });
  await p2.goto('./');
  await expect(p2.locator('#visite')).toBeVisible();
  await p2.getByLabel('Ne plus montrer cette visite').check();
  await p2.keyboard.press('Escape');
  await expect(p2.locator('#visite')).toHaveCount(0);
  expect(await p2.evaluate(() => localStorage.getItem('superchef-visite'))).toBe('cachee');
  const p3 = await page.context().newPage();
  await brancher(p3, { visite: true });
  await p3.goto('./');
  await expect(p3.getByRole('button', { name: 'Se connecter avec Google' })).toBeVisible();
  await expect(p3.locator('#visite')).toHaveCount(0);
  expect(erreurs).toEqual([]);
});

test('D-G-047 : « Revoir la visite » dans Compte, « Passer la visite » la ferme', async ({ page }) => {
  const erreurs = surveiller(page);
  await brancher(page, { visite: true });
  await page.goto('./');
  await page.getByRole('button', { name: 'Passer la visite' }).click();
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
