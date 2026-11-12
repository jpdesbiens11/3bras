// D-G-051 : la mise en place guidée, après la connexion Google : des kits à la liste du Provigo.
import { test, expect } from '@playwright/test';
import { brancher } from './outils.mjs';

async function connecter(page, opts = {}) {
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
  const b = await brancher(page, { guide: true, ...opts });
  await page.goto('./');
  await page.getByRole('button', { name: 'Se connecter avec Google' }).click();
  await expect(page.locator('#comptesheet')).toBeVisible();
  return { ...b, erreurs };
}
const bulle = (page) => page.locator('.gd-bulle');
const etape = (page, titre) => expect(bulle(page).getByRole('heading')).toHaveText(titre);

/** L'anneau du guide entoure bien l'élément visé. */
async function entoure(page, sel) {
  await expect(page.locator('.gd-anneau')).toBeVisible();
  await expect.poll(async () => {
    const a = await page.locator('.gd-anneau').boundingBox(), c = await page.locator(sel).first().boundingBox();
    return a && c && a.x <= c.x + 1 && a.y <= c.y + 1 && a.x + a.width >= c.x + c.width - 1 && a.y + a.height >= c.y + c.height - 1;
  }).toBe(true);
}

test('D-G-051 : la mise en place guidée mène des kits à la liste du Provigo', async ({ page }, info) => {
  const P = info.project.name;
  const { sim, erreurs } = await connecter(page);
  // Le livre est vide : le guide démarre ; Compte est déjà ouvert, il passe à la 2e étape.
  await etape(page, 'Choisis tes kits');
  await expect(bulle(page)).toContainText('Mise en place · 2 sur 18 · Kits');
  await entoure(page, '#kitchoix');
  await page.screenshot({ path: `tests/captures/${P}-guide-kits.png` });
  await page.locator('[data-kit="survie"]').click();
  await etape(page, 'Ajoute-les à ton livre');
  await entoure(page, '#chargerkits');
  await page.locator('#chargerkits').click();
  await etape(page, 'Ton stock de base');
  await page.locator('#ouvrirstock').click();
  await etape(page, 'Coche ce que tu as');
  await page.locator('#stock-ajouter').click();
  await etape(page, 'Ferme le Compte');
  await entoure(page, '[data-stockclose]');
  await page.locator('[data-stockclose]').click();
  await entoure(page, '[data-compteclose]');
  await page.locator('[data-compteclose]').click();

  await etape(page, 'Va au Livre');
  await entoure(page, '[data-go="tri"]');
  await page.locator('[data-go="tri"]').click();
  await etape(page, 'Passe en mode Trier');
  await entoure(page, '[data-libmode="tri"]');
  await page.locator('[data-libmode="tri"]').click();
  await etape(page, 'Trie quelques recettes');
  await page.screenshot({ path: `tests/captures/${P}-guide-trier.png` });
  for (let k = 0; k < 3; k++) await page.locator('[data-decide="Au livre"]').click();
  await etape(page, 'Va au Garde-manger');
  await page.locator('[data-go="livre"]').click();
  await etape(page, 'Ajoute ce qu\'il y a au frigo');
  await entoure(page, '#addinv');
  await bulle(page).getByRole('button', { name: 'Suivant' }).click();

  await etape(page, 'Va à la Semaine');
  await page.locator('[data-go="semaine"]').click();
  await etape(page, 'Choisis tes soirs');
  await bulle(page).getByRole('button', { name: 'Suivant' }).click();
  await etape(page, 'Pige ou choisis');
  await bulle(page).getByRole('button', { name: 'Suivant' }).click();
  await etape(page, 'Déplace un souper');
  await page.locator('#deplacer-btn').click();
  await entoure(page, '[data-dpenregistrer]');
  await page.locator('#deplacer [data-dpjour="0"]').click();
  await page.locator('#deplacer [data-dpjour="1"]').click();
  await page.locator('[data-dpenregistrer]').click();
  await etape(page, 'Approuve ta semaine');
  await entoure(page, '#save');
  await page.locator('#save').click();

  await etape(page, 'Va au Provigo');
  await page.locator('[data-go="provigo"]').click();
  await etape(page, 'Ta liste est prête, chef !');
  await expect(page.locator('.dept').first()).toBeVisible();
  await page.screenshot({ path: `tests/captures/${P}-guide-provigo.png` });
  await bulle(page).getByRole('button', { name: 'Terminer' }).click();
  await expect(page.locator('#guide')).toHaveCount(0);
  expect(await page.evaluate(() => [localStorage.getItem('superchef-guide'), localStorage.getItem('superchef-guide-fin')])).toEqual([null, '1']);
  const plans = [...sim.classeurs.values()][0].onglets['Plans de semaine'];
  expect(plans.length).toBeGreaterThan(4);                                            // la semaine est écrite dans le classeur
  expect(erreurs).toEqual([]);
});

test('D-G-051 : passer, reprendre après un rechargement, quitter, relancer depuis Compte', async ({ page }) => {
  const { erreurs } = await connecter(page);
  await etape(page, 'Choisis tes kits');
  await bulle(page).getByRole('button', { name: 'Passer cette étape' }).click();
  await etape(page, 'Ajoute-les à ton livre');
  await page.reload();
  await page.getByRole('button', { name: 'Continuer' }).click();                    // compte mémorisé
  await etape(page, 'Ajoute-les à ton livre');                                       // repris là où on était
  await page.getByRole('button', { name: 'Quitter la mise en place guidée' }).click();
  await expect(page.locator('#guide')).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await expect(page.locator('#comptesheet')).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.locator('#guide')).toHaveCount(0);                               // quitté : il ne revient pas seul
  await page.getByRole('button', { name: 'Lancer le guide' }).click();
  await etape(page, 'Choisis tes kits');
  expect(erreurs).toEqual([]);
});
