#!/usr/bin/env python3
"""
LA PLAQUE DE CIEL — fabrique le fond du vide.

POURQUOI UN OUTIL ET PAS UNE IMAGE POSÉE LÀ. Une plaque de ciel se règle :
sa densité d'étoiles, la force de sa Voie lactée, sa luminosité moyenne —
laquelle doit rester BASSE, parce que le vide doit demeurer plus sombre que
la cuve éclairée (sinon la hiérarchie lumineuse s'inverse et la scène se
noie ; c'est écrit noir sur blanc dans le shader). Un outil rejoue la plaque
avec un réglage de plus ; une image posée là ne se rejoue pas.

CE QU'ELLE IMITE. Le ciel vu de l'espace, sans atmosphère : un noir franc,
une BANDE LACTÉE qui le traverse en biais — une nuée d'étoiles trop
nombreuses pour être séparées, déchirée par des lanes de poussière sombre —
et, partout ailleurs, un semis clairsemé. Le premier tirage imitait un champ
profond de Webb (nuages sarcelle et or, six aigrettes) : en jeu, il se lisait
comme des TACHES DE PEINTURE molles, pas comme un ciel. Un vrai ciel tient
presque tout entier dans ses étoiles ; le gaz n'y est qu'un voile.

CE QU'ELLE NE FAIT PLUS : porter seule les étoiles nettes. Le jeu montre
environ deux texels par pixel au cadrage du hub ; une étoile d'un texel y est
moyennée, donc pâlie et adoucie. Les étoiles NETTES sont dessinées par le
shader, au pixel près, par-dessus (renderer.ts, `etoiles`). La plaque donne
le fond : la Voie lactée, son grain, ses poussières.

ELLE EST PÉRIODIQUE PAR CONSTRUCTION : bruits tirés dans l'espace de Fourier,
bande posée le long de la diagonale (u + v ne dépend que de sa valeur
modulo 1), étoiles semées en coordonnées enroulées. Ses bords se raccordent,
elle se répète sans couture.

    python3 tools/ciel/genere-ciel.py --taille 4096 --sortie public/assets/ciel.webp
"""

from __future__ import annotations

import argparse
import math

import numpy as np
from PIL import Image

# ---------------------------------------------------------------- bruit ----


def bruit_periodique(n: int, beta: float, rng: np.random.Generator) -> np.ndarray:
    """
    Un champ de bruit fractal, PÉRIODIQUE par construction : du bruit blanc
    dont on pèse le spectre en 1/f^beta, puis retour dans l'espace image.
    Passer par Fourier n'est pas une coquetterie — c'est ce qui garantit que
    les bords se raccordent, donc qu'on peut répéter la plaque sans couture.
    """
    blanc = rng.standard_normal((n, n)).astype(np.float32)
    spectre = np.fft.rfft2(blanc)
    fy = np.fft.fftfreq(n)[:, None]
    fx = np.fft.rfftfreq(n)[None, :]
    k = np.sqrt(fy * fy + fx * fx)
    k[0, 0] = 1.0  # la composante continue ne se pèse pas : elle se jette
    poids = k ** (-beta)
    poids[0, 0] = 0.0
    champ = np.fft.irfft2(spectre * poids, s=(n, n)).astype(np.float32)
    champ -= champ.min()
    m = champ.max()
    return champ / m if m > 0 else champ


def deplace(champ: np.ndarray, dx: np.ndarray, dy: np.ndarray) -> np.ndarray:
    """Déforme un champ par un autre : c'est ce qui donne des FILAMENTS au
    lieu de taches rondes. Les coordonnées s'enroulent — la périodicité tient."""
    n = champ.shape[0]
    ys, xs = np.meshgrid(np.arange(n), np.arange(n), indexing="ij")
    yi = (ys + dy).astype(np.int32) % n
    xi = (xs + dx).astype(np.int32) % n
    return champ[yi, xi]


