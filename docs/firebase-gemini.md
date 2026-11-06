# Brancher Gemini dans 3Bras (Firebase AI Logic) — réglages

Tout se fait dans le projet Google Cloud « 3eBras » déjà utilisé pour la connexion Google. Aucune valeur ci-dessous n'est secrète, **sauf la clé secrète reCAPTCHA**, qui va seulement dans la console Firebase.

1. **Ajouter Firebase au projet** : https://console.firebase.google.com → *Créer un projet* → *Ajouter Firebase à un projet Google Cloud existant* → choisir « 3eBras ». Google Analytics : non.
2. **Enregistrer l'app web** : ⚙ *Paramètres du projet* → *Vos applications* → icône Web `</>` → surnom `3Bras` (pas d'hébergement Firebase). Copier `apiKey`, `projectId` et `appId` (valeurs publiques).
3. **Activer AI Logic** : menu *IA* → *AI Logic* → *Commencer* → fournisseur **Gemini Developer API** (sans frais). Si l'assistant propose App Check, accepter.
4. **Créer la clé reCAPTCHA v3** : https://www.google.com/recaptcha/admin/create → libellé `3Bras`, type **Score (v3)**, domaines `jpdesbiens11.github.io` et `localhost`. Garder la **clé de site** (publique) et la **clé secrète**.
5. **App Check** : console Firebase → *Sécurité* → *App Check* → *Apps* → l'app web → **reCAPTCHA** → coller la **clé secrète** → *Enregistrer*. Puis onglet *API* → *Firebase AI Logic* → **Appliquer** (enforce).
6. Donner à Claude : `apiKey`, `projectId`, `appId`, la **clé de site** reCAPTCHA. Claude les met dans `dist/js/config.js` (`ia: { … }`).

Modèle par défaut : `gemini-3.5-flash` (changer `modele` dans la config au besoin).
