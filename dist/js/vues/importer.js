// Vue Importer (R-02) : choisir le fichier, le valider, l'écrire dans le classeur.
import { el, vider } from '../el.js?v=1.1.0';
import { T } from '../textes.js?v=1.1.0';
import { valider, importer } from '../import.js?v=1.1.0';

export function vueImporter(ctx, zone) {
  const resultat = el('div', { class: 'resultat', 'aria-live': 'polite' });
  const champ = el('input', { type: 'file', accept: '.json,application/json', class: 'champ-fichier',
    id: 'fichier-import', onchange: () => lire(champ.files[0]) });

  zone.append(
    el('h2', { 'data-new': '1.1.0-importer' }, T.importerTitre),
    el('p', {}, T.importerAide),
    el('label', { for: 'fichier-import', class: 'bouton principal' }, T.choisirFichier),
    champ,
    resultat);

  async function lire(fichier) {
    if (!fichier) return;
    vider(resultat);
    if (fichier.size > 20 * 1024 * 1024) { resultat.append(el('p', { class: 'avis', role: 'alert' }, T.fichierTropGros)); return; }
    const v = valider(await fichier.text());
    if (!v.ok) {
      resultat.append(el('p', { class: 'avis', role: 'alert' }, T.fichierInvalide),
        el('ul', { class: 'erreurs' }, v.erreurs.slice(0, 20).map((e) => el('li', {}, e))),
        v.erreurs.length > 20 && el('p', { class: 'aide' }, T.autresErreurs(v.erreurs.length - 20)));
      return;
    }
    const d = v.donnees;
    resultat.append(
      el('p', {}, T.fichierPret),
      el('ul', {},
        el('li', {}, T.nbRecettes(d.recettes.length)),
        el('li', {}, T.nbPlans(d.plans.length)),
        el('li', {}, T.nbInventaire(d.inventaire.length)),
        el('li', {}, T.nbBilans(d.bilans.length))),
      el('button', { type: 'button', class: 'bouton principal', 'data-new': '1.1.0-lancer-import',
        onclick: (e) => { e.target.disabled = true; lancer(d); } }, T.lancerImport));
  }

  async function lancer(donnees) {
    const statut = el('p', { class: 'travail', role: 'status' }, el('span', { class: 'roue', 'aria-hidden': 'true' }), T.importEnCours(''));
    vider(resultat).append(statut);
    try {
      const r = await importer(ctx.drive, ctx.classeurId, donnees, (titre) => { statut.lastChild.textContent = T.importEnCours(titre); });
      ctx.recettes = null;
      vider(resultat).append(
        el('h3', {}, T.importFini),
        el('ul', { class: 'rapport' },
          el('li', {}, T.rapportCreees(r.creees)),
          el('li', {}, T.rapportDeja(r.deja)),
          r.kits.length > 0 && el('li', {}, T.rapportKits(r.kits.length), el('ul', {}, r.kits.map((n) => el('li', {}, n)))),
          el('li', {}, T.rapportVerifier(r.aVerifier.length))),
        r.aVerifier.length > 0 && el('details', {}, el('summary', {}, T.voirAVerifier), el('ul', {}, r.aVerifier.map((n) => el('li', {}, n)))),
        el('button', { type: 'button', class: 'bouton principal', onclick: () => ctx.aller('livre') }, T.ouvrirLivre));
    } catch (err) {
      console.error(err);
      vider(resultat).append(el('p', { class: 'avis', role: 'alert' }, `${T.erreurTitre} ${err.message}`),
        el('p', { class: 'aide' }, T.importReprise));
    }
  }
}
