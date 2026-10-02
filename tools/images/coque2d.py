#!/usr/bin/env python3
"""LE MODULE EN 2D DE FACE — prépare les pièces de sa coque (assets-ia §35).

Les sources, déposées dans masters/images/coque2d/ (non versionné, comme les
autres masters) : la tôle (deux variantes), les bords haut et bas, les deux
bouts, les quatre coins, les deux angles rentrants, la baie, la trappe, la
machinerie, la cellule de la mini-carte, la planche des équipements et le
couloir. Le moteur les lit dans public/assets/coque2d-*.webp
(render/module2d.ts, render/module2dCanvas.ts).

· TOUT À 80 % : les sources font 1024 à 1536 px. La moitié suffisait au
  zoom de jeu, mais près de la salle, zoomé, le décor était flou (aperçu du
  02/10) : la toile proche (render/module2d.ts, DENSITE_PROCHE) demande
  ~850 px par largeur de salle, soit 80 % des sources.
· LE NOIR DÉTOURÉ PAR REMPLISSAGE depuis les bords de l'image : un seuil de
  luminance rendait transparentes les zones sombres de la coque elle-même
  (maquette du 01/10 : la machinerie « fantôme »).
· LA COQUE ASSOMBRIE d'un quart : la salle jouée et les cellules doivent
  rester ce qui se lit en premier (maquette v0).
· LA CELLULE EN QUATRE ÉTATS, précalculés : jouée (grise), joignable
  maintenant (ambre, lampes allumées), joignable plus loin (bleue), fermée
  (éteinte, croix) — le moteur n'a qu'à choisir l'image ; et neutre, celle
  qui grossit jusqu'à la salle pendant la transition.
· LE CORPS DE CHAQUE BOUT, sans son collier : une bande prise en haut de
  l'image, qui se répète le long d'un bord vertical de n'importe quelle
  hauteur.

    python3 tools/images/coque2d.py
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

RACINE = Path(__file__).resolve().parents[2]
SOURCES = RACINE / 'masters/images/coque2d'
SORTIE = RACINE / 'public/assets'
ECHELLE = 0.8
SOMBRE_COQUE = 0.72
SOMBRE_EQUIPEMENT = 0.8


def lit(nom: str) -> np.ndarray:
    src = next(SOURCES / f'{nom}{e}' for e in ('.png', '.webp') if (SOURCES / f'{nom}{e}').exists())
    return np.asarray(Image.open(src).convert('RGB')).astype(float) / 255


def detoure(a: np.ndarray, rogne: bool = False) -> np.ndarray:
    """RGBA : le noir relié aux bords de l'image devient transparent."""
    m = Image.fromarray(((a.max(2) >= 0.06) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))
    h, w = a.shape[:2]
    for p in [(x, y) for x in (0, w // 2, w - 1) for y in (0, h // 2, h - 1)]:
        if m.getpixel(p) == 0:
            ImageDraw.floodfill(m, p, 128)
    dedans = (np.asarray(m) != 128).astype(np.uint8) * 255
    al = np.asarray(Image.fromarray(dedans).filter(ImageFilter.GaussianBlur(1))).astype(float) / 255
    rgba = np.dstack([a, al])
    if rogne:
        ys, xs = np.where(al > 0.5)
        rgba = rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    return rgba


def ecrit(nom: str, a: np.ndarray) -> None:
    mode = 'RGBA' if a.shape[2] == 4 else 'RGB'
    im = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8), mode)
    im = im.resize((max(1, round(im.width * ECHELLE)), max(1, round(im.height * ECHELLE))), Image.LANCZOS)
    out = SORTIE / f'coque2d-{nom}.webp'
    im.save(out, 'WEBP', quality=86, method=6)
    print(f'  {nom} : {im.width}×{im.height}, {out.stat().st_size // 1024} Ko')


def raccorde(a: np.ndarray, b: int = 48) -> np.ndarray:
    """Rend une tôle VRAIMENT raccordable : le générateur promet le raccord
    mais le rate souvent en haut/bas (tôles du 02/10 : écart au bord 8 à 20
    fois celui de deux lignes voisines, une couture visible à chaque rangée).
    Les b dernières lignes (puis colonnes) sont fondues dans les b premières ;
    l'image perd b pixels par côté et devient périodique."""
    for _ in range(2):
        h = a.shape[0]
        w = np.linspace(0, 1, b)[:, None, None]
        tete = a[h - b:] * (1 - w) + a[:b] * w
        a = np.concatenate([tete, a[b:h - b]], axis=0)
        a = a.transpose(1, 0, 2)
    return a


def sombre(a: np.ndarray, k: float) -> np.ndarray:
    b = a.copy()
    b[..., :3] *= k
    return b


