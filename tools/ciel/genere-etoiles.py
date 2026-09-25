#!/usr/bin/env python3
"""
LES TUILES D'ÉTOILES du calque de ciel (src/render/cielCalque.ts).

Le ciel n'est plus peint par le shader : c'est un calque HTML derrière la
toile WebGL, que le navigateur compose TOUJOURS à la définition native de
l'écran — quel que soit le réglage de résolution de rendu, qui ne touche
que la toile. Les étoiles y sont des tuiles d'image affichées à UN texel
par pixel physique : nettes par construction, et d'un coût à peu près nul
(le déplacement est une transformation, faite par le compositeur).

Trois tuiles, trois profondeurs, de tailles PREMIÈRES ENTRE ELLES : leurs
répétitions ne coïncident qu'au bout de 887 × 1024 × 1181 pixels — l'œil
n'y reconnaît aucun motif.
  - fond   : la poussière d'étoiles, des milliers d'étoiles faibles ;
  - milieu : un semis plus rare, un peu plus vif ;
  - proche : quelques étoiles vives, légèrement plus larges.

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
    x = np.clip(img, 0, 1) ** (1 / 1.6) * 255.0 + 0.5
    Image.fromarray(x.astype(np.uint8), "RGB").save(chemin, "WEBP", lossless=True, method=6)
    print(f"{chemin} — {img.shape[0]}², {os.path.getsize(chemin) / 1e3:.0f} Ko")


def main() -> None:
    # LA PROFONDEUR, C'EST LE DÉSÉQUILIBRE : une immense majorité d'étoiles à
    # peine visibles, très peu de vives. Premier tirage (éclats 0,55 / 1 /
    # 2,2, puissances 3 à 3,5, noyaux de 0,5 à 0,65 px) : en jeu, des pâtés
    # blancs tous pareils — un semis de confettis, pas un ciel profond.
    enregistre(tuile(887, 9000, 0.55, 4.0, 0.42, 1), "public/assets/etoiles-fond.webp")
    enregistre(tuile(1024, 1500, 1.00, 4.5, 0.46, 2), "public/assets/etoiles-milieu.webp")
    enregistre(tuile(1181, 170, 2.40, 3.5, 0.55, 3), "public/assets/etoiles-proche.webp")


if __name__ == "__main__":
    main()
