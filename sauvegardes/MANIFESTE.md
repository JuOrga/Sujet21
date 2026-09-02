# Sauvegarde des documents partagés

Prise le **2026-09-02T07:57:47.712Z** depuis `https://sujet21.vercel.app/api`.

| Famille | Fichier | Entrées | Détail |
| --- | --- | ---: | --- |
| tableaux | `levels.json` | 56 | séquence : HUB2 → 21AA-100 → 21AB-100 → 21AC-100 → 21AD-131 → 21AF-101 → 21AG-111 → 101 → 101 → 101 → 121 → 212 → 111 → 111 → 101 → 101 → 101 → 21TY-232 → 21T-112 → 21GE-112 → 21AC-111 → AH → 21AE-131 → 21E-102 → 21 AB-101 → 21AC-102 → 21-? → 531 → 21AA-122 → 21-S1 → 21-S2 → 21-S3 → 21-B → 21-C → 21-F → 21-D → 21-H → 21-I → 21-J → 21-K → 21-L → 21-100 → 21-G → 21-101 → 21-A bis → 21-? → 21-? → 21-? → 21-? → 21-01 → AH-2 → 21-101 → 21-07 → 21AE-111 → 21-502 → 21-? |
| présets | `presets.json` | 7 | défaut : ⚙ Ballet orbital · ⚙ Ballet orbital, boizcohesioncontrole1, boizessai1, boizessai2, boizvapeur1, Julian-ReculLocalise-propulsion, Julian2-ReculLocalise-propulsion |
| cahier des règles | `regles.json` | 0 | 0 note(s), 0 ajout(s) |
| fiches réécrites | `fiches.json` | 0 | 0 fiche(s) réécrite(s) |
| cinématiques | `cinematiques.json` | 2 | SONDE-CI, ESSAI-3 |
| catalogue d’images | `images.json` | 0 | 0 entrée(s) — URL seulement, pas les pixels |
| registres | `records.json` | 78 | 40 tableau(x), 38 top(s), expédition : oui |

## Ce que cette sauvegarde contient — et ce qu’elle ne contient pas

- **`levels.json` porte la carte.** L’ordre du tableau `levels` EST la
  séquence de l’expédition : le restaurer remet les salles *et* leur
  enchaînement.
- **`images.json` ne porte pas les pixels.** Le catalogue garde les URL
  des blobs. Si un blob est supprimé côté Vercel, l’URL sauvegardée est
  morte — sauvegarder les binaires demanderait un autre dispositif.
- **Rien de ce qui est local au joueur** (progression, réglages, run en
  cours) n’est ici : cela vit dans le `localStorage` de chaque poste.

## Rendre une sauvegarde

```bash
# 1. ce qui SERAIT écrit, sans rien écrire (défaut)
node ops/restaure.mjs <dossier>

# 2. écrire pour de bon
CONFIRME=oui node ops/restaure.mjs <dossier>
```

La restauration ne fait que des ajouts et des remplacements par clé :
elle ne supprime jamais une entrée présente sur le serveur.
