#!/usr/bin/env python3
"""
LES TUILES D'ÉTOILES du calque de ciel (src/render/cielCalque.ts).

Le ciel n'est plus peint par le shader : c'est un calque HTML derrière la
toile WebGL, que le navigateur compose TOUJOURS à la définition native de
l'écran — quel que soit le réglage de résolution de rendu, qui ne touche
que la toile. Les étoiles y sont des tuiles d'image affichées à UN texel
par pixel physique : nettes par construction, et d'un coût à peu près nul
(le déplacement est une transformation, faite par le compositeur).

UNE SEULE TUILE, qui porte les trois populations (poussière, semis,
étoiles vives). Il y en avait trois, sur trois profondeurs de parallaxe,
fondues en « screen » : le compositeur payait alors trois couches plein
écran, une surface isolée pour la fusion et une autre pour le filtre du
froid — mesuré sous Chromium en rendu logiciel (1280 × 800, DPR 2), le
calque tombait de 60 im/s (sans ciel) à 12. Une couche, en fusion normale :
29. La tuile porte donc un ALPHA (la couleur la plus vive du pixel) : posée
normalement sur la galaxie, elle donne s + g·(1 − a), à peu près le
« screen » d'avant (s + g·(1 − s)) pour des étoiles presque blanches.

La taille est PREMIÈRE (1531) : aucun sous-motif ne se répète en deçà.

Périodiques : chaque étoile est posée modulo la taille, son noyau aussi.

    python3 tools/ciel/genere-etoiles.py
"""

from __future__ import annotations

import os

import numpy as np
from PIL import Image


def couleur(t: np.ndarray) -> np.ndarray:
    """Pâles, selon la température : orangé froid, blanc, bleu-blanc chaud."""
    froid = np.array([1.00, 0.80, 0.62], np.float32)
    tiede = np.array([1.00, 0.97, 0.92], np.float32)
    chaud = np.array([0.80, 0.88, 1.00], np.float32)
    t = t[:, None]
    bas = froid + (tiede - froid) * np.clip(t * 2.0, 0, 1)
    haut = tiede + (chaud - tiede) * np.clip(t * 2.0 - 1.0, 0, 1)
    return np.where(t < 0.5, bas, haut)


def tuile(n: int, nombre: int, eclat: float, puissance: float, sigma: float, graine: int):
    rng = np.random.default_rng(graine)
    img = np.zeros((n, n, 3), np.float32)
    x = rng.random(nombre) * n
    y = rng.random(nombre) * n
    e = (rng.random(nombre) ** puissance) * eclat
    c = couleur(rng.random(nombre)) * e[:, None]
    r = 3
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            # le noyau est évalué au CENTRE de chaque pixel voisin : une étoile
            # tombée entre deux pixels les partage, au lieu de sauter de l'un
            # à l'autre — c'est ce qui la garde ronde et nette
            px = np.floor(x).astype(int) + dx
            py = np.floor(y).astype(int) + dy
            d2 = (px + 0.5 - x) ** 2 + (py + 0.5 - y) ** 2
            w = np.exp(-d2 / (2.0 * sigma * sigma))
            np.add.at(img, (py % n, px % n), c * w[:, None])
    return img


def enregistre(img: np.ndarray, chemin: str) -> None:
    # UNE COURBE DOUCE (1/1,6). La gamma pleine (1/2,2) remontait les
    # faibles au niveau des vives (0,05 devenait 0,26) : un semis de
    # confettis égaux. Sans courbe, les faibles disparaissaient : un ciel
    # vide. Entre les deux, les faibles restent à peine là — c'est la
    # profondeur.
    x = np.clip(img, 0, 1) ** (1 / 1.6)
    # l'alpha : la composante la plus vive ; la couleur, rapportée à lui
    # (WebP n'est pas prémultiplié)
    a = x.max(axis=2, keepdims=True)
    c = np.where(a > 0, x / np.maximum(a, 1e-6), 0.0)
    rgba = np.concatenate([c, a], axis=2) * 255.0 + 0.5
    Image.fromarray(rgba.astype(np.uint8), "RGBA").save(chemin, "WEBP", lossless=True, method=6)
    print(f"{chemin} — {img.shape[0]}², {os.path.getsize(chemin) / 1e3:.0f} Ko")


def main() -> None:
    # LA PROFONDEUR, C'EST LE DÉSÉQUILIBRE : une immense majorité d'étoiles à
    # peine visibles, très peu de vives. Premier tirage (éclats 0,55 / 1 /
    # 2,2, puissances 3 à 3,5, noyaux de 0,5 à 0,65 px) : en jeu, des pâtés
    # blancs tous pareils — un semis de confettis, pas un ciel profond.
    # (les trois tirages d'origine — 887², 1024², 1181² — gardent leur
    # densité par pixel sur la tuile commune de 1531²)
    n = 1531
    img = (
        tuile(n, round(9000 * (n / 887) ** 2), 0.55, 4.0, 0.42, 1)
        + tuile(n, round(1500 * (n / 1024) ** 2), 1.00, 4.5, 0.46, 2)
        + tuile(n, round(170 * (n / 1181) ** 2), 2.40, 3.5, 0.55, 3)
    )
    enregistre(img, "public/assets/etoiles.webp")

if __name__ == "__main__":
    main()
