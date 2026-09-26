#!/usr/bin/env python3
"""
L'ATLAS DES CHALEURS — la chaudière et le surchauffeur, une texture.

POURQUOI UN ATLAS. Comme pour la conduite d'ammoniac (conduite_atlas.py) :
le shader de composition n'a plus d'unité de texture libre. La chaudière en
veut six — le tronçon, le bout, le joint, le brûleur, la compacte et le sol
chauffé — et elles remplacent, réunies, l'ancienne texture à ailettes
(chaud.webp, unité 10).

LE SURCHAUFFEUR y loge aussi, dans la MOITIÉ BASSE (l'atlas passe à
1024 × 2048) : lui aussi voulait sa texture, et il n'y a plus d'unité. C'est
une BORNE À VAPEUR SOUS VERRE — trois images (docs/assets-ia.md §31),
générées bleu-blanc et RECOLORÉES ici en vapeur jaune-ambre incandescente
(dore) : elle rappelle la chaudière, plus jaune et plus vive.

  masters/images/sources/surch-tube.png  le tube de verre, sa vapeur, ses cerclages
  masters/images/sources/surch-tete.png  le bout : la tête d'acier, vanne,
                                         manomètre et voyant
  masters/images/sources/surch-dome.png  le dôme (blocs presque carrés)

Sortie : masters/images/chaudiere-atlas.png (1024 × 2048, RGBA), que
tools/images/prepare.py livre ensuite en public/assets/chaudiere-atlas.webp.

LES CADRES CI-DESSOUS SONT UN CONTRAT avec le shader et la physique : les
proportions mesurées ici (les brides du joint font toute la largeur du
bloc, le carter 81 %) sont celles de CHAUDIERE dans game/formes.ts. Une
nouvelle image impose de remesurer — et de mettre les deux à jour.

Usage : python3 tools/images/chaudiere_atlas.py
"""

from __future__ import annotations

import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from conduite_atlas import SRC, colle, lis, saigne  # noqa: E402 — les mêmes outils que la conduite

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DST = os.path.join(ROOT, 'masters', 'images', 'chaudiere-atlas.png')

TAILLE = 1024  # la largeur
HAUTEUR = 2048
# (x, y, largeur, hauteur) dans l'atlas, en pixels depuis le HAUT-gauche.
# Le shader lit les mêmes cadres (CHAUDIERE_ATLAS dans game/formes.ts).
CADRE_CORPS = (0, 0, 1024, 303)
CADRE_BOUT = (0, 312, 440, 290)
CADRE_JOINT = (450, 312, 200, 311)
CADRE_BRULEUR = (660, 312, 185, 185)
CADRE_COMPACTE = (0, 628, 396, 396)
CADRE_SOL = (404, 628, 616, 308)
# le surchauffeur, moitié basse (SURCHAUFFEUR_ATLAS dans game/formes.ts)
CADRE_S_CORPS = (0, 1036, 1024, 338)
CADRE_S_BOUT = (0, 1384, 453, 410)
CADRE_S_DOME = (463, 1384, 400, 400)


def ambre(a: np.ndarray, zone: tuple[int, int, int, int] | None = None) -> None:
    """Le ROUGE d'un manomètre passe en ambre : le rouge est réservé à
    l'alerte des cinématiques (charte §3). `zone` (x0, y0, x1, y1) borne la
    retouche — sur le surchauffeur, la lueur orangée des tubes serait prise
    pour du rouge."""
    rouge = (a[..., 0] > 150) & (a[..., 1] < 90) & (a[..., 2] < 90)
    if zone:
        x0, y0, x1, y1 = zone
        masque = np.zeros_like(rouge)
        masque[y0:y1, x0:x1] = True
        rouge &= masque
    lum = a[..., 0][rouge] / 255.0
    a[..., 0][rouge] = 201 * lum / 0.79
    a[..., 1][rouge] = 111 * lum / 0.79
    a[..., 2][rouge] = 20 * lum / 0.79


def compacte() -> Image.Image:
    """La chaudière ronde, détourée à son cercle d'ailettes. Mesuré : centre
    (625, 582), rayon 575 — le boîtier de gauche en dépasse de 33 px, la
    bride de droite de 121 : la collision est un disque, l'image aussi. Le
    secteur rouge du manomètre passe en ambre : le rouge est réservé à
    l'alerte des cinématiques (charte §3)."""
    im = lis('chaudiere-compacte.png').crop((45, 2, 1205, 1162))
    a = np.asarray(im, dtype=np.float32).copy()
    h, w = a.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    r = np.hypot(xx - (w - 1) / 2, yy - (h - 1) / 2)
    a[..., 3] *= np.clip((578.0 - r) / 3.0, 0.0, 1.0)
    ambre(a)
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA')


