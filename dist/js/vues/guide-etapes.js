// Les étapes de la mise en place guidée (D-G-056) : de l'accueil (connexion Google) à l'étape 2 du souper de lundi.
// Chaque étape dit son écran (ecran), ce qu'elle encadre (cible), quand elle est faite (fait) et le geste que le doigt
// mime (geste). Textes courts, une seule action à la fois : pensé pour qu'une grand-mère avec un compte Google s'y retrouve.
import { S, $, STEPS, DAYS } from '../etat.js?v=1.23.0';
import { iaDisponible } from '../ia.js?v=1.23.0';

export const val = (v) => (typeof v === 'function' ? v() : v);
export const auLivre = () => (S.book || []).filter((r) => r.statut === 'Au livre').length;
const planTexte = () => (S.plan || []).map((id, i) => (S.on?.[i] ? id || '' : '')).join('|');
/** Ce qui compte pour savoir si une action est faite, pris en arrivant à l'étape. */
export const base = () => ({ livre: (S.book || []).length, aulivre: auLivre(), plan: planTexte(), etape: S.cook?.idx || 0 });

/** Le souper de lundi (sinon le premier souper complet de la semaine) : la mise en place finit dans sa recette. */
export function souperDuGuide() {
  const ok = (i) => S.on?.[i] && S.plan?.[i] && S.byId?.[S.plan[i]]?.complete;
  const i = ok(1) ? 1 : (S.plan || []).findIndex((x, k) => ok(k));
  return i >= 0 ? { id: S.plan[i], i, jour: DAYS[i].toLowerCase(), nom: S.byId[S.plan[i]].name } : null;
}
const souper = () => souperDuGuide() || { id: '', i: 1, jour: 'lundi', nom: 'ton souper' };
const etiquette = (id) => { const s = STEPS.find((x) => x.id === id); return s ? `${s.n} ${s.label}` : id; };

/** Où est le menu du navigateur pour garder la page sur l'écran d'accueil du téléphone. */
export function appareil() {
  const ua = navigator.userAgent || '';
  let installe = false;
  try { installe = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch (_) { /* vieux navigateur */ }
  if (installe) return { installe, texte: 'C\'est déjà fait : SuperChef.ai est sur ton écran d\'accueil.' };
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) {
    return { coin: 'bas', texte: 'Touche le bouton Partager (le carré avec une flèche vers le haut), puis « Sur l\'écran d\'accueil ».' };
  }
  if (/SamsungBrowser/.test(ua)) return { coin: 'bas-droite', texte: 'Touche le menu ≡ en bas à droite, puis « Ajouter page à » et « Écran d\'accueil ».' };
  if (/Android/.test(ua)) return { coin: 'haut-droite', texte: 'Touche les trois points ⋮ en haut à droite, puis « Ajouter à l\'écran d\'accueil ».' };
  return { coin: 'haut-droite', texte: 'À l\'ordinateur, mets la page dans tes favoris (Ctrl + D, ou ⌘ + D sur un Mac). Au téléphone : menu ⋮, puis « Ajouter à l\'écran d\'accueil ».' };
}

