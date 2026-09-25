#!/usr/bin/env python3
"""
LA PLAQUE DE CIEL — fabrique la Voie lactée du fond.

UNE SEULE IMAGE, UNE SEULE VOIE LACTÉE. La plaque n'est plus répétée : le
jeu la cadre par rapport à l'écran (render/parallaxe.ts, cadrePlaque) et
garantit que l'écran reste dedans. Elle n'a donc plus à se raccorder à
elle-même — la version périodique d'avant, en reculant, montrait deux ou
trois bandes parallèles : un papier peint. Elle peut désormais avoir un
SUJET : la bande traverse l'image en biais, et son BULBE, le cœur doré de la
galaxie, se tient près du centre, là où la caméra regarde au départ.

CE QU'ELLE IMITE : les grandes photographies du centre galactique.
  - la bande, faite de nuées d'étoiles trop nombreuses pour être séparées ;
  - le bulbe, une lueur chaude, plus large que la bande ;
  - LES LANES DE POUSSIÈRE, étirées dans le sens de la bande (c'est ce qui
    fait « vrai » : des taches rondes font nuage, des lanes font galaxie),
    bordées d'un liseré roux où la poussière diffuse la lumière ;
  - des nébuleuses d'hydrogène, roses, groupées près du cœur ;
  - une région colorée hors de la bande, bleue et orangée (à la manière de
    Rho Ophiuchi et d'Antarès) ;
  - un semis d'étoiles qui s'entasse dans la bande et s'éteint derrière la
    poussière.

L'ÉTIREMENT FINAL est celui des astrophotographes : un arc sinus
hyperbolique, qui garde le noir noir, montre les faibles et ne brûle pas le
cœur. Les étoiles NETTES ne sont pas ici : le shader les dessine au pixel
près par-dessus (renderer.ts, `etoiles`).

    python3 tools/ciel/genere-ciel.py --taille 4096 --sortie public/assets/ciel.webp
"""

from __future__ import annotations

import argparse
import math

import numpy as np
from PIL import Image

# ---------------------------------------------------------------- bruit ----

# la direction de la bande (vers le haut à droite) et sa perpendiculaire
ANGLE = math.radians(33.0)
LE_LONG = np.array([math.cos(ANGLE), math.sin(ANGLE)], np.float32)
EN_TRAVERS = np.array([-math.sin(ANGLE), math.cos(ANGLE)], np.float32)


def bruit(
    n: int, beta: float, rng: np.random.Generator, etire: float = 1.0
) -> np.ndarray:
    """
    Un champ fractal : du bruit blanc dont on pèse le spectre en 1/f^beta.
    `etire` > 1 ALLONGE les structures dans le sens de la bande : la
    fréquence le long de la bande compte `etire` fois plus, donc y varie
    `etire` fois moins vite. C'est ce qui change des nuages en lanes.
    Normalisé sur 0..1.
    """
    blanc = rng.standard_normal((n, n)).astype(np.float32)
    spectre = np.fft.rfft2(blanc)
    fy = np.fft.fftfreq(n)[:, None].astype(np.float32)
    fx = np.fft.rfftfreq(n)[None, :].astype(np.float32)
    fl = fx * LE_LONG[0] + fy * LE_LONG[1]
    ft = fx * EN_TRAVERS[0] + fy * EN_TRAVERS[1]
    k = np.sqrt((fl * etire) ** 2 + ft**2)
    k[0, 0] = 1.0
    poids = k ** (-beta)
    poids[0, 0] = 0.0
    champ = np.fft.irfft2(spectre * poids, s=(n, n)).astype(np.float32)
    champ -= champ.min()
    return champ / max(float(champ.max()), 1e-9)


def crete(b: np.ndarray) -> np.ndarray:
    """Le bruit CRÊTÉ : les creux deviennent des arêtes vives."""
    return 1.0 - np.abs(b * 2.0 - 1.0)


def floute(plan: np.ndarray, sigma: float) -> np.ndarray:
    """Convolution gaussienne par Fourier : une transformée pour l'image."""
    n = plan.shape[0]
    ax = np.fft.fftfreq(n) * n
    r2 = (ax[:, None] ** 2 + ax[None, :] ** 2).astype(np.float32)
    psf = np.exp(-r2 / (2.0 * sigma**2))
    psf /= psf.sum()
    return np.fft.irfft2(np.fft.rfft2(plan) * np.fft.rfft2(psf), s=plan.shape).astype(
        np.float32
    )


