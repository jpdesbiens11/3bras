// D-G-048 : partager une recette en PDF, avec les choix du « Partager » de Dynamite | Agile.
import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { brancher } from './outils.mjs';
import { LIVRE } from './fixture.mjs';

async function demarrer(page, avant) {
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
  const b = await brancher(page);
  if (avant) await page.addInitScript(avant);
  await page.goto('./');
  await page.getByRole('button', { name: 'Se connecter avec Google' }).click();
  await page.locator('#fichier-import').setInputFiles({ name: 'livre.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(LIVRE)) });
  await page.locator('#lancer-import').click();
  await expect(page.getByRole('heading', { name: 'Import terminé.' })).toBeVisible();
  await page.locator('[data-compteclose]').click();
  await page.locator('[data-go="tri"]').click();
  await page.getByRole('button', { name: /Poulet au citron test/ }).click();
  return { ...b, erreurs };
}
const NOM = 'poulet-au-citron-test-superchef.pdf';

test('D-G-048 : à l\'ordinateur, PDF téléchargé avant chaque choix, lien Google Drive et code QR', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'pc-1440', 'feuille de l\'ordinateur');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const { sim, erreurs, sorties } = await demarrer(page, () => { window.__ouverts = []; window.open = (u) => { window.__ouverts.push(u); return null; }; });
  await page.getByRole('button', { name: 'Partager la recette Poulet au citron test en PDF' }).click();
  const feuille = page.getByRole('dialog', { name: 'Poulet au citron test' });
  await expect(feuille).toBeVisible();
  await expect(feuille).toContainText(NOM);
  await expect(feuille).toContainText('PDF · 1 page ·');
  await expect(feuille.locator('[data-ptway]')).toHaveCount(8);
  await page.screenshot({ path: 'tests/captures/pc-1440-partage.png' });

  // Télécharger : le vrai fichier PDF, avec la recette dedans.
  const [dl] = await Promise.all([page.waitForEvent('download'), feuille.getByRole('button', { name: 'Télécharger' }).click()]);
  expect(dl.suggestedFilename()).toBe(NOM);
  const pdf = (await readFile(await dl.path())).toString('latin1');
  expect(pdf.startsWith('%PDF-1.4')).toBe(true);
  for (const t of ['(Poulet au citron test) Tj', '(Marinade) Tj', '(M\\351langer la marinade.) Tj', '(Page 1 sur 1) Tj']) expect(pdf).toContain(t);

  // Gmail sans lien : le PDF d'abord, puis Gmail avec le message.
  const [dl2] = await Promise.all([page.waitForEvent('download'), feuille.getByRole('button', { name: 'Gmail' }).click()]);
  expect(dl2.suggestedFilename()).toBe(NOM);
  await expect(page.locator('#toast')).toContainText('PDF téléchargé : joins-le au message dans Gmail');
  let ouverts = await page.evaluate(() => window.__ouverts);
  expect(ouverts[0]).toMatch(/^https:\/\/mail\.google\.com\/mail\/\?view=cm&fs=1&su=Recette%20%3A%20Poulet%20au%20citron%20test&body=/);

  // Lien Google Drive : le PDF dans Exports, lisible par qui a le lien ; code QR.
  await feuille.getByRole('button', { name: 'Créer le lien Google Drive' }).click();
  const champ = feuille.getByLabel('Lien du PDF');
  await expect(champ).toHaveValue(/^https:\/\/drive\.google\.com\/file\/d\/f\d+\/view/);
  await expect(feuille.locator('#pt-qr canvas')).toBeVisible();
  const pdfs = sim.fichiers.filter((f) => f.mimeType === 'application/pdf');
  const exportsId = sim.fichiers.find((f) => f.appProperties['3ebras'] === 'sous-dossier:Exports').id;
  expect(pdfs.map((f) => [f.name, f.appProperties['3ebras'], f.parents[0], f.permissions])).toEqual([[NOM, 'partage:r-poulet', exportsId, [{ role: 'reader', type: 'anyone' }]]]);
  const lien = await champ.inputValue();
  await page.screenshot({ path: 'tests/captures/pc-1440-partage-lien.png' });

  // Avec le lien : WhatsApp reçoit le lien, il est copié, rien n'est téléchargé.
  let telechargements = 0; page.on('download', () => telechargements++);
  await feuille.getByRole('button', { name: 'WhatsApp' }).click();
  await expect(page.locator('#toast')).toContainText('Lien copié aussi');
  ouverts = await page.evaluate(() => window.__ouverts);
  expect(ouverts.at(-1)).toBe(`https://wa.me/?text=${encodeURIComponent(`Recette : Poulet au citron test — ${lien} — SuperChef.ai`)}`);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(lien);
  expect(telechargements).toBe(0);
  await feuille.getByRole('button', { name: 'Texto' }).click();
  await expect(page.locator('#toast')).toContainText('vise le code QR');
  await expect(feuille.locator('#pt-qr')).toHaveClass(/pt-flash/);

  // Échap ferme le partage, la fiche reste ; un nouveau lien remplace le même fichier (même adresse).
  await page.keyboard.press('Escape');
  await expect(page.locator('#partage')).toHaveCount(0);
  await expect(page.locator('#sheet h2')).toHaveText('Poulet au citron test');
  await page.getByRole('button', { name: 'Partager la recette Poulet au citron test en PDF' }).click();
  await page.getByRole('button', { name: 'Créer le lien Google Drive' }).click();
  await expect(page.getByLabel('Lien du PDF')).toHaveValue(lien);
  expect(sim.fichiers.filter((f) => f.mimeType === 'application/pdf')).toHaveLength(1);
  await page.getByRole('button', { name: 'Fermer le partage' }).click();
  await expect(page.locator('#partage')).toHaveCount(0);
  expect(new Set(sorties.filter((h) => !/googleapis\.com$|^accounts\.google\.com$/.test(h)))).toEqual(new Set());
  expect(erreurs).toEqual([]);
});