const SEM = { vue: 'semaine' };
const minuteur = () => $('#cook .tstart [data-tadd]');
export const ETAPES = [
  { id: 'connexion', groupe: 'Accueil', titre: 'Connecte-toi avec Google', cible: '#connexion', fait: () => !!S.ctx,
    texte: 'Touche « Se connecter avec Google ». Dans la fenêtre de Google, touche ton compte, puis « Continuer ».',
    geste: [{ toucher: '#connexion' }] },
  { id: 'kits', groupe: 'Compte', ecran: { compte: true }, bulle: 'bas', titre: 'Choisis tes kits de recettes', fait: (b) => S.book.length > b.livre,
    cible: () => ($('#kitchoix [aria-pressed="true"]') ? '#chargerkits' : '#kitchoix'),
    texte: 'Touche un ou plusieurs kits : un crochet ✓ apparaît. Puis touche le bouton « Ajouter » juste en dessous.',
    geste: () => ($('#kitchoix [aria-pressed="true"]') ? [{ toucher: '#chargerkits' }] : [{ toucher: '#kitchoix [data-kit]' }, { toucher: '#chargerkits' }]) },
  { id: 'stock', groupe: 'Compte', ecran: { stock: true }, titre: 'Ton stock de base', cible: '#stock-ajouter', fait: () => !!$('#stock-voir'),
    texte: 'Ce que tu as toujours à la maison : sel, huile, farine… Décoche ce que tu n\'as pas, puis touche « Ajouter ».',
    geste: [{ toucher: '#stock-ajouter' }] },
  { id: 'recette', groupe: '+ Recette', ecran: { ajout: true }, info: true, titre: 'Tes recettes à toi', cible: '#addsheet .pick',
    texte: () => `Plus tard, touche « + Recette », en haut, pour ajouter une recette : une photo de ton livre, un lien ou du texte. ${iaDisponible() ? 'Gemini' : 'SuperChef.ai'} en fait une fiche, à trier.`,
    geste: [{ toucher: '#addsheet .pickbtn' }] },
  { id: 'tri', groupe: '01 · Livre', ecran: { vue: 'tri', mode: 'tri' }, bulle: 'haut', titre: 'Trie tes recettes', cible: '.tri-wrap',
    fait: (b) => auLivre() >= b.aulivre + 3 || (S.tri.list && S.tri.idx >= S.tri.list.length),
    texte: 'Pousse la fiche vers la droite pour la garder dans ton livre (ou touche « Au livre »). Gardes-en au moins 3.',
    geste: [{ glisser: '#tricard', dx: 120, indice: '#trihint', texte: 'Au livre' }] },
  { id: 'frigo', groupe: '02 · Garde-manger', ecran: { vue: 'livre' }, info: true, titre: 'Ce qu\'il y a dans ton frigo', cible: '#addinv',
    texte: 'Écris un aliment que tu as déjà (par exemple « lait »), puis touche « Ajouter ». Il ne sera pas sur ta liste d\'épicerie.',
    geste: [{ toucher: '#inv-name' }] },
  { id: 'soirs', groupe: '03 · Semaine', ecran: SEM, info: true, titre: 'Tes soupers de la semaine', cible: '.daytog',
    texte: 'L\'app a choisi un souper pour chaque soir. Touche un jour pour l\'ajouter ou l\'enlever. « Piger » propose un autre souper.',
    geste: [{ toucher: '.daytog button[aria-pressed="false"]' }] },
  { id: 'deplacer', groupe: '03 · Semaine', ecran: SEM, titre: 'Change un souper de soir', cible: () => ($('#deplacer') ? '[data-dpenregistrer]' : '.week .day[data-jour] .dname'),
    fait: (b) => !$('#deplacer') && planTexte() !== b.plan,
    texte: 'Garde le doigt 2 secondes sur un souper (une barre jaune se remplit), puis glisse-le sur un autre soir. Touche ensuite « Enregistrer ».',
    geste: () => ($('#deplacer') ? [{ toucher: '[data-dpenregistrer]' }]
      : [{ tenir: '.week .day[data-jour] .dname', vers: document.querySelectorAll('.week .day[data-jour]')[1] }]) },
  { id: 'approuver', groupe: '03 · Semaine', ecran: SEM, titre: 'Approuve ta semaine', cible: '#save', fait: () => S.saved && (S.planRows || []).some((r) => r['Recette id']),
    texte: 'Touche « Approuver la semaine ». Elle s\'enregistre dans ton classeur Google, et ta liste d\'épicerie se prépare.',
    geste: [{ toucher: '#save' }] },
  { id: 'provigo', groupe: '04 · Provigo', ecran: { vue: 'provigo' }, info: true, titre: 'Ta liste d\'épicerie est prête', cible: '.dept',
    texte: 'Elle est classée par rayon, sans ce que tu as déjà. Au magasin, coche chaque article que tu mets dans ton panier.',
    geste: [{ toucher: '.dept .gl' }] },
  { id: 'telephone', groupe: 'Ton téléphone', info: true, titre: 'Garde l\'app sur ton téléphone', fil: ['Menu du navigateur'],
    texte: () => `Pour la retrouver au magasin. ${appareil().texte} La prochaine fois, touche « Continuer » : ton livre revient.`,
    geste: () => (appareil().coin ? [{ coin: appareil().coin }] : []) },
  { id: 'lundi', groupe: '05 · Au poêle', ecran: { vue: 'poele' }, titre: () => `${souper().jour[0].toUpperCase()}${souper().jour.slice(1)} soir : ${souper().nom}`,
    cible: () => `.pick [data-cook="${souper().id}"]`, fait: () => S.view === 'poele' && !!S.cook?.id,
    texte: () => `C'est le souper de ${souper().jour}. Touche-le : la recette s'ouvre, une étape à la fois.`,
    geste: () => [{ toucher: `.pick [data-cook="${souper().id}"]` }] },
  { id: 'etape1', groupe: '05 · Au poêle', ecran: { vue: 'poele', cuisiner: () => souper().id }, info: true, bulle: 'bas', titre: 'Étape 1 : lis et prépare', cible: '#cook .stage',
    texte: 'Lis l\'étape, en grosses lettres. Coche ce qu\'il te faut dans « Pour cette étape ».',
    geste: [{ toucher: '#cook .stepings label' }] },
  { id: 'suite', groupe: '05 · Au poêle', ecran: { vue: 'poele', cuisiner: () => souper().id }, titre: 'Le minuteur, puis l\'étape 2', cible: '#cook .cook-nav',
    fait: (b) => S.view === 'poele' && (S.cook?.idx || 0) > b.etape,
    texte: () => `${minuteur() ? `Touche « ${minuteur().textContent.trim()} » : le minuteur part et sonne à la fin. ` : 'Pas de minuteur à cette étape. '}Quand c'est fait, glisse l'étape vers la gauche, ou touche « Suivante ».`,
    geste: () => [minuteur() && { toucher: minuteur() }, { glisser: '#cook .stage', dx: -110, dy: 0 }].filter(Boolean) },
  { id: 'adapter', groupe: '05 · Au poêle', si: iaDisponible, ecran: { vue: 'poele', cuisiner: () => souper().id }, info: true, titre: 'Il te manque un ingrédient ?',
    cible: '#cook [data-adapt]', texte: 'Touche « Adapter avec Gemini » et dis ce qui manque : il change la recette pour ce soir, ou pour de bon. Bon souper, chef !',
    geste: [{ toucher: '#cook [data-adapt]' }] }
];
/** Les 10 étapes de 1.21 et 1.22 : un guide commencé avant la mise à jour reprend à la même. */
export const ANCIENNES = ['kits', 'stock', 'tri', 'frigo', 'soirs', 'deplacer', 'approuver', 'provigo', 'lundi', 'etape1'];

