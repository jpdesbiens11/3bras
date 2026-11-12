// Client minimal des API Google Drive et Sheets (portée drive.file).
// Toute réponse est une donnée non fiable : on ne l'insère jamais en HTML.

const DRIVE = 'https://www.googleapis.com/drive/v3';
const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
export const TYPE_DOSSIER = 'application/vnd.google-apps.folder';
export const TYPE_CLASSEUR = 'application/vnd.google-apps.spreadsheet';
// Étiquette Drive qui retrouve les fichiers de l'app (D-G-012). Clé technique figée depuis 3eBras :
// la changer ferait perdre leur livre à ceux qui l'ont déjà (D-G-030).
export const CLE_APP = '3ebras';

export class ErreurGoogle extends Error {
  constructor(statut, message) { super(message || `HTTP ${statut}`); this.statut = statut; }
}

export function creerDrive({ jetonValide, fetch = globalThis.fetch.bind(globalThis) }) {
  // brut / typeBrut : corps déjà prêt (fichier ou multipart), D-G-048.
  async function appel(url, { methode = 'GET', corps, brut, typeBrut } = {}) {
    const jeton = await jetonValide();
    const rep = await fetch(url, {
      method: methode,
      headers: {
        Authorization: `Bearer ${jeton}`,
        ...(corps ? { 'Content-Type': 'application/json' } : brut !== undefined ? { 'Content-Type': typeBrut } : {})
      },
      body: corps ? JSON.stringify(corps) : brut
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
        `appProperties has { key='${CLE_APP}' and value='${echapper(role)}' }`,
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
          appProperties: { [CLE_APP]: role }
        }
      });
    },

    // Renomme un fichier créé par l'app (portée drive.file).
    renommer(id, nom) {
      return appel(`${DRIVE}/files/${encodeURIComponent(id)}?fields=${encodeURIComponent('id,name,webViewLink')}`, {
        methode: 'PATCH', corps: { name: nom }
      });
    },

    // D-G-048 : dépose un fichier créé par l'app (PDF d'une recette partagée), ou en remplace le contenu.
    televerser({ nom, type, octets, parent, role }) {
      const limite = `superchef-${Date.now().toString(36)}`;
      const meta = JSON.stringify({ name: nom, mimeType: type, ...(parent ? { parents: [parent] } : {}), appProperties: { [CLE_APP]: role } });
      const corps = new Blob([`--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${limite}\r\nContent-Type: ${type}\r\n\r\n`,
        octets, `\r\n--${limite}--`]);
      return appel(`${UPLOAD}?uploadType=multipart&fields=${encodeURIComponent('id,name,webViewLink')}`, { methode: 'POST', brut: corps, typeBrut: `multipart/related; boundary=${limite}` });
    },
    remplacerContenu(id, { type, octets, nom }) {
      return appel(`${UPLOAD}/${encodeURIComponent(id)}?uploadType=media&fields=${encodeURIComponent('id,name,webViewLink')}`, { methode: 'PATCH', brut: new Blob([octets], { type }), typeBrut: type })
        .then((f) => (nom && f.name !== nom ? this.renommer(id, nom) : f));
    },
    // Lien « toute personne qui a le lien peut lire » (portée drive.file : fichiers créés par l'app seulement).
    partagerLien(id) {
      return appel(`${DRIVE}/files/${encodeURIComponent(id)}/permissions?fields=id`, { methode: 'POST', corps: { role: 'reader', type: 'anyone' } });
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

    // D-G-040 : efface les valeurs (pas les lignes) des plages données.
    viderValeurs(id, plages) {
      return appel(`${SHEETS}/${encodeURIComponent(id)}/values:batchClear`, {
        methode: 'POST', corps: { ranges: plages }
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
