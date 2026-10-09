# `tools/tiktok/` — filmer le jeu et monter des clips verticaux

Ces scripts ne font pas partie du jeu : ils ne sont ni dans `tsconfig.json`
ni dans Vitest, et rien ici n'est déployé. Les vidéos produites vivent dans
`masters/tiktok/`.

## Pourquoi un temps virtuel

L'environnement d'analyse n'a pas de GPU : le WebGL tourne en logiciel, une
image coûte de 0,5 à 2,5 s en 1080×1920. Filmer en temps réel donnerait un
diaporama. `harness.mjs` remplace donc `requestAnimationFrame`,
`performance.now` et `Date.now` par une horloge qu'on avance à la main :
chaque image est calculée puis lue sur la toile, et le film sort à 30 images
par seconde parfaites, quel que soit le coût réel.

Deux pièges vécus, à ne pas refaire :

- **SwiftShader** (le WebGL logiciel par défaut de Chromium) bloquait
  1 à 3 minutes toutes les 8 images : les commandes s'empilaient puis le
  tampon plein figeait le rendu (~17 s par image en réalité). Avec
  **Xvfb + Mesa llvmpipe** (`--use-angle=gl`), une salle se rend en 0,26 s
  à 540×960 et 0,5 à 0,6 s à 1080×1920 (mesuré sur les cibles et la ronde) ;
  les gros plans d'eau montent à ~2 s.
- La **capture d'écran** de Chromium attend une image du compositeur, que
  le temps virtuel ne lui donne jamais (25 s par capture). On lit plutôt
  `glcanvas` + `fx-canvas` dans la même tâche que le rendu (`__grab`).
- Dans une image, le temps avance au dixième du réel : sans ça, une boucle
  « tant que le budget n'est pas épuisé » (la prévision exacte) tournait
  jusqu'à son plafond.

## Le correctif de tournage

`video.patch` ajoute deux choses à `src/main.ts`, **dans une copie à part,
jamais dans le dépôt** :

- `?libre` lève le verrou du CYCLE (glace et vapeur sans les avoir tissées) ;
- `window.__input` expose l'entrée, pour régler le time warp.

## La chaîne

```bash
# 1. une copie du jeu avec le correctif, servie en local
git archive HEAD | tar -x -C /tmp/jeu-video && cd /tmp/jeu-video
ln -s "$OLDPWD/node_modules" node_modules && git apply "$OLDPWD/tools/tiktok/video.patch"
npx vite build --outDir /tmp/dist-video
(cd /tmp/dist-video && python3 -m http.server 4173 --bind 127.0.0.1 &)

# 2. l'écran virtuel, puis un rush par scénario (images dans frames/<nom>/)
Xvfb :99 -screen 0 1920x2160x24 +extension GLX &
cd tools/tiktok && node rec.mjs scenarios/r1_traversee.json

# 3. la musique (générée, aucun échantillon externe) et la police du titre
(cd audio && python3 compose.py phonk lofi hypno)
python3 -c "from fontTools.ttLib import TTFont; f=TTFont('../../node_modules/@fontsource/michroma/files/michroma-latin-400-normal.woff'); f.flavor=None; f.save('fonts/michroma.ttf')"

# 4. le montage
python3 v2.py out/V2-etats-de-l-eau.mp4 audio/phonk.wav
```

Dépendances Python : `numpy`, `pillow`, `scipy`, `fonttools`. `harness.mjs`
importe Playwright depuis `/opt/node-tools` (l'installation de
l'environnement d'analyse) : adapter le chemin ailleurs.

## Les scénarios

Un scénario est une liste de gestes datés (`scenarios/*.json`) :

| geste | effet |
| --- | --- |
| `pilote` | suit des points de passage : éjecte quand la vitesse s'écarte de la consigne, lâche sinon |
| `tenir` | éjecte dans une direction pendant une durée |
| `touche` | une touche du jeu (`f` glace, `g` vapeur) |
| `dash` | vise puis relâche (le dash de vapeur) |
| `tirauto` | en glace, tire un éclat quand le corps survole une mire |
| `warp`, `zoom`, `params` | time warp, zoom de caméra, réglages du banc |

`rec.mjs` écrit aussi `journal.json` : l'état du corps toutes les 5 images
et l'instant de chaque geste — le montage s'en sert pour le compteur de
volume et pour caler les bruitages du jeu.

## Le montage

`edit.py` lit les images d'un rush à travers une carte temps-sortie →
temps-source (accélérés, ralentis fondus entre deux images), ajoute les
coups de zoom sur les temps, les flashs aux coupes, les secousses, les
légendes (`*mot*` en couleur, `|` saut de ligne) et mixe la musique avec
les bruitages de `public/sound/`. Chaque montage sort en deux versions :
avec musique, et `-sans-musique` pour poser un son tendance dans TikTok.
