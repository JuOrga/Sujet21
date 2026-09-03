# Sujet 21 — Prompts d'assets pour la carte (structure v2 : 11 modules)

Convention : une image par module, déposée dans `public/assets/map/<ID>.png` (ratio 4:3, 1024×768). Dans `Carte Station.dc.html`, le champ `img` de chaque nœud indique le fichier chargé (actuellement des anciennes vignettes réutilisées : remplacer par le nouvel ID une fois généré).

## Bible de style (à coller à la fin de chaque prompt)

> isometric miniature of a space station module, seen from above at 30°, cutaway roof, hard-surface sci-fi, dark navy background #030710, cyan emissive lighting #63b7e6, thin holographic wireframe edges, clean vector-painterly finish, no text, no people, centered, 4:3

Palette : fond `#030710`, cyan `#63b7e6`, givre `#a7ddf5`, vert `#3fd69b`, ambre vapeur `#f2c98e`, violet observatoire `#c99aff`, rouge `#e0685c`.

Négatif : `text, watermark, people, blurry, photo-realistic, bright white background, cartoon faces`

## Fond de station (`public/assets/map/_fond.png`, 20:9, 3200×1440) — PRIORITÉ

Vue de dessus du vaisseau entier, silhouette qui doit coller au plan (coordonnées dans une scène 1600×720) :
- gauche (x 0–320) : grand arc de coque en croissant, du haut en bas, avec le HUB posé sur l'arc au centre (x≈245, y≈360), module allongé verticalement, ~180×290 ;
- trois coursives partent du HUB vers la droite vers trois modules alignés verticalement (x≈490 ; y≈165, 360, 555) ;
- les trois convergent sur un petit nœud rond (x≈700, y≈360) ;
- du nœud, trois petites coursives vers trois petits modules (x≈860 ; y≈230, 360, 490) ; le haut et le bas se prolongent chacun vers un module isolé (x≈1000, y≈140 et y≈585) ;
- le module central mène à l'OBSERVATOIRE, gros module octogonal (x≈1135, y≈360, ~175×175) ;
- droite (x 1215–1600) : un mât incliné (~−24°) portant quatre panneaux solaires quadrillés et une antenne parabolique, relié à l'observatoire par un tube coudé.

Prompt :
> top-down orthographic technical view of a modular space station, dark navy background #030710, hull panels in dark graphite with thin cyan #63b7e6 edge lights, LEFT: a large crescent-shaped hull arc spanning the full height with an elongated vertical central hub module docked on it, three straight corridors leaving the hub to the right toward three stacked octagonal modules, the three corridors converging into a small round junction node, from the node three short corridors to three small octagonal modules, the top and bottom ones each extending to one more isolated small module, the middle one leading to a LARGE octagonal observatory module with a glass dome, RIGHT: a long tilted truss boom carrying four gridded solar panels and a parabolic dish, connected to the observatory by a bent tube, all modules drawn as EMPTY dark plates (no interior detail, no windows glowing), clean hard-surface sci-fi, faint hexagonal grid in the void, subtle nebula, no text, no stars near the modules, 20:9

Négatif fond : `text, labels, arrows, planets, people, bright center, blurry, perspective tilt`

## Modules (11)

**Z-01 Hub** (dominante cyan)
- `HUB` — tall central hub chamber, circular command floor, docking ring around it, six sealed doors, crew benches, cyan status lights, calm and intact — *format 2:3 vertical, 768×1152*

**Z-02 Transformateurs** (dominante vert)
- `T1` — transformation chamber sealed behind a curtain of ice, frost everywhere, cryo-vapour pouring from vents, blue-white light — glace nécessaire
- `T2` — open transit module, clean corridor with grating floor, green guidance lights, no obstacles, slight vine growth — aucune transfo
- `T3` — transformation chamber behind a glowing amber steam grate, pressure valves, heat haze, orange pipes — gaz nécessaire

**Z-03 Nœud** (dominante givre)
- `N` — small round junction chamber, holographic sign with a question mark, three exits, flickering light
- `S1` — small cold module (à définir), frost, blue light
- `S2` — small central module (à définir), neutral temperature, cyan light
- `S3` — small hot module (à définir), amber light, steam
- `S1b` — isolated dead-end pod, frozen, a purple glowing crate inside (cache)
- `S3b` — isolated dead-end pod, overheated, a purple glowing crate inside (cache)

**Z-04 Observatoire** (dominante violet)
- `OBS` — observatory with a huge glass dome overlooking a ringed planet, telescope, purple-blue light, solar panel truss visible through the glass, the final module — *plus grand, plus détaillé*

## UI (optionnel)

- Verrou glace : `icon of a frozen curtain of ice, flat, single colour #a7ddf5 on transparent, 128px`
- Verrou vapeur : `icon of a steam grate with rising vapour, flat, single colour #f2c98e on transparent, 128px`
- Nœud : `small circular junction node, holographic ring, cyan, transparent background, 64px`
- Marqueur joueur : `holographic diamond beacon pulsing, cyan and white, transparent background, 128px`

## Ajouter / renommer un module

Dans `Carte Station.dc.html`, bloc `noeuds` : `ID: { x, y, z: <0-3>, t: <sas|jonction|combat|enigme|coffre|boss>, nom, temp, img: '<fichier sans .png>', desc }`, puis une ligne dans `aretes` : `{ a: 'ID_départ', b: 'ID', t: <main|alt|glace|vapeur> }`.
