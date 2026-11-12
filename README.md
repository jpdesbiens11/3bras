# SuperChef.ai

Le livre de recettes familial qui vit dans **ton** Google Drive. Tu planifies la semaine, tu fais l'épicerie, tu cuisines et tu notes les soupers. (Anciennement 3Bras, 3eBras et Gordon Rams.ai.)

- App : sur un sous-domaine Hostinger (D-G-031, `docs/hostinger-deploiement.md`) ; copie de secours : https://jpdesbiens11.github.io/SuperChef.ai/ (D-G-034)
- Aucune recette ne passe par un serveur. L'app parle directement à Google depuis ton navigateur, au téléphone comme à l'ordinateur.
- Ta semaine planifiée est gardée dans l'onglet « Plans de semaine » de ton classeur Google et revient à chaque connexion.
- Portée Google `drive.file` : SuperChef.ai ne voit que les fichiers qu'il a créés.

## État

Version 1.17.0 : partager une recette en PDF (feuille de partage du téléphone, ou courriel, Gmail, Outlook, texto, Messenger, WhatsApp, Telegram, Teams, lien Google Drive et code QR), et Carnet imposé une fois comme thème. Depuis 1.16.0 : nouveau thème Carnet par défaut avec le logo SuperChef.ai (toque et éclair), et visite guidée animée à l'ouverture (« Ne plus montrer », Compte → « Revoir la visite »). Depuis 1.15.0 : « Créer avec Gemini » dans + Recette, à partir d'une simple description (et du garde-manger). Depuis 1.14.0 : mode Modifier dans le livre et texte de la fiche modifiable à la main. Depuis 1.13.0 : garde-manger filtrable avec mode Modifier et fusion des doublons, « Au garde-manger » dans Provigo. Depuis 1.12.0 : 10 kits de départ (dont Survie et Mexicain), stock de base à cocher, classeur qui se répare avant d'écrire. Depuis 1.10 : « Adapter avec Gemini » au poêle et dans la fiche ; depuis 1.9.0 : « Créer des recettes avec Claude ». Voir `docs/releases/` et `docs/DECISIONS.md`.

## Développer

HTML, CSS et JavaScript natifs, sans framework ni build. Le site publié, c'est le dossier `dist/`.

```sh
npm ci
npm test                       # tests unitaires, Drive simulé, sans réseau
npx playwright install chromium
npm run test:e2e               # bout en bout au téléphone (S25) et à 1440 px
npm run serve                  # http://localhost:4173/superchef/
```

Règles du dépôt (vérifiées par les tests) : fichiers JS et CSS sous 500 lignes, aucun `innerHTML`, aucune ressource externe sauf Google, CSP dans chaque page, aucun secret.

## Publier une version

1. `node scripts/version.mjs 1.x.y` et une note `docs/releases/1.x.y.json`, dans une branche `version/1.x.y`.
2. PR vers `main` ; les tests tournent sur la PR.
3. Fusionner : GitHub Actions crée le tag et la release `v1.x.y` (avec l'archive `superchef-1.x.y.zip`), puis publie `dist/` sur Pages (D-G-014).
4. Hostinger : `npm run paquet` produit `paquet/superchef-<version>.zip`, déployé par le connecteur Hostinger (D-G-031) ; marche à suivre dans `docs/hostinger-deploiement.md`.
5. Retour arrière : Actions → « Publier SuperChef.ai » → *Run workflow* avec le tag précédent ; sur Hostinger, redéployer l'archive de la release précédente.

## Héberger ta propre copie

Forker le dépôt, créer ton ID client OAuth « Application Web » dans Google Cloud et le mettre dans `dist/js/config.js`, puis publier `dist/` (Pages, ou l'archive de `npm run paquet` sur n'importe quel hébergement statique). Le domaine doit être déclaré à Google : voir `docs/firebase-gemini.md`, section « Nouveau domaine ».

## Licence

MIT
