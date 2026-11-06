// Faux Google Drive + Sheets en mémoire, branché sur fetch. Aucun réseau.
export function creerDriveSimule() {
  const fichiers = [];
  const classeurs = new Map();
  const appels = [];
  let compteur = 0;

  const json = (statut, corps) => ({
    ok: statut < 400, status: statut, json: async () => corps
  });

  async function fetch(url, opts = {}) {
    const u = new URL(url);
    const methode = opts.method || 'GET';
    const corps = opts.body ? JSON.parse(opts.body) : null;
    appels.push({ methode, url, corps, auth: opts.headers?.Authorization });
    if (opts.headers?.Authorization !== 'Bearer jeton-test') return json(401, { error: { message: 'jeton' } });

    if (u.pathname === '/drive/v3/files' && methode === 'GET') {
      const q = u.searchParams.get('q');
      const role = /value='([^']+)'/.exec(q)[1];
      const type = /mimeType='([^']+)'/.exec(q)[1];
      return json(200, { files: fichiers.filter((f) => f.appProperties['3ebras'] === role && f.mimeType === type) });
    }
    if (u.pathname === '/drive/v3/files' && methode === 'POST') {
      const f = { id: `f${++compteur}`, name: corps.name, mimeType: corps.mimeType,
        parents: corps.parents || [], appProperties: corps.appProperties, webViewLink: `https://x/${compteur}` };
      fichiers.push(f);
      if (f.mimeType.endsWith('spreadsheet')) {
        classeurs.set(f.id, { sheets: [{ properties: { sheetId: 0, title: 'Feuille 1' } }], valeurs: {} });
      }
      return json(200, f);
    }
    const m = /^\/v4\/spreadsheets\/([^/:]+)(.*)$/.exec(u.pathname);
    if (m) {
      const c = classeurs.get(decodeURIComponent(m[1]));
      if (!c) return json(404, { error: { message: 'introuvable' } });
      if (m[2] === '' && methode === 'GET') return json(200, { sheets: c.sheets });
      if (m[2] === ':batchUpdate') {
        for (const r of corps.requests) {
          if (r.updateSheetProperties) {
            const s = c.sheets.find((x) => x.properties.sheetId === r.updateSheetProperties.properties.sheetId);
            s.properties.title = r.updateSheetProperties.properties.title;
          } else if (r.addSheet) {
            c.sheets.push({ properties: { sheetId: c.sheets.length + 100, title: r.addSheet.properties.title } });
          }
        }
        return json(200, {});
      }
      if (m[2] === '/values:batchUpdate') {
        for (const d of corps.data) c.valeurs[d.range] = d.values;
        return json(200, {});
      }
    }
    if (u.pathname === '/oauth2/v3/userinfo') return json(200, { email: 'jp@exemple.ca' });
    return json(404, { error: { message: `route ${methode} ${u.pathname}` } });
  }

  return { fetch, fichiers, classeurs, appels };
}
