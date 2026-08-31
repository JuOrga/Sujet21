# `ops/` — les scripts qui parlent au site

Ces scripts ne sont **pas** compilés dans le jeu : ils vivent hors de
`tsconfig.json` (`include: ["src", "vite.config.ts"]`) et hors de Vitest
(`include: ['src/**/*.spec.ts']`). Les ajouter ou les modifier ne peut donc
ni casser le build, ni faire tomber un test.

Ils s'exécutent depuis **GitHub Actions**, pas depuis l'environnement
d'analyse : la politique réseau du bac à sable refuse `sujet21.vercel.app`,
le runner GitHub l'atteint.

---

## Sauvegarder les documents partagés

`sauvegarde.mjs` · workflow `sauvegarde` · branche `sauvegardes`

### Pourquoi

Tout ce que les concepteurs écrivent depuis le jeu vit dans **un document
JSON par famille**, en régime « dernier écrivain gagnant », derrière des
endpoints **sans authentification** :

| Famille | Ce qu'on perd si elle est écrasée |
| --- | --- |
| **tableaux** (`/api/levels`) | les salles **et leur ordre** — l'ordre du tableau `levels` *est* la séquence de l'expédition |
| **présets** (`/api/presets`) | les réglages publiés, et le préset appliqué au lancement |
| cahier des règles (`/api/regles`) | les notes et les ajouts en texte libre |
| fiches (`/api/fiches`) | les fiches réécrites depuis l'éditeur |
| cinématiques (`/api/cinematiques`) | les montages partagés |
| catalogue d'images (`/api/images`) | les noms et URL des visuels importés |
| registres (`/api/records`) | les records |

`api/_magasin.ts` garde bien un historique de 4 versions, mais c'est un
filet d'écriture, pas une sauvegarde : quatre enregistrements suffisent à
le faire défiler entièrement. Ici, **chaque exécution ajoute un commit** —
donc l'historique complet, aussi loin qu'on remonte.

### Quand ça tourne

- tous les jours à **03:17 UTC** ;
- à la demande (onglet Actions → *sauvegarde* → *Run workflow*) ;
- sur un push de la branche-gâchette `sauvegarde-go`.

### Où c'est déposé

- branche **`sauvegardes`** — un commit par exécution, jamais de `--force` ;
  une exécution sans changement ne commite rien ;
- **artefact** téléchargeable depuis l'exécution (90 jours), pour récupérer
  un instantané sans cloner la branche.

### Ce que le script ne fait pas

- **Il n'écrit jamais vers l'API.** Il ne connaît que `GET`.
- **Il n'écrit jamais une sauvegarde partielle.** Si une seule famille est
  illisible (après 3 essais — une lambda froide peut répondre 500 une fois),
  il sort en erreur **sans créer un seul fichier**. Le workflow échoue, la
  sauvegarde précédente reste intacte.
- **Il ne sauvegarde pas les pixels des images**, seulement le catalogue
  (noms et URL des blobs). Un blob supprimé côté Vercel laisse une URL
  morte dans la sauvegarde.
- **Il ne touche à rien de local au joueur** (progression, réglages, run en
  cours) : cela vit dans le `localStorage` de chaque poste.

### À la main

```bash
node ops/sauvegarde.mjs                 # → sauvegardes/
node ops/sauvegarde.mjs mon-dossier
API=https://…/api node ops/sauvegarde.mjs
```

---

## Rendre une sauvegarde

`restaure.mjs` — **manuel, jamais automatique.** Aucun workflow ne
l'exécute, et c'est délibéré.

```bash
# 1. voir ce qui SERAIT écrit — rien n'est envoyé (c'est le défaut)
node ops/restaure.mjs sauvegardes

# 2. écrire pour de bon
CONFIRME=oui node ops/restaure.mjs sauvegardes
```

**Elle ne peut que rendre, jamais retirer.** Elle repose chaque tableau par
son `id` et chaque préset par son `title` (l'API remplace par clé), puis
remet l'ordre des tableaux. Elle n'appelle **jamais** `DELETE`, et une
entrée présente sur le serveur mais absente de la sauvegarde est laissée en
place — le réordonnancement de l'API la garde (« ce que l'appelant n'a pas
cité reste, à la fin »).

**Ce qui ne revient pas à l'identique :** `majAt` prend la date de la
restauration, le serveur l'écrivant lui-même. L'auteur, le code et la
provenance du code sont préservés : l'API ne redate la codification que si
le code *change*, et il ne change pas.

**Portée : tableaux et présets.** Ce sont les deux familles dont
l'écriture est un remplacement par clé, donc rejouable sans risque. Les
règles, fiches et cinématiques sont bien *sauvegardées* (elles sont dans le
dossier) mais se rendent à la main depuis le jeu — écrire ici une
restauration que personne n'a essayée serait un piège.

---

## Les autres scripts

| Script | Rôle | Gâchette |
| --- | --- | --- |
| `seed-levels.mjs` | semer les tableaux livrés sans toucher aux existants | `seed-levels-go` |
| `maj-hub.mjs` | remplacer l'instantané du hub en bibliothèque | `maj-hub-go` |
| `seed-inspires.mjs` | semer les recadrages d'inspiration | `seed-inspires-go` |

Ceux-là **écrivent** vers l'API. Une sauvegarde fraîche avant de les lancer
est une bonne habitude — c'est maintenant à un `Run workflow` près.
