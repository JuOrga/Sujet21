# La cérémonie (#mb-veil) — inventaire factuel

Base : worktree `.claude/worktrees/apercu`, branche `claude/apercu-quatre-chantiers` (HEAD 2bd0055, dev + 4 PR en attente).
Lignes : `src/main.ts` (M:), `index.html` (H:, la feuille est inline dans index.html), `src/game/*` nommés.

## 0. Comment les captures ont été faites (lire avant de regarder)

- **Tout est reconstitué, rien n'est observé en jeu.** WebGL2 n'existe pas en headless WSL : le jeu ne démarre pas.
- Méthode : `vite build` → `dist/` servi en local, **scripts du jeu bloqués**, vraie feuille de style ; puis injection de
  - `fabrique.js` : les **vrais modules** du jeu empaquetés par esbuild (plan de station `dessinCarteSVG`, mini-carte `dessinMiniCarteSVG`, plans des salles générées `genereNiveauAtelier` + `dessineMiniCarte`, catalogue `INSTRUMENTS` + `tirageInstruments`, tuiles `gainsDeSalle/gainsDeModule`, rencontres `tireEvenement/offresDe`, haltes `offresRepos/offreDon`, et la vraie simulation de particules `Feu`) ;
  - `poses.js` : le DOM que main.ts bâtit à chaque étape, **recopié de ses gabarits** (chaque pose cite sa ligne M:). `carteHTML` et `mbGainHTML` (internes à main.ts) sont recopiés à la lettre.
- Valeurs **plausibles, pas mesurées** : salle livrée à 93 % (SUPERFLUIDE), 4,18 L, prime de glace 0,32 L, chrono 48,3 s, bourse 655 cL, réserve 3,2/8 L, maîtrise 4,6 → 8,8 L (palier 2 franchi), descente 3-4/18, module TRANSFO GLACE (vrai module de `carteStation.json`).
- Images « mi-animation » : animations CSS figées via `document.getAnimations()` (pause + `currentTime`), flash/secousse posés, et le canvas `#mb-feu` dessiné par le vrai `Feu` (mêmes paramètres de rafale que main.ts) avancé à l'âge voulu. **Ce n'est pas une image du jeu en mouvement** : l'ordre et l'âge des effets sont tirés du code.
- Écarts connus : (1) le WSL n'a aucune police emoji — Segoe UI Emoji du poste Windows a été prêtée aux familles du jeu par `unicode-range` (ce qu'un joueur Windows voit ; un Deck/Linux/Mac dessinera d'autres emoji). (2) Derrière le voile, en jeu, il y a la salle WebGL (le fond du voile est à 96–98 % d'opacité) ; ici, du noir. (3) Survols : seul le `:hover` CSS joue (les gestionnaires JS de main.ts ne sont pas là) — la fiche de la mini-carte et l'extinction des cases au survol ne sont pas montrées. (4) Le retournement de carte du tirage montre la **face en miroir** au lieu du dos (`.mb-pli::before`) : observé dans Chromium headless (rendu logiciel), **à confirmer sur un vrai navigateur GPU** — si ça se confirme, le « dos » n'est jamais vu.
- Scripts : `banc-ceremonie.cjs` (lance tout, écrit `mesures.json`), `fabrique.ts` → `fabrique.js`, `poses.js`. Serveur arrêté.

## 1. Captures (1280 × 720, dossier `captures/`)

