// Configuration publique de 3eBras. Aucun secret ici (P-11, D-04).
// L'ID client OAuth « Application Web » est public par nature.
export const CONFIG = Object.freeze({
  version: '1.0.0',
  clientId: '',
  portees: 'openid email https://www.googleapis.com/auth/drive.file',
  nomDossier: '3eBras',
  nomClasseur: '3eBras — Livre',
  versionSchema: 1
});
