// Faux Google Drive + Sheets en mémoire, branché sur fetch. Aucun réseau.
// Chaque classeur garde ses onglets en tableaux 2D, comme Sheets.
const col = (l) => [...l].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0);

function parsePlage(p) {
  const m = /^'(.+)'(?:!([A-Z]+)(\d*)(?::([A-Z]+)(\d*))?)?$/.exec(p);
  if (!m) throw new Error(`plage ${p}`);
  return { onglet: m[1], c1: m[2] ? col(m[2]) - 1 : 0, r1: m[3] ? Number(m[3]) - 1 : 0,
    r2: m[5] ? Number(m[5]) - 1 : Infinity, c2: m[4] ? col(m[4]) - 1 : Infinity };
}

export function creerDriveSimule() {
  const fichiers = [];
  const classeurs = new Map();
  const appels = [];
  let compteur = 0;

  const json = (statut, corps) => ({ ok: statut < 400, status: statut, json: async () => corps });

  function lire(c, plage) {
    const p = parsePlage(plage);
    const t = c.onglets[p.onglet];
    if (!t) return null;
    const lignes = t.slice(p.r1, p.r2 === Infinity ? undefined : p.r2 + 1)
      .map((l) => l.slice(p.c1, p.c2 === Infinity ? undefined : p.c2 + 1));
    while (lignes.length && !lignes[lignes.length - 1].length) lignes.pop();
    return { range: plage, values: lignes.length ? lignes : undefined };
  }

  function ecrire(c, plage, valeurs) {
    const p = parsePlage(plage);
    const t = (c.onglets[p.onglet] ||= []);
    valeurs.forEach((l, i) => {
      const r = p.r1 + i;
      while (t.length <= r) t.push([]);
      l.forEach((v, j) => { t[r][p.c1 + j] = v; });
    });
  }

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
        classeurs.set(f.id, { sheets: [{ properties: { sheetId: 0, title: 'Feuille 1' } }], onglets: { 'Feuille 1': [] } });
      }
      return json(200, f);
    }
    const m = /^\/v4\/spreadsheets\/([^/:]+)(.*)$/.exec(u.pathname);
    if (m) {
      const c = classeurs.get(decodeURIComponent(m[1]));
      if (!c) return json(404, { error: { message: 'introuvable' } });
      const reste = decodeURIComponent(m[2]);
      if (reste === '' && methode === 'GET') return json(200, { sheets: c.sheets });
      if (reste === ':batchUpdate') {
        for (const r of corps.requests) {
          if (r.updateSheetProperties) {
            const s = c.sheets.find((x) => x.properties.sheetId === r.updateSheetProperties.properties.sheetId);
            c.onglets[r.updateSheetProperties.properties.title] = c.onglets[s.properties.title] || [];
            delete c.onglets[s.properties.title];
            s.properties.title = r.updateSheetProperties.properties.title;
          } else if (r.addSheet) {
            c.sheets.push({ properties: { sheetId: c.sheets.length + 100, title: r.addSheet.properties.title } });
            c.onglets[r.addSheet.properties.title] = [];
          }
        }
        return json(200, {});
      }
      if (reste === '/values:batchUpdate') {
        for (const d of corps.data) ecrire(c, d.range, d.values);
        return json(200, {});
      }
      if (reste === '/values:batchGet') {
        return json(200, { valueRanges: u.searchParams.getAll('ranges').map((p) => lire(c, p) || { range: p }) });
      }
      const ap = /^\/values\/(.+):append$/.exec(reste);
      if (ap && methode === 'POST') {
        const p = parsePlage(ap[1]);
        const t = (c.onglets[p.onglet] ||= []);
        let fin = t.length;
        while (fin > 0 && !t[fin - 1].some((v) => v !== '' && v !== undefined)) fin--;
        ecrire(c, `'${p.onglet}'!A${fin + 1}`, corps.values);
        return json(200, { updates: { updatedRows: corps.values.length, updatedRange: `'${p.onglet}'!A${fin + 1}:Z${fin + corps.values.length}` } });
      }
      const g = /^\/values\/(.+)$/.exec(reste);
      if (g && methode === 'GET') {
        const r = lire(c, g[1]);
        return r ? json(200, r) : json(400, { error: { message: `onglet ${g[1]}` } });
      }
    }
    if (u.pathname === '/oauth2/v3/userinfo') return json(200, { email: 'jp@exemple.ca' });
    return json(404, { error: { message: `route ${methode} ${u.pathname}` } });
  }

  // Crée un classeur au schéma 1 (comme celui de JP en 1.0.x), pour tester la migration.
  function classeurV1(colonnesV1) {
    const dossier = { id: `f${++compteur}`, name: '3eBras', mimeType: 'application/vnd.google-apps.folder', parents: [], appProperties: { '3ebras': 'dossier' } };
    const livre = { id: `f${++compteur}`, name: '3eBras — Livre', mimeType: 'application/vnd.google-apps.spreadsheet', parents: [dossier.id], appProperties: { '3ebras': 'livre' } };
    fichiers.push(dossier, livre);
    const onglets = {};
    for (const [titre, cols] of Object.entries(colonnesV1)) onglets[titre] = [cols];
    onglets['Schéma'].push(['version_schema', '1'], ['cree_par', '3eBras 1.0.1'], ['cree_le', '2026-11-05']);
    classeurs.set(livre.id, { sheets: Object.keys(onglets).map((t, i) => ({ properties: { sheetId: i, title: t } })), onglets });
    return livre.id;
  }

  return { fetch, fichiers, classeurs, appels, classeurV1 };
}