def lisse(x: np.ndarray, a: float, b: float) -> np.ndarray:
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


# --------------------------------------------------------------- étoiles ----


def couleur_stellaire(t: np.ndarray) -> np.ndarray:
    """De l'orangé des étoiles froides au bleu-blanc des chaudes, en teintes
    PÂLES — des couleurs franches font immédiatement « dessin »."""
    froid = np.array([1.00, 0.74, 0.52], np.float32)
    tiede = np.array([1.00, 0.95, 0.88], np.float32)
    chaud = np.array([0.74, 0.84, 1.00], np.float32)
    t = t[:, None]
    bas = froid + (tiede - froid) * np.clip(t * 2.0, 0, 1)
    haut = tiede + (chaud - tiede) * np.clip(t * 2.0 - 1.0, 0, 1)
    return np.where(t < 0.5, bas, haut).astype(np.float32)


def seme(n: int, nombre: int, carte: np.ndarray, rng: np.random.Generator):
    """`nombre` positions dont la densité suit `carte` (0..1), par rejet."""
    xs_, ys_, reste = [], [], nombre
    while reste > 0:
        lot = max(reste * 4, 4096)
        x = rng.integers(0, n, lot)
        y = rng.integers(0, n, lot)
        garde = rng.random(lot) < carte[y, x]
        xs_.append(x[garde][:reste])
        ys_.append(y[garde][:reste])
        reste -= len(xs_[-1])
    return np.concatenate(xs_), np.concatenate(ys_)


def pose_etoiles(n, nombre, carte, rng, eclat, puissance, sigma):
    """Des étoiles semées selon `carte`, d'éclat en loi de puissance,
    floutées ENSEMBLE par un même halo — comme dans un vrai capteur."""
    xs, ys = seme(n, nombre, carte, rng)
    e = (rng.random(nombre).astype(np.float32) ** puissance) * eclat
    c = couleur_stellaire(rng.random(nombre).astype(np.float32))
    plan = np.zeros((n, n, 3), np.float32)
    np.add.at(plan, (ys, xs), c * e[:, None])
    for k in range(3):
        plan[..., k] = floute(plan[..., k], sigma)
    return plan


# ------------------------------------------------------------------ ciel ----


