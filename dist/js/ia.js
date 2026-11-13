// Gemini par Firebase AI Logic (D-G-029) : convertit une recette (texte, photo, PDF, lien) en fiche du livre.
// Aucune clé secrète dans l'app : la configuration Firebase est publique, la clé Gemini reste chez Google,
// et App Check (Fraud Defense, anciennement reCAPTCHA Enterprise) n'accepte que les appels qui viennent de SuperChef.ai.
// La bibliothèque Firebase est chargée seulement à la première conversion.
import { CONFIG } from './config.js?v=1.23.1';

let modele = null;

export const iaDisponible = () => !!(CONFIG.ia && CONFIG.ia.apiKey && CONFIG.ia.projectId && CONFIG.ia.appId && CONFIG.ia.recaptcha);

async function obtenirModele() {
  if (modele) return modele;
  const [{ initializeApp }, { initializeAppCheck, ReCaptchaEnterpriseProvider }, { getAI, getGenerativeModel, GoogleAIBackend }] = await Promise.all([
    import('../vendor/firebase/firebase-app.js'),
    import('../vendor/firebase/firebase-app-check.js'),
    import('../vendor/firebase/firebase-ai.js')
  ]);
  const { apiKey, projectId, appId, recaptcha } = CONFIG.ia;
  const app = initializeApp({ apiKey, projectId, appId, authDomain: `${projectId}.firebaseapp.com` }, 'superchef');
  initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(recaptcha), isTokenAutoRefreshEnabled: true });
  const ai = getAI(app, { backend: new GoogleAIBackend() });
  modele = { ai, getGenerativeModel };
  return modele;
}

// parties : [{ texte }] ou [{ mimeType, data (base64) }] ; url : lien à lire par Gemini (outil URL context).
// rapide : modèle léger (Flash-Lite) pour les petites retouches de texte (D-G-033).
export async function convertirAvecGemini(consigne, parties, url, { rapide = false, max = 4096 } = {}) {
  const { ai, getGenerativeModel } = await obtenirModele();
  const m = getGenerativeModel(ai, {
    model: (rapide && CONFIG.ia.modeleRapide) || CONFIG.ia.modele || 'gemini-3.5-flash',
    generationConfig: { temperature: rapide ? 0.2 : max > 4096 ? 0.6 : 0.2, maxOutputTokens: max },
    ...(url ? { tools: [{ urlContext: {} }] } : {})
  });
  const contenu = [
    ...parties.filter((p) => p.data).map((p) => ({ inlineData: { mimeType: p.mimeType, data: p.data } })),
    consigne
  ];
  const rep = await m.generateContent(contenu);
  return rep.response.text();
}

// D-G-055 : un lot de recettes s'écrit en flux : le texte arrive morceau par morceau (le progrès se voit), au plus
// 150 secondes, et on peut l'arrêter (signal). Sans flux (tests, vieux module), un seul appel.
export async function ecrireAvecGemini(consigne, { max = 12000, suivi, signal, delai = 150000 } = {}) {
  const { ai, getGenerativeModel } = await obtenirModele();
  const m = getGenerativeModel(ai, { model: CONFIG.ia.modele || 'gemini-3.5-flash', generationConfig: { temperature: 0.6, maxOutputTokens: max } });
  const opts = { timeout: delai, ...(signal ? { signal } : {}) };
  if (typeof m.generateContentStream !== 'function') { const r = await m.generateContent([consigne], opts); const t = r.response.text(); suivi?.(t); return t; }
  const { stream } = await m.generateContentStream([consigne], opts);
  let texte = '';
  for await (const morceau of stream) {
    if (signal?.aborted) break;
    try { texte += morceau.text(); } catch (_) { /* morceau sans texte */ }
    suivi?.(texte);
  }
  return texte;
}

// Message clair pour les erreurs de Google.
export function erreurIA(e) {
  // Firebase classe toute réponse HTTP en « fetch-error » : on lit le message, pas le code.
  try { console.error('[SuperChef.ai] Gemini', e); } catch { /* console absente */ }
  const code = String((e && e.code) || '');
  const msg = String((e && e.message) || '');
  const t = `${code} ${msg}`;
  // « App Check token is invalid » : le jeton anti-robot a été refusé (réglage reCAPTCHA chez Google, ou bloqueur du navigateur).
  if (/app.?check|attestation|recaptcha|initial-throttle/i.test(t)) return 'La vérification anti-robot de Google a échoué, alors Gemini a refusé l\'appel. Réessaie dans une minute ; si ça revient, un bloqueur de pub ou un réglage chez Google est en cause.';
  if (/\b429\b|quota|RESOURCE_EXHAUSTED/i.test(t)) return 'La limite gratuite de Gemini est atteinte pour le moment. Réessaie plus tard, ou passe par le projet Claude SuperChef.ai.';
  if (/SAFETY/i.test(t)) return 'Gemini a refusé ce contenu. Essaie avec le texte de la recette.';
  if (/timeout|has expired|deadline/i.test(t)) return 'Gemini a mis trop de temps à répondre (plus de 2 minutes). Réessaie, ou demande moins de recettes à la fois.';
  if (/^(TypeError: )?(Failed to fetch|NetworkError|Load failed)/i.test(msg) || (typeof navigator !== 'undefined' && navigator.onLine === false)) return 'Pas de réseau pour joindre Gemini. Réessaie dans un moment.';
  return `Gemini n'a pas pu convertir la recette : ${msg.slice(0, 200) || code}`;
}
