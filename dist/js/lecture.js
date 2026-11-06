// Lecture de recettes sans bibliothèque externe (P-1, N-10) : texte, Word (.docx), PDF simple,
// et réponse JSON de Claude (même format que la conversion de Gordon Rams.ai).
import { norm } from './etat.js?v=1.4.0';

/* ---------- .docx : zip natif (DecompressionStream) + XML ---------- */
async function inflerBrut(octets) {
  const flux = new Blob([octets]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(flux).arrayBuffer());
}
export async function lireDocx(fichier) {
  const b = new Uint8Array(await fichier.arrayBuffer()), v = new DataView(b.buffer);
  let fin = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (v.getUint32(i, true) === 0x06054b50) { fin = i; break; }
  if (fin < 0) throw new Error('docx');
  let p = v.getUint32(fin + 16, true); const n = v.getUint16(fin + 10, true);
  for (let k = 0; k < n; k++) {
    const meth = v.getUint16(p + 10, true), taille = v.getUint32(p + 20, true), ln = v.getUint16(p + 28, true), lx = v.getUint16(p + 30, true), lc = v.getUint16(p + 32, true), loc = v.getUint32(p + 42, true);
    const nom = new TextDecoder().decode(b.subarray(p + 46, p + 46 + ln));
    if (nom === 'word/document.xml') {
      const debut = loc + 30 + v.getUint16(loc + 26, true) + v.getUint16(loc + 28, true);
      const brut = b.subarray(debut, debut + taille);
      const xml = new TextDecoder().decode(meth === 8 ? await inflerBrut(brut) : brut);
      const doc = new DOMParser().parseFromString(xml, 'application/xml');
      return [...doc.getElementsByTagName('w:p')].map((par) => [...par.getElementsByTagName('w:t')].map((t) => t.textContent).join('').trim()).filter(Boolean).join('\n');
    }
    p += 46 + ln + lx + lc;
  }
  throw new Error('docx');
}

/* ---------- PDF : texte des flux compressés (PDF simples seulement) ---------- */
async function infler(octets) {
  try { const f = new Blob([octets]).stream().pipeThrough(new DecompressionStream('deflate')); return new Uint8Array(await new Response(f).arrayBuffer()); } catch (_) { return null; }
}
const latin = (u8) => { let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return s; };
function chaine(s) {
  return s.replace(/\\([nrtbf()\\]|[0-7]{1,3})/g, (m, c) => ({ n: '\n', r: '', t: ' ', b: '', f: '', '(': '(', ')': ')', '\\': '\\' }[c] ?? String.fromCharCode(parseInt(c, 8))));
}
export async function lirePdf(fichier) {
  const brut = new Uint8Array(await fichier.arrayBuffer()), tout = latin(brut), morceaux = [];
  const re = /stream\r?\n/g; let m;
  while ((m = re.exec(tout))) {
    const debut = m.index + m[0].length, fin = tout.indexOf('endstream', debut); if (fin < 0) break;
    const entete = tout.slice(Math.max(0, m.index - 300), m.index);
    const octets = brut.subarray(debut, fin);
    const contenu = /FlateDecode/.test(entete) ? await infler(octets) : octets;
    if (!contenu) continue;
    const s = latin(contenu);
    if (!/BT[\s\S]*ET/.test(s)) continue;
    for (const bloc of s.match(/BT[\s\S]*?ET/g) || []) {
      let ligne = '';
      bloc.replace(/\[((?:\\.|[^\]])*)\]\s*TJ|\(((?:\\.|[^)])*)\)\s*(?:Tj|'|")|(T\*|Td|TD)/g, (x, tab, un, saut) => {
        if (saut) { if (ligne.trim()) morceaux.push(ligne.trim()); ligne = ''; return ''; }
        if (un !== undefined) ligne += chaine(un);
        else (tab.match(/\(((?:\\.|[^)])*)\)|-?\d+/g) || []).forEach((t) => { if (t.startsWith('(')) ligne += chaine(t.slice(1, -1)); else if (+t < -200) ligne += ' '; });
        return '';
      });
      if (ligne.trim()) morceaux.push(ligne.trim());
    }
  }
  const texte = morceaux.join('\n');
  const lettres = (texte.match(/[a-zA-ZÀ-ÿ]/g) || []).length;
  if (texte.length < 40 || lettres / texte.length < 0.5) throw new Error('pdf');
  return texte;
}