def fabrique(n: int, graine: int, densite: float, nebuleuse: float) -> np.ndarray:
    rng = np.random.default_rng(graine)
    # les coordonnées, en fraction d'image, centrées
    yy, xx = np.meshgrid(
        (np.arange(n, dtype=np.float32) + 0.5) / n - 0.5,
        (np.arange(n, dtype=np.float32) + 0.5) / n - 0.5,
        indexing="ij",
    )
    # y vers le HAUT, comme dans le jeu (la ligne 0 de l'image est en haut)
    yy = -yy
    s = xx * LE_LONG[0] + yy * LE_LONG[1]  # le long de la bande
    t = xx * EN_TRAVERS[0] + yy * EN_TRAVERS[1]  # en travers

    # --- LA BANDE : sa ligne médiane ondule, sa largeur respire
    ondule = (bruit(n, 3.4, rng, 2.0) - 0.5) * 0.10
    largeur = 0.105 * (0.80 + 0.45 * bruit(n, 3.2, rng, 2.5))
    d = (t - ondule) / largeur
    coeur_bande = np.exp(-0.5 * d * d)
    flancs = np.exp(-0.5 * (d / 2.3) ** 2)

    # --- LE BULBE : le cœur de la galaxie, un peu à gauche du centre
    bs, bt = s + 0.06, t - ondule
    bulbe = np.exp(-0.5 * ((bs / 0.16) ** 2 + (bt / 0.11) ** 2))
    noyau = np.exp(-0.5 * ((bs / 0.06) ** 2 + (bt / 0.04) ** 2))
    # la bande s'éclaire en approchant du bulbe, sans jamais s'éteindre
    long_ = 0.45 + 0.55 * np.exp(-0.5 * (bs / 0.38) ** 2)

    # --- LES NUÉES : la bande est faite de nuages d'étoiles
    nuees = bruit(n, 2.2, rng, 1.6)
    nuees = lisse(nuees, 0.25, 0.85)
    grumeaux = bruit(n, 1.6, rng)
    richesse = (coeur_bande * (0.35 + 0.65 * nuees) * long_ + 0.12 * flancs * long_)
    richesse = richesse * (0.80 + 0.20 * grumeaux) + bulbe * 0.9

    # --- LA POUSSIÈRE : des LANES étirées le long de la bande
    lanes = (
        crete(bruit(n, 2.1, rng, 2.2)) * 0.45
        + crete(bruit(n, 1.75, rng, 1.8)) * 0.35
        + crete(bruit(n, 1.45, rng, 1.4)) * 0.20
    )
    lanes = lisse(lanes, 0.58, 0.88)
    # la grande faille : une lane sombre qui court près du milieu de la bande
    faille = np.exp(-0.5 * ((d - 0.25 - 0.5 * (bruit(n, 3.0, rng, 2.5) - 0.5)) / 0.32) ** 2)
    faille *= lisse(bruit(n, 2.6, rng, 2.0), 0.35, 0.70)
    poussiere = np.clip(lanes * (0.25 + 0.95 * coeur_bande) + faille * 0.9, 0, 1)
    poussiere *= 0.6 + 0.4 * lisse(bruit(n, 1.7, rng, 1.5), 0.3, 0.7)
    transmis = np.exp(-3.4 * poussiere)
    # le LISERÉ ROUX : la poussière diffuse la lumière des étoiles derrière
    lisere = floute(poussiere, n * 0.004) - poussiere * 0.6
    lisere = np.clip(lisere, 0, 1) * coeur_bande

    # --- LA LUEUR : la lumière des étoiles qu'on ne sépare pas
    tc = np.clip(bulbe * 1.6 + coeur_bande * 0.35, 0, 1)[..., None]
    froid = np.array([0.66, 0.74, 1.00], np.float32)
    chaud = np.array([1.00, 0.80, 0.55], np.float32)
    teinte = froid * (1 - tc) + chaud * tc
    lueur = floute(richesse, n * 0.0008)[..., None] * teinte * 0.20
    lueur += noyau[..., None] * np.array([1.0, 0.86, 0.62], np.float32) * 0.35
    ciel = lueur * transmis[..., None]
    ciel += lisere[..., None] * np.array([0.30, 0.13, 0.05], np.float32) * 0.22

    # --- LES NÉBULEUSES : des poches d'hydrogène, roses, groupées près du cœur
    def poches(beta: float, seuil: float, etire: float = 1.0) -> np.ndarray:
        return lisse(bruit(n, beta, rng, etire), seuil, 1.0) ** 1.3

    zone_rose = np.exp(-0.5 * ((bs / 0.30) ** 2)) * np.exp(-0.5 * (d / 1.1) ** 2)
    fils = crete(bruit(n, 1.9, rng)) ** 2.5
    rose = poches(2.3, 0.70) * zone_rose * (0.35 + 0.65 * fils)
    # deux nébuleuses vives, compactes, posées à la main près du cœur :
    # c'est elles que l'œil trouve en premier (à la manière de la Lagune)
    for cs, ct, r, f in ((-0.02, -0.05, 0.030, 1.0), (0.10, 0.03, 0.022, 0.7)):
        g = np.exp(-0.5 * (((s - cs) / r) ** 2 + ((t - ondule - ct) / (r * 0.8)) ** 2))
        rose += g * f * (0.45 + 0.55 * fils)
    ciel += (rose * transmis ** 0.5)[..., None] * np.array(
        [0.95, 0.16, 0.34], np.float32
    ) * 0.14 * nebuleuse

    # --- LA RÉGION COLORÉE, au-dessus de la bande près du cœur : un voile
    # bleu (réflexion sur une étoile chaude) et une lueur orangée voisine
    rs, rt = s + 0.02, t - 0.20
    region = np.exp(-0.5 * ((rs / 0.09) ** 2 + (rt / 0.07) ** 2))
    vol = lisse(bruit(n, 2.0, rng), 0.35, 0.9)
    bleu = region * vol
    orange = np.exp(-0.5 * (((rs + 0.07) / 0.035) ** 2 + ((rt + 0.02) / 0.03) ** 2)) * vol
    sombre_region = lisse(crete(bruit(n, 2.0, rng, 1.4)), 0.6, 0.95) * region
    ciel *= (1.0 - 0.7 * sombre_region)[..., None]
    ciel += bleu[..., None] * np.array([0.16, 0.34, 0.95], np.float32) * 0.18 * nebuleuse
    ciel += orange[..., None] * np.array([1.0, 0.55, 0.22], np.float32) * 0.16 * nebuleuse

    # --- LES ÉTOILES : un GRAIN dense dans la bande, puis le champ
    carte = np.clip(0.02 + 0.98 * np.clip(richesse, 0, 1) ** 0.8, 0, 1).astype(np.float32)
    grain = pose_etoiles(n, int(n * n * 0.050 * densite), carte, rng, 0.55, 4.0, 0.55)
    champ = pose_etoiles(
        n, int(n * n * 0.0030 * densite),
        np.clip(0.25 + 0.75 * flancs, 0, 1).astype(np.float32), rng, 2.4, 5.5, 0.65,
    )
    ciel += grain * transmis[..., None] ** 1.3 * 1.3
    ciel += champ * (1.0 - 0.5 * poussiere)[..., None]

    # --- QUELQUES ÉTOILES VIVES, halo doux, sans aigrettes
    for _ in range(max(30, int(n * n * 4.0e-6 * densite))):
        x, y = int(rng.integers(0, n)), int(rng.integers(0, n))
        f = float(rng.random() ** 2.5) * 1.8 + 0.5
        c = couleur_stellaire(rng.random(1).astype(np.float32))[0]
        r = max(6, int(n * 0.0024))
        yy_, xx_ = np.mgrid[-r : r + 1, -r : r + 1]
        d2 = (xx_ * xx_ + yy_ * yy_).astype(np.float32)
        k = np.exp(-d2 / (2.0 * (n / 4096 * 0.9) ** 2)) + 0.05 * np.exp(
            -d2 / (2.0 * (r * 0.3) ** 2)
        )
        k *= np.clip(1.0 - np.sqrt(d2) / r, 0.0, 1.0) ** 2
        y0, y1 = max(0, y - r), min(n, y + r + 1)
        x0, x1 = max(0, x - r), min(n, x + r + 1)
        ciel[y0:y1, x0:x1] += (k[y0 - y + r : y1 - y + r, x0 - x + r : x1 - x + r] * f)[
            ..., None
        ] * c

    # le fond du vide : presque rien, un soupçon de bleu nuit
    ciel += np.array([0.0015, 0.0020, 0.0045], np.float32)
    return ciel