def cellule() -> None:
    a = lit('cellule')
    gris = a.mean(2, keepdims=True)
    h, w = a.shape[:2]
    for etat in ('joue', 'ambre', 'bleu', 'ferme', 'neutre'):
        if etat == 'neutre':
            # celle qui grossit jusqu'à la salle pendant la transition : ses
            # lampes allumées, à cette taille, faisaient deux taches orange
            c = a
        elif etat == 'joue':
            c = (gris * 0.9 + a * 0.1) * 0.95
        elif etat == 'ferme':
            c = np.repeat(gris * 0.35, 3, axis=2)
        elif etat == 'ambre':
            c = a * 1.25 + np.array([0.16, 0.09, 0.02]) * (gris / 0.24)
        else:
            c = a * 1.05 + np.array([0, 0.04, 0.09]) * (gris / 0.24)
        im = Image.fromarray((np.clip(c, 0, 1) * 255).astype(np.uint8)).convert('RGBA')
        d = ImageDraw.Draw(im)
        if etat in ('ambre', 'bleu'):
            # les deux lampes du cadre (x 23,5 % et 76,5 %, y 5,5 %) s'allument
            col = (255, 170, 70) if etat == 'ambre' else (110, 190, 240)
            halo = Image.new('RGBA', im.size, (0, 0, 0, 0))
            dh = ImageDraw.Draw(halo)
            for fx in (0.235, 0.765):
                cx, cy = fx * w, 0.055 * h
                dh.ellipse((cx - w * 0.07, cy - h * 0.05, cx + w * 0.07, cy + h * 0.05), fill=col + (255,))
            im.alpha_composite(halo.filter(ImageFilter.GaussianBlur(12)))
            im.alpha_composite(halo.filter(ImageFilter.GaussianBlur(4)))
            if etat == 'ambre':
                d.rectangle((6, 6, w - 7, h - 7), outline=col + (200,), width=14)
        if etat == 'ferme':
            d.line((60, 60, w - 60, h - 60), fill=(130, 55, 48, 255), width=26)
            d.line((60, h - 60, w - 60, 60), fill=(130, 55, 48, 255), width=26)
        ecrit(f'cellule-{etat}', np.asarray(im).astype(float) / 255)


# la planche des équipements (livrée le 01/10, 1536 × 1024) : chaque élément
# dans sa boîte, mesurée sur l'image
EQUIPEMENTS = {
    'grand-solaire': (26, 43, 596, 500),
    'petit-solaire': (641, 106, 977, 444),
    'antenne': (1048, 27, 1512, 487),
    'mat': (95, 485, 377, 992),
    'radiateur': (440, 562, 952, 968),
    'reservoir': (1018, 668, 1523, 919),
}


# la planche des petits détails (livrée le 02/10, 1536 × 1024) : une case
# large par détail — le détourage rogne au détail lui-même
DETAILS = {
    'panneau': (40, 40, 500, 520),
    'reparation': (530, 40, 1030, 520),
    'vanne': (1080, 10, 1530, 530),
    'grille': (40, 545, 500, 1010),
    'cuve': (510, 545, 1040, 1000),
    'aerations': (1050, 545, 1530, 1000),
}


def main() -> None:
    b = 'tempere-'
    for n in ('tole', 'tole-2', 'tole-machines'):
        ecrit(f'{b}{n}', sombre(raccorde(lit(b + n)), SOMBRE_COQUE))
    for n in ('bord-haut', 'bord-bas', 'bout-gauche', 'bout-droit', 'coin-haut-gauche', 'coin-bas-gauche',
              'coin-bas-droit', 'rentrant-haut', 'rentrant-bas'):
        ecrit(f'{b}{n}', sombre(detoure(lit(b + n)), SOMBRE_COQUE))
    # le coin haut-droit : le haut-gauche en miroir (le générateur a rendu
    # deux fois le même coin)
    ecrit(f'{b}coin-haut-droit', sombre(detoure(lit(b + 'coin-haut-gauche')[:, ::-1]), SOMBRE_COQUE))
    for n in ('baie', 'baie-2', 'colonne', 'trappe', 'machinerie'):
        ecrit(f'{b}{n}', sombre(detoure(lit(b + n), rogne=True), SOMBRE_COQUE))
    cellule()
    planche = lit('equipements')
    for n, (x0, y0, x1, y1) in EQUIPEMENTS.items():
        ecrit(f'equipement-{n}', sombre(detoure(planche[y0:y1, x0:x1], rogne=True), SOMBRE_EQUIPEMENT))
    planche = lit('details')
    for n, (x0, y0, x1, y1) in DETAILS.items():
        # un cran plus sombres que la coque : posés dessus, leurs liserés bleus
        # ressortaient plus que la tôle autour (rendu du 02/10)
        ecrit(f'detail-{n}', sombre(detoure(planche[y0:y1, x0:x1], rogne=True), SOMBRE_COQUE * 0.85))
    # le tube : la bande du couloir, sans ses colliers d'extrémité
    c = lit('couloir')
    h = c.shape[0]
    ecrit('tube', c[round(0.172 * h):round(0.787 * h), 150:-150])


if __name__ == '__main__':
    main()