/* ---------- réponse de Claude (JSON) ---------- */
export function parseLoose(text) {
  const t = String(text || '').trim();
  try { return JSON.parse(t); } catch (_) {}
  const f = t.match(/```(?:json)?\s*([\s\S]*?)```/); if (f) { try { return JSON.parse(f[1]); } catch (_) {} }
  const a = t.indexOf('{'), b = t.lastIndexOf('}'); if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (_) {} }
  return null;
}

/* ---------- texte libre → fiche ---------- */
const PROT_MOTS = [['Poisson & fruits de mer', /saumon|crevette|poisson|thon|morue|petoncle|tilapia|aiglefin|moule/], ['Poulet', /poulet|dinde/], ['Bœuf', /boeuf|bavette|steak/], ['Porc', /porc|bacon|jambon|saucisse/], ['Veau', /\bveau\b/], ['Œufs', /\boeufs?\b/]];
export function parseTexte(texte, type) {
  const lignes = String(texte).split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  let nom = '', sec = null, groupe = null; const ingredients = [], etapes = [], notes = [];
  const titreSec = (l) => {
    const n = norm(l).replace(/[:\s]+$/, '');
    if (/^(ingredients?|ce qu'il (vous )?faut|liste d'ingredients)$/.test(n)) return 'ing';
    if (/^(preparation|etapes?|instructions?|methode|directions|marche a suivre|mode de preparation)$/.test(n)) return 'eta';
    return null;
  };
  const puce = /^(?:[-*•▪◦·]|\[[ xX]\])\s*/, numero = /^(?:etape\s*)?\d+\s*[.)\-:]\s*/i;
  for (const l of lignes) {
    const s = titreSec(l);
    if (s) { sec = s; groupe = null; continue; }
    if (!nom && !sec) { nom = l.replace(/^#+\s*/, ''); continue; }
    if (sec === 'ing') {
      if (/:$/.test(l) && l.length < 40) { groupe = l.replace(/\s*:$/, ''); ingredients.push({ groupe, items: [] }); continue; }
      if (!ingredients.length) ingredients.push({ groupe: null, items: [] });
      ingredients[ingredients.length - 1].items.push(l.replace(puce, ''));
    } else if (sec === 'eta') {
      if (numero.test(norm(l)) || numero.test(l) || !etapes.length) etapes.push(l.replace(numero, '').replace(puce, ''));
      else etapes[etapes.length - 1] += ' ' + l;
    } else notes.push(l);
  }
  // Sans titres de section : lignes à quantité = ingrédients, phrases = étapes.
  if (!ingredients.length && !etapes.length) {
    const q = /^(?:[-*•]\s*)?(\d|[½¼¾⅓⅔]|une?\s|quelques|sel\b|poivre\b)/i;
    ingredients.push({ groupe: null, items: notes.filter((l) => q.test(l) && l.length < 90).map((l) => l.replace(puce, '')) });
    etapes.push(...notes.filter((l) => !(q.test(l) && l.length < 90)).map((l) => l.replace(numero, '')));
    notes.length = 0;
  }
  const tout = norm(texte);
  const portions = (tout.match(/(\d+)\s*(?:portions?|personnes?)/) || tout.match(/(?:portions?|pour)\s*:?\s*(\d+)/) || [])[1];
  const temps = ['preparation', 'cuisson', 'repos'].reduce((t, k) => t + Number((tout.match(new RegExp(`${k}\\s*:?\\s*(\\d+)\\s*min`)) || [])[1] || 0), 0)
    || Number((tout.match(/temps total\s*:?\s*(\d+)\s*min/) || [])[1] || 0);
  const ingTexte = norm(ingredients.flatMap((g) => g.items).join(' '));
  const proteine = (PROT_MOTS.find(([, re]) => re.test(ingTexte)) || [type === 'Souper' ? 'Végé' : null])[0];
  return {
    nom: nom.slice(0, 120) || 'Nouvelle recette', type, proteine, cuisine: null,
    portions: portions ? +portions : null, temps: temps || null, outils: [],
    source_nom: 'Inconnue', source_cat: 'Web autre',
    ingredients: ingredients.filter((g) => g.items.length), etapes: etapes.filter(Boolean),
    sous: [], a_verifier: 'Lue automatiquement dans le texte : vérifie les ingrédients et les étapes.'
  };
}
