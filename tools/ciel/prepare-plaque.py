#!/usr/bin/env python3
"""
PRÉPARER UNE PLAQUE DE CIEL à partir d'une image (photographie ou image
générée) : carré centré, retouches ponctuelles, mise à la taille, WebP.

    python3 tools/ciel/prepare-plaque.py assets-src/voie-lactee.png \\
        --retouche 620,495,3 --taille 2048

POURQUOI PAS TOUJOURS 4096. Agrandir n'ajoute aucun détail : une image de
1254 px portée à 4096 coûte quatre fois plus de mémoire graphique (≈ 90 Mo
contre ≈ 22 Mo en 2048) pour exactement la même netteté. La taille se choisit
d'après la SOURCE — la plus petite puissance de deux qui ne la réduit pas,
plafonnée à 4096 (au-delà, la tablette ne charge plus). Les étoiles nettes ne
viennent pas de la plaque : le shader les dessine au pixel près par-dessus.

LES RETOUCHES. Un générateur laisse parfois un défaut ponctuel — ici un
point noir en plein cœur galactique, que l'œil trouve en premier. Chaque
retouche (x, y, rayon, en pixels de la SOURCE) remplace le disque par la
médiane de l'anneau qui l'entoure.

L'ORIGINAL N'ENTRE PAS DANS LE DÉPÔT (assets-src/ est ignoré par git) : seul
le WebP de public/assets/ est versionné.
"""

from __future__ import annotations

import argparse
import os

import numpy as np
from PIL import Image


def retouche(a: np.ndarray, x: int, y: int, r: int) -> None:
    h, w = a.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    d2 = (xx - x) ** 2 + (yy - y) ** 2
    disque = d2 <= r * r
    anneau = (d2 > r * r) & (d2 <= (2 * r + 2) ** 2)
    a[disque] = np.median(a[anneau], axis=0)


def main() -> None:
    p = argparse.ArgumentParser(description="Prépare une plaque de ciel")
    p.add_argument("source")
    p.add_argument("--retouche", action="append", default=[], help="x,y,rayon")
    p.add_argument("--taille", type=int, default=0, help="0 : d'après la source")
    p.add_argument("--qualite", type=int, default=90)
    p.add_argument("--sortie", default="public/assets/ciel.webp")
    a = p.parse_args()

    Image.MAX_IMAGE_PIXELS = None  # les plaques de télescope dépassent la garde
    im = Image.open(a.source).convert("RGB")
    px = np.asarray(im, dtype=np.float32).copy()
    for r in a.retouche:
        x, y, rayon = (int(v) for v in r.split(","))
        retouche(px, x, y, rayon)
    im = Image.fromarray(np.clip(px + 0.5, 0, 255).astype(np.uint8))
    c = min(im.size)  # le cadrage compte en fraction d'image : il faut un carré
    im = im.crop(
        ((im.width - c) // 2, (im.height - c) // 2, (im.width + c) // 2, (im.height + c) // 2)
    )
    taille = a.taille or min(4096, 1 << (c - 1).bit_length())
    im = im.resize((taille, taille), Image.LANCZOS)
    im.save(a.sortie, "WEBP", quality=a.qualite, method=6)
    print(f"{a.sortie} — {taille}×{taille}, {os.path.getsize(a.sortie) / 1e6:.2f} Mo")


if __name__ == "__main__":
    main()
