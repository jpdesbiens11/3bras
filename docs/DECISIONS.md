# Décisions — 3Bras (anciennement 3eBras)

Chaque décision a un code D-G-nnn et une date. On n'en efface jamais : une décision remplacée est marquée « révisée ».

| Code | Date | Décision |
|---|---|---|
| D-G-001 | 2026-11-05 | Format dans Drive : un classeur Google Sheets comme base, et une fiche Google Docs par recette. |
| D-G-002 | 2026-11-05 | Accès à Drive par la portée `drive.file` seulement : l'app ne voit que ses fichiers. Ni recette ni jeton sur un serveur. |
| D-G-003 | 2026-11-05 | Migration depuis Notion faite une seule fois : Claude lit Notion et produit un fichier d'import JSON validé. |
| D-G-004 | 2026-11-05 | Ajout d'une recette par deux voies : formulaire ou texte collé dans l'app ; photo, PDF ou lien extraits dans un chat Claude, qui produit un fichier à importer. |
| D-G-005 | 2026-11-05 | Toute personne qui a le lien peut se connecter. L'écran de consentement sera publié, avec accueil, politique de confidentialité et conditions. |
| D-G-006 | 2026-11-05 (révisée) | Hébergement sur GitHub Pages : https://jpdesbiens11.github.io/3ebras/. Phase 1 : écran Google en mode Test. Phase 2 : publication. |
| D-G-007 | 2026-11-05 | Dépôt GitHub public `3ebras`, licence MIT. Aucune recette ni donnée personnelle dans le dépôt. |
| D-G-008 | 2026-11-05 | Tout est migré au MVP 1 : recettes, desserts, plans, inventaire et bilans. |
| D-G-009 | 2026-11-05 | Notion reste en lecture seule comme filet de sécurité ; rien n'y est écrit après le MVP 2. |
| D-G-010 | 2026-11-05 | Nom de l'app : 3eBras partout. Il remplace Gordon Rams.ai. |
| D-G-011 | 2026-11-05 | Le VPS Hostinger n'est pas utilisé. |
| D-G-012 | 2026-11-05 | Le dossier Drive s'appelle « 3eBras » et le classeur « 3eBras — Livre ». L'app retrouve ses fichiers par l'étiquette `appProperties.3ebras` (`dossier`, `livre`), jamais par leur nom : la personne peut les renommer. |
| D-G-013 | 2026-11-05 | Le jeton Google est obtenu par le flux « jeton » de Google Identity Services, sans serveur. Il est renouvelé sans invite cinq minutes avant la fin de son heure. |
| D-G-014 | 2026-11-05 | Une version = une PR fusionnée dans `main`. Le workflow lit la version de `package.json`, crée le tag et la release `v<version>` s'ils n'existent pas, puis publie. La fusion de la PR par JP est la seule étape humaine. |
| D-G-015 | 2026-11-06 | Schéma 2 : les champs de Notion absents du schéma 1 (Facilité, Étoiles, Restes, Tâches sous-chef, À vérifier, Fiche complète, Lien source, Notes, ID Notion, ID Evernote ; Titre et Déjà à la maison pour les plans ; Département et Essentiel pour l'inventaire ; six colonnes de bilan) sont ajoutés à la fin des onglets. Un classeur v1 est migré à l'ouverture ; un en-tête renommé à la main bloque la migration au lieu d'être écrasé. |
| D-G-016 | 2026-11-06 | Fichier d'import `3ebras-import` v1 : un objet par ligne, clés = noms de colonnes, ids stables (`r-<id Notion>`, `p-…`, `i-…`). Tout est validé avant d'écrire ; ré-importer le même fichier n'ajoute rien. Les recettes de kits repas sont refusées à l'import (R-15). |
| D-G-017 | 2026-11-06 | Le Livre montre par défaut toutes les recettes sauf les « Déclassées » ; les filtres Type, Statut et Protéine précisent. |
| D-G-018 | 2026-11-06 | 3eBras reprend exactement le cadre de Gordon Rams.ai (artefact du 2026-11-04) : même CSS, trois thèmes, icônes, en-tête à 6 étapes (01 Livre, 02 Garde-manger, 03 Semaine, 04 Provigo, 05 Au poêle, 06 Bilan), feuilles d'aperçu, minuteurs et glissement de tri. Seule la couche de données change : le classeur Google remplace Notion. Les gabarits en innerHTML sont réécrits avec el() (P-2) ; les polices Google sont servies par l'app (P-1). Les textes restent dans chaque vue, comme dans l'artefact ; ils passeront dans un fichier unique (N-09) à l'étape anglaise. |
| D-G-019 | 2026-11-06 | Un plan de semaine = une ligne par souper (Jour) et une ligne par dessert (Dessert = oui) dans « Plans de semaine ». Approuver met à jour ces lignes (relues avant d'écrire, N-07) au lieu de les recréer. |
| D-G-020 | 2026-11-06 | Le bouton « + Recette » (conversion par Claude) reste caché hors de claude.ai, comme dans l'artefact : la conversion passe par un chat Claude qui produit un fichier d'import (D-G-004). Le bouton Compte (en-tête) donne l'import, le classeur et la déconnexion. |
| D-G-021 | 2026-11-06 | Nom affiché : 3Bras (révise D-G-010). Sous-titre B.R.A.S. : « Besoin de Renfort Au Souper », à la place de « Restauration Express ». Restent figés : le dépôt `3ebras`, l'adresse https://jpdesbiens11.github.io/3ebras/, le dossier Drive « 3eBras » et son classeur, le format `3ebras-import` et les clés techniques. |

## Questions ouvertes

- Domaine `3ebras.io` : vérifier qu'il est libre et l'acheter avant la phase 2 (JP).
- Ouvrir un classeur existant qui n'a pas été créé par l'app : il faudra le Google Picker, à prévoir au MVP 1.
