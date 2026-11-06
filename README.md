# 3Bras

Le livre de recettes familial qui vit dans **ton** Google Drive. Tu planifies la semaine, tu fais l'épicerie, tu cuisines et tu notes les soupers.

- App : https://jpdesbiens11.github.io/3ebras/
- Aucune recette ne passe par un serveur. L'app parle directement à Google depuis ton navigateur.
- Portée Google `drive.file` : 3Bras ne voit que les fichiers qu'il a créés.

## État

Version 1.0.0, MVP 0 (socle) : connexion Google, puis création du dossier `3Bras` et du classeur `3Bras — Livre`. Voir `docs/releases/` et `docs/DECISIONS.md`.

## Développer

HTML, CSS et JavaScript natifs, sans framework ni build. Le site publié, c'est le dossier `dist/`.

```sh
npm ci
npm test                       # tests unitaires, Drive simulé, sans réseau
npx playwright install chromium
npm run test:e2e               # bout en bout au téléphone (S25) et à 1440 px
npm run serve                  # http://localhost:4173/3ebras/
```

Règles du dépôt (vérifiées par les tests) : fichiers JS et CSS sous 500 lignes, aucun `innerHTML`, aucune ressource externe sauf Google, CSP dans chaque page, aucun secret.

## Publier une version

1. `node scripts/version.mjs 1.0.x` et une note `docs/releases/1.0.x.json`, dans une branche `version/1.0.x`.
2. PR vers `main` ; les tests tournent sur la PR.
3. Fusionner : GitHub Actions crée le tag et la release `v1.0.x`, puis publie `dist/` sur Pages (D-G-014).
4. Retour arrière : Actions → « Publier 3Bras » → *Run workflow* avec le tag précédent.

## Héberger ta propre copie

Le guide complet viendra au MVP 3. En bref : forker le dépôt, activer Pages (source : GitHub Actions), créer ton ID client OAuth « Application Web » dans Google Cloud, puis le mettre dans `dist/js/config.js`.

## Relais Claude (conversion de recettes)

`relais/` est un Cloudflare Worker publié par le workflow « Relais Claude » (D-G-027). Secrets du dépôt requis : `ANTHROPIC_API_KEY`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`. Pour ta propre copie : change `ORIGINES` dans `relais/worker.js`, l'adresse `relais` dans `dist/js/config.js` et la CSP de `dist/index.html`, ou laisse `relais` vide pour te passer de Claude.

## Licence

MIT