def floute(plan: np.ndarray, sigma: float) -> np.ndarray:
    """Convolution gaussienne ENROULÉE, par Fourier : une transformée pour
    l'image entière, et les bords se raccordent comme le reste."""
    n = plan.shape[0]
    ax = np.fft.fftfreq(n) * n
    r2 = ax[:, None] ** 2 + ax[None, :] ** 2
    psf = np.exp(-r2 / (2.0 * sigma**2)).astype(np.float32)
    psf /= psf.sum()
    pf = np.fft.rfft2(psf)
    return np.fft.irfft2(np.fft.rfft2(plan) * pf, s=(n, n)).astype(np.float32)


# --------------------------------------------------------------- étoiles ----


def couleur_stellaire(t: np.ndarray) -> np.ndarray:
    """
    La couleur d'une étoile suit sa température : de l'orangé des naines
    froides au bleu-blanc des géantes chaudes, en passant par le blanc
    jaunâtre du Soleil. Les teintes restent PÂLES — vues sans atmosphère,
    les étoiles sont blanches à peine teintées ; des couleurs franches font
    immédiatement « dessin ». t ∈ [0,1] : 0 = froid, 1 = chaud.
    """
    froid = np.array([1.00, 0.78, 0.58], np.float32)
    tiede = np.array([1.00, 0.95, 0.88], np.float32)
    chaud = np.array([0.78, 0.86, 1.00], np.float32)
    t = t[:, None]
    bas = froid + (tiede - froid) * np.clip(t * 2.0, 0, 1)
    haut = tiede + (chaud - tiede) * np.clip(t * 2.0 - 1.0, 0, 1)
    return np.where(t < 0.5, bas, haut).astype(np.float32)


def seme(
    n: int,
    nombre: int,
    acceptation: np.ndarray,
    rng: np.random.Generator,
) -> tuple[np.ndarray, np.ndarray]:
    """Tire `nombre` positions dont la densité suit `acceptation` (0..1) —
    par rejet : on tire large, on garde selon la carte. C'est ce qui fait
    que les étoiles s'ENTASSENT dans la bande lactée au lieu de s'y poser
    au hasard comme partout ailleurs."""
    xs_, ys_ = [], []
    reste = nombre
    while reste > 0:
        lot = max(reste * 3, 1024)
        x = rng.integers(0, n, lot)
        y = rng.integers(0, n, lot)
        garde = rng.random(lot) < acceptation[y, x]
        xs_.append(x[garde][:reste])
        ys_.append(y[garde][:reste])
        reste -= len(xs_[-1])
    return np.concatenate(xs_), np.concatenate(ys_)


# ------------------------------------------------------------------ ciel ----


