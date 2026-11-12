// D-G-049 : déplacer les soupers d'un soir à l'autre (tenir 2 s, glisser, déposer), puis réapprouver la semaine.
import { test, expect } from '@playwright/test';
import { brancher } from './outils.mjs';
import { LIVRE } from './fixture.mjs';

const ID = Object.fromEntries(LIVRE.recettes.map((r) => [r.Nom, r.id]));
const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

async function demarrer(page) {
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
  const b = await brancher(page);
  await page.goto('./');
  await page.getByRole('button', { name: 'Se connecter avec Google' }).click();
  await page.locator('#fichier-import').setInputFiles({ name: 'livre.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(LIVRE)) });
  await page.locator('#lancer-import').click();
  await expect(page.getByRole('heading', { name: 'Import terminé.' })).toBeVisible();
  await page.locator('[data-compteclose]').click();
  await expect(page.locator('.week .day[data-jour]')).toHaveCount(4);
  return { ...b, erreurs };
}
const centre = async (loc) => { const b = await loc.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
const titre = (page, i) => page.locator(`.week .day[data-jour="${i}"] h3`).textContent();
const caseDe = (page, i) => page.locator(`#deplacer [data-dpjour="${i}"]`);

/** Doigt (Galaxy S25, vrais événements tactiles) ou souris (PC). */
function geste(page, tactile) {
  let cdp = null;
  const t = async (type, p) => { cdp ||= await page.context().newCDPSession(page); await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: p ? [{ x: p.x, y: p.y, id: 1 }] : [] }); };
  return {
    async bas(p) { if (tactile) await t('touchStart', p); else { await page.mouse.move(p.x, p.y); await page.mouse.down(); } },
    async vers(p, de) {
      if (!tactile) return page.mouse.move(p.x, p.y, { steps: 8 });
      for (let k = 1; k <= 8; k++) await t('touchMove', { x: de.x + ((p.x - de.x) * k) / 8, y: de.y + ((p.y - de.y) * k) / 8 });
    },
    async haut() { if (tactile) await t('touchEnd'); else await page.mouse.up(); }
  };
}
async function lignesPlan(sim) {
  const c = [...sim.classeurs.values()][0], t = c.onglets['Plans de semaine'];
  const h = t[0], j = h.indexOf('Jour'), r = h.indexOf('Recette id'), d = h.indexOf('Dessert');
  return Object.fromEntries(t.slice(1).filter((l) => l[j] && String(l[d]) !== 'true').map((l) => [l[j], l[r] || '']));
}

test('D-G-049 : tenir 2 s, glisser au doigt ou à la souris, enregistrer, puis réapprouver', async ({ page }, info) => {
  const tactile = info.project.name === 's25';
  const { sim, erreurs } = await demarrer(page);
  const g = geste(page, tactile);
  const t = [await titre(page, 0), await titre(page, 1), await titre(page, 2), await titre(page, 3)];
  await expect(page.getByText('Astuce : tiens un souper 2 secondes')).toBeVisible();

  // Un toucher court reste un toucher : la recette s'ouvre.
  const p0 = await centre(page.locator('.week .day[data-jour="0"] h3'));
  await g.bas(p0); await page.waitForTimeout(250); await g.haut();
  await expect(page.locator('#sheet h2')).toHaveText(t[0]);
  await page.locator('#sheet [data-close]').first().click();
  await expect(page.locator('#deplacer')).toHaveCount(0);

  // Tenir 2 s : la vue compacte s'ouvre sous le doigt ; glisser sur mardi, l'échange se voit avant de relâcher.
  const d0 = await centre(page.locator('.week .day[data-jour="0"] .dname'));
  await g.bas(d0);
  await page.waitForTimeout(800);
  await expect(page.locator('#deplacer')).toHaveCount(0);                     // pas avant 2 s
  await expect(page.locator('.week .day[data-jour="0"]')).toHaveClass(/tenir/);
  await page.waitForTimeout(1500);
  await expect(page.getByRole('dialog', { name: 'Glisse un souper vers un autre soir' })).toBeVisible();
  await expect(page.locator('.dp-fantome')).toHaveText(t[0]);
  const c2 = await centre(caseDe(page, 2));
  await g.vers(c2, d0);
  await expect(caseDe(page, 2)).toHaveClass(/cible/);
  await expect(caseDe(page, 2)).toContainText(t[0]);
  await expect(caseDe(page, 0)).toContainText(t[2]);
  await page.screenshot({ path: `tests/captures/${info.project.name}-deplacer.png` });
  await g.haut();
  await expect(page.locator('.dp-fantome')).toHaveCount(0);
  await expect(caseDe(page, 2)).toContainText(t[0]);
  await expect(caseDe(page, 0)).toContainText(t[2]);
  await expect(page.locator('.dp-annonce')).toContainText(`${t[0]} : mardi`);

  // On jongle : lundi va au jeudi libre (lundi devient libre), puis toucher mercredi puis dimanche.
  const c1 = await centre(caseDe(page, 1)), c4 = await centre(caseDe(page, 4));
  await g.bas(c1); await g.vers(c4, c1); await g.haut();
  await expect(caseDe(page, 4)).toContainText(t[1]);
  await expect(caseDe(page, 1)).toHaveText('Soir libre');
  await caseDe(page, 3).click();
  await expect(caseDe(page, 3)).toHaveAttribute('aria-pressed', 'true');
  await caseDe(page, 0).click();
  await expect(caseDe(page, 0)).toContainText(t[3]);
  await expect(caseDe(page, 3)).toContainText(t[2]);

  // Enregistrer : retour à la semaine, dans le nouvel ordre, à approuver. Rien n'est encore écrit dans le classeur.
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.locator('#deplacer')).toHaveCount(0);
  for (const [i, x] of [[0, t[3]], [2, t[0]], [3, t[2]], [4, t[1]]]) expect(await titre(page, i)).toBe(x);
  await expect(page.locator('.week .day[data-jour="1"]')).toHaveCount(0);
  await expect(page.locator('[data-dtog="1"]')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('[data-dtog="4"]')).toHaveAttribute('aria-pressed', 'true');
  expect(await lignesPlan(sim)).toEqual({});
  await page.locator('#save').click();
  await expect(page.locator('#save')).toHaveText('Semaine approuvée');
  const attendu = { Dimanche: ID[t[3]], Mardi: ID[t[0]], Mercredi: ID[t[2]], Jeudi: ID[t[1]] };
  expect(await lignesPlan(sim)).toEqual(attendu);

  // Semaine approuvée : on peut encore déplacer, mais il faut réapprouver pour l'écrire.
  await page.locator('.week .day[data-jour="0"]').scrollIntoViewIfNeeded();
  const e0 = await centre(page.locator('.week .day[data-jour="0"] .dname'));
  await g.bas(e0); await page.waitForTimeout(2200);
  const e3 = await centre(caseDe(page, 3));
  await g.vers(e3, e0); await g.haut();
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.locator('#save')).toHaveText('Approuver la semaine');
  await expect(page.locator('.week-foot .status')).toContainText('Modifiée : approuve de nouveau la semaine');
  expect(await lignesPlan(sim)).toEqual(attendu);
  await page.locator('#save').click();
  await expect(page.locator('#save')).toHaveText('Semaine approuvée');
  expect(await lignesPlan(sim)).toEqual({ ...attendu, Dimanche: ID[t[2]], Mercredi: ID[t[3]] });

  // « Déplacer » ouvre la même vue ; Échap annule sans rien changer.
  await page.locator('#deplacer-btn').click();
  await caseDe(page, 0).click(); await caseDe(page, 4).click();
  await expect(caseDe(page, 0)).toContainText(t[1]);
  await page.keyboard.press('Escape');
  await expect(page.locator('#deplacer')).toHaveCount(0);
  expect(await titre(page, 0)).toBe(t[2]);
  await expect(page.locator('#save')).toHaveText('Semaine approuvée');
  expect(erreurs).toEqual([]);
});
