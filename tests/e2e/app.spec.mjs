// Parcours complet dans les 6 étapes, Google simulé (aucun réseau sortant).
import { test, expect } from '@playwright/test';
import { brancher } from './outils.mjs';
import { LIVRE } from './fixture.mjs';

async function demarrer(page) {
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
  page.on('dialog', () => erreurs.push('dialog'));
  const b = await brancher(page);
  await page.goto('./');
  await page.getByRole('button', { name: 'Se connecter avec Google' }).click();
  await expect(page.locator('#comptesheet')).toBeVisible();     // livre vide : la feuille Compte s'ouvre sur l'import
  await page.locator('#fichier-import').setInputFiles({ name: 'livre.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(LIVRE)) });
  await page.locator('#lancer-import').click();
  await expect(page.getByRole('heading', { name: 'Import terminé.' })).toBeVisible();
  await page.locator('[data-compteclose]').click();
  return { ...b, erreurs };
}

test('les 6 étapes de Gordon Rams.ai sur 3Bras', async ({ page }, info) => {
  const P = info.project.name;
  const { sim, erreurs } = await demarrer(page);

  // En-tête identique : marque, 6 étapes numérotées
  await expect(page.locator('.brand h1')).toHaveText('3Bras');
  await expect(page.locator('#steps button')).toHaveCount(6);
  await expect(page.locator('#steps button[aria-current="page"] i')).toHaveText('Semaine');
  await expect(page.locator('#sync')).toHaveText(/soupers dans le livre/);

  // 03 Semaine : brouillon pigé dimanche à mercredi, puis approbation
  await expect(page.locator('.frame.day')).toHaveCount(4);
  await page.screenshot({ path: `tests/captures/${P}-semaine.png`, fullPage: true });
  await page.locator('#save').click();
  await expect(page.locator('#save')).toHaveText(/Semaine approuvée/);
  const classeur = [...sim.classeurs.values()][0];
  expect(classeur.onglets['Plans de semaine'].length).toBeGreaterThan(1);

  // Aperçu d'un souper de la semaine : cocher « déjà à la maison »
  await page.locator('.frame.day .title-btn').first().click();
  await expect(page.locator('#sheet h2')).toBeVisible();
  await page.screenshot({ path: `tests/captures/${P}-apercu.png`, fullPage: true });
  await page.locator('#sheet [data-close]').first().click();

  // 01 Livre : parcourir, puis trier
  await page.locator('[data-go="tri"]').click();
  await expect(page.locator('.pickrow')).toHaveCount(LIVRE.recettes.length - 0);
  await page.locator('[data-libmode="tri"]').click();
  await expect(page.locator('#tricard h3')).toBeVisible();
  await page.screenshot({ path: `tests/captures/${P}-tri.png`, fullPage: true });
  await page.locator('[data-decide="Au livre"]').click();
  await expect(page.locator('.tri-count')).toHaveText(/^2 sur/);

  // 02 Garde-manger
  await page.locator('[data-go="livre"]').click();
  await expect(page.locator('.zone h3').first()).toBeVisible();
  await page.locator('[data-qty="i-citron"][data-d="1"]').click();
  await expect(page.locator('.inv-row', { hasText: 'Citron' }).locator('.qty b')).toHaveText('1');

  // 04 Provigo
  await page.locator('[data-go="provigo"]').click();
  await expect(page.locator('.dept').first()).toBeVisible();
  await page.screenshot({ path: `tests/captures/${P}-provigo.png`, fullPage: true });

  // 05 Au poêle
  await page.locator('[data-go="poele"]').click();
  await page.locator('.pick .btn:not([disabled])').first().click();
  await expect(page.locator('.step-no')).toHaveText(/Étape 1 sur/);
  await page.locator('#next').click();
  await expect(page.locator('.step-no')).toHaveText(/Étape 2 sur/);
  await page.screenshot({ path: `tests/captures/${P}-poele.png`, fullPage: true });

  // 06 Bilan
  await page.locator('[data-go="bilan"]').click();
  await expect(page.locator('.panel-head h2')).toHaveText('Bilan');

  // Thèmes Magazine et Ardoise
  for (const skin of ['magazine', 'ardoise']) {
    await page.locator('#skin').selectOption(skin);
    await page.locator('[data-go="semaine"]').click();
    await page.screenshot({ path: `tests/captures/${P}-semaine-${skin}.png`, fullPage: true });
  }
  expect(erreurs).toEqual([]);
});

test('texte hostile dans le classeur affiché comme texte', async ({ page }) => {
  const b = await brancher(page);
  const hostile = { ...LIVRE, recettes: [...LIVRE.recettes, { id: 'r-x', Nom: '<img src=x onerror=alert(1)>', Type: 'Souper', Statut: 'Au livre', Ingrédients: ['<script>alert(2)</script>'], Étapes: ['<b>gras</b>'] }] };
  const dialogs = []; page.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss(); });
  await page.goto('./');
  await page.getByRole('button', { name: 'Se connecter avec Google' }).click();
  await page.locator('#fichier-import').setInputFiles({ name: 'l.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(hostile)) });
  await page.locator('#lancer-import').click();
  await expect(page.getByRole('heading', { name: 'Import terminé.' })).toBeVisible();
  await page.locator('[data-compteclose]').click();
  await page.locator('[data-go="tri"]').click();
  await page.getByRole('button', { name: /<img src=x/ }).click();
  await expect(page.locator('#sheet h2')).toHaveText('<img src=x onerror=alert(1)>');
  await expect(page.locator('#sheet')).toContainText('<script>alert(2)</script>');
  expect(dialogs).toEqual([]);
  expect(b.sim).toBeTruthy();
});

test('ID client absent : message clair', async ({ page }) => {
  await brancher(page, { clientId: '' });
  await page.goto('./');
  await expect(page.getByRole('alert')).toContainText('ID client Google');
});

test('mémoire du compte : le retour se fait en un toucher, sans garder le jeton', async ({ page, context }, info) => {
  const { sim } = await demarrer(page);
  const stock = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)])));
  expect(stock['3bras-compte']).toBe('jp@exemple.ca');
  expect(JSON.stringify(stock)).not.toContain('jeton-test');           // N-02 : jamais le jeton
  const schema = [...sim.classeurs.values()][0].onglets['Schéma'];
  expect(schema.find((l) => l[0] === 'proprietaire')?.[1]).toBe('jp@exemple.ca');

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Content de te revoir' })).toBeVisible();
  await page.screenshot({ path: `tests/captures/${info.project.name}-retour.png` });
  await page.locator('[data-go="tri"]').click();                        // un toucher sur une étape reconnecte
  await expect(page.locator('#sync')).toHaveText(/soupers dans le livre/);
  await expect(page.locator('.pickrow').first()).toBeVisible();
  expect(context).toBeTruthy();
});

