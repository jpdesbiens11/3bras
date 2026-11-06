// Google simulé pour les tests de bout en bout (aucun réseau sortant).
import { readFile } from 'node:fs/promises';
import { creerDriveSimule } from '../unit/drive-simule.mjs';

const FAUX_GIS = `
window.google = { accounts: { oauth2: {
  initTokenClient: (cfg) => ({ requestAccessToken: () =>
    setTimeout(() => cfg.callback({ access_token: 'jeton-test', expires_in: 3600 }), 50) }),
  revoke: (j, cb) => cb && cb()
} } };`;

export async function brancher(page, { clientId = 'client-test.apps.googleusercontent.com', ia } = {}) {
  const sim = creerDriveSimule();
  const sorties = [];
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === 'localhost') {
      if (url.pathname.endsWith('/js/config.js')) {
        const src = await readFile(new URL('../../dist/js/config.js', import.meta.url), 'utf8');
        let js = src.replace(/clientId: '[^']*'/, `clientId: '${clientId}'`);
        if (ia) js = js.replace(/ia: null/, `ia: ${JSON.stringify(ia)}`);
        return route.fulfill({ contentType: 'text/javascript', body: js });
      }
      // Firebase simulé (D-G-029) : mêmes exports que les modules servis par l'app.
      if (ia && url.pathname.includes('/vendor/firebase/')) {
        const nom = url.pathname.split('/').pop();
        const faux = {
          'firebase-app.js': 'export const initializeApp = (c) => ({ c });',
          'firebase-app-check.js': 'export class ReCaptchaV3Provider { constructor(k) { this.k = k; } } export const initializeAppCheck = (app, o) => { window.__appcheck = o.provider.k; };',
          'firebase-ai.js': `export class GoogleAIBackend {}
            export const getAI = () => ({});
            export const getGenerativeModel = (ai, o) => ({ generateContent: async (parts) => { window.__gemini = { modele: o.model, outils: o.tools || [], parts }; return { response: { text: () => window.__reponseGemini } }; } });`
        }[nom];
        return route.fulfill({ contentType: 'text/javascript', body: faux });
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

