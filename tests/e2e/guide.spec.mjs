// D-G-051, D-G-053 : la mise en place guidée, après la connexion Google : le guide ouvre lui-même chaque écran,
// encadre ce qui est visible, ◀ ▶ pour naviguer ; des kits à la liste du Provigo.
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
let nCapture = 0;
async function etape(page, titre) {
  await expect(bulle(page).getByRole('heading')).toHaveText(titre);
  if (process.env.GUIDE_CAPTURES) { await page.waitForTimeout(700); await page.screenshot({ path: `${process.env.GUIDE_CAPTURES}/${String(++nCapture).padStart(2, '0')}.png` }); }
}
const suivant = (page) => bulle(page).getByRole('button', { name: 'Étape suivante' }).click();
const precedent = (page) => bulle(page).getByRole('button', { name: 'Étape précédente' }).click();

/** L'anneau entoure l'élément visé, et cet élément est bien visible (pas caché sous une feuille). */
async function entoure(page, sel) {
  await expect(page.locator('.gd-anneau')).toBeVisible();
  await expect.poll(async () => {
    const a = await page.locator('.gd-anneau').boundingBox(), c = await page.locator(sel).first().boundingBox();
    return !!(a && c && a.x <= c.x + 1 && a.y <= c.y + 1 && a.x + a.width >= c.x + c.width - 1 && a.y + a.height >= c.y + c.height - 1);
  }).toBe(true);
  await expect.poll(() => page.locator(sel).first().evaluate((n) => {
    const r = n.getBoundingClientRect(), H = innerHeight, W = innerWidth;
    const x = (Math.max(r.left, 0) + Math.min(r.right, W)) / 2, y = (Math.max(r.top, 0) + Math.min(r.bottom, H)) / 2;
    const d = document.elementFromPoint(x, y); return !!d && (n.contains(d) || !!d.closest('#guide'));
  })).toBe(true);                                                                       // le guide fait défiler jusqu'à elle
}

