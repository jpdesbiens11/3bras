// Google simulé pour les tests de bout en bout (aucun réseau sortant).
import { readFile } from 'node:fs/promises';
import { creerDriveSimule } from '../unit/drive-simule.mjs';

const FAUX_GIS = `
window.google = { accounts: { oauth2: {
  initTokenClient: (cfg) => ({ requestAccessToken: () =>
    setTimeout(() => cfg.callback({ access_token: 'jeton-test', expires_in: 3600 }), 50) }),
  revoke: (j, cb) => cb && cb()
} } };`;

export async function brancher(page, { clientId = 'client-test.apps.googleusercontent.com', ia, visite = false, guide = false } = {}) {
  const sim = creerDriveSimule();
  // D-G-047 : la visite guidée est déjà vue dans les tests, sauf ceux qui la testent.
  if (!visite) await page.addInitScript(() => { try { localStorage.setItem('superchef-visite', 'cachee'); } catch (_) {} });
  // D-G-051 : la mise en place guidée est déjà faite, sauf pour les tests qui la suivent.
  if (!guide) await page.addInitScript(() => { try { localStorage.setItem('superchef-guide-fin', '1'); } catch (_) {} });
  const sorties = [];
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === 'localhost') {
      if (url.pathname.endsWith('/js/config.js')) {
        const src = await readFile(new URL('../../dist/js/config.js', import.meta.url), 'utf8');
        let js = src.replace(/clientId: '[^']*'/, `clientId: '${clientId}'`);
        js = js.replace(/ia: (null|\{[\s\S]*?\n  \})/, `ia: ${ia ? JSON.stringify(ia) : 'null'}`); // tests : Firebase seulement si demandé
        return route.fulfill({ contentType: 'text/javascript', body: js });
      }
      // Firebase simulé (D-G-029) : mêmes exports que les modules servis par l'app.
      if (ia && url.pathname.includes('/vendor/firebase/')) {
        const nom = url.pathname.split('/').pop();
        const faux = {
          'firebase-app.js': 'export const initializeApp = (c) => ({ c });',
          'firebase-app-check.js': 'export class ReCaptchaEnterpriseProvider { constructor(k) { this.k = k; } } export const initializeAppCheck = (app, o) => { window.__appcheck = o.provider.k; };',
          'firebase-ai.js': `export class GoogleAIBackend {}
            export const getAI = () => ({});
            export const getGenerativeModel = (ai, o) => ({
              generateContent: async (parts) => { window.__gemini = { modele: o.model, outils: o.tools || [], parts }; return { response: { text: () => window.__reponseGemini } }; },
              // D-G-055 : en flux, une fiche à la fois ; window.__geminiLent (ms) ralentit chaque morceau ; le signal arrête tout
              generateContentStream: async (parts, opts = {}) => {
                window.__gemini = { modele: o.model, outils: o.tools || [], parts, flux: true, delai: opts.timeout, max: o.generationConfig?.maxOutputTokens };
                window.__appelsGemini = (window.__appelsGemini || 0) + 1;
                const morceaux = String(window.__reponseGemini).split(/(?=FICHE SUPERCHEF)/);
                return { stream: (async function* () {
                  for (const m of morceaux) {
                    await new Promise((ok, non) => { const t = setTimeout(ok, window.__geminiLent || 30); opts.signal?.addEventListener('abort', () => { clearTimeout(t); non(new DOMException('arrêt', 'AbortError')); }); });
                    yield { text: () => m };
                  }
                })() };
              }
            });`
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
        ? { Authorization: req.headers().authorization } : {}, body: url.pathname.startsWith('/upload/') ? req.postDataBuffer()?.toString('latin1') : req.postData() || undefined });
      return route.fulfill({ status: rep.status, contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(await rep.json()) });
    }
    return route.abort();
  });
  return { sim, sorties };
}

