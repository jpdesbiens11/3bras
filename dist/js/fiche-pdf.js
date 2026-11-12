// Fiche de recette en PDF (D-G-048), à l'image du thème Carnet : logo, nom, trait jaune, infos, ingrédients par groupe,
// étapes numérotées dans des cercles, tâches sous-chef, adaptations de la famille, recette d'origine, pied SuperChef.ai.
// Code pur : reçoit la recette déjà lue (pas de DOM, pas d'état), rend { octets: Uint8Array, pages }.
import { creerPdf, couper } from './pdf.js?v=1.18.0';

const ENCRE = '#26323f', GRIS = '#56636f', FILET = '#dfe6ee', JAUNE = '#ffd23f', ORANGE = '#e2622f', VERT = '#178a7c', BLEU = '#1b5fd6';
const G = 56, D = 556, HAUT = 736, BAS = 64;   // marges (points) ; la page fait 612 × 792
export const LOGO = [
  { d: 'M7 3 H25 C27.2 3 29 4.8 29 7 V25 C29 27.2 27.2 29 25 29 H7 C4.8 29 3 27.2 3 25 V7 C3 4.8 4.8 3 7 3 Z', fond: JAUNE, trait: ENCRE, epaisseur: 2 },
  { d: 'M10.5 18 C7 18 6.2 13.1 9.6 12.1 C9.2 8.7 12.8 7.3 14.6 9.1 C15.6 6.1 19.8 6.3 20.6 9.3 C22.6 7.5 26 9.1 25.2 12.3 C28 13.5 27 18 23.5 18 Z', fond: '#ffffff', trait: ENCRE, epaisseur: 2 },
  { d: 'M11 18 V25 H23 V18', fond: '#ffffff', trait: ENCRE, epaisseur: 2 },
  { d: 'M18 19 L14.6 22.4 H17.2 L15.6 25.6', trait: ORANGE, epaisseur: 1.8 }
];

/** Nom de fichier sûr partout : « pate-chinois-superchef.pdf ». */
export function nomFichier(nom) {
  const s = String(nom || 'recette').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/gi, 'oe').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '');
  return `${s || 'recette'}-superchef.pdf`;
}

/**
 * recette : { nom, infos: [« 45 min », « 6 portions », …], ingredients: [{ groupe, texte }], etapes: [], sous: [],
 *             adaptations: [], source, date: « 12 novembre 2026 » }
 */
export function pdfRecette(recette, quand = new Date()) {
  const r = { infos: [], ingredients: [], etapes: [], sous: [], adaptations: [], ...recette };
  const pdf = creerPdf({ titre: r.nom || 'Recette' });
  let y = 0;
  const nouvellePage = () => { pdf.page(); y = HAUT; };
  const place = (h) => { if (y - h < BAS) { nouvellePage(); return true; } return false; };
  const paragraphe = (t, x, { taille = 10.5, gras = false, couleur = ENCRE, interligne = 14.5 } = {}) => {
    for (const l of couper(t, D - x, taille, gras)) { place(interligne); pdf.texte(x, y - taille, l, { taille, gras, couleur }); y -= interligne; }
  };
  const titreSection = (t, lignesSuivantes = 2) => {
    place(34 + lignesSuivantes * 14.5); y -= 14;
    pdf.texte(G, y - 13, t, { taille: 13, gras: true });
    y -= 19; pdf.ligne(G, y, D, y, { trait: FILET, epaisseur: 1 }); y -= 8;
  };
  const puces = (liste, couleur = ENCRE) => liste.forEach((t) => {
    const lignes = couper(t, D - G - 14, 10.5);
    place(lignes.length * 14.5 + 2);
    pdf.cercle(G + 3.5, y - 7, 1.6, { fond: couleur, trait: couleur, epaisseur: 0.5 });
    lignes.forEach((l) => { pdf.texte(G + 14, y - 10.5, l, { taille: 10.5, couleur }); y -= 14.5; });
    y -= 2;
  });

  // En-tête : logo et mot-symbole, date à droite.
  nouvellePage();
  pdf.svg(G, y, 1.05, LOGO);
  let x = G + 42;
  for (const [t, c] of [['Super', ORANGE], ['Chef', VERT], ['.ai', GRIS]]) { pdf.texte(x, y - 23, t, { taille: 17, gras: true, couleur: c }); x += pdf.largeur(t, 17, true); }
  if (r.date) pdf.texte(D - pdf.largeur(r.date, 9), y - 21, r.date, { taille: 9, couleur: GRIS });
  y -= 46; pdf.ligne(G, y, D, y, { trait: ENCRE, epaisseur: 1.5 }); y -= 20;

  // Nom de la recette, trait jaune, infos.
  for (const l of couper(r.nom || 'Recette', D - G, 22, true)) { place(27); pdf.texte(G, y - 21, l, { taille: 22, gras: true }); y -= 27; }
  pdf.rect(G, y - 7, 74, 5, { fond: JAUNE }); y -= 20;
  if (r.infos.length) paragraphe(r.infos.join('  ·  '), G, { taille: 10.5, couleur: GRIS });

  if (r.ingredients.length) {
    titreSection('Ingrédients');
    let groupe = null;
    for (const ing of r.ingredients) {
      if (ing.groupe && ing.groupe !== groupe) { groupe = ing.groupe; place(36); y -= 4; paragraphe(groupe, G, { taille: 10.5, gras: true, couleur: VERT }); }
      puces([ing.texte]);
    }
  }
  if (r.etapes.length) {
    titreSection('Étapes');
    r.etapes.forEach((t, i) => {
      const lignes = couper(t, D - G - 28, 10.5);
      place(Math.min(lignes.length, 3) * 14.5 + 6);
      const num = String(i + 1);
      pdf.cercle(G + 9, y - 7.5, 8.5, { trait: ENCRE, epaisseur: 1.2 });
      pdf.texte(G + 9 - pdf.largeur(num, 8.5, true) / 2, y - 10.5, num, { taille: 8.5, gras: true });
      lignes.forEach((l) => { place(14.5); pdf.texte(G + 28, y - 10.5, l, { taille: 10.5 }); y -= 14.5; });
      y -= 6;
    });
  }
  if (r.sous.length) { titreSection('Tâches sous-chef'); puces(r.sous); }
  if (r.adaptations.length) { titreSection('Adaptations de la famille'); puces(r.adaptations, GRIS); }
  if (/^https:\/\/\S+$/.test(r.source || '')) {
    place(40); y -= 12;
    pdf.texte(G, y - 10, 'Recette d\'origine', { taille: 10, gras: true, couleur: GRIS }); y -= 15;
    for (const l of couper(r.source, D - G, 9.5)) {
      place(13); pdf.texte(G, y - 9.5, l, { taille: 9.5, couleur: BLEU }); pdf.lien(G, y - 12, pdf.largeur(l, 9.5), 13, r.source); y -= 13;
    }
  }

  // Pied de chaque page.
  const total = pdf.nbPages;
  for (let p = 1; p <= total; p++) {
    pdf.sur(p, () => {
      pdf.ligne(G, 44, D, 44, { trait: FILET, epaisseur: 1 });
      pdf.texte(G, 30, 'Partagé avec SuperChef.ai · Ton renfort au souper', { taille: 8.5, couleur: GRIS });
      const t = `Page ${p} sur ${total}`;
      pdf.texte(D - pdf.largeur(t, 8.5), 30, t, { taille: 8.5, couleur: GRIS });
    });
  }
  return { octets: pdf.octets(quand), pages: total };
}
