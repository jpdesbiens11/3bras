// PDF fait dans la page (D-G-048) : aucune bibliothèque, aucun réseau. Polices standard Helvetica et Helvetica-Bold
// (présentes dans tout lecteur PDF, rien à intégrer), codage WinAnsi pour les accents français, flux non compressés.
// Code pur (pas de DOM) : testé dans Node. creerPdf() -> { page, texte, largeur, rect, ligne, cercle, svg, lien, octets }.

export const LETTRE = Object.freeze({ l: 612, h: 792 });   // format Lettre (Canada), en points

/* Largeurs Helvetica / Helvetica-Bold (métriques AFM d'Adobe, en millièmes de corps), codes 32 à 126. */
const R = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556,
  556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778,
  722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500,
  222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
const B = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556,
  556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778,
  722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556,
  278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584];
/* Au-delà de 126 : [régulier, gras] des signes WinAnsi utiles ; une lettre accentuée prend la largeur de sa lettre de base. */
const SPECIAUX = { 0x80: [556, 556], 0x85: [1000, 1000], 0x8c: [1000, 1000], 0x91: [222, 278], 0x92: [222, 278], 0x93: [333, 500],
  0x94: [333, 500], 0x95: [350, 350], 0x96: [556, 556], 0x97: [1000, 1000], 0x9c: [944, 944], 0xa0: [278, 278], 0xab: [556, 556],
  0xbb: [556, 556], 0xb0: [400, 400], 0xb7: [278, 278], 0xbc: [834, 834], 0xbd: [834, 834], 0xbe: [834, 834], 0xd7: [584, 584],
  0xc6: [1000, 1000], 0xe6: [889, 889], 0xdf: [611, 611], 0xec: [278, 278], 0xed: [278, 278], 0xee: [278, 278], 0xef: [278, 278] };
const BASE = 'AAAAAA_CEEEEIIIIDNOOOOO_OUUUUY__aaaaaa_ceeeeiiiidnooooo_ouuuuy_y';   // 0xC0 à 0xFF

const UNI = { 0x20ac: 0x80, 0x2026: 0x85, 0x0152: 0x8c, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95,
  0x2013: 0x96, 0x2014: 0x97, 0x0153: 0x9c, 0x202f: 0xa0, 0x2009: 0xa0, 0x2007: 0xa0 };
const FRACTIONS = { '⅓': '1/3', '⅔': '2/3', '⅕': '1/5', '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8', '⅙': '1/6', '−': '-', '≈': '~', '→': '->', '✓': 'v' };

/** Texte -> octets WinAnsi (tableau de nombres). Ce qui n'existe pas en WinAnsi est remplacé ou retiré (emoji). */
export function winAnsi(texte) {
  const s = String(texte ?? '').normalize('NFC').replace(/[⅓⅔⅕⅛⅜⅝⅞⅙−≈→✓]/g, (c) => FRACTIONS[c])
    .replace(/\s*(?:\p{Extended_Pictographic}|\uFE0F|\u200D)+/gu, '').replace(/[\t\r\n]+/g, ' ');
  const out = [];
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (c >= 32 && c <= 126) out.push(c);
    else if (UNI[c]) out.push(UNI[c]);
    else if (c >= 0xa0 && c <= 0xff) out.push(c);
    else if (c > 126) out.push(63);   // « ? »
  }
  return out;
}

export function largeur(texte, taille, gras = false) {
  let w = 0;
  for (const c of winAnsi(texte)) {
    if (c <= 126) w += (gras ? B : R)[c - 32];
    else if (SPECIAUX[c]) w += SPECIAUX[c][gras ? 1 : 0];
    else if (c >= 0xc0 && BASE[c - 0xc0] !== '_') { const b = BASE.charCodeAt(c - 0xc0); w += (gras ? B : R)[b - 32]; }
    else w += 556;
  }
  return (w * taille) / 1000;
}

