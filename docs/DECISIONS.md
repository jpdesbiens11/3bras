# Décisions — 3eBras

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

## Questions ouvertes

- Domaine `3ebras.io` : vérifier qu'il est libre et l'acheter avant la phase 2 (JP).
- Ouvrir un classeur existant qui n'a pas été créé par l'app : il faudra le Google Picker, à prévoir au MVP 1.