def etire(ciel: np.ndarray, force: float = 14.0) -> np.ndarray:
    """L'étirement des astrophotographes : arc sinus hyperbolique. Linéaire
    dans le noir, logarithmique dans le clair — le fond reste noir, les
    faibles se montrent, le cœur ne brûle pas. La couleur est gardée : on
    étire la LUMINANCE et on remet la teinte par-dessus."""
    lum = ciel @ np.array([0.30, 0.55, 0.15], np.float32)
    lum = np.maximum(lum, 1e-7)
    cible = np.arcsinh(force * lum) / np.arcsinh(force)
    return np.clip(ciel * (cible / lum)[..., None], 0.0, 1.0)


def encode(img: np.ndarray, rng: np.random.Generator) -> Image.Image:
    """Le passage en octets, avec un tramage d'un demi-niveau : les fondus de
    la bande tombent sinon sur quelques valeurs et se strient."""
    x = img * 255.0 + rng.random(img.shape, dtype=np.float32) - 0.5
    return Image.fromarray(np.clip(x + 0.5, 0, 255).astype(np.uint8), "RGB")


def main() -> None:
    p = argparse.ArgumentParser(description="Fabrique la plaque de ciel du jeu")
    p.add_argument("--taille", type=int, default=4096)
    p.add_argument("--graine", type=int, default=21)
    p.add_argument("--densite", type=float, default=1.0)
    p.add_argument("--nebuleuse", type=float, default=1.0)
    p.add_argument("--etirement", type=float, default=6.0)
    p.add_argument("--qualite", type=int, default=80)
    p.add_argument("--sortie", default="public/assets/ciel.webp")
    a = p.parse_args()

    img = etire(fabrique(a.taille, a.graine, a.densite, a.nebuleuse), a.etirement)
    encode(img, np.random.default_rng(a.graine + 1)).save(
        a.sortie, "WEBP", quality=a.qualite, method=6
    )
    import os

    print(f"{a.sortie} — {a.taille}×{a.taille}, {os.path.getsize(a.sortie) / 1e6:.2f} Mo")
    print(f"luminance moyenne {float(img.mean()):.4f} (encodée, avant la force du jeu)")


if __name__ == "__main__":
    main()
