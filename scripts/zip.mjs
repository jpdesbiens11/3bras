// Archive .zip minimale (deflate), sans dépendance : sert au paquet Hostinger (D-G-031).
import { deflateRawSync } from 'node:zlib';

const TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
export function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// entrees : [{ nom: 'css/app.css', donnees: Buffer }] → Buffer de l'archive.
export function creerZip(entrees, date = new Date()) {
  const heure = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const jour = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  const locaux = [], central = [];
  let decalage = 0;
  for (const { nom, donnees } of entrees) {
    const n = Buffer.from(nom, 'utf8');
    const comp = deflateRawSync(donnees, { level: 9 });
    const crc = crc32(donnees);
    const tete = Buffer.alloc(30);
    tete.writeUInt32LE(0x04034b50, 0); tete.writeUInt16LE(20, 4); tete.writeUInt16LE(0x0800, 6); // UTF-8
    tete.writeUInt16LE(8, 8); tete.writeUInt16LE(heure, 10); tete.writeUInt16LE(jour, 12);
    tete.writeUInt32LE(crc, 14); tete.writeUInt32LE(comp.length, 18); tete.writeUInt32LE(donnees.length, 22);
    tete.writeUInt16LE(n.length, 26);
    locaux.push(tete, n, comp);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(0x031e, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8);
    c.writeUInt16LE(8, 10); c.writeUInt16LE(heure, 12); c.writeUInt16LE(jour, 14);
    c.writeUInt32LE(crc, 16); c.writeUInt32LE(comp.length, 20); c.writeUInt32LE(donnees.length, 24);
    c.writeUInt16LE(n.length, 28); c.writeUInt32LE((0o100644 << 16) >>> 0, 38); c.writeUInt32LE(decalage, 42);
    central.push(c, n);
    decalage += tete.length + n.length + comp.length;
  }
  const taille = central.reduce((s, b) => s + b.length, 0);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0); fin.writeUInt16LE(entrees.length, 8); fin.writeUInt16LE(entrees.length, 10);
  fin.writeUInt32LE(taille, 12); fin.writeUInt32LE(decalage, 16);
  return Buffer.concat([...locaux, ...central, fin]);
}
