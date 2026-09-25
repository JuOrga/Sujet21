#!/usr/bin/env python3
"""LE MATÉRIEL DE COQUE EN IMAGES — une image par pièce, un atlas pour le jeu.

Le décor posé au-dehors de la cuve, vu de dessus (assets-ia §28) : une image
détourée par pièce, déposée dans masters/images/coque/<nom>.png. La
composition (qui va où, à quelle taille) est écrite par le moteur
(src/render/compositionCoque.ts) ; les images ne fournissent que les pièces.

Une première version prenait une PLANCHE de huit pièces : trop petites, trop
vite faites, et à une échelle commune qui réduisait les petites à quelques
pixels. Ce script, désormais :

1. prend chaque image présente (les absentes restent tracées par le shader) ;
2. la recadre sur ses pixels opaques ;
3. fait SAIGNER ses couleurs dans le transparent — sans ça, le noir sous
   l'alpha nul se mélange au bord des pièces au filtrage (un liseré sombre
   au dézoom) ;
4. les range en étagères dans un atlas 2048 × 2048, chacune à la hauteur
   qui lui donne assez de pixels pour sa taille dans le monde ;
5. écrit src/render/coqueAtlas.ts : le rectangle de chaque pièce dans
   l'atlas et son RAPPORT largeur / hauteur — la composition en tire la
   taille des pièces, pour qu'aucune ne soit déformée.

    python3 tools/images/materiel.py
"""

import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter

RACINE = Path(__file__).resolve().parents[2]
SOURCES = RACINE / 'masters/images/coque'
SORTIE = RACINE / 'public/assets/coque-materiel.webp'
TABLE = RACINE / 'src/render/coqueAtlas.ts'
COTE = 2048
ECART = 10  # entre deux pièces : le mip ne mord pas la voisine

# L'ordre est celui des constantes PIECE_* de compositionCoque.ts ; la
# hauteur, celle de la pièce dans l'atlas (en pixels), pesée sur sa taille
# à l'écran : l'aile et le port sont grands, le feu minuscule.
PIECES = [
    ('aile', 660),
    ('radiateur', 800),
    ('parabole', 700),
    ('amarrage', 1000),
    ('treillis', 950),
    ('propulseurs', 0),  # retirés de la composition : la case reste vide
    ('feu', 0),  # tracé par le moteur : à 28 u, une image ne se verrait pas
]


def saigne(im: Image.Image) -> Image.Image:
    """Les couleurs des bords s'étalent dans le transparent, l'alpha intact :
    flous de plus en plus larges de la couleur PRÉMULTIPLIÉE, divisés par le
    flou de l'alpha, versés là où il n'y avait rien."""
    alpha = im.getchannel('A')
    rgb = im.convert('RGB')
    premul = ImageChops.multiply(rgb, Image.merge('RGB', (alpha, alpha, alpha)))
    plein = rgb.copy()
    rempli = alpha.point(lambda v: 255 if v > 8 else 0)
    for rayon in (2, 4, 8, 16, 32):
        c = premul.filter(ImageFilter.GaussianBlur(rayon))
        a = alpha.filter(ImageFilter.GaussianBlur(rayon))
        pc, pa, pp, pr = c.load(), a.load(), plein.load(), rempli.load()
        w, h = im.size
        for y in range(h):
            for x in range(w):
                if pr[x, y] or pa[x, y] < 2:
                    continue
                k = 255.0 / pa[x, y]
                r, g, b = pc[x, y]
                pp[x, y] = (min(255, int(r * k)), min(255, int(g * k)), min(255, int(b * k)))
                pr[x, y] = 255
    return Image.merge('RGBA', (*plein.split(), alpha))


def main() -> None:
    atlas = Image.new('RGBA', (COTE, COTE), (0, 0, 0, 0))
    x = y = hauteur_etagere = 0
    lignes = []
    for i, (nom, h) in enumerate(PIECES):
        src = SOURCES / f'{nom}.png'
        if not h:
            lignes.append(f'  null, // {i} {nom} : sans image, par choix (voir PIECES)')
            continue
        if not src.exists():
            lignes.append(f'  null, // {i} {nom} : pas d’image, tracée par le shader')
            continue
        im = Image.open(src).convert('RGBA')
        bb = im.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox()
        im = im.crop(bb)
        rapport = im.width / im.height
        w = round(h * rapport)
        if w > COTE:
            w, h = COTE, round(COTE / rapport)
        q = saigne(im.resize((w, h), Image.LANCZOS))
        if x + w > COTE:  # étagère pleine : on passe à la suivante
            x, y, hauteur_etagere = 0, y + hauteur_etagere + ECART, 0
        if y + h > COTE:
            sys.exit(f'{nom} : l’atlas de {COTE} est plein')
        atlas.alpha_composite(q, (x, y))
        lignes.append(
            f'  {{ u0: {x / COTE:.5f}, v0: {y / COTE:.5f}, u1: {(x + w) / COTE:.5f}, '
            f'v1: {(y + h) / COTE:.5f}, rapport: {rapport:.4f} }}, // {i} {nom}'
        )
        print(f'  {nom} : {im.width}×{im.height} → {w}×{h} en ({x}, {y}), rapport {rapport:.2f}')
        x += w + ECART
        hauteur_etagere = max(hauteur_etagere, h)
    SORTIE.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(SORTIE, 'WEBP', quality=88, method=6)
    TABLE.write_text(
        '// ÉCRIT PAR tools/images/materiel.py — ne pas retoucher à la main.\n'
        '// Le rectangle de chaque pièce du matériel de coque dans l’atlas\n'
        '// (public/assets/coque-materiel.webp), en fraction de l’atlas, origine\n'
        '// en HAUT à gauche comme l’image ; `rapport` = largeur / hauteur de la\n'
        '// pièce recadrée. null : pas d’image, le shader la trace lui-même.\n'
        '// L’ordre est celui des constantes PIECE_* de compositionCoque.ts.\n\n'
        'export interface RectAtlas {\n  u0: number\n  v0: number\n  u1: number\n  v1: number\n  rapport: number\n}\n\n'
        'export const ATLAS_COQUE: readonly (RectAtlas | null)[] = [\n' + '\n'.join(lignes) + '\n]\n'
    )
    print(f'{SORTIE.relative_to(RACINE)} : {SORTIE.stat().st_size // 1024} Ko · {TABLE.relative_to(RACINE)}')


if __name__ == '__main__':
    main()
