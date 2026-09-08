#!/usr/bin/env python3
"""
LA CHAÎNE DES IMAGES — des masters à public/assets/.

POURQUOI UNE CHAÎNE ET PAS UN DÉPÔT À LA MAIN. L'audio en a une depuis le
début (tools/audio/prepare.py) : les masters restent intacts dans masters/,
un script produit ce que le jeu charge, et une règle MESURABLE (rien
au-dessus de 3 kHz) tranche ce qui passe et ce qui repart. Les images, elles,
arrivaient une à une, à la taille que le générateur avait bien voulu donner
(1254², 1024², 1536×614 dans la même famille), sans que rien ne vérifie un
raccord, une transparence ou un poids. Ce script est le pendant de
l'audio : les sources en pleine résolution vont dans masters/images/, il
produit public/assets/ à la taille de la famille, en WebP à la qualité de
la famille, et REFUSE ce qui ne passe pas ses mesures.

LES MESURES, par famille (voir FAMILLES, et docs/charte-visuelle.md) :

  · le RACCORD d'une texture répétée : l'écart entre la première et la
    dernière colonne, rapporté à l'écart moyen entre deux colonnes voisines
    dans l'image. Un raccord invisible tient sous 3 (mesuré, voir
    RACCORD_MAX) ; au-delà, la couture se voit à l'affichage ;
  · la LUMINANCE moyenne (luma Rec. 709, 0 à 1) : le vide doit rester plus
    sombre que la cuve, la cuve plus sombre que le corps — sinon la
    hiérarchie lumineuse s'inverse et la scène se noie (c'est écrit dans le
    shader). Chaque famille a son plafond ;
  · la part de pixels CHAUDS (teinte orange/rouge, saturée) : la palette est
    froide, l'ambre est réservé aux veilleuses. Une image qui vire au chaud
    a été générée hors charte ;
  · la BORDURE d'un décalque : une pièce détourée doit être transparente sur
    son bord, sinon elle est coupée par le cadre et se lit comme une
    vignette collée ;
  · le POIDS : au-delà du plafond de la famille, on baisse la qualité avant
    de livrer — le jeu se joue sur téléphone.

Usage :
  python3 tools/images/prepare.py                 # tout masters/images/ → public/assets/
  python3 tools/images/prepare.py decal-vanne     # un seul master (nom sans extension)
  python3 tools/images/prepare.py --audit         # mesure ce qui est DÉJÀ dans public/assets/
  python3 tools/images/prepare.py --verifie       # mesure les masters sans rien écrire
  python3 tools/images/prepare.py --recadre       # accepte un master au mauvais format (recadrage centré)

Dépendances : pillow, numpy
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from dataclasses import dataclass, field
from typing import Iterable

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'masters', 'images')
DST = os.path.join(ROOT, 'public', 'assets')

EXTENSIONS = ('.png', '.jpg', '.jpeg', '.webp', '.tif', '.tiff')

# Au-delà de ce rapport entre la couture et le grain interne, le raccord se
# voit. Mesuré le 08/09/2026 sur les textures livrées (x / y) : wall-a 1,0 /
# 1,7, phile 1,8 / 1,6, phobe 2,3 / 2,5, froid 1,3 / 2,4 — celles-là ne
# montrent pas leur couture. La grille (4,6 / 4,7) et le vieux mur de
# substitution (1,9 / 4,7), si : on les voit se répéter.
RACCORD_MAX = 3.0
# La part de pixels chauds au-delà de laquelle une image est hors palette,
# quand la famille n'en dit pas plus. Mesuré : les planches de cinématique
# froides 0 %, la serre 2 à 5 %, le plafond de la chaufferie (ambre voulu)
# 17 %, l'éponge (ocre par nature) 52 à 75 %.
CHAUD_MAX = 0.15


@dataclass
class Famille:
    nom: str
    motifs: tuple[str, ...]
    # taille de sortie (largeur, hauteur) ; None = celle du master, plafonnée
    # par `cote_max`. Une taille fixe s'applique à un master du même RAPPORT
    # (à 2 % près) : un rapport différent est refusé, sauf --recadre.
    taille: tuple[int, int] | None = None
    cote_max: int = 1536
    alpha: bool = False  # pièce détourée : l'alpha est exigé, le bord doit être vide
    raccord_x: bool = False  # se répète horizontalement : couture gauche/droite mesurée
    raccord_y: bool = False  # se répète verticalement : couture haut/bas mesurée
    luma_max: float = 1.0  # luminance moyenne au-delà de laquelle l'image est refusée
    chaud_max: float | None = None  # part de pixels chauds tolérée ; None = CHAUD_MAX
    qualite: int = 82
    poids_max_ko: int = 350
    note: str = ''
    # rempli à l'usage
    _regex: list[re.Pattern[str]] = field(default_factory=list)

    def accepte(self, nom: str) -> bool:
        if not self._regex:
            self._regex = [re.compile('^' + m.replace('*', '.*') + '$') for m in self.motifs]
        return any(r.match(nom) for r in self._regex)


# L'ordre compte : la première famille dont un motif accepte le nom gagne.
FAMILLES: list[Famille] = [
    Famille(
        'plaque de ciel', ('ciel',), taille=(4096, 4096), raccord_x=True, raccord_y=True,
        luma_max=0.16, qualite=80, poids_max_ko=1100,
        # la plaque fabriquée par tools/ciel mesure 0,14 : la nébulosité
        # compte, un fond d'étoiles nues descend à 0,02
        note='le fond du vide : plus sombre que la cuve (docs/ciel.md)',
    ),
    Famille(
        'fond étoilé', ('stars', 'stars-far'), taille=(1024, 1024), raccord_x=True, raccord_y=True,
        luma_max=0.08, qualite=80, poids_max_ko=120,
    ),
    Famille(
        'coque', ('hull',), cote_max=2048, raccord_x=True, luma_max=0.25, poids_max_ko=120,
        note='la bande de coque se répète à l’horizontale',
    ),
    Famille(
        'atlas des habillages', ('paroi-atlas',), taille=(4096, 2048), luma_max=0.30, qualite=80,
        poids_max_ko=1200, note='grille 4×2 de cases 1024² — le raccord se mesure case par case',
    ),
    Famille(
        'surface répétée',
        ('wall', 'wall-*', 'phile', 'phobe', 'froid', 'chaud', 'grille', 'tank-bg'),
        taille=(1024, 1024), raccord_x=True, raccord_y=True, luma_max=0.32, poids_max_ko=300,
    ),
    Famille(
        'éponge', ('sponge-*',), taille=(1024, 1024), raccord_x=True, raccord_y=True,
        luma_max=0.32, chaud_max=1.0, poids_max_ko=300, note='ocre par nature : la palette froide ne s’y applique pas',
    ),
    Famille(
        'iris du sas', ('iris',), taille=(1024, 1024), luma_max=0.32, chaud_max=0.5, poids_max_ko=300,
        note='centré, jamais répété ; ses veilleuses sont ambre',
    ),
    Famille(
        'plafond du reflet', ('plafond', 'plafond-*'), taille=(1024, 1024), luma_max=0.24,
        chaud_max=0.25, poids_max_ko=380, note='répété en miroir : pas de raccord à mesurer — la chaufferie est ambre',
    ),
    Famille(
        'planche de cinématique', ('cine/*',), taille=(1600, 900), luma_max=0.50, chaud_max=1.0,
        qualite=84, poids_max_ko=260,
        note='1600×900 paysage, marge sur les bords (docs/assets-ia.md §11) ; l’alerte rouge y a droit',
    ),
    Famille(
        'planche de vues', ('*-anime', 'meta-eclat', 'meta-icones'), alpha=True, cote_max=4096,
        poids_max_ko=600,
        # 4096 : le plancher de MAX_TEXTURE_SIZE sur les téléphones encore en
        # service — plus large, la bande ne se charge pas (render/planche.ts)
        note='une bande de vues côte à côte (tools/images/planche.py, docs/charte-visuelle.md §8)',
    ),
    Famille(
        'décalque',
        ('decal-*', 'fiole-*', 'serre-*', 'meta-*', 'sas-raccord*', 'zone-*', 'lampe-*'),
        alpha=True, cote_max=1600, luma_max=0.60, poids_max_ko=350,
        note='pièce détourée, bord transparent',
    ),
    Famille('emblème', ('badge',), taille=(512, 512), chaud_max=1.0, poids_max_ko=100),
    Famille('illustration', ('home', 'card-galerie'), cote_max=1800, luma_max=0.55, poids_max_ko=160),
]

FAMILLE_INCONNUE = Famille('(inconnue)', (), cote_max=1536, poids_max_ko=350)


def famille_de(nom: str) -> Famille:
    for f in FAMILLES:
        if f.accepte(nom):
            return f
    return FAMILLE_INCONNUE


# ---- les mesures -------------------------------------------------------------


def luminance(rgb: np.ndarray, alpha: np.ndarray | None = None) -> float:
    """Luma Rec. 709 moyenne, 0..1 — pondérée par l'alpha pour une pièce
    détourée (le vide autour ne compte pas)."""
    y = 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]
    if alpha is None:
        return float(y.mean())
    poids = alpha.sum()
    return float((y * alpha).sum() / poids) if poids > 0 else 0.0


def part_chaude(rgb: np.ndarray, alpha: np.ndarray | None = None) -> float:
    """La part des pixels CHAUDS : rouge dominant, nettement au-dessus du
    bleu, et assez saturés pour se voir. Un gris chaud ne compte pas."""
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    maxi = rgb.max(axis=-1)
    mini = rgb.min(axis=-1)
    sat = np.where(maxi > 0, (maxi - mini) / np.maximum(maxi, 1e-6), 0)
    chaud = (r > b * 1.35) & (r >= g) & (sat > 0.25) & (maxi > 0.15)
    if alpha is None:
        return float(chaud.mean())
    poids = alpha.sum()
    return float((chaud * alpha).sum() / poids) if poids > 0 else 0.0


def raccord(rgb: np.ndarray, axe: str) -> float:
    """Le rapport entre l'écart de la couture (première/dernière colonne, ou
    ligne) et l'écart moyen entre voisines dans l'image : 1 = la couture
    n'est pas plus marquée qu'un pas ordinaire."""
    a = rgb if axe == 'x' else np.transpose(rgb, (1, 0, 2))
    voisines = np.abs(a[:, 1:, :] - a[:, :-1, :]).mean()
    couture = np.abs(a[:, 0, :] - a[:, -1, :]).mean()
    # plancher d'un niveau sur 255 : un aplat quasi uniforme n'a pas de grain
    # à comparer, et diviserait par presque rien
    return float(couture / max(voisines, 1.0 / 255.0))


def bord_plein(alpha: np.ndarray) -> float:
    """La part du bord (un pixel d'épaisseur) qui n'est pas transparente."""
    bord = np.concatenate([alpha[0, :], alpha[-1, :], alpha[:, 0], alpha[:, -1]])
    return float((bord > 0.1).mean())


@dataclass
class Mesure:
    nom: str
    famille: Famille
    largeur: int
    hauteur: int
    alpha: bool
    luma: float
    chaud: float
    raccord_x: float | None
    raccord_y: float | None
    bord: float | None
    poids_ko: int
    defauts: list[str] = field(default_factory=list)


def a_de_l_alpha(img: Image.Image) -> bool:
    return img.mode in ('RGBA', 'LA', 'PA') or (img.mode == 'P' and 'transparency' in img.info)


def mesure(nom: str, img: Image.Image, poids_octets: int, fam: Famille, alpha_source: bool | None = None) -> Mesure:
    # `alpha_source` : le master avait-il une couche alpha ? Après conversion
    # en RGBA pour la livraison, l'image en a toujours une — c'est le master
    # qui dit la vérité
    a_alpha = a_de_l_alpha(img) if alpha_source is None else alpha_source
    im = img.convert('RGBA')
    arr = np.asarray(im, dtype=np.float32) / 255.0
    rgb = arr[..., :3]
    alpha = arr[..., 3] if a_alpha else None
    m = Mesure(
        nom=nom, famille=fam, largeur=im.width, hauteur=im.height, alpha=a_alpha,
        luma=luminance(rgb, alpha), chaud=part_chaude(rgb, alpha),
        raccord_x=raccord(rgb, 'x') if fam.raccord_x else None,
        raccord_y=raccord(rgb, 'y') if fam.raccord_y else None,
        bord=bord_plein(alpha) if (fam.alpha and alpha is not None) else None,
        poids_ko=round(poids_octets / 1024),
    )
    if fam.alpha and not a_alpha:
        m.defauts.append('pas de couche alpha : une pièce détourée en exige une')
    if m.bord is not None and m.bord > 0.05:
        m.defauts.append(f'bord plein à {m.bord:.0%} : la pièce est coupée par le cadre')
    if m.luma > fam.luma_max:
        m.defauts.append(f'luminance {m.luma:.2f} > {fam.luma_max:.2f} : trop clair pour sa place')
    chaud_max = CHAUD_MAX if fam.chaud_max is None else fam.chaud_max
    if m.chaud > chaud_max:
        m.defauts.append(f'{m.chaud:.0%} de pixels chauds > {chaud_max:.0%} : hors palette (ambre = veilleuses seulement)')
    if m.raccord_x is not None and m.raccord_x > RACCORD_MAX:
        m.defauts.append(f'raccord horizontal {m.raccord_x:.1f} > {RACCORD_MAX} : la couture se verra')
    if m.raccord_y is not None and m.raccord_y > RACCORD_MAX:
        m.defauts.append(f'raccord vertical {m.raccord_y:.1f} > {RACCORD_MAX} : la couture se verra')
    if m.poids_ko > fam.poids_max_ko:
        m.defauts.append(f'{m.poids_ko} Ko > {fam.poids_max_ko} Ko : trop lourd pour un téléphone')
    if fam.taille and abs(im.width / im.height - fam.taille[0] / fam.taille[1]) > 0.02 * (fam.taille[0] / fam.taille[1]):
        m.defauts.append(f'rapport {im.width}×{im.height} ≠ {fam.taille[0]}×{fam.taille[1]} attendu')
    return m


# ---- la fabrication ------------------------------------------------------------


def recadre_centre(img: Image.Image, rapport: float) -> Image.Image:
    w, h = img.size
    if w / h > rapport:
        nw = round(h * rapport)
        x = (w - nw) // 2
        return img.crop((x, 0, x + nw, h))
    nh = round(w / rapport)
    y = (h - nh) // 2
    return img.crop((0, y, w, y + nh))


def taille_de_sortie(img: Image.Image, fam: Famille) -> tuple[int, int]:
    if fam.taille:
        return fam.taille
    w, h = img.size
    if max(w, h) <= fam.cote_max:
        return (w, h)
    k = fam.cote_max / max(w, h)
    return (max(1, round(w * k)), max(1, round(h * k)))


def encode(img: Image.Image, chemin: str, qualite: int) -> int:
    """Écrit le WebP et rend son poids. method=6 : le plus lent, le plus
    petit — on ne fabrique pas soixante fois par seconde."""
    img.save(chemin, 'WEBP', quality=qualite, method=6)
    return os.path.getsize(chemin)


def fabrique(nom: str, chemin_master: str, dst: str, fam: Famille, recadre: bool, ecrit: bool) -> Mesure:
    img = Image.open(chemin_master)
    img.load()
    alpha_source = a_de_l_alpha(img)
    img = img.convert('RGBA' if (fam.alpha or alpha_source) else 'RGB')
    if fam.taille:
        rapport = fam.taille[0] / fam.taille[1]
        if abs(img.width / img.height - rapport) > 0.02 * rapport:
            if not recadre:
                m = mesure(nom, img, os.path.getsize(chemin_master), fam, alpha_source)
                m.defauts.append('→ passez --recadre pour un recadrage centré, ou refaites le master')
                return m
            img = recadre_centre(img, rapport)
    cible = taille_de_sortie(img, fam)
    if cible != img.size:
        img = img.resize(cible, Image.LANCZOS)
    sortie = os.path.join(dst, nom + '.webp')
    os.makedirs(os.path.dirname(sortie), exist_ok=True)
    if not ecrit:
        # la mesure porte sur ce qui SERAIT livré : la taille de sortie, mais
        # le poids ne se connaît qu'en encodant — on encode en mémoire
        import io

        tampon = io.BytesIO()
        img.save(tampon, 'WEBP', quality=fam.qualite, method=6)
        return mesure(nom, img, tampon.tell(), fam, alpha_source)
    # au-dessus du plafond de poids, on descend la qualité par pas de 4 —
    # jamais sous 60, où le WebP se met à baver sur les aplats sombres
    qualite = fam.qualite
    poids = encode(img, sortie, qualite)
    while poids > fam.poids_max_ko * 1024 and qualite > 60:
        qualite -= 4
        poids = encode(img, sortie, qualite)
    m = mesure(nom, img, poids, fam, alpha_source)
    if qualite != fam.qualite:
        m.defauts = [d for d in m.defauts if 'trop lourd' not in d]
        m.defauts.append(f'qualité descendue à {qualite} pour tenir sous {fam.poids_max_ko} Ko')
    return m


# ---- le rapport ------------------------------------------------------------------


def ligne(m: Mesure) -> str:
    def f(v: float | None) -> str:
        return '   —' if v is None else f'{v:4.1f}'

    bord = '  —' if m.bord is None else f'{m.bord:3.0%}'
    return (
        f'{m.nom:<28} {m.famille.nom:<22} {m.largeur:>5}×{m.hauteur:<5} '
        f'{m.luma:5.2f} {m.chaud:5.0%} {f(m.raccord_x)} {f(m.raccord_y)} {bord} {m.poids_ko:>5} Ko'
    )


ENTETE = (
    f'{"image":<28} {"famille":<22} {"taille":<11} {"luma":>5} {"chaud":>5} {"rac.x":>4} {"rac.y":>4} {"bord":>4} {"poids":>8}'
)


def rapporte(mesures: Iterable[Mesure]) -> int:
    print(ENTETE)
    print('-' * len(ENTETE))
    fautifs = 0
    for m in mesures:
        print(ligne(m))
        for d in m.defauts:
            print(f'{"":<28} ✗ {d}')
        if m.defauts:
            fautifs += 1
    return fautifs


def noms_relatifs(racine: str) -> list[str]:
    out: list[str] = []
    for dossier, _, fichiers in os.walk(racine):
        for fic in fichiers:
            base, ext = os.path.splitext(fic)
            if ext.lower() in EXTENSIONS:
                rel = os.path.relpath(os.path.join(dossier, base), racine)
                out.append(rel.replace(os.sep, '/'))
    return sorted(out)


def chemin_master(src: str, nom: str) -> str | None:
    for ext in EXTENSIONS:
        p = os.path.join(src, nom + ext)
        if os.path.exists(p):
            return p
    return None


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('noms', nargs='*', help='les masters à préparer (sans extension) ; rien = tous')
    ap.add_argument('--audit', action='store_true', help='mesure public/assets/ tel quel, sans master')
    ap.add_argument('--verifie', action='store_true', help='mesure les masters sans écrire')
    ap.add_argument('--recadre', action='store_true', help='recadrage centré si le rapport ne correspond pas')
    ap.add_argument('--depuis', default=SRC, help='le dossier des masters (défaut : masters/images/)')
    ap.add_argument('--vers', default=DST, help='le dossier livré (défaut : public/assets/)')
    args = ap.parse_args(argv)
    src, dst = args.depuis, args.vers

    if args.audit:
        mesures = []
        for nom in noms_relatifs(dst):
            chemin = os.path.join(dst, nom + '.webp')
            if not os.path.exists(chemin):
                continue
            img = Image.open(chemin)
            img.load()
            mesures.append(mesure(nom, img, os.path.getsize(chemin), famille_de(nom)))
        fautifs = rapporte(mesures)
        print(f'\n{len(mesures)} images, {fautifs} hors mesure.')
        return 0

    noms = args.noms or (noms_relatifs(src) if os.path.isdir(src) else [])
    if not noms:
        print(f'Aucun master dans {src} — déposez-y les sources (masters/images/LISEZ-MOI.md).')
        return 1
    mesures = []
    for nom in noms:
        chemin = chemin_master(src, nom)
        if not chemin:
            print(f'✗ {nom} : aucun master dans masters/images/')
            return 1
        fam = famille_de(nom)
        if fam is FAMILLE_INCONNUE:
            print(f'· {nom} : famille inconnue — ajoutez-la dans FAMILLES (mesures par défaut)')
        mesures.append(fabrique(nom, chemin, dst, fam, args.recadre, ecrit=not args.verifie))
    fautifs = rapporte(mesures)
    verbe = 'mesurée' if args.verifie else 'livrée'
    print(f'\n{len(mesures)} image{"s" if len(mesures) > 1 else ""} {verbe}{"s" if len(mesures) > 1 else ""}, {fautifs} hors mesure.')
    return 1 if fautifs else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