def fabrique(taille: int, graine: int, densite: float, nebuleuse: float) -> np.ndarray:
    rng = np.random.default_rng(graine)
    n = taille
    yy, xx = np.meshgrid(
        np.arange(n, dtype=np.float32) / n,
        np.arange(n, dtype=np.float32) / n,
        indexing="ij",
    )

    # --- LA BANDE LACTÉE : le long de la diagonale, déformée
    # u + v modulo 1 est périodique dans les deux sens : la bande se raccorde
    # à elle-même d'un bord à l'autre. Sa ligne médiane ondule (un bruit très
    # lent) pour ne pas se lire comme une règle posée sur le ciel.
    ondule = (bruit_periodique(n, 3.2, rng) - 0.5) * 0.16
    s = (xx + yy + ondule) % 1.0
    d = np.abs(s - 0.5)  # 0 sur la ligne médiane, 0,5 au plus loin
    coeur = np.exp(-((d / 0.075) ** 2))
    bande = coeur * 0.70 + np.exp(-((d / 0.19) ** 2)) * 0.30

    # les NUÉES : la bande n'est pas un tube lisse, c'est une suite de
    # nuages d'étoiles plus ou moins riches
    nuees = bruit_periodique(n, 2.3, rng)
    nuees = np.clip((nuees - 0.25) / 0.6, 0, 1) ** 1.4
    richesse = bande * (0.35 + 0.65 * nuees)

    # --- LA POUSSIÈRE qui ABSORBE : des lanes, des filaments, des trous
    # Le bruit CRÊTÉ (1 - |2n-1|) change les creux en arêtes ; la déformation
    # par deux autres bruits tord ces arêtes en volutes. Elle ne mord que
    # dans la bande : hors de la bande, il n'y a rien derrière à cacher.
    def crete(beta: float) -> np.ndarray:
        b = bruit_periodique(n, beta, rng)
        return 1.0 - np.abs(b * 2.0 - 1.0)

    wx = (bruit_periodique(n, 2.8, rng) - 0.5) * (n * 0.06)
    wy = (bruit_periodique(n, 2.8, rng) - 0.5) * (n * 0.06)
    lanes = deplace(crete(2.1) * 0.5 + crete(1.7) * 0.5, wx, wy)
    lanes = np.clip((lanes - 0.50) / 0.42, 0, 1) ** 1.2
    absorbe = np.clip(lanes * (0.35 + 0.9 * coeur), 0, 0.93)
    transmis = 1.0 - absorbe

    # --- LA LUEUR DIFFUSE : ce qu'on voit des milliards d'étoiles qu'on ne
    # sépare pas. Chaude au cœur (vieilles étoiles), plus froide sur les
    # flancs. Très basse : c'est un voile, pas un nuage.
    tc = np.clip(coeur * 1.4, 0, 1)[..., None]
    teinte = np.array([0.62, 0.70, 0.95], np.float32) * (1 - tc) + np.array(
        [1.00, 0.86, 0.66], np.float32
    ) * tc
    lueur = floute(richesse, 3.0)[..., None] * teinte * 0.085 * nebuleuse

    # quelques régions d'ÉMISSION (rose de l'hydrogène) et de RÉFLEXION
    # (bleu), rares, collées à la bande — ce sont elles qui font « vrai »,
    # à condition de rester à peine au-dessus du noir
    def poches(seuil: float) -> np.ndarray:
        b = bruit_periodique(n, 2.4, rng)
        return np.clip((b - seuil) / (1.0 - seuil), 0, 1) ** 1.6

    rose = poches(0.70) * bande
    bleu = poches(0.72) * bande
    fils = deplace(crete(1.8), wx * 0.5, wy * 0.5) ** 3  # des filaments dedans
    lueur += (rose * (0.4 + 0.6 * fils))[..., None] * np.array(
        [0.100, 0.022, 0.034], np.float32
    ) * nebuleuse
    lueur += (bleu * (0.5 + 0.5 * fils))[..., None] * np.array(
        [0.016, 0.030, 0.070], np.float32
    ) * nebuleuse

    # --- LE GRAIN DE LA BANDE : des centaines de milliers d'étoiles d'un
    # texel, semées selon la richesse, puis floutées ensemble par un même
    # halo instrumental — comme dans un vrai capteur
    accept = np.clip(0.015 + 0.985 * richesse**0.8, 0, 1).astype(np.float32)
    nb = int(n * n * 0.040 * densite)
    xs, ys = seme(n, nb, accept, rng)
    ecl = (rng.random(nb).astype(np.float32) ** 4.0) * 0.55 + 0.03
    col = couleur_stellaire(rng.random(nb).astype(np.float32))
    grain = np.zeros((n, n, 3), np.float32)
    np.add.at(grain, (ys, xs), col * ecl[:, None])
    for c in range(3):
        grain[..., c] = floute(grain[..., c], 0.60)

    # --- LES ÉTOILES DU CHAMP, un peu plus vives, partout
    # Le nombre croît vite quand l'éclat baisse (loi de puissance) : beaucoup
    # de faibles, très peu de vives — sans ce déséquilibre, le ciel a l'air
    # d'un semis de confettis tous pareils.
    nbc = int(n * n * 0.0022 * densite)
    xs, ys = seme(n, nbc, np.clip(0.18 + 0.82 * bande, 0, 1).astype(np.float32), rng)
    ecl = (rng.random(nbc).astype(np.float32) ** 5.0) * 2.2 + 0.08
    col = couleur_stellaire(rng.random(nbc).astype(np.float32))
    champ = np.zeros((n, n, 3), np.float32)
    np.add.at(champ, (ys, xs), col * ecl[:, None])
    for c in range(3):
        champ[..., c] = floute(champ[..., c], 0.70)

    # la poussière éteint ce qui est DERRIÈRE elle : la lueur et le grain
    # (les étoiles lointaines de la bande) ; les étoiles du champ sont pour
    # la plupart devant, elle ne les voile qu'à moitié
    ciel = (lueur + grain * 1.6) * transmis[..., None]
    ciel += champ * (1.0 - 0.5 * absorbe)[..., None]

    # --- QUELQUES ÉTOILES VIVES, avec un halo doux — et PAS d'aigrettes :
    # l'œil nu n'en voit pas, et les six branches de Webb disaient
    # « photographie » plutôt que « fenêtre »
    for _ in range(max(24, int(n * n * 3.0e-6 * densite))):
        x = int(rng.integers(0, n))
        y = int(rng.integers(0, n))
        f = float(rng.random() ** 2.5) * 1.6 + 0.5
        t = couleur_stellaire(rng.random(1).astype(np.float32))[0]
        r = 9
        yy_, xx_ = np.mgrid[-r : r + 1, -r : r + 1]
        d2 = (xx_ * xx_ + yy_ * yy_).astype(np.float32)
        noyau = np.exp(-d2 / (2.0 * 0.85**2)) + 0.05 * np.exp(-d2 / (2.0 * 2.6**2))
        # la fenêtre radiale éteint le halo AVANT le bord du carré : tronqué
        # net, il laissait une BOÎTE visible autour de chaque étoile vive
        noyau *= np.clip(1.0 - np.sqrt(d2) / r, 0.0, 1.0) ** 2
        yi = (np.arange(-r, r + 1) + y) % n
        xi = (np.arange(-r, r + 1) + x) % n
        ciel[np.ix_(yi, xi)] += (noyau * f)[..., None] * t

    # le fond du vide : presque rien, un soupçon de bleu
    ciel += np.array([0.0006, 0.0008, 0.0016], np.float32)
    return ciel


