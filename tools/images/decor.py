#!/usr/bin/env python3
"""LE DÉCOR PEINT — prépare l'image d'un biome et MESURE son gabarit.

Les sources, déposées dans masters/images/decor/ (non versionné, comme les
autres masters) : <biome>.png ou .webp. Le moteur lit
public/assets/decor-<biome>.webp (render/decor.ts, renderer.ts).

LA MESURE. Le moteur doit savoir où l'image a mis son horizon et son
ouverture : le générateur ne respecte le gabarit qu'à peu près (la
tempérée livrée le 01/10 : horizon à 20 % au lieu de 22, ouverture en
trapèze au lieu du rectangle demandé). L'outil les relève sur l'image et
imprime la ligne à recopier dans GABARITS (render/decor.ts) :
  · l'horizon : la première ligne où plus de 2 % des pixels sortent du noir ;
  · l'ouverture : les lignes où la plage noire qui contient le centre fait
    plus de 15 % de la largeur — la première, la dernière, et l'étendue de
    la dernière (le bas du trapèze).

    python3 tools/images/decor.py
"""

from pathlib import Path

import numpy as np
from PIL import Image

RACINE = Path(__file__).resolve().parents[2]
SOURCES = RACINE / 'masters/images/decor'
SORTIE = RACINE / 'public/assets'
NOIR = 30  # somme R+G+B sous laquelle un pixel est « noir »


def plage_noire(ligne: np.ndarray, c: int) -> tuple[int, int] | None:
    if ligne[c] > NOIR:
        return None
    x0 = c
    while x0 > 0 and ligne[x0 - 1] <= NOIR:
        x0 -= 1
    x1 = c
    while x1 < len(ligne) - 1 and ligne[x1 + 1] <= NOIR:
        x1 += 1
    return x0, x1


def mesure(im: Image.Image) -> dict:
    a = np.asarray(im.convert('RGB')).astype(int).sum(2)
    h, w = a.shape
    horizon = next(y for y in range(h) if (a[y] > 40).mean() > 0.02)
    lignes = []
    for y in range(horizon, h):
        p = plage_noire(a[y], w // 2)
        if p and p[1] - p[0] > 0.15 * w:
            lignes.append((y, p))
    (haut, _), (bas, (g, d)) = lignes[0], lignes[-1]
    return dict(largeur=w, hauteur=h, horizon=horizon, ouvertureHaut=haut, ouvertureBas=bas, ouvertureGauche=g, ouvertureDroite=d)


def main() -> None:
    for src in sorted(SOURCES.glob('*')):
        if src.suffix not in ('.png', '.webp'):
            continue
        im = Image.open(src).convert('RGB')
        m = mesure(im)
        out = SORTIE / f'decor-{src.stem}.webp'
        im.save(out, 'WEBP', quality=88, method=6)
        y = (np.asarray(im, float) / 255).mean()
        print(f'  {src.stem} : {m["largeur"]}×{m["hauteur"]}, luminance {y:.3f}, {out.stat().st_size // 1024} Ko')
        champs = ', '.join(f'{k}: {v}' for k, v in m.items())
        print(f"    {src.stem}: {{ {champs} }},")


if __name__ == '__main__':
    main()
