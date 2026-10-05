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


def ecrit(nom: str, a: np.ndarray, echelle: float = ECHELLE) -> None:
    mode = 'RGBA' if a.shape[2] == 4 else 'RGB'
    im = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8), mode)
    if echelle != 1:
        im = im.resize((max(1, round(im.width * echelle)), max(1, round(im.height * echelle))), Image.LANCZOS)
    out = SORTIE / f'coque2d-{nom}.webp'
    im.save(out, 'WEBP', quality=86, method=6)
    print(f'  {nom} : {im.width}×{im.height}, {out.stat().st_size // 1024} Ko')


def raccorde(a: np.ndarray, b: int = 48, sens: int = 2) -> np.ndarray:
    """Rend une tôle VRAIMENT raccordable : le générateur promet le raccord
    mais le rate souvent en haut/bas (tôles du 02/10 : écart au bord 8 à 20
    fois celui de deux lignes voisines, une couture visible à chaque rangée).
    Les b dernières lignes (puis colonnes) sont fondues dans les b premières ;
    l'image perd b pixels par axe traité et devient périodique. sens=1 : à gauche
    et à droite seulement (une tranche du cylindre a ses rebords en haut et
    en bas, qui ne se répètent pas)."""
    if sens == 1:
        a = a.transpose(1, 0, 2)
    for _ in range(sens):
        h = a.shape[0]
        w = np.linspace(0, 1, b)[:, None, None]
        tete = a[h - b:] * (1 - w) + a[:b] * w
        a = np.concatenate([tete, a[b:h - b]], axis=0)
        a = a.transpose(1, 0, 2)
    return a


def boucle(t: np.ndarray, avant: np.ndarray) -> np.ndarray:
    """Rend t répétable SANS décaler sa coupe : ses len(avant) dernières
    lignes se fondent dans `avant`, les lignes qui précèdent son début dans
    l'image d'origine. Son premier pixel reste la ligne de coupe — raccorde,
    qui fondait la fin dans le début, la décalait, et la jonction avec la
    pièce voisine faisait couture (relecture du 06/10)."""
    b = len(avant)
    w = np.linspace(0, 1, b)[:, None, None]
    t = t.copy()
    t[-b:] = t[-b:] * (1 - w) + avant * w
    return t


def amorce(t: np.ndarray, suite: np.ndarray) -> np.ndarray:
    """L'inverse, pour la pièce qui suit une pièce bouclée : ses premières
    lignes partent de `suite` (ce qui suit la fin bouclée dans l'image
    d'origine) et se fondent vers les siennes."""
    b = len(suite)
    w = np.linspace(0, 1, b)[:, None, None]
    t = t.copy()
    t[:b] = suite * (1 - w) + t[:b] * w
    return t


def neuf(prefixe: str, a: np.ndarray, haut: int, bande: int, bas: int, g: int = 200, d: int = 830, b: int = 24, debut_bas: int | None = None) -> None:
    """Neuf morceaux : trois lignes (haut, bande répétée en hauteur, bas) et
    trois colonnes (bord gauche et son arc, cœur répété en largeur, bord
    droit). Les quatre jonctions se raccordent, miroir du cœur compris : le
    bout bouclé d'un morceau répété retombe sur la ligne qui précède sa
    coupe, et le morceau suivant part de celle qui la suit. debut_bas : le bas
    peut commencer plus loin que la fin de la bande (les tranches sautent
    une étagère, 703–1281)."""
    T = lambda x: x.transpose(1, 0, 2)
    lignes = {
        'haut': a[:haut],
        'bande': boucle(a[haut:bande], a[haut - b:haut]),
        'bas': amorce(a[bande if debut_bas is None else debut_bas:bas], a[haut:haut + b]),
    }
    for nl, l in lignes.items():
        ecrit(f'{prefixe}-{nl}-g', l[:, :g], 1)
        ecrit(f'{prefixe}-{nl}-m', T(boucle(T(l[:, g:d]), T(l[:, g - 2 * b:g]))), 1)
        ecrit(f'{prefixe}-{nl}-d', T(amorce(T(l[:, d:]), T(l[:, g:g + 2 * b]))), 1)


def sombre(a: np.ndarray, k: float) -> np.ndarray:
    b = a.copy()
    b[..., :3] *= k
    return b


