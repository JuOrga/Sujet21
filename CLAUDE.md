# Sujet 21 — les règles du dépôt

Ce fichier est lu automatiquement par Claude Code à chaque session. Ce qui
est écrit ici s'applique **sans qu'on ait à le redemander**.

---

## Le flux de branches — À SUIVRE SYSTÉMATIQUEMENT

```
prod ────────────────────────●──────────────●────────   ← ce qui est EN LIGNE
                            ╱              ╱             (déploie sur merge)
dev  ──●────●────●─────────●──────●───────●──────────   ← l'intégration
      ╱    ╱    ╱                ╱                       (aucun déploiement)
   branche  branche  branche                             ← une par demande
```

**`prod`** — ce qui est en ligne. On n'y pousse **jamais** directement : on
y arrive uniquement par une PR depuis `dev`, et cette fusion **publie**.

**`dev`** — l'intégration. On n'y pousse **jamais** directement non plus :
tout y entre par PR. Ni déploiement ni CI ne partent de `dev` — une PR vers
`dev` ne déclenche **rien**, d'où l'obligation de vérifier en local (voir
plus bas).

**Une branche par demande.** À **chaque nouvelle demande**, créer une
branche **issue de `dev`**, y travailler, puis ouvrir une **PR vers `dev`**.
Ne jamais empiler deux demandes sans lien sur la même branche.

```bash
git fetch origin dev
git checkout -b claude/<sujet-court> origin/dev
# … le travail, un commit par idée …
git push -u origin claude/<sujet-court>
# puis une PR vers dev
```

**Livrer** = ouvrir une PR `dev` → `prod`. C'est le seul geste qui met en
ligne, et il est **toujours** celui de l'humain : ne jamais fusionner vers
`prod` sans qu'il l'ait demandé explicitement.

---

## L'ÉCONOMIE DES ACTIONS — la contrainte qui prime

Le projet vise les paliers **gratuits** de GitHub et de Vercel. Au 31/08/2026,
avant réglage, il consommait **~2 361 min d'Actions par mois** (quota gratuit :
2 000) et **~618 déploiements Vercel en production par mois**.

Trois règles en découlent, et elles passent **avant le confort** :

1. **Rien ne tourne que pour `prod`.** La CI se déclenche sur les PR vers
   `prod` et les poussées sur `prod` — **pas** sur les PR vers `dev`, ni sur
   les branches de travail. Aucun workflow ne se déclenche sur `push` sans
   filtre de branche : c'est ce qui faisait tourner la CI deux fois par
   poussée (une fois pour `push`, une fois pour `pull_request`).
2. **Seul `prod` déploie**, et **seul le workflow `deploy` publie**. Pour
   voir une branche en ligne, deux chemins, le même résultat :

   ```bash
   git push -f origin <votre-branche>:previsu-go   # la gâchette
   ```
   ou `deploy` → *Run workflow* → cible `previsualisation` — mais ce bouton
   ne s'affiche pas partout (il se replie selon l'appareil et la largeur de
   la fenêtre), d'où la gâchette, qui marche toujours.

   L'adresse s'affiche en tête du résumé de l'exécution. Le site en ligne
   n'est pas touché. Jamais un déploiement automatique depuis `dev` ou une
   branche de travail.

   **PUBLIER EST L'EXCEPTION** : `deploy` ne met en ligne que sur une
   poussée vers `prod` ou un lancement manuel ciblant `production`. Tout le
   reste est un aperçu — une branche déclenchante ajoutée par mégarde ne
   peut donc plus publier.

   ⚠️ **Une seconde chaîne existe, invisible depuis le dépôt.** L'application
   GitHub de Vercel est connectée au projet et reçoit le même webhook : le
   31/08 elle construisait **toutes les branches**, 3 s après chaque poussée —
   20 déploiements sur une heure, dont 2 seulement en production. Ce qui la
   retient est le réglage **« Ignored Build Step » → « Don't build anything »**
   du projet Vercel. Le remettre sur `Automatic` ramène le doublon **en
   silence** : aucune ligne du dépôt ne le signalerait. Avant de conclure quoi
   que ce soit sur le coût, regarder le tableau de bord Vercel — l'onglet
   Actions ne voit pas cette chaîne.
3. **Tout workflow porte `paths-ignore`** (`docs/**`, `masters/**`,
   `ops/**`, `**/*.md`) **et un `concurrency` avec `cancel-in-progress`**.
   Un commit de documentation ne construit rien ; trois poussées d'affilée
   ne sont vérifiées qu'une fois.

**Avant d'ajouter un workflow ou un déclencheur, se demander ce qu'il coûte
par mois.** En cas de doute, préférer `workflow_dispatch` ou une branche
gâchette (voir `ops/LISEZ-MOI.md`) à un déclenchement automatique.

---

## Vérifier avant de pousser — LE FILET, C'EST VOUS

**Aucune vérification automatique n'a lieu avant `prod`.** Une PR vers
`dev` ne déclenche rien du tout : entre une branche de travail et `dev`, la
seule chose qui protège le code est ce qu'on lance **en local avant de
pousser**. Un défaut peut donc atteindre `dev` sans que rien ne le signale.
Il sera arrêté à la PR `dev` → `prod` — on protège ce qui est **publié**,
pas ce qui est intégré, et c'est un choix assumé pour rester gratuit.

Les trois commandes, **systématiquement, sans exception** :

```bash
pnpm type-check    # strict, doit être à 0 erreur
pnpm test          # 888 tests, ~23 s (mesuré le 04/09/2026)
pnpm build
```

Un correctif de bug arrive avec **le test qui tombe sans lui**, et on le
vérifie dans les deux sens (retiré : rouge ; remis : vert).

---

## Les branches de service

| Branche | Rôle |
| --- | --- |
| `sauvegardes` | les sauvegardes des documents partagés, un commit par exécution |
| `sauvegarde-go`, `perf-sync-go`, `diag-*-go`, `seed-*-go` | **gâchettes** : y pousser lance le workflow du même nom |
| `previsu-go` | **gâchette** : y pousser déploie un APERÇU de ce qu'on y pousse (jamais la production) |

Les gâchettes existent parce que l'environnement d'analyse ne joint pas
`sujet21.vercel.app` (politique réseau) : le runner GitHub, si. Détail dans
`ops/LISEZ-MOI.md`.

---

## Le style de la maison

- **Tout en français**, code, commentaires et messages de commit compris.
- **Les commentaires disent POURQUOI**, pas quoi. Le dépôt documente ses
  pannes vécues (« le miroir disparaissait à l'enregistrement ») — c'est
  une pratique à continuer, pas une bizarrerie.
- **Les messages de commit racontent le symptôme, la cause, le correctif et
  la vérification.** Regarder `git log` pour le ton.
- **Ne jamais annoncer un chiffre sans l'avoir mesuré.** « ~30 % plus
  léger » se vérifie par une construction avant/après.
- Aucun identifiant de modèle (Claude, Opus…) dans le code, les commits ou
  les PR — cela reste dans la conversation.
