# Brancher Gemini dans SuperChef.ai (Firebase AI Logic) — réglages

Tout se fait dans le projet Google Cloud « 3eBras » déjà utilisé pour la connexion Google. Aucune valeur ci-dessous n'est secrète, **sauf la clé secrète reCAPTCHA**, qui va seulement dans la console Firebase.

1. **Ajouter Firebase au projet** : https://console.firebase.google.com → *Créer un projet* → *Ajouter Firebase à un projet Google Cloud existant* → choisir « 3eBras ». Google Analytics : non.
2. **Enregistrer l'app web** : ⚙ *Paramètres du projet* → *Vos applications* → icône Web `</>` → surnom `SuperChef.ai` (pas d'hébergement Firebase). Copier `apiKey`, `projectId` et `appId` (valeurs publiques).
3. **Activer AI Logic** : menu *IA* → *AI Logic* → *Commencer* → fournisseur **Gemini Developer API** (sans frais). Si l'assistant propose App Check, accepter.
4. **Créer la clé reCAPTCHA** : https://www.google.com/recaptcha/admin/create → libellé `SuperChef.ai`, type **Score (v3)**, domaines `jpdesbiens11.github.io` et `localhost`, projet Google Cloud du projet Firebase. Depuis 2026, la clé créée est une clé **Fraud Defense** (anciennement reCAPTCHA Enterprise) ; seule la **clé de site** (publique) sert.
5. **App Check** : console Firebase → *Sécurité* → *App Check* → *Applications* → l'app web → **Fraud Defense** (la version classique est fermée aux nouvelles apps) → coller la **clé de site**, TTL 1 heure → *Enregistrer*. Après la publication de l'app avec App Check : onglet *API* → *Firebase AI Logic* → **Appliquer** (enforce).
6. Donner à Claude : `apiKey`, `projectId`, `appId`, la **clé de site**. Claude les met dans `dist/js/config.js` (`ia: { … }`).

Valeurs en place (2026-11-06, créées sous le nom 3Bras) : projet Firebase `bras-933fe`, app web `3Bras`. Ces noms internes ne se voient pas dans l'app et n'ont pas à changer (D-G-030).

Modèle par défaut : `gemini-3.5-flash` (changer `modele` dans la config au besoin).

## Nouveau domaine (Hostinger, D-G-031)

Google n'accepte la connexion et Gemini que depuis les domaines qu'on lui déclare. Pour chaque nouveau domaine (ex. `https://superchef.exemple.com`, sans barre à la fin) :

1. **Connexion Google** : console Google Cloud → *API et services* → *Identifiants* → l'ID client OAuth « Application Web » → *Origines JavaScript autorisées* → **Ajouter** le domaine. Garder `https://jpdesbiens11.github.io` tant que Pages sert de copie de secours.
2. **Écran de consentement** : *API et services* → *Écran de consentement OAuth* (ou *Google Auth Platform* → *Branding*) → nom de l'application **SuperChef.ai**, et le domaine dans *Domaines autorisés*. En mode Test, chaque compte qui se connecte doit être dans *Utilisateurs test*.
3. **Clé reCAPTCHA (Fraud Defense)** : console Google Cloud → *Sécurité* → *Fraud Defense* (reCAPTCHA) → la clé de site → *Domaines* → ajouter le domaine (sans `https://`).
4. **Clé Firebase** : *API et services* → *Identifiants* → *Browser key (auto created by Firebase)* → si *Référents HTTP* est coché, ajouter `https://<domaine>/*`.

Aucune valeur de `dist/js/config.js` ne change.
