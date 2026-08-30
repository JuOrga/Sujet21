#!/usr/bin/env python3
"""
LA PLAQUE DE CIEL — fabrique le fond étoilé du jeu.

POURQUOI UN OUTIL ET PAS UNE IMAGE POSÉE LÀ. Une plaque de ciel se règle :
sa densité d'étoiles, la force de sa nébulosité, sa teinte, sa luminosité
moyenne — laquelle doit rester BASSE, parce que le vide doit demeurer plus
sombre que la cuve éclairée (sinon la hiérarchie lumineuse s'inverse et la
scène se noie ; c'est écrit noir sur blanc dans le shader). Un outil rejoue
la plaque avec un réglage de plus ; une image posée là ne se rejoue pas.

CE QU'ELLE IMITE. Les grands champs profonds — la signature du télescope
James Webb : un fond noir bleuté, des filaments de poussière chauds, un
semis d'étoiles dont les plus vives portent SIX AIGRETTES (le miroir
hexagonal de Webb les dessine ainsi), et de minuscules galaxies lointaines.

CE QU'ELLE N'EST PAS : une vraie photographie. Voir docs/ciel.md pour
déposer une plaque authentique de Webb ou de Hubble à la place — le jeu
prend celle qu'il trouve, sans une ligne de code à changer.

LES ÉTOILES SONT POSÉES EN DEUX FOIS, et c'est ce qui fait la ressemblance.
Les dizaines de milliers d'étoiles faibles sont semées en points purs puis
TOUTES floutées d'un coup par une convolution (une seule transformée de
Fourier pour l'image entière) : c'est le même halo instrumental pour
toutes, comme dans un vrai capteur. Les quelques centaines d'étoiles vives
sont dessinées une à une, avec leur halo large et leurs aigrettes.

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
    les bords se raccordent, donc qu'on peut répéter la plaque si le monde
    devient plus large que prévu, sans couture visible dans le noir.
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


# --------------------------------------------------------------- étoiles ----


def couleur_stellaire(t: np.ndarray) -> np.ndarray:
    """
    La couleur d'une étoile suit sa température. On échelonne du bleu-blanc
    des géantes chaudes à l'orange des naines froides, en passant par le
    blanc : c'est cette DIVERSITÉ qui distingue un vrai champ d'un semis de
    points blancs. t ∈ [0,1] : 0 = froid (orangé), 1 = chaud (bleuté).
    """
    froid = np.array([1.00, 0.72, 0.48], np.float32)
    tiede = np.array([1.00, 0.94, 0.86], np.float32)
    chaud = np.array([0.74, 0.83, 1.00], np.float32)
    t = t[:, None]
    bas = froid + (tiede - froid) * np.clip(t * 2.0, 0, 1)
    haut = tiede + (chaud - tiede) * np.clip(t * 2.0 - 1.0, 0, 1)
    return np.where(t < 0.5, bas, haut).astype(np.float32)


def magnitudes(n: int, rng: np.random.Generator) -> np.ndarray:
    """
    Le nombre d'étoiles croît vite quand on descend en éclat : beaucoup de
    faibles, très peu de vives. Une loi de puissance rend ce déséquilibre —
    sans lui, un ciel a l'air d'un semis de confettis tous pareils.
    """
    u = rng.random(n).astype(np.float32)
    return (u ** 3.2).astype(np.float32)  # écrase vers le faible


def aigrettes(
    plan: np.ndarray, x: float, y: float, force: float, teinte: np.ndarray, portee: int
) -> None:
    """
    LES SIX AIGRETTES DE WEBB. Le miroir du télescope est fait d'hexagones :
    la lumière d'une étoile vive s'y diffracte en six branches à 60°, plus
    deux horizontales plus faibles dues aux bras du support. C'est LA
    signature visuelle de l'instrument — sans elle, l'image ne « dit » pas
    Webb, quelle que soit la beauté du fond.
    """
    n = plan.shape[0]
    branches = [(a, 1.0) for a in range(0, 360, 60)] + [(0, 0.35), (180, 0.35)]
    for angle, poids in branches:
        a = math.radians(angle)
        ca, sa = math.cos(a), math.sin(a)
        for r in range(1, portee):
            f = force * poids * (1.0 - r / portee) ** 2.4
            if f < 0.0015:
                break
            px = int(x + ca * r) % n
            py = int(y + sa * r) % n
            plan[py, px] += teinte * f


# ------------------------------------------------------------------ ciel ----


def fabrique(taille: int, graine: int, densite: float, nebuleuse: float) -> np.ndarray:
    rng = np.random.default_rng(graine)
    n = taille

    # --- LA NÉBULOSITÉ : des FILAMENTS, pas des taches
    # Un vrai champ profond n'a pas de nuages ronds : il a des veines, des
    # crêtes, des fronts. Deux moyens l'obtiennent. Le bruit CRÊTÉ
    # (1 - |2n-1|) transforme les creux en arêtes vives ; la DÉFORMATION du
    # champ par deux autres bruits tord ces arêtes en volutes. Sans eux, on
    # obtient un papier peint bleu — c'était le premier essai, et il ne
    # ressemblait à rien.
    def crete(beta: float) -> np.ndarray:
        b = bruit_periodique(n, beta, rng)
        return 1.0 - np.abs(b * 2.0 - 1.0)

    wx = (bruit_periodique(n, 2.7, rng) - 0.5) * (n * 0.10)
    wy = (bruit_periodique(n, 2.7, rng) - 0.5) * (n * 0.10)
    grand = deplace(crete(2.5), wx, wy)
    moyen = deplace(crete(2.1), wx * 0.45, wy * 0.45)
    fin = crete(1.75)
    voile = grand * 0.52 + moyen * 0.32 + fin * 0.16
    voile = (voile - voile.min()) / max(1e-6, float(voile.max() - voile.min()))
    # LE SEUIL EST HAUT, ET C'EST VOULU : le vide occupe les trois quarts de
    # la plaque. Une nébuleuse partout n'est pas un ciel, et surtout elle
    # noierait la cuve éclairée — la hiérarchie lumineuse du jeu en dépend.
    voile = np.clip((voile - 0.56) / 0.44, 0, 1) ** 2.1

    # --- LA POUSSIÈRE qui ABSORBE : les veines noires d'un vrai champ
    poussiere = deplace(crete(2.4), wy * 0.7, -wx * 0.7)
    absorbe = np.clip((poussiere - 0.52) / 0.48, 0, 1) ** 1.1

    # --- LA COULEUR : noir bleuté, sarcelle, or — la palette des composites
    # en infrarouge proche. Le fond part de PRESQUE RIEN : c'est le noir qui
    # fait ressortir les étoiles, pas la couleur.
    nuit = np.array([0.0007, 0.0011, 0.0026], np.float32)
    sarcelle = np.array([0.026, 0.115, 0.150], np.float32)
    orge = np.array([0.300, 0.150, 0.052], np.float32)
    v = voile[..., None]
    froid = nuit + (sarcelle - nuit) * np.clip(v * 2.3, 0, 1)
    chaud = sarcelle + (orge - sarcelle) * np.clip(v * 2.3 - 1.0, 0, 1)
    ciel = np.where(v < 0.435, froid, chaud).astype(np.float32)
    ciel *= nebuleuse
    ciel *= (1.0 - 0.80 * absorbe)[..., None]
    ciel += nuit  # le fond du vide, et rien de plus

    # --- LES ÉTOILES FAIBLES : semées en points purs, floutées EN UNE FOIS
    nb = int(n * n * 4.5e-3 * densite)
    xs = rng.integers(0, n, nb)
    ys = rng.integers(0, n, nb)
    ecl = magnitudes(nb, rng) * 0.85 + 0.015
    col = couleur_stellaire(rng.random(nb).astype(np.float32))
    semis = np.zeros((n, n, 3), np.float32)
    np.add.at(semis, (ys, xs), col * ecl[:, None])

    # le halo instrumental, identique pour toutes : une gaussienne étroite
    # appliquée par convolution — une transformée pour l'image entière
    ax = np.fft.fftfreq(n) * n
    r2 = ax[:, None] ** 2 + ax[None, :] ** 2
    psf = np.exp(-r2 / (2.0 * 0.62**2)).astype(np.float32)
    # L'AILE LARGE RESTE MINCE. Chaque étoile faible en porte une ; à
    # soixante-dix mille étoiles, la somme de ces ailes fait un VOILE
    # laiteux qui mange le noir — le ciel paraît alors embué plutôt que
    # profond. C'est le défaut qu'on voyait en jeu au deuxième essai.
    psf += 0.010 * np.exp(-r2 / (2.0 * 1.9**2))
    psf /= psf.sum()
    pf = np.fft.rfft2(psf)
    for c in range(3):
        semis[..., c] = np.fft.irfft2(np.fft.rfft2(semis[..., c]) * pf, s=(n, n))
    ciel += np.clip(semis, 0, None) * 1.75

    # --- LES ÉTOILES VIVES : une à une, avec halo large et aigrettes
    nbv = max(48, int(n * n * 4.0e-5 * densite))
    for _ in range(nbv):
        x = float(rng.integers(0, n))
        y = float(rng.integers(0, n))
        f = float(rng.random() ** 2.0) * 1.5 + 0.35
        teinte = couleur_stellaire(rng.random(1).astype(np.float32))[0]
        # LA TAILLE DES HALOS SE JUGE EN JEU, pas sur la plaque. À 0,006
        # la plaque était superbe vue de près et se couvrait, une fois dans
        # le vide du hub, de grosses taches molles — le jeu montre environ
        # un texel par pixel, donc un halo de quarante texels fait une
        # tache de quarante pixels à l'écran. Divisé par deux et demi.
        portee = int(n * 0.0024 * (0.5 + f))
        aigrettes(ciel, x, y, f * 0.16, teinte, max(6, portee))
        # LE CŒUR ET SON HALO. Le halo large se dessine sur un carré, et
        # c'est un piège : tronqué net, il laisse une BOÎTE visible autour
        # de chaque étoile vive — le premier essai en était constellé. On
        # étale donc le carré bien au-delà du halo, et on l'éteint par une
        # fenêtre radiale qui atteint zéro AVANT le bord.
        r = max(5, int(portee * 0.75))
        yy, xx = np.mgrid[-r : r + 1, -r : r + 1]
        d2 = (xx * xx + yy * yy).astype(np.float32)
        sig = r * 0.13
        noyau = np.exp(-d2 / (2.0 * sig**2)) + 0.16 * np.exp(
            -d2 / (2.0 * (sig * 2.7) ** 2)
        )
        noyau *= np.clip(1.0 - np.sqrt(d2) / r, 0.0, 1.0) ** 2
        yi = (np.arange(-r, r + 1) + int(y)) % n
        xi = (np.arange(-r, r + 1) + int(x)) % n
        ciel[np.ix_(yi, xi)] += (noyau * f)[..., None] * teinte

    # --- LES GALAXIES LOINTAINES : la signature d'un champ PROFOND
    for _ in range(max(10, int(n * n * 2.2e-6))):
        x, y = int(rng.integers(0, n)), int(rng.integers(0, n))
        r = int(rng.integers(3, max(5, int(n * 0.0022))))
        ang = rng.random() * math.pi
        allonge = 0.28 + rng.random() * 0.55
        yy, xx = np.mgrid[-r * 2 : r * 2 + 1, -r * 2 : r * 2 + 1]
        u = xx * math.cos(ang) + yy * math.sin(ang)
        w = (-xx * math.sin(ang) + yy * math.cos(ang)) / allonge
        g = np.exp(-(u * u + w * w) / (2.0 * (r * 0.5) ** 2)).astype(np.float32)
        t = couleur_stellaire(np.array([rng.random() * 0.45], np.float32))[0]
        yi = (np.arange(-r * 2, r * 2 + 1) + y) % n
        xi = (np.arange(-r * 2, r * 2 + 1) + x) % n
        ciel[np.ix_(yi, xi)] += g[..., None] * t * (0.05 + rng.random() * 0.10)

    return ciel


def encode(ciel: np.ndarray) -> Image.Image:
    """
    Le passage en octets. La compression douce (racine) rend au sombre la
    place qu'il mérite : sans elle, huit bits par canal écrasent tout le
    dégradé du vide en deux ou trois valeurs, et le fond se strie en bandes.
    """
    x = np.clip(ciel, 0.0, 1.0)
    x = x ** (1.0 / 2.2)
    return Image.fromarray((x * 255.0 + 0.5).astype(np.uint8), "RGB")


def main() -> None:
    p = argparse.ArgumentParser(description="Fabrique la plaque de ciel du jeu")
    p.add_argument("--taille", type=int, default=4096)
    p.add_argument("--graine", type=int, default=21)
    p.add_argument("--densite", type=float, default=1.0)
    p.add_argument("--nebuleuse", type=float, default=1.0)
    p.add_argument("--qualite", type=int, default=88)
    p.add_argument("--sortie", default="public/assets/ciel.webp")
    a = p.parse_args()

    ciel = fabrique(a.taille, a.graine, a.densite, a.nebuleuse)
    img = encode(ciel)
    img.save(a.sortie, "WEBP", quality=a.qualite, method=6)
    import os

    o = os.path.getsize(a.sortie)
    moy = float(np.clip(ciel, 0, 1).mean())
    print(f"{a.sortie} — {a.taille}×{a.taille}, {o / 1e6:.2f} Mo")
    print(f"luminance moyenne {moy:.4f} (doit rester basse : le vide est sombre)")


if __name__ == "__main__":
    main()
