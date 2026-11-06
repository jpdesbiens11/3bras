// Serveur statique local qui imite GitHub Pages : dist/ servi sous /3ebras/.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';

const RACINE = new URL('../dist/', import.meta.url).pathname;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png' };
const PORT = Number(process.env.PORT || 4173);

createServer(async (req, res) => {
  const chemin = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (!chemin.startsWith('/3ebras/')) { res.writeHead(302, { Location: '/3ebras/' }).end(); return; }
  let rel = normalize(chemin.slice('/3ebras/'.length)).replace(/^(\.\.[/\\])+/, '');
  if (rel === '' || rel === '.' || rel.endsWith('/')) rel = join(rel, 'index.html');
  try {
    const corps = await readFile(join(RACINE, rel));
    res.writeHead(200, { 'Content-Type': TYPES[extname(rel)] || 'application/octet-stream' }).end(corps);
  } catch {
    res.writeHead(404).end('introuvable');
  }
}).listen(PORT, () => console.log(`3eBras sur http://localhost:${PORT}/3ebras/`));
