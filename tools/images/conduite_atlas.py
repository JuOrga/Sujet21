#!/usr/bin/env python3
"""
L'ATLAS DE LA CONDUITE D'AMMONIAC — quatre images générées, une texture.

POURQUOI UN ATLAS. Le shader de composition a ses seize unités de texture
occupées (renderer.ts, bindTex). La conduite en veut quatre : le tronçon, la
bride de bout, le joint à brides et le givre du sol. Elles remplacent donc,
réunies, l'ancienne texture de la plaque froide (froid.webp, unité 9).

Les sources (docs/assets-ia.md, « La conduite d'ammoniac ») :

  masters/images/sources/conduite-troncon.png   le corps, sur fond sombre
  masters/images/sources/conduite-traversee.png le bout : bride, coude qui
                                                plonge dans une plaque de sol
  masters/images/sources/conduite-raccords.png  la planche de raccords
  masters/images/sources/conduite-givre.png     le givre du sol, détouré
  masters/images/sources/conduite-vanne.webp    la tête de vanne (petits blocs)

Sortie : masters/images/conduite-atlas.png (1024², RGBA), que
tools/images/prepare.py livre ensuite en public/assets/conduite-atlas.webp.

LES CADRES CI-DESSOUS SONT UN CONTRAT avec le shader et la physique : les
proportions mesurées ici (la bride fait toute la largeur du bloc, le tuyau
un peu plus de la moitié) sont celles de CONDUITE dans game/formes.ts. Une
nouvelle image impose de remesurer — et de mettre les deux à jour.

Usage : python3 tools/images/conduite_atlas.py
"""

from __future__ import annotations

import os

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'masters', 'images', 'sources')
DST = os.path.join(ROOT, 'masters', 'images', 'conduite-atlas.png')

# 1024² : à l'écran, un tuyau fait au plus une centaine de pixels de large —
# l'atlas de 2048² pesait 1,07 Mo en WebP (mesuré), sans rien de visible en
# plus.
TAILLE = 1024
# (x, y, largeur, hauteur) dans l'atlas, en pixels depuis le HAUT-gauche.
# Le shader lit les mêmes cadres (CONDUITE_ATLAS dans game/formes.ts).
CADRE_CORPS = (0, 0, 1024, 341)
CADRE_BOUT = (0, 350, 370, 276)
CADRE_JOINT = (380, 350, 451, 365)
CADRE_GIVRE = (384, 720, 608, 304)
CADRE_VANNE = (0, 640, 370, 361)


def lis(nom: str) -> Image.Image:
    return Image.open(os.path.join(SRC, nom)).convert('RGBA')


def corps() -> Image.Image:
    """Le tronçon est livré sur fond sombre, sans alpha. Dans la bande du
    tuyau (lignes 56 à 612 sur 724, mesurées), tout est opaque : le bas du
    tuyau est aussi sombre que le fond, un seuil l'aurait troué. Hors de la
    bande, seules la frange de givre et les stalactites restent, par leur
    clarté."""
    im = lis('conduite-troncon.png')
    a = np.asarray(im, dtype=np.float32)
    lum = a[..., :3].mean(axis=2)
    h = a.shape[0]
    rangs = np.arange(h)[:, None] / h
    dans = (rangs >= 56 / 724) & (rangs <= 612 / 724)
    alpha = np.clip((lum - 32.0) / 38.0, 0.0, 1.0)
    alpha = np.where(dans, 1.0, alpha)
    a[..., 3] = alpha * 255.0
    return Image.fromarray(a.astype(np.uint8), 'RGBA')


def colle(atlas: Image.Image, piece: Image.Image, cadre: tuple[int, int, int, int]) -> None:
    x, y, w, h = cadre
    atlas.alpha_composite(piece.resize((w, h), Image.LANCZOS), (x, y))


def saigne(atlas: Image.Image, passes: int = 24) -> Image.Image:
    """LE SAIGNEMENT DES COULEURS : un pixel transparent garde la couleur de
    ses voisins opaques. Le détourage laisse du NOIR sous l'alpha nul ; en
    réduisant l'image (mipmaps, filtrage), la carte graphique le mélange au
    bord de la pièce — un liseré sombre autour du givre. On étend donc les
    couleurs dans le transparent, passe après passe ; l'alpha, lui, ne
    bouge pas."""
    a = np.asarray(atlas, dtype=np.float32).copy()
    rgb = a[..., :3] * (a[..., 3:4] > 0)
    poids = (a[..., 3] > 0).astype(np.float32)
    for _ in range(passes):
        somme = np.zeros_like(rgb)
        n = np.zeros_like(poids)
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            somme += np.roll(rgb * poids[..., None], (dy, dx), axis=(0, 1))
            n += np.roll(poids, (dy, dx), axis=(0, 1))
        vide = (poids == 0) & (n > 0)
        rgb[vide] = somme[vide] / n[vide, None]
        poids = np.where(vide, 1.0, poids)
    a[..., :3] = rgb
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA')


def main() -> None:
    atlas = Image.new('RGBA', (TAILLE, TAILLE), (0, 0, 0, 0))
    colle(atlas, corps(), CADRE_CORPS)
    # LA TRAVERSÉE DE SOL (le bout libre) : de l'amorce de la bride (x 845)
    # au bord de la plaque (1770) ; en hauteur, la plaque (123..800,
    # mesurée) et 10 px de marge, centrée sur l'axe du tuyau (455) et de
    # la plaque (461) — y 113..803
    colle(atlas, lis('conduite-traversee.png').crop((845, 113, 1770, 803)), CADRE_BOUT)
    # le joint : la première pièce de la planche, centrée sur ses brides
    # (x 380), bride de 79 à 483
    colle(atlas, lis('conduite-raccords.png').crop((98, 56, 662, 513)), CADRE_JOINT)
    colle(atlas, lis('conduite-givre.png'), CADRE_GIVRE)
    # LA VANNE (les blocs presque carrés) : la plaque (x 48..1074,
    # y 70..1058, mesurée) et 10 à 16 px de marge, centrée sur la plaque
    colle(atlas, lis('conduite-vanne.webp').crop((38, 54, 1084, 1074)), CADRE_VANNE)
    saigne(atlas).save(DST)
    print('écrit', os.path.relpath(DST, ROOT))


if __name__ == '__main__':
    main()