/** Le chemin depuis l'accueil, pour le fil d'Ariane de la bulle. */
export function filDe(e) {
  if (e.fil) return val(e.fil);
  const ec = e.ecran || {}, f = [];
  if (ec.compte || ec.stock) f.push('👥 Compte');
  if (ec.stock) f.push('Stock de base');
  if (ec.ajout) f.push('+ Recette');
  if (ec.vue) f.push(etiquette(ec.vue));
  if (ec.mode === 'tri') f.push('Trier');
  if (ec.cuisiner) f.push(`${DAYS[souper().i].slice(0, 3)} · ${souper().nom}`);
  return f;
}

/** Le prochain bouton à toucher pour se rendre à l'écran de l'étape, d'après ce qui est ouvert maintenant (null : arrivé). */
export function prochainToucher(ec) {
  const t = (sel, nom, pour) => ({ sel, nom, pour });
  if ($('#stocksheet') && !ec.stock) return t('#stocksheet [data-stockclose]', '←', 'fermer le stock');
  if ($('#addsheet') && !ec.ajout) return t('#addsheet [data-addclose]', '←', 'fermer l\'ajout de recette');
  if ($('#comptesheet') && !ec.compte && !ec.stock) return t('#comptesheet [data-compteclose]', '←', 'fermer le compte');
  if ((ec.compte || ec.stock) && !$('#comptesheet')) return t('#comptebtn', '👥 Compte');
  if (ec.stock && !$('#stocksheet')) return t('#ouvrirstock', 'Choisir mon stock de base');
  if (ec.ajout && !$('#addsheet')) return t('#addbtn', '+ Recette');
  if (ec.vue && S.view !== ec.vue) return t(`#steps [data-go="${ec.vue}"]`, etiquette(ec.vue));
  if (ec.mode && S.lib.mode !== ec.mode) return t(`[data-libmode="${ec.mode}"]`, 'Trier');
  const id = ec.cuisiner?.();
  if (id && S.cook.id !== id) return t(`.pick [data-cook="${id}"]`, `${DAYS[souper().i].slice(0, 3)} · ${souper().nom}`);
  return null;
}
