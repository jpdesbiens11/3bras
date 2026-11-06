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

test('+ Recette : texte collé, réponse de Claude, photo vers Claude', async ({ page }, info) => {
  const { sim, erreurs } = await demarrer(page);
  await expect(page.locator('#addbtn')).toBeVisible();
  await page.locator('#addbtn').click();
  await expect(page.locator('#addsheet h2')).toHaveText('Nouvelle recette');
  await page.screenshot({ path: `tests/captures/${info.project.name}-ajout.png`, fullPage: true });

  // 1. Texte collé, lu par l'app
  await page.locator('#add-text').fill('Soupe à l\'oignon\nPortions : 4\n\nIngrédients\n- 4 oignons\n- 1 l de bouillon de bœuf\n\nPréparation\n1. Caraméliser les oignons 30 minutes.\n2. Ajouter le bouillon et mijoter 20 minutes.');
  await page.locator('#add-type').selectOption('Soupe');
  await page.locator('#add-go').click();
  await expect(page.locator('#add-name')).toHaveValue('Soupe à l\'oignon');
  await expect(page.locator('#add-prev ol li')).toHaveCount(2);
  await page.screenshot({ path: `tests/captures/${info.project.name}-ajout-apercu.png`, fullPage: true });
  await page.locator('#add-save').click();
  await expect(page.locator('#toast')).toContainText('Ajoutée au livre : Soupe à l\'oignon');
  const rec = [...sim.classeurs.values()][0].onglets.Recettes;
  const ligne = rec.find((l) => l[1] === 'Soupe à l\'oignon');
  expect(ligne).toBeTruthy();

  // 2. Réponse JSON de Claude collée
  await page.locator('#addbtn').click();
  await page.locator('#add-text').fill('```json\n{"nom":"Pad thaï maison","type":"Souper","proteine":"Poulet","temps_total_min":30,"portions":4,"ingredients":[{"groupe":null,"items":["200 g de nouilles de riz","2 poitrines de poulet"]}],"etapes":["Tremper les nouilles 10 minutes.","Sauter le poulet."],"sous_chef":["Rincer les germes"],"a_verifier":""}\n```');
  await page.locator('#add-go').click();
  await expect(page.locator('#add-status')).toContainText('Fiche de Claude lue');
  await expect(page.locator('#add-name')).toHaveValue('Pad thaï maison');
  await page.locator('[data-addclose]').click();

  // 3. Photo : envoyée à Claude (nouvel onglet claude.ai avec la consigne)
  await page.evaluate(() => { window.__ouvert = []; window.open = (u) => { window.__ouvert.push(u); return null; }; Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true }); });
  await page.locator('#addbtn').click();
  await page.locator('#add-file').setInputFiles({ name: 'recette.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]) });
  await expect(page.locator('.fchip')).toHaveCount(1);
  await page.locator('#add-go').click();
  await expect(page.locator('#add-status')).toContainText('Claude prend le relais');
  const ouvert = await page.evaluate(() => window.__ouvert[0]);
  expect(ouvert).toMatch(/^https:\/\/claude\.ai\/new\?q=/);
  expect(decodeURIComponent(ouvert)).toContain('3Bras');
  expect(erreurs).toEqual([]);
});

test('+ Recette : Fiche 3Bras du projet Claude collée telle quelle', async ({ page }) => {
  const { readFileSync } = await import('node:fs');
  const fiche = readFileSync(new URL('../../docs/projet-claude-3bras.md', import.meta.url), 'utf8').split('```')[1].trim();
  const { sim, erreurs } = await demarrer(page);
  await page.locator('#addbtn').click();
  await expect(page.locator('#addsheet')).toContainText('projet Claude « 3Bras »');
  await page.locator('#add-text').fill(fiche);
  await page.locator('#add-go').click();
  await expect(page.locator('#add-status')).toContainText('Fiche 3Bras lue');
  await expect(page.locator('#add-name')).toHaveValue('Pâté chinois');
  await expect(page.locator('#add-prev')).toContainText('Ricardo');
  await page.locator('#add-save').click();
  await expect(page.locator('#toast')).toContainText('Ajoutée au livre : Pâté chinois');
  const onglet = [...sim.classeurs.values()][0].onglets.Recettes, entete = onglet[0];
  const ligne = onglet.find((l) => l[1] === 'Pâté chinois'), col = (c) => ligne[entete.indexOf(c)];
  expect(col('Type')).toBe('Souper');
  expect(col('Protéine')).toBe('Bœuf');
  expect(col('Source')).toBe('Ricardo');
  expect(col('Lien source')).toBe('https://www.ricardocuisine.com/recettes/5541-pate-chinois');
  expect(col('Ingrédients')).toContain('## Purée');
  expect(col('Tâches sous-chef')).toContain('Étendre la purée');
  expect(erreurs).toEqual([]);
});

