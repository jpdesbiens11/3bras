// Client minimal des API Google Drive et Sheets (portée drive.file).
// Toute réponse est une donnée non fiable : on ne l'insère jamais en HTML.

const DRIVE = 'https://www.googleapis.com/drive/v3';
const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';
export const TYPE_DOSSIER = 'application/vnd.google-apps.folder';
export const TYPE_CLASSEUR = 'application/vnd.google-apps.spreadsheet';

export class ErreurGoogle extends Error {
  constructor(statut, message) { super(message || `HTTP ${statut}`); this.statut = statut; }
}

export function creerDrive({ jetonValide, fetch = globalThis.fetch.bind(globalThis) }) {
  async function appel(url, { methode = 'GET', corps } = {}) {
    const jeton = await jetonValide();
    const rep = await fetch(url, {
      method: methode,
      headers: {
        Authorization: `Bearer ${jeton}`,
        ...(corps ? { 'Content-Type': 'application/json' } : {})
      },
      body: corps ? JSON.stringify(corps) : undefined
    });
    if (!rep.ok) {
      let msg = '';
      try { msg = (await rep.json())?.error?.message || ''; } catch { /* corps vide */ }
      throw new ErreurGoogle(rep.status, msg);
    }
    return rep.status === 204 ? null : rep.json();
  }

  const echapper = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

  return {
    // Cherche les fichiers créés par l'app portant une étiquette donnée.
    async chercher({ role, type }) {
      const q = [
        `appProperties has { key='3ebras' and value='${echapper(role)}' }`,
        `mimeType='${echapper(type)}'`,
        'trashed=false'
      ].join(' and ');
      const url = `${DRIVE}/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent('files(id,name,webViewLink)')}&spaces=drive&pageSize=10`;
      return (await appel(url)).files || [];
    },

    creerFichier({ nom, type, parent, role }) {
      return appel(`${DRIVE}/files?fields=${encodeURIComponent('id,name,webViewLink')}`, {
        methode: 'POST',
        corps: {
          name: nom,
          mimeType: type,
          ...(parent ? { parents: [parent] } : {}),
          appProperties: { '3ebras': role }
        }
      });
    },

    lireClasseur(id) {
      return appel(`${SHEETS}/${encodeURIComponent(id)}?fields=${encodeURIComponent('sheets.properties(sheetId,title)')}`);
    },

    majClasseur(id, requetes) {
      return appel(`${SHEETS}/${encodeURIComponent(id)}:batchUpdate`, {
        methode: 'POST', corps: { requests: requetes }
      });
    },

    ecrireValeurs(id, donnees) {
      return appel(`${SHEETS}/${encodeURIComponent(id)}/values:batchUpdate`, {
        methode: 'POST', corps: { valueInputOption: 'RAW', data: donnees }
      });
    },

    lireValeurs(id, plage) {
      return appel(`${SHEETS}/${encodeURIComponent(id)}/values/${encodeURIComponent(plage)}`);
    },

    lirePlusieurs(id, plages) {
      const qs = plages.map((p) => `ranges=${encodeURIComponent(p)}`).join('&');
      return appel(`${SHEETS}/${encodeURIComponent(id)}/values:batchGet?${qs}`);
    },

    // Ajoute des lignes à la fin d'un onglet (jamais par numéro de ligne).
    ajouterValeurs(id, plage, lignes) {
      return appel(`${SHEETS}/${encodeURIComponent(id)}/values/${encodeURIComponent(plage)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
        methode: 'POST', corps: { values: lignes }
      });
    },

    moi() {
      return appel('https://www.googleapis.com/oauth2/v3/userinfo');
    }
  };
}