def cellule(source: str = 'cellule', prefixe: str = 'cellule', capsule: bool = False) -> None:
    """capsule : la capsule de culture de la serre, détourée (fond
    transparent) — pas de cadre rectangulaire à l'ambre, et la croix de la
    salle fermée tenue dans le vitrage."""
    a = lit(source)
    if capsule:
        r = detoure(a, rogne=True)
        a, alpha = r[..., :3], r[..., 3:]
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
        if capsule:
            im.putalpha(Image.fromarray((alpha[..., 0] * 255).astype(np.uint8)))
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
            if etat == 'ambre' and not capsule:
                d.rectangle((6, 6, w - 7, h - 7), outline=col + (200,), width=14)
        if etat == 'ferme':
            x0, y0, x1, y1 = (0.15 * w, 0.22 * h, 0.85 * w, 0.78 * h) if capsule else (60, 60, w - 60, h - 60)
            d.line((x0, y0, x1, y1), fill=(130, 55, 48, 255), width=26)
            d.line((x0, y1, x1, y0), fill=(130, 55, 48, 255), width=26)
        ecrit(f'{prefixe}-{etat}', np.asarray(im).astype(float) / 255)


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


def serre() -> None:
    """LA SERRE EN CYLINDRE DE CULTURE (05/10) : des tranches vitrées répétées
    sur la longueur, un anneau à chaque jonction, un dôme à chaque bout, un
    berceau de machines dessous, des capsules pour la mini-carte.

    · LES TRANCHES ET L'ANNEAU EN TROIS MORCEAUX, haut, bande, bas : la bande
      se répète en hauteur. Étirée d'un bloc à la hauteur du module (~3
      salles), une tranche n'avait que ~400 px par largeur de salle — floue
      dès qu'on zoomait sur la salle, au Steam Deck surtout (06/10). Les deux
      tranches partagent leurs étagères aux lignes 429, 703 et 1281 : la
      bande 429–703 se répète, les étagères restent alignées d'une tranche à
      l'autre. L'anneau : son chapeau et sa lampe (0–775), un module de
      plaques (775–1035), son pied.
    · EN PLEINE RÉSOLUTION (pas les 80 % des autres pièces) : posées à
      deux bandes par étagère d'origine, elles donnent ~1000 px par salle."""
    for n in ('tranche', 'tranche-2'):
        a = raccorde(lit(f'serre-{n}'), sens=1)
        # la rampe de culture, en haut du vitrage : trois fois plus claire que
        # le reste de l'image, elle ferait un néon continu sur tout le module
        y = np.arange(a.shape[0])[:, None, None] / a.shape[0]
        a = sombre(a * (1 - 0.3 * np.exp(-(((y - 0.145) / 0.03) ** 2))), 0.9)
        # en neuf morceaux : la bande d'étagère répétée en hauteur, le cœur en
        # largeur — à pleine finesse, d'un bloc, la tranche faisait des
        # capsules étroites et hautes, neuf anneaux au lieu de quatre (06/10)
        neuf(f'serre-{n}', a, 429, 703, a.shape[0], d=820, debut_bas=1281)
    # LES ZONES (06/10) : une capsule entière par thème le long du cylindre,
    # pour varier dans la longueur au lieu de répéter. Leur gabarit n'est pas
    # celui des tranches (bacs aux lignes 424 et 871, rebord haut plus fin,
    # rebord bas jusqu'à 1440) : neuf morceaux propres, les mêmes colonnes
    for z in ('algues', 'champignons'):
        neuf(f'serre-zone-{z}', sombre(raccorde(lit(f'serre-zone-{z}'), sens=1), 0.85), 424, 871, 1440)
    # LES ÉTAGÈRES DE RECHANGE : une étagère (bacs toutes les 323 lignes),
    # raccordée dans les deux sens — elles remplacent au hasard la bande du
    # cœur des capsules du jardin d'air, cinq étagères au lieu de deux
    for e in ('1', '3'):
        t = lit(f'serre-etageres-{e}')[247:571]
        t = raccorde(raccorde(t.transpose(1, 0, 2), b=24, sens=1).transpose(1, 0, 2), sens=1)
        ecrit(f'serre-etagere-{e}', t, 1)
    # les pièces détourées, ramenées à la luminosité des tranches (~10 %)
    an = sombre(detoure(lit('serre-anneau')), 0.6)
    ys, xs = np.where(an[..., 3] > 0.5)
    an = an[:, xs.min():xs.max() + 1]
    ecrit('serre-anneau-haut', an[ys.min():775], 1)
    ecrit('serre-anneau-bande', boucle(an[775:1035], an[775 - 16:775]), 1)
    ecrit('serre-anneau-bas', amorce(an[1035:ys.max() + 1], an[775:775 + 16]), 1)
    for n in ('dome-gauche', 'dome-droit'):
        ecrit(f'serre-{n}', sombre(detoure(lit(f'serre-{n}')), 0.65))
    b = detoure(lit('serre-berceau'))
    ecrit('serre-berceau', sombre(raccorde(b, sens=1), 0.7))
    cellule('serre-capsule', 'serre-cellule', capsule=True)


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
    serre()
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
    # son collier d'entrée, l'anneau seul : posé à chaque bout de tube, il en
    # fait une conduite raccordée plutôt qu'un trait (aperçu du 05/10)
    ecrit('tube-collier', c[105:580, 60:145])


if __name__ == '__main__':
    main()
