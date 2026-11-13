// D-G-051, D-G-053, D-G-056 : la mise en place guidée, de l'accueil (connexion Google) à l'étape 2 du souper de lundi.
// Un doigt fait le chemin à l'écran (≈ 1 s par toucher) en touchant les vrais boutons, puis mime le geste à faire ;
// « Suivant » sur chaque étape, ◀ ▶ pour naviguer, « Revoir le chemin », « Plus lent » (1.23.1).
import { test, expect } from '@playwright/test';
import { brancher } from './outils.mjs';

test.setTimeout(150000);
const IA = { apiKey: 'AIza-test', projectId: 'projet-test', appId: '1:2:web:3', recaptcha: 'cle-site-test', modele: 'gemini-3.5-flash', modeleRapide: 'gemini-3.5-flash-lite' };
async function ouvrir(page, opts = {}) {
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
  const b = await brancher(page, { guide: true, ...opts });
  await page.goto('./');
  return { ...b, erreurs };
}
const bulle = (page) => page.locator('.gd-bulle');
let nCapture = 0;
async function etape(page, titre) {
  await expect(bulle(page).getByRole('heading')).toHaveText(titre);
  await expect(bulle(page).locator('.gd-texte')).toBeVisible({ timeout: 15000 });   // le doigt est arrivé
  if (titre !== 'Reconnecte-toi') await expect(bulle(page).locator('.gd-acts .btn.primary')).toHaveText(/^(Suivant|Terminer)$/);   // 1.23.1 : sur chaque étape
  if (process.env.GUIDE_CAPTURES) { await page.waitForTimeout(900); await page.screenshot({ path: `${process.env.GUIDE_CAPTURES}/${String(++nCapture).padStart(2, '0')}.png` }); }
}
/** Le doigt touche ce bouton en chemin : la bulle le dit et le doigt est à l'écran. */
async function touche(page, nom) {
  await expect(bulle(page).locator('.gd-route')).toContainText(`Je touche « ${nom} »`, { timeout: 15000 });
  await expect(page.locator('#gd-doigt.vu')).toHaveCount(1);
}
const fil = (page) => bulle(page).locator('.gd-fil');
/** Rien ne couvre ce bouton (ni la bulle, ni la barre d'une feuille) : on peut le toucher là où il est. */
async function libre(page, sel) {
  await expect.poll(() => page.locator(sel).first().evaluate((n) => {
    const r = n.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    const d = y > 0 && y < innerHeight ? document.elementFromPoint(x, y) : null; return !!d && n.contains(d);
  }), { message: `${sel} est couvert ou hors de l'écran` }).toBe(true);
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

test('D-G-056, D-G-057 : 14 étapes de l\'accueil à l\'étape 2 de lundi, le doigt fait chaque chemin', async ({ page }, info) => {
  const P = info.project.name;
  const { sim, erreurs } = await ouvrir(page, { ia: IA });
  // 1 : dès l'accueil, avant Google ; la visite dessinée ne s'ouvre plus seule.
  await etape(page, 'Connecte-toi avec Google');
  await expect(page.locator('#visite')).toHaveCount(0);
  await expect(bulle(page)).toContainText('1 sur 14 · Accueil');
  await expect(fil(page)).toHaveText('Accueil');
  await entoure(page, '#connexion');
  await expect(bulle(page).getByRole('button', { name: 'Étape précédente' })).toBeDisabled();
  await page.screenshot({ path: `tests/captures/${P}-guide-accueil.png` });
  await page.getByRole('button', { name: 'Se connecter avec Google' }).click();

  // 2 : le doigt touche lui-même 👥 Compte (Compte ne s'ouvre plus d'office).
  await touche(page, '👥 Compte');
  await etape(page, 'Choisis tes kits de recettes');
  await expect(page.locator('#comptesheet')).toBeVisible();
  await expect(fil(page)).toHaveText('Accueil›👥 Compte');
  await entoure(page, '#kitchoix');
  await expect(page.locator('#gd-doigt.vu')).toHaveCount(0, { timeout: 8000 });     // le geste mimé est fini
  await libre(page, '[data-kit="survie"]');                                          // 1.23.1 : le premier kit reste à l'écran, libre
  await page.locator('[data-kit="survie"]').click();
  await entoure(page, '#chargerkits');
  await page.locator('#chargerkits').click();

  // 3 : « Choisir mon stock de base », touché dans Compte.
  await touche(page, 'Choisir mon stock de base');
  await etape(page, 'Ton stock de base');
  await expect(page.locator('#stocksheet')).toBeVisible();
  await expect(fil(page)).toHaveText('Accueil›👥 Compte›Stock de base');
  await entoure(page, '#stock-ajouter');
  // 4 : ← ferme le stock, ← ferme Compte, + Recette : 3 touchers, environ 1 seconde chacun.
  const t0 = Date.now();
  await page.locator('#stock-ajouter').click();
  await touche(page, '←');
  await touche(page, '+ Recette');
  await etape(page, 'Tes recettes à toi');
  const duree = Date.now() - t0;
  expect(duree).toBeGreaterThan(2400);
  expect(duree).toBeLessThan(7000);
  await expect(page.locator('#addsheet')).toBeVisible();
  await expect(page.locator('#comptesheet')).toHaveCount(0);
  await entoure(page, '#addsheet .pick');
  await bulle(page).getByRole('button', { name: 'Suivant', exact: true }).click();

  // 5 : ← ferme l'ajout, 01 Livre, Trier ; le doigt mime le glisser (la fiche suit, puis revient : rien n'est trié).
  await touche(page, '01 Livre');
  await touche(page, 'Trier');
  await etape(page, 'Trie tes recettes');
  await expect(page.locator('[data-go="tri"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('[data-libmode="tri"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#trihint')).toHaveText('Au livre', { timeout: 5000 });
  await expect(page.locator('#trihint')).toHaveText('');
  await expect(page.locator('.tri-count')).toHaveText(/^1 sur/);
  await entoure(page, '.tri-wrap');
  for (let k = 0; k < 3; k++) await page.locator('[data-decide="Au livre"]').click();

  await touche(page, '02 Garde-manger');
  await etape(page, 'Ce qu\'il y a dans ton frigo');
  await entoure(page, '#addinv');
  await bulle(page).getByRole('button', { name: 'Suivant', exact: true }).click();
  await touche(page, '03 Semaine');
  await etape(page, 'Tes soupers de la semaine');
  await entoure(page, '.daytog');
  await bulle(page).getByRole('button', { name: 'Suivant', exact: true }).click();
  // 8 : même écran, pas de chemin ; le doigt tient un souper 2 s (la barre jaune se remplit), sans rien déplacer.
  await etape(page, 'Change un souper de soir');
  await expect(page.locator('.week .day.tenir')).toHaveCount(1, { timeout: 5000 });
  await expect(page.locator('#deplacer')).toHaveCount(0);
  await expect(page.locator('.week .day.tenir')).toHaveCount(0, { timeout: 5000 });
  await page.locator('#deplacer-btn').click();
  await entoure(page, '[data-dpenregistrer]');
  // 1.23.1 : dans la vue « Déplacer », la bulle s'efface (l'anneau reste sur « Enregistrer ») ; tous les soirs restent libres
  await expect(bulle(page)).toBeHidden();
  for (let k = 0; k < 7; k++) { await page.locator(`#deplacer [data-dpjour="${k}"]`).scrollIntoViewIfNeeded(); await libre(page, `#deplacer [data-dpjour="${k}"]`); }
  await page.locator('#deplacer [data-dpjour="0"]').click();
  await page.locator('#deplacer [data-dpjour="2"]').click();
  await page.locator('[data-dpenregistrer]').click();
  await etape(page, 'Approuve ta semaine');
  await expect(bulle(page).locator('h3')).toBeVisible();                              // la vue fermée, la bulle revient
  await entoure(page, '#save');
  await page.locator('#save').click();

  await touche(page, '04 Provigo');
  await etape(page, 'Ta liste d\'épicerie est prête');
  await entoure(page, '.dept');
  await bulle(page).getByRole('button', { name: 'Suivant', exact: true }).click();
  // 11 : 05 Au poêle, le souper de lundi est encadré ; on le touche (1.23.1 : plus d'étape « téléphone » avant).
  await touche(page, '05 Au poêle');
  await expect(bulle(page).getByRole('heading')).toHaveText(/^Lundi soir : /);
  await expect(bulle(page).locator('.gd-texte')).toBeVisible();
  const lundi = await page.evaluate(() => [...document.querySelectorAll('.pick [data-cook]')].find((b) => /^Lun/.test(b.textContent))?.dataset.cook);
  expect(lundi).toBeTruthy();
  await entoure(page, `.pick [data-cook="${lundi}"]`);
  await page.locator(`.pick [data-cook="${lundi}"]`).click();
  await etape(page, 'Étape 1 : lis et prépare');
  await expect(page.locator('#cook .step-no')).toHaveText(/^Étape 1 sur/);
  await entoure(page, '#cook .stage');
  await page.screenshot({ path: `tests/captures/${P}-guide-poele.png` });
  await bulle(page).getByRole('button', { name: 'Suivant', exact: true }).click();
  // 13 : le minuteur, puis l'étape 2 ; le minuteur parti, la bulle laisse le bas de l'écran libre (1.23.1).
  // Une étape sans « Lancer » (la soupe du kit Survie) : le guide ouvre lui-même « Autre minuteur et son » et encadre
  // ses boutons, pour qu'un minuteur parte quand même en bas de l'écran (1.23.2).
  await etape(page, 'Le minuteur, puis l\'étape 2');
  const lancer = page.locator('#cook .tstart [data-tadd]');
  if (await lancer.count()) { await entoure(page, '#cook .tstart'); await lancer.first().click(); }
  else {
    await expect(page.locator('#cook details.tfree')).toHaveAttribute('open', '');
    await expect(bulle(page).locator('.gd-texte')).toContainText('touche « 1 min » pour en lancer un');
    await entoure(page, '#cook .tfree .seg');
    await expect(page.locator('#gd-doigt.vu')).toHaveCount(0, { timeout: 8000 });   // le doigt a mimé « 1 min », puis « Suivante »
    await libre(page, '#cook .tfree [data-tadd="60"]');
    await page.screenshot({ path: `tests/captures/${P}-guide-sans-minuteur.png` });
    await page.locator('#cook .tfree [data-tadd="60"]').click();
  }
  await expect(page.locator('#tray .tchip')).toBeVisible();
  await expect(bulle(page).locator('.gd-texte')).toContainText('Le minuteur roule, en bas de l\'écran');
  await entoure(page, '#cook .cook-nav');
  await expect.poll(async () => { const b = await bulle(page).boundingBox(), t = await page.locator('#tray').boundingBox(); return b.y + b.height <= t.y + 1; }).toBe(true);
  await libre(page, '#tray .tchip');
  await page.screenshot({ path: `tests/captures/${P}-guide-minuteur.png` });
  await page.locator('#next').click();
  await etape(page, 'Il te manque un ingrédient ?');
  await expect(page.locator('#cook .step-no')).toHaveText(/^Étape 2 sur/);
  await entoure(page, '#cook [data-adapt]');
  await expect(bulle(page)).toContainText('14 sur 14');
  await expect(bulle(page).getByRole('button', { name: 'Étape suivante' })).toBeDisabled();
  await bulle(page).getByRole('button', { name: 'Terminer' }).click();
  await expect(page.locator('#guide')).toHaveCount(0);
  await expect(page.locator('#gd-doigt.vu')).toHaveCount(0);
  expect(await page.evaluate(() => [localStorage.getItem('superchef-guide'), localStorage.getItem('superchef-guide-fin')])).toEqual([null, '1']);
  expect([...sim.classeurs.values()][0].onglets['Plans de semaine'].length).toBeGreaterThan(4);
  expect(erreurs).toEqual([]);
});

test('D-G-056 : ◀ refait le chemin en sens inverse, « Revoir le chemin », « Passer l\'animation »', async ({ page }) => {
  const { erreurs } = await ouvrir(page);
  await page.getByRole('button', { name: 'Se connecter avec Google' }).click();
  await etape(page, 'Choisis tes kits de recettes');
  await expect(bulle(page)).toContainText('2 sur 13');                                 // sans Gemini : pas d'étape « Adapter »
  await expect(bulle(page)).toContainText('À toi de jouer');
  await expect(bulle(page).getByRole('button', { name: 'Passer cette étape' })).toHaveCount(0);
  await bulle(page).getByRole('button', { name: 'Suivant', exact: true }).click();     // 1.23.1 : « Suivant » aussi quand il y a une action
  await etape(page, 'Ton stock de base');
  // Revoir : le doigt repart de Compte et retouche « Choisir mon stock de base ».
  await bulle(page).getByRole('button', { name: 'Revoir le chemin' }).click();
  await expect(page.locator('#stocksheet')).toHaveCount(0);
  await touche(page, 'Choisir mon stock de base');
  await etape(page, 'Ton stock de base');
  await suivant(page);
  await touche(page, '+ Recette');
  await etape(page, 'Tes recettes à toi');
  // ◀ : ← ferme l'ajout, puis 👥 Compte et le stock de base.
  await precedent(page);
  await touche(page, '👥 Compte');
  await etape(page, 'Ton stock de base');
  await expect(page.locator('#stocksheet')).toBeVisible();
  await expect(page.locator('#addsheet')).toHaveCount(0);
  // ▶ puis « Passer l'animation » : l'écran voulu tout de suite.
  await suivant(page);
  await bulle(page).getByRole('button', { name: 'Passer l\'animation' }).click();
  await etape(page, 'Tes recettes à toi');
  await expect(page.locator('#addsheet')).toBeVisible();
  await expect(page.locator('#gd-bouclier')).toHaveCount(0);
  expect(erreurs).toEqual([]);
});

test('D-G-057 : « Plus lent » double le temps du doigt et reste choisi ; plus de bouton « Écouter »', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('superchef-guide-voix', '1'); } catch (_) {} });   // clé de 1.23.0
  const { erreurs } = await ouvrir(page);
  await expect(bulle(page).getByRole('button', { name: /Écouter|Voix/ })).toHaveCount(0);
  await bulle(page).getByRole('button', { name: 'Plus lent' }).click();
  await expect(bulle(page).getByRole('button', { name: 'Plus lent' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Se connecter avec Google' }).click();
  await etape(page, 'Choisis tes kits de recettes');
  await bulle(page).getByRole('button', { name: 'Suivant', exact: true }).click();
  await etape(page, 'Ton stock de base');
  const t0 = Date.now();
  await bulle(page).getByRole('button', { name: 'Suivant', exact: true }).click();   // 3 touchers à environ 2 s
  await touche(page, '+ Recette');
  await etape(page, 'Tes recettes à toi');
  expect(Date.now() - t0).toBeGreaterThan(5000);
  expect(await page.evaluate(() => [localStorage.getItem('superchef-guide-vitesse'), localStorage.getItem('superchef-guide-voix')])).toEqual(['lent', null]);
  expect(erreurs).toEqual([]);
});

test('D-G-051 : reprendre après un rechargement, quitter, relancer depuis Compte', async ({ page }) => {
  const { erreurs } = await ouvrir(page);
  await page.getByRole('button', { name: 'Se connecter avec Google' }).click();
  await etape(page, 'Choisis tes kits de recettes');
  await bulle(page).getByRole('button', { name: 'Suivant', exact: true }).click();
  await etape(page, 'Ton stock de base');
  await page.reload();
  await etape(page, 'Reconnecte-toi');                                                // compte mémorisé : « Continuer » est encadré
  await entoure(page, '#connexion');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await touche(page, '👥 Compte');
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
  await etape(page, 'Choisis tes kits de recettes');
  expect(erreurs).toEqual([]);
});

test('D-G-056 : mouvement réduit, le doigt ne voyage pas mais chaque bouton s\'allume avant d\'être touché', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const { erreurs } = await ouvrir(page);
  await page.getByRole('button', { name: 'Se connecter avec Google' }).click();
  await expect(page.locator('#comptebtn.gd-vise')).toHaveCount(1, { timeout: 10000 });
  await etape(page, 'Choisis tes kits de recettes');
  await expect(page.locator('#comptesheet')).toBeVisible();
  expect(erreurs).toEqual([]);
});
