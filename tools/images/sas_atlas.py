#!/usr/bin/env python3
"""
LE SAS DE RACCORD, de son rendu à ses deux fichiers (18/11).

Le rendu Blender (tools/images/blender/sas_raccord.py) sort la pièce entière,
1024 × 1280, détourée. Deux gestes restent, hors de Blender :

  · LE FONDU DES MOIGNONS. Sur ses deux bords verticaux, la pièce recouvre la
    couture entre deux coques ; elle doit s'y ÉTEINDRE en transparence
    (docs/assets-ia.md §16) — une pièce qui s'arrête net sur la coque
    soulignerait le joint au lieu de le cacher. Un fondu de matière, dans
    Blender, s'éteindrait sous la lumière de façon inégale : on le pose ici,
    sur l'alpha, en rampe douce sur les FONDU px du bord.
  · LE QUART DE TOUR. `sas-raccord-v` (1280 × 1024) est la même pièce tournée :
    le moteur pose l'une ou l'autre selon le sens du couloir
    (metaAssets.ts, decalsDuMeta).

Source : masters/images/sources/sas-raccord.png (copié de SORTIE/alpha/).
Sortie : masters/images/sas-raccord.png et sas-raccord-v.png, que
tools/images/prepare.py livre ensuite dans public/assets/.

Usage : python3 tools/images/sas_atlas.py
"""

from __future__ import annotations

import os

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'masters', 'images', 'sources', 'sas-raccord.png')
DST = os.path.join(ROOT, 'masters', 'images')
TAILLE = (1024, 1280)
# le moignon fait ~250 px de chaque bord : il s'éteint sur ses 130 derniers
FONDU = 130


def fondu(im: Image.Image) -> Image.Image:
    a = np.asarray(im, dtype=np.float32).copy()
    w = a.shape[1]
    x = np.arange(w, dtype=np.float32)
    d = np.minimum(x, w - 1 - x)  # distance au bord vertical le plus proche
    t = np.clip(d / FONDU, 0.0, 1.0)
    rampe = t * t * (3 - 2 * t)  # smoothstep : pas d'arête au début du fondu
    a[..., 3] *= rampe[None, :]
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA')


def main() -> None:
    im = Image.open(SRC).convert('RGBA')
    assert im.size == TAILLE, im.size
    sas = fondu(im)
    sas.save(os.path.join(DST, 'sas-raccord.png'))
    # le quart de tour : le couloir vertical — la pièce tournée de 90°
    sas.transpose(Image.Transpose.ROTATE_90).save(os.path.join(DST, 'sas-raccord-v.png'))
    print('écrit masters/images/sas-raccord.png et sas-raccord-v.png')


if __name__ == '__main__':
    main()
