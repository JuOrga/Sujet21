#!/usr/bin/env python3
"""
LA TERRE VUE DE L'ISS — fabrique la texture du mode TERRE du ciel.

UNE SEULE TEXTURE, DEUX IMAGES. Le fragment shader n'a que seize unités de
texture garanties, et les seize sont prises : le ciel n'en a qu'UNE
(uTexCiel), partagée entre les modes. La Terre y tient donc entière :

    RVB — le jour : la Blue Marble de la NASA, et des nuages ;
    A   — la NUIT : les lumières des villes (Black Marble), INVERSÉES et
          ramenées dans 128..255 : A = 255 − 127 · lumière.

POURQUOI INVERSÉES. Là où il n'y a pas de ville — presque partout — une
lumière directe mettrait l'alpha à 0. Or un navigateur qui décode l'image
en alpha PRÉMULTIPLIÉ (le repli par l'<img>, ou un pilote zélé) multiplie
le RVB par l'alpha : à 0, tout l'océan devenait NOIR. Inversé et plancher à
128, l'alpha ne descend jamais sous 0,5 : au pire un demi-bit de couleur
perdu, jamais une planète éteinte. Le shader relit `lumière = 2 · (1 − a)`.

LES NUAGES sont CUITS dans l'image, pas calculés à l'image : le shader n'en
paie rien. Un bruit fractal pris SUR LA SPHÈRE (en 3D, sur le point unité),
sans quoi la couture de ±180° et le pincement des pôles se verraient. Leur
couverture suit les grandes bandes du vrai ciel : chargée sous l'équateur
(la zone de convergence), claire sur les déserts subtropicaux, dense sur les
rails des dépressions des moyennes latitudes. Sous un nuage, la ville
pâlit : c'est aussi cuit ici.

SOURCES — images NASA, domaine public (NASA Earth Observatory, Blue Marble
et Black Marble). Le réseau de l'environnement de travail ne joint pas la
NASA : on les prend dans le paquet npm three-globe (licence MIT), qui les
embarque en 4096 × 2048 :

    npm pack three-globe && tar xzf three-globe-*.tgz package/example/img
    python3 tools/ciel/prepare-terre.py package/example/img \\
        --sortie public/assets/terre.webp
"""

from __future__ import annotations

import argparse
import math
from pathlib import Path

import numpy as np
from PIL import Image


def lumieres(nuit: np.ndarray) -> np.ndarray:
    """Les villes, dans la Black Marble. Elle porte AUSSI le relief éclairé
    par la lune, bleuté ; les villes, elles, sont d'un blanc chaud — c'est
    le rapport rouge/bleu qui les sépare (un désert au clair de lune :
    ~0,1 ; une ville : ~1). Un seuil sur la luminance seule prenait le
    Sahara pour une métropole."""
    r, g, b = nuit[..., 0], nuit[..., 1], nuit[..., 2]
    rapport = r / (b + 0.03)
    w = np.clip((rapport - 0.35) / 0.4, 0, 1)
    w = w * w * (3 - 2 * w)
    y = 0.3 * r + 0.6 * g + 0.1 * b
    return np.clip((y - 0.02) * 2.0, 0, 1) * w


def bruit3(p: np.ndarray, graine: int) -> np.ndarray:
    """Bruit de valeur 3D, trilinéaire lissé, sur un réseau entier haché."""
    i = np.floor(p).astype(np.int64)
    f = p - i
    f = f * f * (3 - 2 * f)

    def h(dx: int, dy: int, dz: int) -> np.ndarray:
        x = i[..., 0] + dx
        y = i[..., 1] + dy
        z = i[..., 2] + dz
        n = (x * 73856093) ^ (y * 19349663) ^ (z * 83492791) ^ (graine * 2654435761)
        n = (n ^ (n >> 13)) * 1274126177
        return ((n ^ (n >> 16)) & 0xFFFF).astype(np.float32) / 65535.0

    fx, fy, fz = f[..., 0], f[..., 1], f[..., 2]
    x00 = h(0, 0, 0) * (1 - fx) + h(1, 0, 0) * fx
    x10 = h(0, 1, 0) * (1 - fx) + h(1, 1, 0) * fx
    x01 = h(0, 0, 1) * (1 - fx) + h(1, 0, 1) * fx
    x11 = h(0, 1, 1) * (1 - fx) + h(1, 1, 1) * fx
    y0 = x00 * (1 - fy) + x10 * fy
    y1 = x01 * (1 - fy) + x11 * fy
    return y0 * (1 - fz) + y1 * fz


