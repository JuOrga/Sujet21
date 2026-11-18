#!/usr/bin/env python3
"""
LES DEUX PLANCHES D'ICÔNES PEINTES (18/11), assemblées depuis les cases que
rend tools/images/blender/icones.py.

  cycle-icones.webp     1024 × 768, 4 × 3 cases de 256 (docs/assets-ia.md §23a)
  trophees-icones.webp  1024 × 512, 4 × 2 cases de 256 (§23b)

L'ORDRE DES CASES EST UN CONTRAT avec src/game/iconesPeintes.ts (vérifié par
iconesPeintes.spec.ts) : on ne le change pas ici sans le changer là.

LE CONTOUR. Ces icônes se lisent à 24 px dans l'ATH, et l'état courant y est
posé sur un fond DE SA PROPRE TEINTE : une goutte sarcelle s'y noierait. Chaque
case reçoit donc un cerne sombre, assez épais pour survivre à la réduction
(CERNE px sur 256 : ~1,5 px à l'écran) — posé ici, sur l'alpha, plutôt que
dans Blender : un contour de géométrie s'éclaire, et s'éclaire mal.

Sources : masters/images/sources/icones/<nom>.png (copiés de SORTIE/alpha/).
Sortie : masters/images/cycle-icones.png et trophees-icones.png, que
tools/images/prepare.py livre ensuite dans public/assets/.

Usage : python3 tools/images/icones_planches.py
"""

from __future__ import annotations

import os

from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'masters', 'images', 'sources', 'icones')
DST = os.path.join(ROOT, 'masters', 'images')
CASE = 256
CERNE = 15  # rayon du cerne, en px de la case
TEINTE_CERNE = (8, 12, 18)

CYCLE = ['solide', 'liquide', 'gaz', 'plasma',
         'fusion', 'liquefaction', 'solidification', 'vaporisation',
         'sublimation', 'condensation', 'ionisation', 'deionisation']
TROPHEES = ['sans-une-goutte', 'palet-parfait', 'trois-etats', 'ligne-de-crete',
            'miroir-vivant', 'recondense', 'integrale', 'operateur-de-nuit']


def cerne(icone: Image.Image) -> Image.Image:
    """l'icône posée sur son cerne : l'alpha dilaté, adouci, teint sombre"""
    a = icone.getchannel('A')
    gros = a.filter(ImageFilter.MaxFilter(2 * CERNE + 1)).filter(ImageFilter.GaussianBlur(1.5))
    fond = Image.new('RGBA', icone.size, TEINTE_CERNE + (0,))
    fond.putalpha(gros.point(lambda v: int(v * 0.9)))
    fond.alpha_composite(icone)
    return fond


def planche(noms: list[str], colonnes: int, rangees: int) -> Image.Image:
    out = Image.new('RGBA', (colonnes * CASE, rangees * CASE), (0, 0, 0, 0))
    for k, nom in enumerate(noms):
        im = Image.open(os.path.join(SRC, f'{nom}.png')).convert('RGBA')
        assert im.size == (CASE, CASE), (nom, im.size)
        out.alpha_composite(cerne(im), ((k % colonnes) * CASE, (k // colonnes) * CASE))
    return out


def main() -> None:
    planche(CYCLE, 4, 3).save(os.path.join(DST, 'cycle-icones.png'))
    planche(TROPHEES, 4, 2).save(os.path.join(DST, 'trophees-icones.png'))
    print('écrit masters/images/cycle-icones.png et trophees-icones.png')


if __name__ == '__main__':
    main()