test('+ Recette avec Gemini (Firebase simulé) : photo et lien deviennent une fiche', async ({ page }) => {
  const IA = { apiKey: 'AIza-test', projectId: 'projet-test', appId: '1:2:web:3', recaptcha: 'cle-site-test', modele: 'gemini-3.5-flash' };
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  const { sim } = await brancher(page, { ia: IA });
  await page.addInitScript(() => { window.__reponseGemini = '```\nFICHE 3BRAS\nNom : Tarte au sucre\nType : Dessert\nProtéine : Aucune\nPortions : 8\nTemps total : 60 min\nSource : Ricardo\nLien : https://www.ricardocuisine.com/recettes/1234-tarte-au-sucre\n\nINGRÉDIENTS\n- 1 abaisse de pâte\n- 250 ml de cassonade\n\nÉTAPES\n1. Préchauffer le four à 180 °C (350 °F).\n2. Cuire 45 minutes.\n\nSOUS-CHEF\n- Mesurer la cassonade\n```'; });
  await page.goto('./');
  await page.getByRole('button', { name: 'Se connecter avec Google' }).click();
  await page.locator('[data-compteclose]').click();
  await page.locator('#addbtn').click();
  await expect(page.locator('#add-go')).toHaveText(/Convertir avec Gemini/);

  // Photo : envoyée à Gemini en image, App Check branché avec la clé de site
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  await page.locator('#add-file').setInputFiles({ name: 'tarte.png', mimeType: 'image/png', buffer: png });
  await page.locator('#add-type').selectOption('Dessert');
  await page.locator('#add-go').click();
  await expect(page.locator('#add-status')).toContainText('Converti par Gemini');
  await expect(page.locator('#add-name')).toHaveValue('Tarte au sucre');
  const g = await page.evaluate(() => ({ ...window.__gemini, appcheck: window.__appcheck, nb: window.__gemini.parts.length, image: !!window.__gemini.parts[0].inlineData }));
  expect(g).toMatchObject({ modele: 'gemini-3.5-flash', appcheck: 'cle-site-test', nb: 2, image: true });
  expect(g.outils).toEqual([]);
  await page.locator('#add-save').click();
  await expect(page.locator('#toast')).toContainText('Ajoutée au livre : Tarte au sucre');
  const onglet = [...sim.classeurs.values()][0].onglets.Recettes, entete = onglet[0];
  const ligne = onglet.find((l) => l[1] === 'Tarte au sucre');
  expect(ligne[entete.indexOf('Type')]).toBe('Dessert');
  expect(ligne[entete.indexOf('Lien source')]).toBe('https://www.ricardocuisine.com/recettes/1234-tarte-au-sucre');

  // Lien seul : Gemini reçoit l'outil « URL context »
  await page.locator('#addbtn').click();
  await page.locator('#add-url').fill('https://www.ricardocuisine.com/recettes/1234-tarte-au-sucre');
  await page.locator('#add-go').click();
  await expect(page.locator('#add-name')).toHaveValue('Tarte au sucre');
  expect(await page.evaluate(() => window.__gemini.outils)).toEqual([{ urlContext: {} }]);

  // Une Fiche 3Bras collée ne repasse pas par Gemini
  await page.evaluate(() => { window.__gemini = null; });
  await page.locator('[data-addclose]').click();
  await page.locator('#addbtn').click();
  await page.locator('#add-text').fill('FICHE 3BRAS\nNom : Soupe test\nType : Soupe\n\nINGRÉDIENTS\n- 1 l d\'eau\n\nÉTAPES\n1. Bouillir 10 minutes.');
  await page.locator('#add-go').click();
  await expect(page.locator('#add-name')).toHaveValue('Soupe test');
  expect(await page.evaluate(() => window.__gemini)).toBeNull();
  expect(erreurs).toEqual([]);
});