def nuages(larg: int, haut: int, graine: int) -> np.ndarray:
    lon = (np.arange(larg, dtype=np.float32) + 0.5) / larg * 2 * math.pi - math.pi
    lat = math.pi / 2 - (np.arange(haut, dtype=np.float32) + 0.5) / haut * math.pi
    lo, la = np.meshgrid(lon, lat)
    p = np.stack([np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)], -1)
    # des nuages ÉTIRÉS d'est en ouest, comme les vents les couchent : le
    # bruit est pris plus serré en latitude (z) qu'en longitude
    p = p * np.array([1.0, 1.0, 1.8], dtype=np.float32)
    somme = np.zeros(lo.shape, np.float32)
    amp, freq, total = 1.0, 6.0, 0.0
    for o in range(7):
        somme += amp * bruit3(p * freq + o * 17.3, graine + o)
        total += amp
        amp *= 0.6
        freq *= 2.1
    somme /= total
    # la couverture, par bandes de latitude (en degrés)
    d = np.degrees(la)
    couv = (
        0.43
        + 0.12 * np.exp(-(((d - 5) / 9) ** 2))          # la convergence équatoriale
        - 0.14 * np.exp(-(((np.abs(d) - 24) / 8) ** 2))  # les déserts subtropicaux
        + 0.14 * np.exp(-(((np.abs(d) - 55) / 12) ** 2)) # les rails des dépressions
    )
    c = np.clip((somme - (1 - couv)) / 0.16, 0, 1)
    return (c * c * (3 - 2 * c)) * 0.8


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('sources', help='dossier contenant earth-blue-marble.jpg et earth-night.jpg')
    ap.add_argument('--sortie', default='public/assets/terre.webp')
    ap.add_argument('--largeur', type=int, default=4096)
    ap.add_argument('--qualite', type=int, default=82)
    ap.add_argument('--graine', type=int, default=21)
    a = ap.parse_args()

    src = Path(a.sources)
    larg, haut = a.largeur, a.largeur // 2
    jour = np.asarray(
        Image.open(src / 'earth-blue-marble.jpg').convert('RGB').resize((larg, haut), Image.LANCZOS),
        np.float32,
    ) / 255
    nuit = np.asarray(
        Image.open(src / 'earth-night.jpg').convert('RGB').resize((larg, haut), Image.LANCZOS),
        np.float32,
    ) / 255

    c = nuages(larg, haut, a.graine)[..., None]
    # un nuage n'est pas un blanc pur : légèrement bleuté dans son épaisseur
    blanc = np.array([0.93, 0.95, 0.98], np.float32)
    rvb = jour * (1 - c) + blanc * c
    lum = lumieres(nuit) * (1 - 0.75 * c[..., 0])

    alpha = 255 - np.round(np.clip(lum, 0, 1) * 127)
    img = np.dstack([np.round(np.clip(rvb, 0, 1) * 255), alpha]).astype(np.uint8)
    out = Path(a.sortie)
    # alpha_quality haute : les villes sont de petits points, une compression
    # forte de l'alpha les étale en taches
    Image.fromarray(img, 'RGBA').save(out, 'WEBP', quality=a.qualite, alpha_quality=90, method=6)
    print(f'{out} : {larg}×{haut}, {out.stat().st_size / 1e6:.2f} Mo')


if __name__ == '__main__':
    main()
