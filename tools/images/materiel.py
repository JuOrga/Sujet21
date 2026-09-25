#!/usr/bin/env python3
"""LE MATÉRIEL DE COQUE EN IMAGES — de la planche du générateur à l'atlas.

Le générateur livre une planche de 4 × 2 pièces (vue de profil, pied en
bas) sur un fond MAGENTA uni — il ne sait pas rendre la transparence de
façon fiable, un fond qu'aucune pièce n'emploie se détoure, lui. Mais il
ne pose jamais les pièces au cordeau : l'une flotte au milieu de sa case,
l'autre en déborde. Ce script :

1. détoure le magenta (alpha progressif + dé-contamination des franges,
   sinon chaque pièce garde un liseré rose sur le ciel noir) ;
2. trouve chaque pièce dans sa case (la boîte de ses pixels opaques) ;
3. les repose dans un atlas 2048 × 1024 à cases de 512, PIED SUR LE BORD
   BAS et centrées — c'est ce que le shader suppose (drawHull, renderer.ts) ;
4. à UNE échelle commune : un feu de navigation reste petit à côté d'un
   mât d'antenne, comme dans la planche.

L'ordre des cases est celui des types du shader :
  0 antenne · 1 parabole · 2 aile solaire · 3 radiateur
  4 feux de navigation · 5 propulseurs · 6 poutre en treillis · 7 main courante

    python3 tools/images/materiel.py masters/images/coque-materiel.png
"""

import sys
from pathlib import Path

from PIL import Image

COLS, ROWS = 4, 2
CASE = 512
MARGE = 8  # un peu d'air autour de chaque pièce : le mip ne mord pas la voisine
SORTIE = Path(__file__).resolve().parents[2] / 'public/assets/coque-materiel.webp'


def detoure(im: Image.Image) -> Image.Image:
    """Le magenta devient transparent. La distance au magenta dit l'alpha ;
    la part de magenta mêlée aux franges est RETIRÉE de la couleur, pas
    seulement voilée — c'est elle qui faisait le liseré rose."""
    im = im.convert('RGB')
    px = im.load()
    w, h = im.size
    out = Image.new('RGBA', (w, h))
    po = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            # « magenta-ité » : fort en rouge ET en bleu, faible en vert
            m = min(r, b) - g
            a = 1.0 - max(0.0, min(1.0, (m - 60) / 110.0))
            if a <= 0.0:
                po[x, y] = (0, 0, 0, 0)
                continue
            # dé-contamination : on enlève la part (1 − a) de magenta pur
            k = 1.0 - a
            rr = max(0.0, (r - 255 * k) / a)
            bb = max(0.0, (b - 255 * k) / a)
            po[x, y] = (int(min(255, rr)), g, int(min(255, bb)), int(a * 255))
    return out


def boite(case: Image.Image):
    """La boîte des pixels franchement opaques (le bruit JPEG ne compte pas)."""
    alpha = case.getchannel('A').point(lambda v: 255 if v > 96 else 0)
    return alpha.getbbox()


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    planche = detoure(Image.open(sys.argv[1]))
    w, h = planche.size
    cw, ch = w / COLS, h / ROWS
    pieces = []
    for i in range(COLS * ROWS):
        c, r = i % COLS, i // COLS
        case = planche.crop((round(c * cw), round(r * ch), round((c + 1) * cw), round((r + 1) * ch)))
        bb = boite(case)
        if not bb:
            sys.exit(f'case {i} vide : la planche n’a pas ses {COLS * ROWS} pièces')
        pieces.append(case.crop(bb))
    utile = CASE - 2 * MARGE
    echelle = min(min(utile / p.width, utile / p.height) for p in pieces)
    atlas = Image.new('RGBA', (COLS * CASE, ROWS * CASE), (0, 0, 0, 0))
    for i, p in enumerate(pieces):
        q = p.resize((max(1, round(p.width * echelle)), max(1, round(p.height * echelle))), Image.LANCZOS)
        c, r = i % COLS, i // COLS
        x = c * CASE + (CASE - q.width) // 2
        y = (r + 1) * CASE - MARGE - q.height  # le pied sur le bord bas
        atlas.alpha_composite(q, (x, y))
        print(f'  pièce {i} : {p.width}×{p.height} → {q.width}×{q.height}')
    SORTIE.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(SORTIE, 'WEBP', quality=88, method=6)
    print(f'{SORTIE.relative_to(SORTIE.parents[2])} : {SORTIE.stat().st_size // 1024} Ko, échelle {echelle:.3f}')


if __name__ == '__main__':
    main()