test('partager une recette depuis le coin de sa fiche', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await demarrer(page);
  await page.addInitScript(() => {});
  await page.evaluate(() => { Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }); });
  await page.locator('[data-go="tri"]').click();
  await page.getByRole('button', { name: /Poulet au citron test/ }).click();
  await page.getByRole('button', { name: 'Partager la recette Poulet au citron test' }).click();
  await expect(page.locator('#toast')).toContainText('Recette copiée');
  const txt = await page.evaluate(() => navigator.clipboard.readText());
  expect(txt).toContain('Poulet au citron test');
  expect(txt).toContain('INGRÉDIENTS');
  expect(txt).toContain('Marinade');
  expect(txt).toContain('1. Mélanger la marinade.');
});

test('première connexion : livre vide, kits de départ au choix', async ({ page }, info) => {
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
  const { sim } = await brancher(page);
  await page.goto('./');
  await page.getByRole('button', { name: 'Se connecter avec Google' }).click();
  await expect(page.locator('#comptesheet')).toBeVisible();
  await expect(page.locator('[data-kit][aria-pressed="true"]')).toHaveCount(3);       // les 3 kits cochés par défaut
  await page.locator('[data-kit="asiatique"]').click();                                // on en retire un
  await page.screenshot({ path: `tests/captures/${info.project.name}-kits.png`, fullPage: true });
  await page.locator('#chargerkits').click();
  await expect(page.locator('#kit-res')).toContainText('20 recettes ajoutées');
  const rec = [...sim.classeurs.values()][0].onglets.Recettes;
  expect(rec.length).toBe(21);                                                         // en-tête + 20
  await page.locator('[data-chargerkits], #chargerkits').click();                      // recharger : aucun doublon
  await expect(page.locator('#kit-res')).toContainText('0 recettes ajoutées');
  await page.locator('[data-compteclose]').click();
  await expect(page.locator('.frame.day')).toHaveCount(4);                             // la semaine se pige dans les kits
  expect(erreurs).toEqual([]);
});
