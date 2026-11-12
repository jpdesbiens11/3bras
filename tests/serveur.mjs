// Serveur statique local : dist/ servi sous un sous-dossier (/superchef/), pour vérifier que l'app
// marche autant à la racine d'un domaine (Hostinger) que dans un sous-dossier (GitHub Pages).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';

const RACINE = new URL('../dist/', import.meta.url).pathname;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png' };
const PORT = Number(process.env.PORT || 4173);

createServer(async (req, res) => {
  const chemin = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (!chemin.startsWith('/superchef/')) { res.writeHead(302, { Location: '/superchef/' }).end(); return; }
  let rel = normalize(chemin.slice('/superchef/'.length)).replace(/^(\.\.[/\\])+/, '');
  if (rel === '' || rel === '.' || rel.endsWith('/')) rel = join(rel, 'index.html');
  try {
    const corps = await readFile(join(RACINE, rel));
    res.writeHead(200, { 'Content-Type': TYPES[extname(rel)] || 'application/octet-stream' }).end(corps);
  } catch {
    res.writeHead(404).end('introuvable');
  }
}).listen(PORT, () => console.log(`SuperChef.ai sur http://localhost:${PORT}/superchef/`));
