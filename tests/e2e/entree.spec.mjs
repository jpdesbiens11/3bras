// Bout en bout de la vue Entrée, Google entièrement simulé (aucun réseau sortant).
import { test, expect } from '@playwright/test';
import { brancher } from './outils.mjs';

test('R-01 : connexion, création du dossier et du classeur', async ({ page }, info) => {
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
  const { sim, sorties } = await brancher(page);

  await page.goto('./');
  const bouton = page.getByRole('button', { name: 'Se connecter avec Google' });
  await expect(bouton).toBeEnabled();
  await page.screenshot({ path: `tests/captures/${info.project.name}-accueil.png` });

  await bouton.click();
  await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Le livre est vide (pour l\'instant).' })).toBeVisible();
  await page.screenshot({ path: `tests/captures/${info.project.name}-livre-vide.png` });

  expect(sim.fichiers.map((f) => f.name).sort()).toEqual(['3eBras', '3eBras — Livre', 'Exports', 'Fiches', 'Photos']);
  expect([...new Set(sorties)].sort()).toEqual(['accounts.google.com', 'sheets.googleapis.com', 'www.googleapis.com']);
  expect(erreurs).toEqual([]);

  // N-02 : rien dans le stockage du navigateur.
  const stockage = await page.evaluate(() => ({ l: localStorage.length, s: sessionStorage.length, c: document.cookie }));
  expect(stockage).toEqual({ l: 0, s: 0, c: '' });

  // N-08 : cibles d'au moins 44 px.
  for (const b of await page.locator('.bouton:visible, .nav-item:visible').all()) {
    expect((await b.boundingBox()).height).toBeGreaterThanOrEqual(44);
  }
});

test('ID client absent : message clair, pas de bouton', async ({ page }) => {
  await brancher(page, { clientId: '' });
  await page.goto('./');
  await expect(page.getByRole('alert')).toContainText('ID client Google');
  await expect(page.getByRole('button')).toHaveCount(0);
});