/** Coupe un texte en lignes d'au plus `max` points ; un mot trop long est coupé à la lettre. */
export function couper(texte, max, taille, gras = false) {
  const lignes = [];
  let cur = '';
  for (const mot of String(texte ?? '').split(/\s+/).filter(Boolean)) {
    const essai = cur ? `${cur} ${mot}` : mot;
    if (largeur(essai, taille, gras) <= max) { cur = essai; continue; }
    if (cur) lignes.push(cur);
    cur = '';
    let reste = mot;
    while (largeur(reste, taille, gras) > max) {
      let k = reste.length - 1;
      while (k > 1 && largeur(reste.slice(0, k), taille, gras) > max) k--;
      lignes.push(reste.slice(0, k)); reste = reste.slice(k);
    }
    cur = reste;
  }
  if (cur) lignes.push(cur);
  return lignes;
}

const n = (x) => (Math.round(x * 100) / 100).toString();
const chaine = (octets) => `(${octets.map((c) => (c === 40 || c === 41 || c === 92) ? `\\${String.fromCharCode(c)}`
  : (c < 32 || c > 126) ? `\\${c.toString(8).padStart(3, '0')}` : String.fromCharCode(c)).join('')})`;
const couleur = (hex) => { const v = parseInt(String(hex).slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((x) => n(x / 255)).join(' '); };
// Texte des métadonnées (titre) : UTF-16BE, lisible par tout lecteur.
const utf16 = (s) => `<FEFF${[...String(s)].map((ch) => { const c = ch.codePointAt(0); return c > 0xffff
  ? [0xd800 + ((c - 0x10000) >> 10), 0xdc00 + ((c - 0x10000) & 0x3ff)].map((u) => u.toString(16).padStart(4, '0')).join('')
  : c.toString(16).padStart(4, '0'); }).join('').toUpperCase()}>`;

/** Chemin SVG simple (M, L, H, V, C, Z en absolu) -> opérateurs PDF, dans le repère SVG (la page le retourne). */
export function cheminSvg(d) {
  const t = String(d).match(/[MLHVCZ]|-?\d*\.?\d+/gi) || [];
  const ops = []; let i = 0, x = 0, y = 0, cmd = '';
  const num = () => Number(t[i++]);
  while (i < t.length) {
    if (/^[A-Za-z]$/.test(t[i])) cmd = t[i++].toUpperCase();
    if (cmd === 'M') { x = num(); y = num(); ops.push(`${n(x)} ${n(y)} m`); cmd = 'L'; }
    else if (cmd === 'L') { x = num(); y = num(); ops.push(`${n(x)} ${n(y)} l`); }
    else if (cmd === 'H') { x = num(); ops.push(`${n(x)} ${n(y)} l`); }
    else if (cmd === 'V') { y = num(); ops.push(`${n(x)} ${n(y)} l`); }
    else if (cmd === 'C') { const p = [num(), num(), num(), num(), num(), num()]; x = p[4]; y = p[5]; ops.push(`${p.map(n).join(' ')} c`); }
    else if (cmd === 'Z') { ops.push('h'); cmd = ''; }
    else i++;
  }
  return ops.join(' ');
}

export function creerPdf({ titre = '', auteur = 'SuperChef.ai', format = LETTRE } = {}) {
  const pages = [];
  let cur = null;
  const op = (s) => cur.ops.push(s);
  const api = {
    format,
    page() { cur = { ops: [], liens: [] }; pages.push(cur); return pages.length; },
    get nbPages() { return pages.length; },
    /** Écrit sur une page donnée (1, 2, …) : pieds de page une fois la mise en page finie. */
    sur(num, fn) { const garde = cur; cur = pages[num - 1]; fn(); cur = garde; },
    texte(x, y, t, { taille = 11, gras = false, couleur: c = '#26323f' } = {}) {
      op(`BT /${gras ? 'F2' : 'F1'} ${n(taille)} Tf ${couleur(c)} rg ${n(x)} ${n(y)} Td ${chaine(winAnsi(t))} Tj ET`);
    },
    largeur,
    rect(x, y, l, h, { fond = null, trait = null, epaisseur = 1 } = {}) {
      op(`${fond ? `${couleur(fond)} rg ` : ''}${trait ? `${couleur(trait)} RG ${n(epaisseur)} w ` : ''}${n(x)} ${n(y)} ${n(l)} ${n(h)} re ${fond && trait ? 'B' : fond ? 'f' : 'S'}`);
    },
    ligne(x1, y1, x2, y2, { trait = '#dfe6ee', epaisseur = 1 } = {}) {
      op(`${couleur(trait)} RG ${n(epaisseur)} w ${n(x1)} ${n(y1)} m ${n(x2)} ${n(y2)} l S`);
    },
    cercle(cx, cy, r, { fond = null, trait = '#26323f', epaisseur = 1.2 } = {}) {
      const k = r * 0.5523;
      op(`${fond ? `${couleur(fond)} rg ` : ''}${couleur(trait)} RG ${n(epaisseur)} w ${n(cx + r)} ${n(cy)} m `
        + `${n(cx + r)} ${n(cy + k)} ${n(cx + k)} ${n(cy + r)} ${n(cx)} ${n(cy + r)} c ${n(cx - k)} ${n(cy + r)} ${n(cx - r)} ${n(cy + k)} ${n(cx - r)} ${n(cy)} c `
        + `${n(cx - r)} ${n(cy - k)} ${n(cx - k)} ${n(cy - r)} ${n(cx)} ${n(cy - r)} c ${n(cx + k)} ${n(cy - r)} ${n(cx + r)} ${n(cy - k)} ${n(cx + r)} ${n(cy)} c ${fond ? 'B' : 'S'}`);
    },
    /** Dessin SVG (repère 0..taille, y vers le bas) posé avec son coin haut-gauche en (x, y), à l'échelle s. */
    svg(x, y, s, formes) {
      op(`q ${n(s)} 0 0 ${n(-s)} ${n(x)} ${n(y)} cm 1 j 1 J`);
      for (const f of formes) {
        op(`${f.fond ? `${couleur(f.fond)} rg ` : ''}${f.trait ? `${couleur(f.trait)} RG ${n(f.epaisseur || 1)} w ` : ''}${cheminSvg(f.d)} ${f.fond && f.trait ? 'B' : f.fond ? 'f' : 'S'}`);
      }
      op('Q');
    },
    /** Zone cliquable vers une adresse https (les lecteurs PDF l'ouvrent). */
    lien(x, y, l, h, url) { if (/^https:\/\/[\x21-\x7e]+$/.test(url)) cur.liens.push({ r: [x, y, x + l, y + h].map(n).join(' '), url }); },
    /** Le fichier : Uint8Array. */
    octets(date = new Date()) {
      const objets = [];
      const ajouter = (corps) => { objets.push(corps); return objets.length; };
      ajouter('<< /Type /Catalog /Pages 2 0 R >>');
      ajouter('');   // Pages, rempli plus bas
      ajouter('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
      ajouter('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
      const d = date.toISOString().replace(/[-:T]/g, '').slice(0, 14);
      ajouter(`<< /Title ${utf16(titre)} /Author ${utf16(auteur)} /Producer (SuperChef.ai) /CreationDate (D:${d}Z) >>`);
      const kids = [];
      for (const p of pages) {
        const flux = p.ops.join('\n');
        const contenu = ajouter(`<< /Length ${flux.length} >>\nstream\n${flux}\nendstream`);
        const annots = p.liens.map((a) => ajouter(`<< /Type /Annot /Subtype /Link /Rect [${a.r}] /Border [0 0 0] /A << /Type /Action /S /URI /URI ${chaine([...a.url].map((c) => c.charCodeAt(0)))} >> >>`));
        kids.push(ajouter(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${format.l} ${format.h}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contenu} 0 R${annots.length ? ` /Annots [${annots.map((a) => `${a} 0 R`).join(' ')}]` : ''} >>`));
      }
      objets[1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;
      let s = '%PDF-1.4\n%âãÏÓ\n';
      const pos = [];
      objets.forEach((o, i) => { pos.push(s.length); s += `${i + 1} 0 obj\n${o}\nendobj\n`; });
      const xref = s.length;
      s += `xref\n0 ${objets.length + 1}\n0000000000 65535 f \n${pos.map((p) => `${String(p).padStart(10, '0')} 00000 n \n`).join('')}`;
      s += `trailer\n<< /Size ${objets.length + 1} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
      return Uint8Array.from(s, (c) => c.charCodeAt(0));
    }
  };
  return api;
}
