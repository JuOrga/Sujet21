#!/usr/bin/env python3
"""L'ÉCRAN ALLUMÉ S'ANIME — les vues de decal-ecran-on-anime.webp, tirées
de l'image fixe LIVRÉE (13/11).

Pourquoi pas Blender, comme la vanne : l'écran est une image générée, riche
(conduites, cadran, interrupteurs) ; le refaire en 3D pour le seul
scintillement changerait toute la pièce. Ici l'image fixe reste celle qu'on
connaît, et seul ce qui est allumé bouge :
  · un balayage descend la vitre, une fois par boucle (il part au-dessus de
    la vitre : la vue 0 est l'image fixe) ;
  · la vitre scintille d'un rien (± 5 %), comme un tube qui chauffe ;
  · les trois voyants clignotent chacun à son rythme ;
  · les barres latérales et l'arc du cadran respirent.

Les repères (pixels de l'image fixe 753 × 938) ont été relevés sur elle :
la vitre en teinte sarcelle, les voyants et les barres en sarcelle vive.

    python3 tools/images/ecran_anime.py            # écrit masters/images/ecran-on/vues/
    python3 tools/images/planche.py decal-ecran-on masters/images/ecran-on/vues
    python3 tools/images/prepare.py decal-ecran-on-anime
"""

import math
import os
import sys

import numpy as np
from PIL import Image

RACINE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FIXE = os.path.join(RACINE, 'public/assets/decal-ecran-on.webp')
SORTIE = os.path.join(RACINE, 'masters/images/ecran-on/vues')
VUES = 8

VITRE = (110, 300, 648, 668)          # x0, y0, x1, y1
VOYANTS = [(396, 736), (429, 735), (461, 736)]
# allumé (1) ou éteint (0), vue par vue : trois rythmes qui ne s'accordent pas
RYTHMES = [(1, 1, 1, 1, 0, 0, 0, 0), (1, 0, 1, 0, 1, 0, 1, 0), (1, 1, 0, 1, 1, 0, 1, 1)]
BARRES = [(86, 441, 96, 508), (660, 441, 669, 507)]
CADRAN = (167, 742, 58)               # centre, rayon de l'arc lumineux
# le scintillement de la vitre, vue par vue (la 0 à zéro : elle reste la fixe)
TREMBLE = (0.0, 0.03, -0.02, 0.04, -0.03, 0.01, 0.05, -0.01)


def vues(fixe: np.ndarray) -> list[np.ndarray]:
    h, w = fixe.shape[:2]
    rgb, al = fixe[..., :3], fixe[..., 3:]
    yy, xx = np.mgrid[0:h, 0:w]
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    # ce qui est sarcelle dans la vitre : le balayage n'éclaire pas le cadre
    x0, y0, x1, y1 = VITRE
    vitre = ((xx >= x0) & (xx < x1) & (yy >= y0) & (yy < y1) & (g > r + 0.04) & (b > r + 0.04)).astype(float)
    sarcelle = ((g > r + 0.1) & (b > r + 0.1)).astype(float)
    out = []
    for k in range(VUES):
        t = k / VUES
        im = rgb.copy()
        # le scintillement de toute la vitre
        im *= 1 + TREMBLE[k] * vitre[..., None]
        # le balayage : une bande douce qui descend, de dessus à dessous la vitre
        yc = y0 - 40 + t * (y1 - y0 + 80)
        bande = np.exp(-(((yy - yc) / 16.0) ** 2)) * vitre
        im += bande[..., None] * np.array([0.05, 0.30, 0.30]) * 0.6
        # les voyants
        for (vx, vy), rythme in zip(VOYANTS, RYTHMES):
            d = np.hypot(xx - vx, yy - vy)
            disque = np.clip((12 - d) / 4, 0, 1) * sarcelle
            im *= 1 - disque[..., None] * (0.0 if rythme[k] else 0.7)
        # les barres et l'arc du cadran respirent (± 15 %), au rythme de la boucle
        souffle = 0.15 * math.sin(2 * math.pi * t)
        for bx0, by0, bx1, by1 in BARRES:
            zone = ((xx >= bx0 - 4) & (xx <= bx1 + 4) & (yy >= by0 - 4) & (yy <= by1 + 4)).astype(float) * sarcelle
            im *= 1 + souffle * zone[..., None]
        cx, cy, cr = CADRAN
        arc = (np.hypot(xx - cx, yy - cy) < cr).astype(float) * sarcelle
        im *= 1 + souffle * arc[..., None]
        out.append(np.concatenate([np.clip(im, 0, 1), al], axis=2))
    return out


def main() -> int:
    fixe = np.asarray(Image.open(FIXE).convert('RGBA')).astype(float) / 255
    os.makedirs(SORTIE, exist_ok=True)
    for k, v in enumerate(vues(fixe)):
        Image.fromarray((v * 255 + 0.5).astype(np.uint8), 'RGBA').save(os.path.join(SORTIE, f'vue-{k:02d}.png'))
    print(f'{VUES} vues dans {SORTIE}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