def encode(ciel: np.ndarray, rng: np.random.Generator) -> Image.Image:
    """
    Le passage en octets. La compression douce (racine) rend au sombre la
    place qu'il mérite : sans elle, huit bits par canal écrasent tout le
    dégradé du vide en deux ou trois valeurs, et le fond se strie en bandes.
    Un TRAMAGE d'un demi-niveau finit le travail : la lueur de la bande est
    si faible que, même en racine, ses fondus tombent sur quelques valeurs.
    """
    x = np.clip(ciel, 0.0, 1.0)
    x = x ** (1.0 / 2.2) * 255.0
    x += rng.random(x.shape, dtype=np.float32) - 0.5
    return Image.fromarray(np.clip(x + 0.5, 0, 255).astype(np.uint8), "RGB")


def main() -> None:
    p = argparse.ArgumentParser(description="Fabrique la plaque de ciel du jeu")
    p.add_argument("--taille", type=int, default=4096)
    p.add_argument("--graine", type=int, default=21)
    p.add_argument("--densite", type=float, default=1.0)
    p.add_argument("--nebuleuse", type=float, default=1.0)
    p.add_argument("--qualite", type=int, default=80)
    p.add_argument("--sortie", default="public/assets/ciel.webp")
    a = p.parse_args()

    ciel = fabrique(a.taille, a.graine, a.densite, a.nebuleuse)
    img = encode(ciel, np.random.default_rng(a.graine + 1))
    img.save(a.sortie, "WEBP", quality=a.qualite, method=6)
    import os

    o = os.path.getsize(a.sortie)
    moy = float(np.clip(ciel, 0, 1).mean())
    print(f"{a.sortie} — {a.taille}×{a.taille}, {o / 1e6:.2f} Mo")
    print(f"luminance moyenne {moy:.4f} (doit rester basse : le vide est sombre)")


if __name__ == "__main__":
    main()
