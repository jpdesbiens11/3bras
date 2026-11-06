// Bout en bout de la vue Entrée, Google entièrement simulé (aucun réseau sortant).
import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { creerDriveSimule } from '../unit/drive-simule.mjs';

const FAUX_GIS = `
window.google = { accounts: { oauth2: {
  initTokenClient: (cfg) => ({ requestAccessToken: () =>
    setTimeout(() => cfg.callback({ access_token: 'jeton-test', expires_in: 3600 }), 50) }),
  revoke: (j, cb) => cb && cb()
} } };`;

async function brancher(page, { clientId = 'client-test.apps.googleusercontent.com' } = {}) {
  const sim = creerDriveSimule();
  const sorties = [];
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === 'localhost') {
      if (url.pathname.endsWith('/js/config.js')) {
        const src = await readFile(new URL('../../dist/js/config.js', import.meta.url), 'utf8');
        return route.fulfill({ contentType: 'text/javascript', body: src.replace("clientId: ''", `clientId: '${clientId}'`) });
      }
      return route.continue();
    }
    sorties.push(url.hostname);
    if (url.href.startsWith('https://accounts.google.com/gsi/client')) {
      return route.fulfill({ contentType: 'text/javascript', body: FAUX_GIS });
    }
    if (/googleapis\.com$/.test(url.hostname)) {
      const req = route.request();
      const rep = await sim.fetch(url.href, { method: req.method(), headers: req.headers().authorization
        ? { Authorization: req.headers().authorization } : {}, body: req.postData() || undefined });
      return route.fulfill({ status: rep.status, contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(await rep.json()) });
    }
    return route.abort();
  });
  return { sim, sorties };
}

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
  await expect(page.getByRole('heading', { name: 'Ton troisième bras est prêt.' })).toBeVisible();
  await expect(page.getByText('Dossier et classeur créés dans ton Drive.')).toBeVisible();
  await expect(page.getByText('Connecté : jp@exemple.ca')).toBeVisible();
  const lien = page.getByRole('link', { name: 'Ouvrir le classeur' });
  await expect(lien).toHaveAttribute('href', /^https:\/\/docs\.google\.com\/spreadsheets\/d\/f\d+\/edit$/);
  await page.screenshot({ path: `tests/captures/${info.project.name}-pret.png` });

  expect(sim.fichiers.map((f) => f.name).sort()).toEqual(['3eBras', '3eBras — Livre', 'Exports', 'Fiches', 'Photos']);
  expect([...new Set(sorties)].sort()).toEqual(['accounts.google.com', 'sheets.googleapis.com', 'www.googleapis.com']);
  expect(erreurs).toEqual([]);

  // N-02 : rien dans le stockage du navigateur.
  const stockage = await page.evaluate(() => ({ l: localStorage.length, s: sessionStorage.length, c: document.cookie }));
  expect(stockage).toEqual({ l: 0, s: 0, c: '' });

  // N-08 : cibles d'au moins 44 px.
  for (const b of await page.locator('.bouton').all()) {
    expect((await b.boundingBox()).height).toBeGreaterThanOrEqual(44);
  }
});

test('ID client absent : message clair, pas de bouton', async ({ page }) => {
  await brancher(page, { clientId: '' });
  await page.goto('./');
  await expect(page.getByRole('alert')).toContainText('ID client Google');
  await expect(page.getByRole('button')).toHaveCount(0);
});
