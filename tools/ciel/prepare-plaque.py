#!/usr/bin/env python3
"""
PRÉPARER UNE PLAQUE DE CIEL à partir d'une image (photographie ou image
générée) : carré centré, retouches ponctuelles, désaturation, WebP.

    python3 tools/ciel/prepare-plaque.py assets-src/voie-lactee.png \\
        --retouche 620,495,3 --saturation 0.55

JAMAIS AGRANDIE. La taille de la plaque est celle de la SOURCE (plafonnée à
4096 : au-delà, la tablette ne charge plus). Ce n'est pas qu'une économie :
le jeu lit la largeur de la texture pour décider jusqu'où il peut l'agrandir
à l'écran sans flou (render/parallaxe.ts, cadrePlaque). Une image de 1254 px
portée à 2048 lui ferait croire à un détail qui n'existe pas — la galaxie
serait affichée 1,6 fois trop grande, donc floue. WebGL 2 accepte les
tailles qui ne sont pas des puissances de deux.

LE FONDU. Le jeu pose l'image telle quelle derrière la toile : ses bords
doivent se fondre dans le noir, sans quoi elle se lit comme une affiche
découpée dans le ciel. `--fondu 0.18` éteint 18 % de chaque côté, en
courbe douce.

LA SATURATION. Les générateurs saturent : « trop de couleurs ». Le
réglage mélange chaque pixel à sa luminance (1 : intact, 0 : gris).

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
    p.add_argument("--taille", type=int, default=0, help="0 : celle de la source")
    p.add_argument("--saturation", type=float, default=1.0)
    p.add_argument("--fondu", type=float, default=0.18)
    p.add_argument("--qualite", type=int, default=90)
    p.add_argument("--sortie", default="public/assets/ciel.webp")
    a = p.parse_args()

    Image.MAX_IMAGE_PIXELS = None  # les plaques de télescope dépassent la garde
    im = Image.open(a.source).convert("RGB")
    px = np.asarray(im, dtype=np.float32).copy()
    for r in a.retouche:
        x, y, rayon = (int(v) for v in r.split(","))
        retouche(px, x, y, rayon)
    lum = px @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    px = lum[..., None] + (px - lum[..., None]) * a.saturation
    im = Image.fromarray(np.clip(px + 0.5, 0, 255).astype(np.uint8))
    c = min(im.size)  # le cadrage compte en fraction d'image : il faut un carré
    im = im.crop(
        ((im.width - c) // 2, (im.height - c) // 2, (im.width + c) // 2, (im.height + c) // 2)
    )
    taille = a.taille or min(4096, c)
    if taille != c:
        im = im.resize((taille, taille), Image.LANCZOS)
    if a.fondu > 0:
        u = (np.arange(taille, dtype=np.float32) + 0.5) / taille
        t = np.clip(np.minimum(u, 1.0 - u) / a.fondu, 0.0, 1.0)
        f = t * t * (3.0 - 2.0 * t)
        masque = f[:, None] * f[None, :]
        px = np.asarray(im, dtype=np.float32) * masque[..., None]
        im = Image.fromarray(np.clip(px + 0.5, 0, 255).astype(np.uint8))
    im.save(a.sortie, "WEBP", quality=a.qualite, method=6)
    print(f"{a.sortie} — {taille}×{taille}, {os.path.getsize(a.sortie) / 1e6:.2f} Mo")


if __name__ == "__main__":
    main()
