// Google simulé pour les tests de bout en bout (aucun réseau sortant).
import { readFile } from 'node:fs/promises';
import { creerDriveSimule } from '../unit/drive-simule.mjs';

const FAUX_GIS = `
window.google = { accounts: { oauth2: {
  initTokenClient: (cfg) => ({ requestAccessToken: () =>
    setTimeout(() => cfg.callback({ access_token: 'jeton-test', expires_in: 3600 }), 50) }),
  revoke: (j, cb) => cb && cb()
} } };`;

export async function brancher(page, { clientId = 'client-test.apps.googleusercontent.com', relais } = {}) {
  const envois = [];
  const sim = creerDriveSimule();
  const sorties = [];
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === 'localhost') {
      if (url.pathname.endsWith('/js/config.js')) {
        const src = await readFile(new URL('../../dist/js/config.js', import.meta.url), 'utf8');
        let js = src.replace(/clientId: '[^']*'/, `clientId: '${clientId}'`);
        if (relais !== undefined) js = js.replace(/relais: '[^']*'/, `relais: '${relais}'`);
        return route.fulfill({ contentType: 'text/javascript', body: js });
      }
      return route.continue();
    }
    sorties.push(url.hostname);
    if (url.href.startsWith('https://accounts.google.com/gsi/client')) {
      return route.fulfill({ contentType: 'text/javascript', body: FAUX_GIS });
    }
    if (url.hostname === '3bras-relais.jpdesbiens11.workers.dev') {
      const cors = { 'Access-Control-Allow-Origin': 'http://localhost:4173', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      const d = JSON.parse(route.request().postData() || '{}'); envois.push(d);
      const nom = (d.texte || '').split('\n')[0] || (d.images?.length ? 'Recette en photo' : 'Recette du lien');
      const fiche = { nom, type: d.type, proteine: 'Végé', portions: 4, temps_total_min: 50, ingredients: [{ groupe: null, items: ['4 oignons', '1 l de bouillon'] }], etapes: ['Caraméliser 30 minutes.', 'Mijoter 20 minutes.'], sous_chef: ['Peler les oignons'], source_nom: 'Test', source_categorie: 'Web autre', a_verifier: '' };
      return route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify({ texte: '```json\n' + JSON.stringify(fiche) + '\n```' }) });
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
  return { sim, sorties, envois };
}

