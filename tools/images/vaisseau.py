#!/usr/bin/env python3
"""LE VAISSEAU EN PERSPECTIVE — prépare ses textures (assets-ia §34).

Les sources, déposées dans masters/images/vaisseau/ (non versionné, comme
les autres masters) : paroi, salle-toit, zone-tempere, zone-cryo,
zone-chaud — en .png ou .webp. Le moteur les lit dans
public/assets/vaisseau-<nom>.webp (render/vaisseau.ts, renderer.ts).

LE RACCORD, FORCÉ. Un générateur rend une texture « tileable » à peu près :
la couture se voyait à la répétition (la zone cryo livrée le 01/10 : écart
moyen de 0,14 entre ses bords haut et bas). On mélange donc l'image avec
elle-même DÉCALÉE d'une demi-taille, sous un masque qui vaut 1 près des
bords et 0 au centre : aux bords, c'est l'image décalée — dont les bords
sont deux colonnes voisines de l'original, donc continus — et au centre,
l'original intact. Les parois et le couloir ne se raccordent qu'en largeur.

    python3 tools/images/vaisseau.py
"""

from pathlib import Path

import numpy as np
from PIL import Image

RACINE = Path(__file__).resolve().parents[2]
SOURCES = RACINE / 'masters/images/vaisseau'
SORTIE = RACINE / 'public/assets'

# nom : (largeur livrée, raccord horizontal, raccord vertical)
PIECES = {
    'paroi': (1536, True, False),
    'salle-toit': (1200, False, False),
    'zone-tempere': (1024, True, True),
    'zone-cryo': (1024, True, True),
    'zone-chaud': (1024, True, True),
    'couloir': (1536, True, False),
    'module-toit': (1400, False, False),
    'module-paroi': (1536, True, False),
}


def raccorde(a: np.ndarray, horiz: bool, vert: bool, bande: float = 0.18) -> np.ndarray:
    h, w = a.shape[:2]
    m = np.zeros((h, w), float)
    if horiz:
        x = np.minimum(np.arange(w), w - 1 - np.arange(w)) / (w * bande)
        m = np.maximum(m, (0.5 + 0.5 * np.cos(np.clip(x, 0, 1) * np.pi))[None, :])
    if vert:
        y = np.minimum(np.arange(h), h - 1 - np.arange(h)) / (h * bande)
        m = np.maximum(m, (0.5 + 0.5 * np.cos(np.clip(y, 0, 1) * np.pi))[:, None])
    dec = np.roll(a, (h // 2 if vert else 0, w // 2 if horiz else 0), axis=(0, 1))
    return a * (1 - m[..., None]) + dec * m[..., None]


def ecart(a: np.ndarray) -> tuple[float, float]:
    return float(np.abs(a[:, 0] - a[:, -1]).mean()), float(np.abs(a[0] - a[-1]).mean())


def main() -> None:
    for nom, (larg, horiz, vert) in PIECES.items():
        src = next((SOURCES / f'{nom}{ext}' for ext in ('.png', '.webp') if (SOURCES / f'{nom}{ext}').exists()), None)
        if src is None:
            print(f'  {nom} : pas de source — le moteur garde sa tôle de secours')
            continue
        im = Image.open(src).convert('RGB')
        im = im.resize((larg, round(larg * im.height / im.width)), Image.LANCZOS)
        a = np.asarray(im, float) / 255
        avant = ecart(a)
        if horiz or vert:
            a = raccorde(a, horiz, vert)
        apres = ecart(a)
        y = (0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]).mean()
        out = SORTIE / f'vaisseau-{nom}.webp'
        Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).save(out, 'WEBP', quality=84, method=6)
        print(f'  {nom} : {im.width}×{im.height}, luminance {y:.3f}, raccord G/D {avant[0]:.3f}→{apres[0]:.3f} '
              f'H/B {avant[1]:.3f}→{apres[1]:.3f}, {out.stat().st_size // 1024} Ko')


if __name__ == '__main__':
    main()
