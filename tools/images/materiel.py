#!/usr/bin/env python3
"""LE MATÉRIEL DE COQUE EN IMAGES — de la planche du générateur à l'atlas.

Le générateur livre une planche de 4 × 2 pièces (vue de profil, pied en
bas), détourée — ou sur un fond MAGENTA uni quand il ne sait pas rendre la
transparence : un fond qu'aucune pièce n'emploie se détoure, lui. Mais il
ne pose jamais les pièces au cordeau : l'une flotte, l'autre déborde sur
la colonne voisine (les propulseurs de la planche du 25/09). Ce script :

1. garde l'alpha de la planche s'il en a un ; sinon détoure le magenta
   (alpha progressif + dé-contamination des franges, sinon chaque pièce
   garde un liseré rose sur le ciel noir) ;
2. trouve les pièces par le VIDE qui les sépare, pas par une grille : deux
   rangées (la bande sans pixel opaque entre elles), puis dans chaque
   rangée les colonnes de vide — quatre pièces, de gauche à droite ;
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


def segments(occupe: list[bool], ecart: int) -> list[tuple[int, int]]:
    """Les plages occupées d'une projection, les trous de moins de `ecart`
    pixels comblés (une traverse fine ne coupe pas une pièce en deux)."""
    plages: list[list[int]] = []
    for i, o in enumerate(occupe):
        if not o:
            continue
        if plages and i - plages[-1][1] <= ecart:
            plages[-1][1] = i
        else:
            plages.append([i, i])
    return [(a, b + 1) for a, b in plages]


def pieces_de(planche: Image.Image) -> list[Image.Image]:
    alpha = planche.getchannel('A').point(lambda v: 255 if v > 96 else 0)
    w, h = planche.size
    px = alpha.load()
    lignes = [any(px[x, y] for x in range(0, w, 2)) for y in range(h)]
    rangs = sorted(segments(lignes, 12), key=lambda r: r[1] - r[0], reverse=True)[:ROWS]
    if len(rangs) < ROWS:
        sys.exit(f'{len(rangs)} rangée(s) trouvée(s), {ROWS} attendues')
    pieces = []
    for y0, y1 in sorted(rangs):
        cols = [any(px[x, y] for y in range(y0, y1, 2)) for x in range(w)]
        plages = sorted(segments(cols, 12), key=lambda c: c[1] - c[0], reverse=True)[:COLS]
        if len(plages) < COLS:
            sys.exit(f'rangée {y0}..{y1} : {len(plages)} pièce(s), {COLS} attendues')
        for x0, x1 in sorted(plages):
            case = planche.crop((x0, y0, x1, y1))
            pieces.append(case.crop(alpha.crop((x0, y0, x1, y1)).getbbox()))
    return pieces


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    brut = Image.open(sys.argv[1])
    a = brut.convert('RGBA').getchannel('A').getextrema()
    planche = brut.convert('RGBA') if a[0] < 16 else detoure(brut)
    pieces = pieces_de(planche)
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
