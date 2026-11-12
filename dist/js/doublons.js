// Doublons probables (D-G-043, D-G-044). Sans DOM : testé à part.
import { norm } from './etat.js?v=1.16.0';
import { couvre } from './stock.js?v=1.16.0';

const proches = (a, b) => norm(a).trim() === norm(b).trim() || couvre(a, b) || couvre(b, a);

// Recette : une recette plus ancienne du même type, au même nom ou dont le nom contient tous les mots de l'autre.
export function doublonRecette(r, book) {
  for (const x of book) { if (x === r) return null; if (x.type === r.type && proches(x.name, r.name)) return x; }
  return null;
}
