// Google simulé pour les tests de bout en bout (aucun réseau sortant).
import { readFile } from 'node:fs/promises';
import { creerDriveSimule } from '../unit/drive-simule.mjs';

const FAUX_GIS = `
window.google = { accounts: { oauth2: {
  initTokenClient: (cfg) => ({ requestAccessToken: () =>
    setTimeout(() => cfg.callback({ access_token: 'jeton-test', expires_in: 3600 }), 50) }),
  revoke: (j, cb) => cb && cb()
} } };`;

export async function brancher(page, { clientId = 'client-test.apps.googleusercontent.com' } = {}) {
  const sim = creerDriveSimule();
  const sorties = [];
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === 'localhost') {
      if (url.pathname.endsWith('/js/config.js')) {
        const src = await readFile(new URL('../../dist/js/config.js', import.meta.url), 'utf8');
        return route.fulfill({ contentType: 'text/javascript', body: src.replace(/clientId: '[^']*'/, `clientId: '${clientId}'`) });
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