test('D-G-048 : au téléphone, la feuille de partage du système reçoit le PDF', async ({ page }, info) => {
  test.skip(info.project.name !== 's25', 'téléphone');
  const { erreurs } = await demarrer(page, () => {
    window.__mode = 'ok';
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: (d) => !!(d && d.files && d.files.length) });
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (d) => {
      if (window.__mode === 'annule') throw new DOMException('annulé', 'AbortError');
      if (window.__mode === 'refus') throw new DOMException('refusé', 'NotAllowedError');
      const f = d.files[0];
      window.__partage = { nom: f.name, type: f.type, debut: await f.slice(0, 8).text(), taille: f.size, texte: d.text, titre: d.title };
    } });
  });
  const bouton = page.getByRole('button', { name: 'Partager la recette Poulet au citron test en PDF' });
  await bouton.click();
  await expect.poll(() => page.evaluate(() => window.__partage)).toBeTruthy();
  const p = await page.evaluate(() => window.__partage);
  expect([p.nom, p.type, p.debut, p.titre]).toEqual([NOM, 'application/pdf', '%PDF-1.4', 'Poulet au citron test']);
  expect(p.taille).toBeGreaterThan(2000);
  expect(p.texte).toBe('Recette : Poulet au citron test (PDF joint) — SuperChef.ai');
  await expect(page.locator('#partage')).toHaveCount(0);

  await page.evaluate(() => { window.__mode = 'annule'; });
  await bouton.click();
  await page.waitForTimeout(300);
  await expect(page.locator('#partage')).toHaveCount(0);                   // annulé : rien d'autre ne s'ouvre

  await page.evaluate(() => { window.__mode = 'refus'; });
  await bouton.click();                                                    // refusé : la feuille de l'app prend le relais
  await expect(page.getByRole('dialog', { name: 'Poulet au citron test' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Autres applications…' })).toBeVisible();
  await page.screenshot({ path: 'tests/captures/s25-partage.png' });
  expect(erreurs).toEqual([]);
});