| Fichier | Étape | Nature |
|---|---|---|
| 01-bilan-chute-t850ms.png | Bilan, la médaille tombe (flash + étincelles) | reconstitué, **mi-animation** |
| 02-bilan-final.png | Bilan complet (≈ 4,6 s) | reconstitué |
| 03-versement.png | Où verser le surplus ? (survol MAÎTRISE) — vue à l'ouverture | reconstitué |
| 03b-versement-defile.png | idem, scène défilée en bas | reconstitué |
| 04-etalonnage-palier-t350ms.png | Jauge de maîtrise : palier franchi (bande, flash, feu) | reconstitué, **mi-animation** |
| 05-tirage-retournement-t550ms.png | Tirage : cartes qui se retournent | reconstitué, **mi-animation** (voir écart 4) |
| 06-tirage.png | Tirage posé, carte 1 visée | reconstitué |
| 06b-tirage-elue-t250ms.png | Carte élue (embrasement + confettis) | reconstitué, **mi-animation** |
| 07-salles.png | Choisissez la salle suivante (mini-carte + 3 portes, porte 1 survolée) | reconstitué |
| 07b-salles-noeud.png | idem avec une porte de RENCONTRE | reconstitué |
| 07c-salles-porte-ouverte-t260ms.png | Porte élue qui s'ouvre (flash, étincelles) | reconstitué, **mi-animation** |
| 08-module-sceau-t350ms.png | Bilan de module : le sceau tombe (confettis) | reconstitué, **mi-animation** |
| 09-module.png | Bilan de module complet | reconstitué |
| 10-carte-station.png | Choisissez la coursive (plan de station) | reconstitué |
| 11-repos.png / 12-don.png | Haltes : alcôve (3 offres) / bonbonne oubliée | reconstitué |
| 13-rencontre.png / 14-rencontre-issue.png | Rencontre (récit + offres) / son issue | reconstitué (événement réel « LE CONDENSEUR ») |
| 15-cache.png / 16-minijeu.png | Cache (orbe) / résultat d'un mini-jeu | reconstitué |
| 17-fin-ordinaire.png | Fin ordinaire (sans voie) « PAROI DU SAS OUVERTE » | reconstitué |
| 18-overlay-descente-bouclee.png / 19-overlay-defaite.png | **Hors #mb-veil** : `#overlay` fin de run / défaite | reconstitué |
| 20-planche-assets-reutilisables.png | Planche des images du jeu réutilisables | assemblage des fichiers `public/assets` |

Mesures (mesures.json) : **seul le versement déborde à 720 px** (scène 789/717 px, défilement interne ; les plaques sont coupées en bas de l'écran à l'ouverture, rien ne les fait défiler). Tout le reste tient.

## 2. Le fil, dans l'ordre

Constantes de rythme : `src/game/ceremonie.ts:70` `TEMPS_BILAN = { titre 0, rang 650, litres 1000, prime 2050, lignes 2350, condensat 3450, versement 4900 }`, `PAS_LIGNE_MS = 240`.
Ponctuations communes (M:14788-14863) : **`mbEclate`** (rafale de particules sur `#mb-feu`, `src/game/ceremonieFx.ts` : formes `eclat` disque / `confetti` rectangle / `etincelle` trait, plafond 900), **`mbFlash`** (H:7892 `mb-flash` 0,5 s, blanc à 55 %), **`mbSecousse`** (H:7910 `mb-secousse-scene` 0,42 s + vibration manette). Teintes : `MB_OR`, `MB_MENTHE`, `MB_EAU` (M:14867).
**Son : deux échantillons seulement pour toute la cérémonie** — `bande.ponctuation('sting-collecte' | 'sting-record', gain)` (`src/game/soundtrack.ts:352`, `public/sound/sting-*.mp3`), plus `audio.iceImpact` (`src/game/audio.ts:534`) pour la prime de glace.
Fond permanent du voile : dégradé radial + grille 64 px qui dérive (H:7856 `mb-derive` 18 s) + balayage de lumière (H:7870 `mb-balaye` 7 s) + vignettage.