def dore(im: Image.Image) -> Image.Image:
    """LA VAPEUR DORÉE. Les images sont générées bleu-blanc (la vapeur
    froide y venait mieux) ; le surchauffeur doit rappeler la chaudière, plus
    jaune et plus intense. Tout ce qui est BLEUTÉ (la vapeur, le verre, les
    liserés, le voyant) passe sur une rampe selon sa clarté : ambre profond,
    jaune, blanc chaud ; l'acier, neutre, ne bouge pas."""
    a = np.asarray(im.convert('RGBA'), dtype=np.float32).copy()
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0
    bleu = np.clip((b - r - 10.0) / 40.0, 0.0, 1.0)[..., None]
    t = np.clip((lum - 0.15) / 0.75, 0.0, 1.0)[..., None]
    c0 = np.array([150.0, 62.0, 8.0])
    c1 = np.array([255.0, 176.0, 40.0])
    c2 = np.array([255.0, 244.0, 205.0])
    rampe = np.where(t < 0.55, c0 + (c1 - c0) * (t / 0.55), c1 + (c2 - c1) * ((t - 0.55) / 0.45))
    a[..., :3] = a[..., :3] * (1.0 - bleu) + rampe * bleu
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA')


def tete() -> Image.Image:
    """Le bout du surchauffeur : du tube juste avant la bride (x 1030) au
    bord du couvercle (1774) ; en hauteur, l'axe (443, mesuré le long du tube
    comme de la tête) ± 336,5 — la tête touche 107..780, la demi-épaisseur du
    bloc. Le manomètre perd son secteur rouge."""
    a = np.asarray(lis('surch-tete.png'), dtype=np.float32).copy()
    ambre(a, (1380, 280, 1500, 420))
    im = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA')
    return dore(im).crop((1030, 107, 1774, 780))


def main() -> None:
    atlas = Image.new('RGBA', (TAILLE, HAUTEUR), (0, 0, 0, 0))
    # LE TRONÇON : le carter, rail à rail (lignes 38 à 681 sur 724,
    # mesurées) — au-dessus et au-dessous, une bande de fond que le
    # générateur a ajoutée. Opaque : il couvre toute sa bande.
    colle(atlas, lis('chaudiere-troncon.png').crop((0, 38, 2172, 681)), CADRE_CORPS)
    # LE BOUT : du carter juste avant le capot (x 790) au bord de la plaque
    # (1935) ; en hauteur, l'axe (401) ± une demi-épaisseur de bloc (377 px :
    # le carter y fait 613 px, 81 % du bloc) — y 24..779
    colle(atlas, lis('chaudiere-traversee.png').crop((790, 24, 1935, 779)), CADRE_BOUT)
    # le joint : la première pièce de la planche, centrée sur ses brides
    # (x 692), brides de 547 à 837 et de 32 à 692 en hauteur
    colle(atlas, lis('chaudiere-raccords.png').crop((480, 32, 904, 692)), CADRE_JOINT)
    # le brûleur : la plaque carrée (x 1312..1675, y 172..549) et sa marge
    colle(atlas, lis('chaudiere-raccords.png').crop((1302, 170, 1685, 553)), CADRE_BRULEUR)
    colle(atlas, compacte(), CADRE_COMPACTE)
    # le sol chauffé : les îlots, tels quels — posés en tampons (le vide
    # entre eux est voulu), leurs franges colorées sous l'alpha nul
    # effacées par le saignement
    colle(atlas, lis('chaudiere-sol.png'), CADRE_SOL)
    # LE SURCHAUFFEUR. Le tube se raccorde bord à bord (écart 12,1 contre
    # 11,2 entre colonnes voisines) : pris tel quel, rails compris (0..716)
    colle(atlas, dore(lis('surch-tube.png')).crop((0, 0, 2172, 717)), CADRE_S_CORPS)
    colle(atlas, tete(), CADRE_S_BOUT)
    # le dôme, centré sur son anneau (626, 627) — ses brides tiennent dans
    # le cadre
    colle(atlas, dore(lis('surch-dome.png')).crop((36, 37, 1216, 1217)), CADRE_S_DOME)
    saigne(atlas).save(DST)
    print('écrit', os.path.relpath(DST, ROOT))


if __name__ == '__main__':
    main()
