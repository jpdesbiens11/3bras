# Brancher Gemini dans SuperChef.ai (Firebase AI Logic) — réglages

Tout se fait dans le projet Google Cloud « 3eBras » déjà utilisé pour la connexion Google. Aucune valeur ci-dessous n'est secrète, **sauf la clé secrète reCAPTCHA**, qui va seulement dans la console Firebase.

1. **Ajouter Firebase au projet** : https://console.firebase.google.com → *Créer un projet* → *Ajouter Firebase à un projet Google Cloud existant* → choisir « 3eBras ». Google Analytics : non.
2. **Enregistrer l'app web** : ⚙ *Paramètres du projet* → *Vos applications* → icône Web `</>` → surnom `SuperChef.ai` (pas d'hébergement Firebase). Copier `apiKey`, `projectId` et `appId` (valeurs publiques).
3. **Activer AI Logic** : menu *IA* → *AI Logic* → *Commencer* → fournisseur **Gemini Developer API** (sans frais). Si l'assistant propose App Check, accepter.
4. **Créer la clé reCAPTCHA** : https://www.google.com/recaptcha/admin/create → libellé `SuperChef.ai`, type **Score (v3)**, domaines `jpdesbiens11.github.io` et `localhost`, projet Google Cloud du projet Firebase. Depuis 2026, la clé créée est une clé **Fraud Defense** (anciennement reCAPTCHA Enterprise) ; seule la **clé de site** (publique) sert.
5. **App Check** : console Firebase → *Sécurité* → *App Check* → *Applications* → l'app web → **Fraud Defense** (la version classique est fermée aux nouvelles apps) → coller la **clé de site**, TTL 1 heure → *Enregistrer*. Après la publication de l'app avec App Check : onglet *API* → *Firebase AI Logic* → **Appliquer** (enforce).
6. Donner à Claude : `apiKey`, `projectId`, `appId`, la **clé de site**. Claude les met dans `dist/js/config.js` (`ia: { … }`).

Valeurs en place (2026-11-06, créées sous le nom 3Bras) : projet Firebase `bras-933fe` (n° 114065620639), app web `3Bras`. Ces noms internes ne se voient pas dans l'app et n'ont pas à changer (D-G-030). Attention : la connexion Google (ID client OAuth) vit dans un **autre** projet Google Cloud, n° 437109324574 (« 3eBras ») ; la clé reCAPTCHA, elle, doit être dans `bras-933fe`.

Clé de site reCAPTCHA (Fraud Defense) depuis 1.10.1 : `6LcUpxsuAAAAAPmcMqwtsT6JvzP-FakB9HHzLHeZ`, créée dans `bras-933fe` (D-G-037). L'ancienne `6LdKxxMu…` n'était pas reconnue par App Check.

## Dépannage : « Firebase App Check token is invalid » (401)

Le jeton anti-robot est refusé. Pour savoir si c'est un réglage, l'échange App Check répond avec un faux jeton :

```bash
curl -s -X POST "https://content-firebaseappcheck.googleapis.com/v1/projects/bras-933fe/apps/<appId>:exchangeRecaptchaEnterpriseToken?key=<apiKey>" -H 'Content-Type: application/json' -H 'Referer: https://jpdesbiens11.github.io/' -d '{"recaptcha_enterprise_token":"faux"}'
```

- `FAILED_PRECONDITION … ensure that the reCAPTCHA Enterprise API is enabled and that the site key is from the same project` : réglage. Vérifier, dans l'ordre : l'API reCAPTCHA Enterprise est **activée** dans `bras-933fe` ; la clé de site est **listée** dans `bras-933fe` (Sécurité → reCAPTCHA) ; Firebase → App Check → l'app web → fournisseur reCAPTCHA Enterprise (Fraud Defense) porte **cette** clé, enregistrée. Compter quelques minutes après un changement.
- Toute autre erreur (jeton invalide ou attestation refusée) : le réglage est bon ; seul le faux jeton est refusé, comme il se doit.


Modèle par défaut : `gemini-3.5-flash` (changer `modele` dans la config au besoin). « Adapter » (D-G-033) utilise le modèle léger `modeleRapide` : `gemini-3.5-flash-lite`.

Note du 2026-11-12 (page des modèles Firebase AI Logic) : Google achemine maintenant les appels à `gemini-3.5-flash` vers `gemini-3.6-flash`, et annonce `gemini-3.8-flash` comme remplaçant. Rien ne casse ; passer `modele` à `gemini-3.8-flash` est une décision à part, à tester sur quelques recettes.

## Nouveau domaine (Hostinger, D-G-031)

Google n'accepte la connexion et Gemini que depuis les domaines qu'on lui déclare. Pour chaque nouveau domaine (ex. `https://superchef.exemple.com`, sans barre à la fin) :

1. **Connexion Google** : console Google Cloud → *API et services* → *Identifiants* → l'ID client OAuth « Application Web » → *Origines JavaScript autorisées* → **Ajouter** le domaine. Garder `https://jpdesbiens11.github.io` tant que Pages sert de copie de secours.
2. **Écran de consentement** : *API et services* → *Écran de consentement OAuth* (ou *Google Auth Platform* → *Branding*) → nom de l'application **SuperChef.ai**, et le domaine dans *Domaines autorisés*. En mode Test, chaque compte qui se connecte doit être dans *Utilisateurs test*.
3. **Clé reCAPTCHA (Fraud Defense)** : console Google Cloud → *Sécurité* → *Fraud Defense* (reCAPTCHA) → la clé de site → *Domaines* → ajouter le domaine (sans `https://`).
4. **Clé Firebase** : *API et services* → *Identifiants* → *Browser key (auto created by Firebase)* → si *Référents HTTP* est coché, ajouter `https://<domaine>/*`.

Aucune valeur de `dist/js/config.js` ne change.
