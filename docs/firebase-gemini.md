# Brancher Gemini dans 3Bras (Firebase AI Logic) — réglages

Tout se fait dans le projet Google Cloud « 3eBras » déjà utilisé pour la connexion Google. Aucune valeur ci-dessous n'est secrète, **sauf la clé secrète reCAPTCHA**, qui va seulement dans la console Firebase.

1. **Ajouter Firebase au projet** : https://console.firebase.google.com → *Créer un projet* → *Ajouter Firebase à un projet Google Cloud existant* → choisir « 3eBras ». Google Analytics : non.
2. **Enregistrer l'app web** : ⚙ *Paramètres du projet* → *Vos applications* → icône Web `</>` → surnom `3Bras` (pas d'hébergement Firebase). Copier `apiKey`, `projectId` et `appId` (valeurs publiques).
3. **Activer AI Logic** : menu *IA* → *AI Logic* → *Commencer* → fournisseur **Gemini Developer API** (sans frais). Si l'assistant propose App Check, accepter.
4. **Créer la clé reCAPTCHA** : https://www.google.com/recaptcha/admin/create → libellé `3Bras`, type **Score (v3)**, domaines `jpdesbiens11.github.io` et `localhost`, projet Google Cloud du projet Firebase. Depuis 2026, la clé créée est une clé **Fraud Defense** (anciennement reCAPTCHA Enterprise) ; seule la **clé de site** (publique) sert.
5. **App Check** : console Firebase → *Sécurité* → *App Check* → *Applications* → l'app web → **Fraud Defense** (la version classique est fermée aux nouvelles apps) → coller la **clé de site**, TTL 1 heure → *Enregistrer*. Après la publication de l'app avec App Check : onglet *API* → *Firebase AI Logic* → **Appliquer** (enforce).
6. Donner à Claude : `apiKey`, `projectId`, `appId`, la **clé de site**. Claude les met dans `dist/js/config.js` (`ia: { … }`).

Valeurs de 3Bras (2026-11-06) : projet Firebase `bras-933fe`, app web `3Bras`.

Modèle par défaut : `gemini-3.5-flash` (changer `modele` dans la config au besoin).