### Déclencheurs
- Fin de salle en run : sas atteint et expédition non bouclée → `montreMiseEnBonbonne(...)` M:20421 (dans `corpsImage`, M:19017). Debug : `simuleBonbonne` M:12751.
- Départ de run avec carte : `newExpedition` M:17707 → `montreCarteRun('depart')` M:17747 (le plan s'ouvre directement, pas de bilan).
- Sortie de l'économat-nœud : `avanceSalle` M:14947 → `montreSuiteRun` M:16904.
- Fin de mini-jeu : M:20155 → `mbMontreResultatMiniJeu`. Palet : `mbMontreChoixPalet` M:14407 (relancer / valider).
- Fin de run bouclée et défaite : **pas** la cérémonie, `showOverlay` M:18911 (M:20404, M:17859/17873).

### Étape 1 — LE BILAN « SALLE FRANCHIE » — `montreMiseEnBonbonne` M:17188 (captures 01, 02)
Affiche : sur-titre `MISE EN BONBONNE · <code> [· PRIME : …]`, titre géant `SALLE FRANCHIE` + filet ; **plaque** `.mb-releve` (H:7953, rectangle r=14) avec : médaille du rang (disque + anneau conique tournant, nom SUPERFLUIDE/LAMINAIRE/TURBULENT/VISQUEUX/FIGÉ, mot, 5 étoiles — `ceremonie.ts:45`), flacon (rectangle arrondi, eau + graduations, 🧊 si prime), grand chiffre VOLUME LIVRÉ, 3 **lignes** rectangulaires (PART LIVRÉE / CHRONO / NOTE : icône emoji, barre 6 px, chiffre, sous-texte, tampon RECORD DU PROTOCOLE), puis « CE QUE LA SALLE RAPPORTE » : **tuiles** `.mb-gain` (condensat, mémoire, [tirage garanti], [orbe]) ; « toucher pour passer » qui clignote.
Temps et effets :
- 0 ms : titre `mb-claque` (H:7932, échelle 2,4→1 + flou, 0,6 s), sur-titre `mb-monte` (H:7944), filet qui s'étire `mb-filet` (H:7943).
- 650 ms (M:17236) : médaille `mb-tombe` (H:8006, 3,6× + rotation, 0,62 s), anneau `mb-tourne` (H:7990, 5 s ∞) ; flash ; secousse (0,9 si ≥ 4 étoiles, sinon 0,5) ; feu `etincelle` 40+16×étoiles, teinte du rang ; son sting-record (≥ 4 ★) ou sting-collecte ; étoiles une à une +240 ms +110 ms/étoile (`mb-etoile` H:8026) avec sting-collecte de plus en plus fort.
- 1000 ms (M:17260) : le corps du relevé paraît (fondu 0,4 s), l'eau monte (transition 1,3 s), compteur de litres qui roule 1,3 s (rAF). Eau vivante : `mb-ondule` H:8061, `mb-bulles` H:8073.
- 2050 ms (M:17274, si prime) : « dont +x L de PRIME DE GLACE » + 🧊 (`mb-plonge` H:8082), `audio.iceImpact`, feu `eclat` bleu sur le flacon.
- 2350 ms + 240 ms/ligne (M:17312) : chaque ligne glisse de la gauche (transition 0,34 s), sa barre se remplit (0,9 s) ; un record : tampon `mb-tampon` (H:8177) +350 ms + sting-record + secousse 0,4 + confettis or.
- 3450 ms + 170 ms/tuile (M:17327) : tuiles posées (transition 0,36 s), feu `eclat` sur l'icône, chiffre qui roule 1 s ; sting-record si orbe ou tirage.
- 4900 ms : passe seul au versement.
Avance : automatique, ou **pointerdown** n'importe où hors bouton (M:17355) → saute au versement. Aucun saut câblé au clavier/manette dans ce code (à vérifier).

### Étape 2 — LE VERSEMENT « OÙ VERSER LE SURPLUS ? » — `mbMontreVersement` M:15065 (captures 03, 03b)
Le bilan est figé (`mbFigeBilan` M:15028) et **reste en grand au-dessus** ; dessous : titre de choix (filets latéraux), **plaque RÉSERVE** (bocal SVG en rectangles arrondis, `avant → après / 8 L`, jauge 8 px) — **goutte** ronde du surplus au centre — **plaque MAÎTRISE** (anneau SVG avec n° de palier, `avant → après`, jauge, tampon or « UN PALIER SE FRANCHIT — TIRAGE OUVERT »). Bocal plein → plaque grisée.
Anim : plaques `mb-carte-monte` (H:8607) décalées 0,1 s ; équerres d'angle (H:8612) ; goutte qui bat `mb-goutte-bat` (H:8722, 2,4 s ∞) ; à la visée la goutte penche et un **flux de gouttelettes** coule vers la plaque (`mb-flux-*` H:8749) ; gain en clair qui pulse `mb-dest-pulse` (H:8820) ; plaque qui franchit un palier : bord qui respire `mb-dest-respire` (H:8836).
Avance : clic sur une plaque (souris, clavier, manette via `pad-vise`). Réserve : sting-collecte 0,55 + feu bleu (36). Maîtrise : sting-collecte 0,55 + feu menthe (36). → étape 3.
**Débordement mesuré à 1280 × 720 : 789 px de scène pour 717 visibles** ; à l'ouverture, le bas des plaques est coupé.

### Étape 3 — L'ÉTALONNAGE « LA MAÎTRISE MONTE » — `mbVerseXp` M:15462 → `mbAnimeEtalonnage` M:15359 (capture 04)
Le bilan se **replie en bandeau** (`.mb-compact`, H:8272 : médaille → pilule, volume « → versé à la maîtrise », gains en puces). Dessous, la **jauge** `.mb-etal` (rectangle r=10) : MAÎTRISE + explication, litres + gain, cercle « palier atteint », **tube** gradué r=17 (fluide rayé animé `mb-etal-rayures` H:8406, reflet `mb-etal-reflet` H:8417, ménisque lumineux), cercle « prochain ».
Coulée : rAF, 450–1400 ms par segment, courbe `douce`. **Palier franchi** (M:15401) : tube embrasé `mb-etal-eclair` (H:8430, 0,7 s), compteur qui saute `mb-palier-pop` (H:8380), tampon or « PALIER n — TIRAGE OUVERT » (`mb-tampon`), sting-record 0,75, **bande « PALIER n / TIRAGE OUVERT »** qui traverse l'écran en biais (`mb-eclair-passe` H:8492, skewY −3°, 1,6 s, M:15451), flash, secousse 0,8, étincelles menthe ×90 depuis le compteur + confettis ×60 depuis le tube ; la jauge repart à zéro ; +850 ms segment suivant ou +1000 ms fin.
Avance : automatique → tirage(s) si paliers franchis ou tirage garanti, sinon étape 5.

### Étape 4 — LE TIRAGE « PALIER DE MAÎTRISE n — EMPORTEZ UN INSTRUMENT » — `mbMontreDraft` M:15502 (captures 05, 06, 06b)
Titre (`titreDuTirage`, `ceremonie.ts:119`) + « EN BOURSE : x cL ». **La jauge reste en grand avec son tampon** au-dessus des cartes (rien ne la replie avant l'étape 5). 3 cartes (4 avec le Carnet du Semblable) = composant `.crt` partagé avec l'atelier (`carteHTML` M:12851) : icône **emoji**, nom, calibre · famille, texte, CONTREPARTIE éventuelle, effets en barres, prix (offert / x cL).
Anim : chaque carte arrive « dos visible » et pivote (`mb-retourne` H:8525, 0,8 s, +0,2 s/carte), éclat qui balaie (`crt-eclat` H:8555), sting-collecte 0,18 à chaque pose (500 + 200i ms) ; visée : isole (autres à 30 %), **inclinaison 3D** qui suit le pointeur (`mbIncline` M:14874). Choix : `crt-elue` (H:8584) / `crt-refus` (H:8589), confettis ×70 + étincelles ×40 à la teinte de la famille, secousse 0,5, sting-record 0,6 ; +420 ms → tirage suivant ou étape 5. Carte trop chère : grisée, non cliquable.

### Étape 5 — aiguillage — `mbApresRecompense` M:15621
Module épuisé → étape 7 (bilan de module). Sinon → `mbMontreSallesDuModule` M:15651 : étape 6 (voie), ou vieux choix à deux salles `mbMontreSalles` M:16590, ou étape 13 (fin ordinaire).

### Étape 6 — « CHOISISSEZ LA SALLE SUIVANTE » — `mbMontreSallesVoie` M:16413 (captures 07, 07b, 07c)
Épure du 13/11 : relevé et jauge cachés. Question en tête, ligne de contexte (`MODULE · SALLE n/N · DESCENTE n/N` [+ confinement, descente du jour, « LE MILIEU S'OUVRE »]). **Mini-carte à voies** SVG (`voiesModule.ts`, tuiles **octogonales**, icônes de nature, coursives, repères ▲●▼, bande « vous êtes ici », sas) ; **portes** `.mb-porte` (rectangle r=12) : vitrine = plan de la salle dessiné au canvas (`carte.ts:38`), repère de voie, code, nom, ligne DIFF · PRIME · FIGURE, pastille ENTRER ▸. Porte de nœud (`mbPorteNoeud` M:16766) : icône de la mini-carte en grand (rencontre « ? », économat, repos, bonbonne, cache, mini-jeu).
Anim : portes qui montent `mb-porte-monte` (H:8965, +0,12 s/porte), **ligne de lecture qui balaie le plan** `mb-scan` (H:8982, 3,2 s ∞), halo des portes sur la mini-carte `mv-bat` (H:9100) ; visée : la porte s'avance, la coursive d'entrée s'allume, ce qu'elle ferme s'éteint, fiche en surimpression (JS, non reconstitué). Au doigt : premier toucher arme, second entre (`porteArmee.ts`).
Choix (M:16680) : porte qui grandit et blanchit `mb-porte-ouvre` (H:9036, 0,55 s), les autres se referment `mb-porte-ferme` (H:9041), flash, secousse 0,7, étincelles menthe ×80, sting-collecte 0,7 ; +520 ms → voile fermé, salle suivante. Nœud : flash + sting, +420 ms → `ouvreNoeud` M:16809 (étapes 9–12, ou économat/mini-jeu joués en salle).

### Étape 7 — « MODULE TRAVERSÉ » — `mbMontreBilanModule` M:15274 (captures 08, 09)
Plaque `.mb-module-tete` (r=14) : **sceau octogonal** menthe ✓ (clip-path, seule forme non rectangulaire de l'écran), nom du module + sous-titre, VOLUME LIVRÉ en très grand ; rangée de **pastilles de salle** (rectangles r=8, teinte du régime, code, régime, étoiles, litres) ; tuiles en 2 colonnes (condensat, mémoire, maîtrise, instruments, [orbe]) ; bouton pilule CHOISIR LA COURSIVE SUIVANTE ▸.
Anim : sceau `mb-tombe` (+0,1 s), pastilles et tuiles `mb-carte-monte` en cascade (0,25 s + 0,09 s/i ; 0,45 s + 0,08 s/i), bouton qui respire `mb-respire` (H:8942) + reflet ; sting-record 0,6 ; confettis menthe+or ×70 depuis le sceau.
Avance : bouton → sting-collecte 0,6 → étape 8.

### Étape 8 — « CHOISISSEZ LA COURSIVE » — `mbMontreCarte` M:15691 (`montreCarteRun` M:15676 au départ) (capture 10)
Scène élargie (`.mb-large`, 1500 px). Plan de station SVG (`dessinCarte.ts:802`, modules octogonaux, coursives, températures, télescope, objectif), légende, **fiche de trois lignes** (texte). Visée : route la plus courte tracée en blanc, ce qui se ferme s'éteint ; module verrouillé : secousse `mb-secousse` (H:9178).
Choix : le plan **zoome sur le module** (×2,4 + fondu, 0,42 s), flash, étincelles bleues ×50, sting-collecte 0,7 ; +420 ms → `entreModuleRun` M:15945 → étape 6 (ou halte de module : repos/don/économat).

### Étapes 9–12 — haltes et rencontres (captures 11–16)
- **Alcôve de repos** `mbMontreRepos` M:15995 : 3 cartes `.mb-carte.mb-repos` (emoji 💠 🫙 💧 + nom + détail, `descenteCarte.ts:371`) ; clic → sting-record 0,6, rien d'autre (ni feu, ni flash). Le titre dit « TRANSFO GLACE — ÉNIGME : … » (le type du module courant, pas « REPOS »).
- **Bonbonne oubliée** `mbMontreDon` M:16043 : une seule carte en colonne 2.
- **Rencontre** `mbMontreEvenement` M:17076 / `mbPeintEvenement` M:17086 : récit (liseré or, lieu + prose), 2–3 offres (texte voilé si jamais prise, « ⚄ n issues possibles » / « ▸ sans risque ») ; choix → `mbTranche` M:17129 : issue + puces de gains (emoji) + bouton REPRENDRE LA DESCENTE ▸ ; sting-record 0,6. Aucun feu.
- **Cache** `mbMontreCache` M:16918 : récit + puce 🔮 + bouton. sting-record au bouton.
- **Mini-jeu** `mbMontreResultatMiniJeu` M:16854 : une carte (🥌 🌬️ 🪐 🎯 🔪, verdict, mémoire). Palet : `mbMontreChoixPalet` M:14407 (deux cartes : relancer / valider).
- Après : `mbApresHalte` M:16892 → étape 6 ou 7.

### Étape 13 — fin ordinaire « PAROI DU SAS OUVERTE » — `mbMontreFin` M:17160 (capture 17)
Chemin hors voie (rare). Bandeau + jauge **mince** (`mbJaugeMince` M:15225) + rangée de jauges texte (emoji) + bouton SALLE SUIVANTE ▸ (flash, étincelles ×50, sting-collecte, +260 ms).

### Hors cérémonie — fin de run et défaite — `showOverlay` M:18911 (captures 18, 19)
`#overlay` (H:5769) : un **rectangle** à liseré gauche (titre en Michroma, `stamp` 0,35 s), un paragraphe centré de texte gris, un bouton rectangulaire plein. Aucun feu, aucune médaille, aucun récapitulatif visuel : la descente bouclée (le plus grand moment du jeu) est l'écran le plus sobre de tous.

## 3. Vocabulaire visuel

**Formes.** Presque tout est un **rectangle à coins arrondis** :
- r=14 plaque du relevé, tête de module ; r=12 cartes `.mb-carte`, portes ; r=10 tuiles de gains, jauge, bandeau compact, dos de carte, plan de station ; r=9 icône de tuile ; r=8 lignes du relevé, vitrine de porte, puces d'issue, pastilles de salle ; r=4–6 tampons, repère de porte.
- **Pilules** (999px) : bouton CONTINUER, ENTRER ▸, médaille repliée ; barres 6–8 px (r=3–4) ; tube de jauge r=17.
- **Cercles** : médaille du rang, compteurs de palier, goutte du versement, anneau de maîtrise.
- **Octogones** : seulement le sceau du module (clip-path) et les tuiles de la mini-carte / du plan (SVG).
- Rien de taillé, d'asymétrique ou de « découpé » : pas de chanfrein, pas de cadre en biseau ; seules entorses : tampons inclinés −2/−3°, bande de palier en skewY −3°, équerres d'angle des `.mb-carte` (H:8612).
- Mise en page : colonnes centrées dans une scène de 1180 px (1500 pour le plan), grille 3 colonnes, titres de section à filets latéraux (`.mb-choix-titre` H:8501, `.mb-recolte-titre` H:8195).

**Polices** (H:32-62) : **Michroma** 400 (titres, étiquettes en capitales espacées 0,2–0,5 em, chiffres) et **IBM Plex Mono** 400/600 (tout le texte courant). Beaucoup d'étiquettes à 7–9 px × `--ui`.

**Palette.** `:root` (H:75) : `--void #030710`, `--panel rgba(9,18,30,.82)`, `--ink #d9ecf7`, `--dim #7f9cb0`, `--specimen #63b7e6`, `--glow #a7ddf5`, `--valid #3fd69b`, `--alert #e0685c`. `#mb-veil` (H:7838) : `--mb-menthe #6dffb8`, `--mb-teal #8fd8c8`, `--mb-or #ffd977`, `--mb-bleu #63b7e6`, `--mb-encre #eaf6ff`, `--mb-rang` (teinte du rang). Rangs : S `#ffd977`, A `#6dffb8`, B `#63b7e6`, C `#a9c3de`, D `#e0685c`. Tuiles : mémoire `#b9a4ff`, orbe `#e58bff`, tirage or, livré bleu. Familles d'instruments : corps `#63b7e6`, états `#f2c98e`, collecte `#6dffb8`, protocole `#c99aff` (M:12800). Une vingtaine de gris-bleus codés en dur (`#cfe2ef`, `#9fb6c8`, `#8ba3b8`, `#7b93a8`, `#6d8aa5`, `#55708c`, `#2d4258`…), pas en variables.

**Icônes.** Majoritairement des **emoji** : lignes du relevé (💧 ⏱ ❖), jauges (🫙 ◈ 💠 ⇣), tuiles (🂠 🔮 💧 ⬡ 🧰), haltes (💠 🫙 💧), mini-jeux (🥌 🌬️ 🪐 🎯 🔪), issues (🫙 💧 🧠 💠 🜄 🗺️ ⚠️), **toutes les icônes d'instruments** (`instruments.ts`). `metaAssets.ts:156` dit lui-même que les emoji « changent de tracé d'une machine à l'autre ». Seules exceptions : condensat et mémoire dans les tuiles (`iconeMetaHTML`, planche `meta-icones.webp`), et les icônes SVG de la mini-carte.

**Éléments « boîte + texte » qui pourraient porter l'identité du jeu**
1. La plaque du relevé et ses 3 lignes (rectangles gris, barre + chiffre) : un tableau de bord.
2. Les tuiles de récolte : carte d'information avec paragraphe de 2–3 lignes (rôle de la monnaie) répété à **chaque** salle.
3. Les plaques du versement : formulaire « avant → après » + jauge ; la goutte est le seul objet.
4. Le flacon : un rectangle CSS alors que `fiole-pleine/vide.webp` existe.
5. La jauge de maîtrise : barre de progression ; et le tampon qui reste affiché pendant le tirage.
6. Les cartes de halte/rencontre/mini-jeu : boîte, emoji, deux lignes de texte ; aucun effet au choix.
7. Les titres de section à filets et les étiquettes en capitales espacées partout : registre « rapport ».
8. Le bouton CONTINUER (pilule menthe générique).
9. L'écran de fin de run `#overlay` : rectangle + paragraphe + bouton.

## 4. Images du jeu réutilisables (capture 20)

Aucune n'est utilisée par la cérémonie, **sauf `meta-icones.webp`** (condensat, mémoire des tuiles, via `iconeMetaHTML`, `metaAssets.ts:191`).

| Fichier (`public/assets/`) | Contenu | Usage possible ici |
|---|---|---|
| meta-icones.webp (1024×512, 4×2) | fiole, éclaboussure, clef, sphère de secours, sac, **cristal de mémoire**, **goutte de condensat**, **bulle de vie** | remplacer les emoji des jauges, haltes, issues (vie, réserve, bourse) ; cases `ICONE_CASE` `metaAssets.ts:170` |
| meta-eclat.webp (4080×170, bande de 24 vues) | éclat de mémoire qui tourne | tuile mémoire animée, gain de mémoire qui « vole » vers le compteur |
| fiole-pleine.webp / fiole-vide.webp (376×1907) | fiole verticale du Semblable | à la place du flacon CSS du bilan, ou de la bonbonne de la réserve |
| badge.webp (512×512) | badge du protocole (planète + anneau) | fond/emblème de la médaille de rang, sceau de fin de module |
| iris.webp (1024×1024) | sas à iris mécanique, lumière verte | transition « la porte s'ouvre » (étape 6), sas de fin de module |
| meta-marchand.webp | cuve du Sujet 12 | halte économat / don |
| meta-alcove.webp, meta-banc.webp | alcôve d'étal, pupitre | alcôve de repos, banc des mémoires (vitrine des offres) |
| decal-ecran-on-anime.webp, decal-vanne-anime.webp (planches animées) | écran de contrôle, vanne | cadre des lignes du relevé / du tirage |
| home.webp, card-galerie.webp, cine/*.webp (1600×900), avaries/*.webp (640×360) | illustrations peintes | fond de rencontre, fin de run, fin de module |
| terre.webp, ciel.webp, plafond-planete.webp, zone-hublot.webp, hull.webp | ciel, Terre, hublot, coque | fond du voile (au lieu de la grille) |

`cycle-icones`, `trophees-icones` : **absents** de ce dépôt (aucun fichier, aucune référence dans `src/` ni `index.html`). Les orbes n'ont pas d'image (nom seul, emoji 🔮).
