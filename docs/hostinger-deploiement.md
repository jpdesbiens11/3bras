# Déployer SuperChef.ai sur Hostinger (D-G-031)

## État du compte (relevé le 2026-11-12, en lecture seulement)

- **Aucun hébergement Web** (ni mutualisé, ni Agency) : les étapes « site statique » plus bas supposent qu'on en achète un.
- **VPS KVM 2** `srv1980606.hstgr.cloud` (2.24.141.240), Ubuntu 24.04 avec Docker et Traefik. Projets Docker : `traefik` (réseau de l'hôte, ports 80 et 443, Let's Encrypt par défi HTTP, résolveur `letsencrypt`, HTTP redirigé vers HTTPS), `dynamite-agile` (demo.dynamiteagile.ca), `hermes-agent-dhhc`. Ne pas y toucher.
- **Domaine dynamiteagile.ca**, DNS chez Hostinger : `@` et `www` vers GitHub Pages, `demo` vers le VPS.
- JP a choisi d'attendre avant de déployer (2026-11-12).

## Proposition pour le VPS (quand JP dit go)

1. DNS : enregistrement A `superchef` → 2.24.141.240 sur dynamiteagile.ca (opération `dns_records_update`, sans écraser les autres).
2. Projet Docker `superchef` (opération `vps_docker_create`, contenu YAML) : un nginx qui sert `dist/`, construit depuis le dépôt public à un tag (`https://github.com/jpdesbiens11/SuperChef.ai.git#v<version>`), avec un `Dockerfile` et un `nginx.conf` à ajouter dans `hostinger/` (mêmes en-têtes que `.htaccess`). Étiquettes Traefik sur le modèle de dynamite-agile : `traefik.enable=true`, `routers.superchef.rule=Host(\`superchef.dynamiteagile.ca\`)`, `entrypoints=websecure`, `tls.certresolver=letsencrypt`, port du service 80.
3. Vérifier `https://superchef.dynamiteagile.ca/`, puis déclarer le domaine chez Google (étape 7 plus bas).
4. Mise à jour : relancer `vps_docker_create` avec le nouveau tag (le projet est remplacé).


Marche à suivre pour une session Claude Code, une fois le **connecteur Hostinger autorisé** dans claude.ai (Paramètres → Connecteurs) et une **nouvelle session** ouverte sur ce dépôt (les connecteurs sont lus au démarrage d'une session). Les questions à JP se posent par menus (AskUserQuestion).

## Ce qui est décidé

- Site statique : aucun PHP, aucune base de données, aucun secret. L'archive à déployer est `superchef-<version>.zip` (jointe à chaque release GitHub, ou `npm run paquet`) : `index.html` à la racine, `.htaccess` (HTTPS forcé, en-têtes de sécurité), notes de version.
- Adresse : un **sous-domaine d'un domaine que JP a déjà chez Hostinger** (choix du 2026-11-12), par exemple `superchef.<domaine>`.
- GitHub Pages (https://jpdesbiens11.github.io/SuperChef.ai/) reste la copie de secours.

## Étapes

1. Lister les domaines et sites du compte Hostinger avec le connecteur, puis demander à JP (menu) quel domaine porte le sous-domaine, et son nom (suggestion : `superchef`).
2. Créer le sous-domaine s'il n'existe pas, avec son propre dossier (pas le `public_html` du domaine principal).
3. Vérifier que le certificat SSL du sous-domaine est actif (Let's Encrypt gratuit chez Hostinger) ; sinon l'activer.
4. Construire l'archive : `npm ci && npm test && npm run paquet` → `paquet/superchef-<version>.zip`.
5. Déployer l'archive dans le dossier du sous-domaine avec l'outil de déploiement de site statique du connecteur (contenu à la racine, pas dans un sous-dossier). Si l'outil demande une adresse plutôt qu'un fichier, donner celle de l'archive jointe à la release.
6. Vérifier `https://<sous-domaine>/` : titre « SuperChef.ai », `http://` redirige vers `https://`, `curl -sI` montre `x-content-type-options: nosniff` et `x-frame-options: DENY`.
7. Côté Google (JP, console Google Cloud ; voir `docs/firebase-gemini.md`, section « Nouveau domaine ») : ajouter `https://<sous-domaine>` aux origines JavaScript de l'ID client OAuth, le sous-domaine aux domaines de la clé reCAPTCHA (Fraud Defense) et aux référents de la clé Firebase s'il y en a ; nom « SuperChef.ai » sur l'écran de consentement.
8. Tester la connexion Google et « + Recette » avec Gemini sur le sous-domaine.
9. Noter l'adresse dans `README.md` et dans une nouvelle décision de `docs/DECISIONS.md` ; fermer la question ouverte du sous-domaine.

## Mettre à jour plus tard

Chaque nouvelle version : fusionner la PR (release et archive créées par GitHub Actions), puis redéployer l'archive de la release (étapes 4 à 6). Retour arrière : redéployer l'archive de la release précédente.
