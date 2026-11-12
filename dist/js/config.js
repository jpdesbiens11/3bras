// Configuration publique de SuperChef.ai. Aucun secret ici (P-11, D-04).
// L'ID client OAuth « Application Web » est public par nature.
export const CONFIG = Object.freeze({
  version: '1.7.0',
  clientId: '437109324574-b0kdk554tldhsj1gjllnhu42m1gueorr.apps.googleusercontent.com',
  portees: 'openid email https://www.googleapis.com/auth/drive.file',
  // Gemini par Firebase AI Logic (D-G-029). Valeurs publiques, aucun secret ; null = sans IA dans l'app.
  // recaptcha = clé de site Fraud Defense (reCAPTCHA Enterprise), publique.
  ia: {
    apiKey: 'AIzaSyDcRyNWTSQ2z5QBWCeSWd76-cz2fduTQrY',
    projectId: 'bras-933fe',
    appId: '1:114065620639:web:90aad8b0c51fb746d4acaa',
    recaptcha: '6LdKxxMuAAAAAD0AMxXXAVdsehXE4jkRs-5U-OtS',
    modele: 'gemini-3.5-flash'
  },
  nomDossier: 'SuperChef.ai',
  nomClasseur: 'SuperChef.ai — Livre',
  versionSchema: 1
});
