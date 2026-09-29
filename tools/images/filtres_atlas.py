#!/usr/bin/env python3
"""
L'ATLAS DES FILTRES — l'évent, le rideau lamellaire (et, demain, la membrane).

POURQUOI UN ATLAS. Le shader de composition n'a plus d'unité de texture
libre (voir chaudiere_atlas.py). Le rideau voulait la sienne ; l'unité de la
grille de l'évent (grille.webp, unité 11) devient celle de la FAMILLE DES
FILTRES — les surfaces qui ne laissent passer qu'un état : l'évent (la
vapeur), le rideau (la glace), la membrane (l'eau). Les deux autres seront
refondues à leur tour et viendront y loger.

  moitié haute : la grille de l'évent, telle qu'elle était (grille.webp),
                 avec une MARGE répétée : le shader la répète à la main
                 (fract) et lit ses niveaux de détail sans couture
  moitié basse : le rideau lamellaire — docs/assets-ia.md §32
    masters/images/sources/rideau-troncon.png   8 lanières de PVC givré
                                                sous leur rail boulonné
    masters/images/sources/rideau-montant.png   le poteau qui ferme un bout
    masters/images/sources/grille.webp          l'ancienne grille livrée

Sortie : masters/images/filtres-atlas.png (1024 × 2048, RGBA), que
tools/images/prepare.py livre ensuite en public/assets/filtres-atlas.webp.

LES CADRES CI-DESSOUS SONT UN CONTRAT avec le shader (FILTRES_ATLAS et
RIDEAU dans game/formes.ts). Une nouvelle image impose de remesurer — et de
mettre les deux à jour.

Usage : python3 tools/images/filtres_atlas.py
"""

from __future__ import annotations

import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from conduite_atlas import SRC, colle, lis, saigne  # noqa: E402 — les mêmes outils que la conduite

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DST = os.path.join(ROOT, 'masters', 'images', 'filtres-atlas.png')

TAILLE = 1024  # la largeur
HAUTEUR = 2048
# (x, y, largeur, hauteur) dans l'atlas, en pixels depuis le HAUT-gauche.
# La grille : une tuile de 960 px au milieu d'un cadre de 1024, 32 px de
# marge répétée tout autour (MARGE_GRILLE).
CADRE_GRILLE = (0, 0, 1024, 1024)
MARGE_GRILLE = 32
# le tronçon : 8 lanières de 110 px, rail et seuil compris
CADRE_R_CORPS = (0, 1034, 880, 440)
# le montant : sa hauteur est TOUTE l'épaisseur du bloc
CADRE_R_MONTANT = (0, 1484, 108, 478)

# LES BORDS DES LANIÈRES dans rideau-troncon.png (1774 × 887), mesurés sur
# le profil de luminance à mi-hauteur : chaque lanière porte un reflet sur
# son bord gauche, qui culmine 5 px après le bord (219, 439, 658, 879, 1099,
# 1321, 1542, 1761). Le générateur les a espacées de 212 à 222 px : on les
# recoupe à ces bords et on les remet TOUTES à 110 px, pour que le shader
# puisse les découper au pas exact et les écarter une par une.
BORDS = (7, 214, 434, 653, 874, 1094, 1316, 1537, 1756)
# en hauteur : le rail (ligne 1) et le bas du seuil (876) — le reste est
# transparent
HAUT_TRONCON, BAS_TRONCON = 1, 876


def troncon() -> Image.Image:
    src = lis('rideau-troncon.png').crop((0, HAUT_TRONCON, 1774, BAS_TRONCON))
    _, _, w, h = CADRE_R_CORPS
    largeur = w // (len(BORDS) - 1)
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    for i in range(len(BORDS) - 1):
        cellule = src.crop((BORDS[i], 0, BORDS[i + 1], src.height))
        out.alpha_composite(cellule.resize((largeur, h), Image.LANCZOS), (i * largeur, 0))
    return out


def montant() -> Image.Image:
    """Le poteau, sa ferrure et le bout de rail qui y arrive (x 380..712),
    du haut de son chapeau (19) au bas de sa semelle (1487). La lanière de
    gauche et son halo restent dehors : le tronçon a les siennes. Rail et
    seuil y tombent aux lignes 116 et 1466 — la même portée que ceux du
    tronçon, une fois les deux à l'échelle (RIDEAU.haut / .bas)."""
    return lis('rideau-montant.png').crop((380, 19, 712, 1487))


def grille() -> Image.Image:
    """La grille livrée (1254², raccordable), réduite à 960 et bordée de sa
    propre répétition : une lecture qui déborde de la tuile (filtrage, niveau
    de détail) retombe sur le bon motif, pas sur le cadre voisin."""
    tuile = Image.open(os.path.join(SRC, 'grille.webp')).convert('RGBA')
    t = CADRE_GRILLE[2] - 2 * MARGE_GRILLE
    a = np.asarray(tuile.resize((t, t), Image.LANCZOS))
    m = MARGE_GRILLE
    return Image.fromarray(np.pad(a, ((m, m), (m, m), (0, 0)), mode='wrap'), 'RGBA')


def main() -> None:
    atlas = Image.new('RGBA', (TAILLE, HAUTEUR), (0, 0, 0, 0))
    atlas.alpha_composite(grille(), CADRE_GRILLE[:2])
    atlas.alpha_composite(troncon(), CADRE_R_CORPS[:2])
    colle(atlas, montant(), CADRE_R_MONTANT)
    saigne(atlas).save(DST)
    print('écrit', os.path.relpath(DST, ROOT))


if __name__ == '__main__':
    main()