test('D-G-053 : 10 étapes qui ouvrent chaque écran, des kits à l\'étape 1 du souper de lundi', async ({ page }, info) => {
  const P = info.project.name;
  const { sim, erreurs } = await connecter(page);
  await etape(page, 'Choisis tes kits, puis ajoute-les');
  await expect(bulle(page)).toContainText('Mise en place · 1 sur 10 · Kits');
  await expect(bulle(page).getByRole('button', { name: 'Étape précédente' })).toBeDisabled();
  await entoure(page, '#kitchoix');
  await page.screenshot({ path: `tests/captures/${P}-guide-kits.png` });
  // ▾ réduit la bulle à sa barre (◀ ▶ restent), ▴ la rouvre
  await bulle(page).getByRole('button', { name: 'Réduire la bulle' }).click();
  await expect(bulle(page).locator('h3')).toBeHidden();
  await expect(bulle(page).getByRole('button', { name: 'Étape suivante' })).toBeVisible();
  await bulle(page).getByRole('button', { name: 'Agrandir la bulle' }).click();
  await expect(bulle(page).locator('h3')).toBeVisible();
  await page.locator('[data-kit="survie"]').click();
  await entoure(page, '#chargerkits');                                               // un kit coché : le guide montre « Ajouter »
  await page.locator('#chargerkits').click();
  // 2 : le guide ouvre lui-même la feuille du stock de base.
  await etape(page, 'Ton stock de base');
  await expect(page.locator('#stocksheet')).toBeVisible();
  await entoure(page, '#stock-ajouter');
  await page.locator('#stock-ajouter').click();

  // 3 : il ferme les feuilles et ouvre le Livre en mode Trier.
  await etape(page, 'Trie tes nouvelles recettes');
  await expect(page.locator('#comptesheet')).toHaveCount(0);
  await expect(page.locator('[data-go="tri"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('[data-libmode="tri"]')).toHaveAttribute('aria-pressed', 'true');
  await entoure(page, '.tri-wrap');
  await page.screenshot({ path: `tests/captures/${P}-guide-trier.png` });
  // ◀ rouvre la feuille du stock (elle n'avance pas seule), ▶ revient au tri
  await precedent(page);
  await etape(page, 'Ton stock de base');
  await expect(page.locator('#stocksheet')).toBeVisible();
  await page.waitForTimeout(600);
  await etape(page, 'Ton stock de base');
  await suivant(page);
  await expect(page.locator('#stocksheet')).toHaveCount(0);
  await etape(page, 'Trie tes nouvelles recettes');
  for (let k = 0; k < 3; k++) await page.locator('[data-decide="Au livre"]').click();

  await etape(page, 'Ajoute ce qu\'il y a au frigo');
  await expect(page.locator('[data-go="livre"]')).toHaveAttribute('aria-current', 'page');
  await entoure(page, '#addinv');
  await suivant(page);
  await etape(page, 'Ta semaine est pigée');
  await expect(page.locator('[data-go="semaine"]')).toHaveAttribute('aria-current', 'page');
  await entoure(page, '.daytog');
  await bulle(page).getByRole('button', { name: 'Suivant', exact: true }).click();
  await etape(page, 'Déplace un souper');
  await page.locator('#deplacer-btn').click();
  await entoure(page, '[data-dpenregistrer]');
  await page.locator('#deplacer [data-dpjour="0"]').click();
  await page.locator('#deplacer [data-dpjour="2"]').click();
  await page.locator('[data-dpenregistrer]').click();
  await etape(page, 'Approuve ta semaine');
  await entoure(page, '#save');
  await page.locator('#save').click();

  await etape(page, 'Ta liste d\'épicerie est prête');
  await expect(page.locator('[data-go="provigo"]')).toHaveAttribute('aria-current', 'page');
  await entoure(page, '.dept');
  await suivant(page);
  // 9 : Au poêle, le souper de lundi est encadré ; on le touche.
  const lundi = (await page.evaluate(() => [...document.querySelectorAll('.pick [data-cook]')].find((b) => /^Lun/.test(b.textContent))?.dataset.cook));
  expect(lundi).toBeTruthy();
  await expect(bulle(page).getByRole('heading')).toHaveText(/^Lundi soir : /);
  await expect(page.locator('[data-go="poele"]')).toHaveAttribute('aria-current', 'page');
  await entoure(page, `.pick [data-cook="${lundi}"]`);
  await page.locator(`.pick [data-cook="${lundi}"]`).click();
  // 10 : l'étape 1 de la recette, encadrée.
  await etape(page, 'Étape 1 : on cuisine !');
  await expect(page.locator('#cook .step-no')).toHaveText(/^Étape 1 sur/);
  await expect(page.locator(`.pick [data-cook="${lundi}"]`)).toHaveAttribute('aria-pressed', 'true');
  await entoure(page, '#cook .stage');
  await expect(bulle(page)).toContainText('10 sur 10');
  await expect(bulle(page).getByRole('button', { name: 'Étape suivante' })).toBeDisabled();
  await page.screenshot({ path: `tests/captures/${P}-guide-poele.png` });
  await bulle(page).getByRole('button', { name: 'Terminer' }).click();
  await expect(page.locator('#guide')).toHaveCount(0);
  expect(await page.evaluate(() => [localStorage.getItem('superchef-guide'), localStorage.getItem('superchef-guide-fin')])).toEqual([null, '1']);
  expect([...sim.classeurs.values()][0].onglets['Plans de semaine'].length).toBeGreaterThan(4);
  expect(erreurs).toEqual([]);
});

test('D-G-051 : passer, reprendre après un rechargement, quitter, relancer depuis Compte', async ({ page }) => {
  const { erreurs } = await connecter(page);
  await etape(page, 'Choisis tes kits, puis ajoute-les');
  await bulle(page).getByRole('button', { name: 'Passer cette étape' }).click();
  await etape(page, 'Ton stock de base');
  await expect(page.locator('#stocksheet')).toBeVisible();                           // ▶ ouvre l'écran suivant tout de suite
  await page.reload();
  await page.getByRole('button', { name: 'Continuer' }).click();                    // compte mémorisé
  await etape(page, 'Ton stock de base');                                            // repris là où on était
  await expect(page.locator('#stocksheet')).toBeVisible();
  await page.getByRole('button', { name: 'Quitter la mise en place guidée' }).click();
  await expect(page.locator('#guide')).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await expect(page.locator('#comptesheet')).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.locator('#guide')).toHaveCount(0);                               // quitté : il ne revient pas seul
  await page.getByRole('button', { name: 'Lancer le guide' }).click();
  await etape(page, 'Choisis tes kits, puis ajoute-les');
  expect(erreurs).toEqual([]);
});
