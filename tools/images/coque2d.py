#!/usr/bin/env python3
"""LE MODULE EN 2D DE FACE — prépare les pièces de sa coque (assets-ia §35).

Les sources, déposées dans masters/images/coque2d/ (non versionné, comme les
autres masters) : la tôle (deux variantes), les bords haut et bas, les deux
bouts, la baie, la trappe, la machinerie, la cellule de la mini-carte, la
planche des équipements et le couloir. Le moteur les lit dans public/assets/coque2d-*.webp
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
· LA CELLULE, NEUTRE : ses états (jouée, joignable maintenant, plus loin,
  fermée) et l'icône de son nœud se peignent dans le moteur.
· LE CORPS DE CHAQUE BOUT, sans son collier : une bande prise en haut de
  l'image, qui se répète le long d'un bord vertical de n'importe quelle
  hauteur.

· LA CHAUFFERIE A SES PIÈCES (12/11) : elles ne sortent pas d'un générateur
  mais d'une scène Blender (tools/images/blender/chaud_biome.py) — voir chaud().

    python3 tools/images/coque2d.py            (tout)
    python3 tools/images/coque2d.py chaud      (les seules pièces de la chaufferie)
    python3 tools/images/coque2d.py serre      (le cylindre de culture)
    python3 tools/images/coque2d.py tempere    (tout le reste)
"""

import sys

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
    """La cellule NEUTRE, seule : l'état (jouée, joignable, fermée), son
    liseré et l'icône de son nœud se peignent dans le moteur
    (render/module2dCanvas.ts, peintCellule) — les quatre images d'état
    précalculées portaient leurs lampes en aplats ovales et ne disaient rien
    du nœud (10/11).

    capsule : la capsule de culture de la serre, détourée (fond transparent)."""
    a = lit(source)
    im = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).convert('RGBA')
    if capsule:
        r = detoure(a, rogne=True)
        im = Image.fromarray((np.clip(r[..., :3], 0, 1) * 255).astype(np.uint8)).convert('RGBA')
        im.putalpha(Image.fromarray((r[..., 3] * 255).astype(np.uint8)))
    ecrit(f'{prefixe}-neutre', np.asarray(im).astype(float) / 255)


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


# le dôme rendu fait 2457 × 3072, livré aux trois quarts ; son débord doit
# valoir 0,655 hauteur
DOME_SERRE = 0.834


def serre() -> None:
    """LA SERRE ORBITALE (12/11) : le cylindre de culture, refait dans Blender
    (tools/images/blender/serre.py) — des bandes qui s'empilent dans n'importe
    quel ordre, plantées chacune par un tirage, une sur trois avec sa
    passerelle et son poste de travail ; la cloison et son échelle ; le
    berceau, les dômes, la capsule de la mini-carte.

    · LES BANDES TELLES QUE RENDUES, à 1536 px par salle (3072 × 411) : elles
      se raccordent à gauche et à droite par construction. À 1024, le tableau
      en plein écran les agrandissait près de deux fois (12/11).
    · LA COQUE ASSOMBRIE à la luminance des pièces remplacées (tranche 0,097,
      anneau 0,095 — mesuré le 12/11 ; le berceau un cran dessous), pour que la salle et
      les capsules restent ce qui se lit en premier.
    · LA CLOISON EN TROIS MORCEAUX, au gabarit de l'ancien anneau : sa tête
      (1148 lignes), une bande d'échelle répétée (390 : quatre barreaux), son
      pied et sa porte.
    · LES DÔMES RESSERRÉS en largeur : rendus à 0,785 fois leur hauteur, ils
      débordent de 0,655 dans le moteur (render/module2d.ts, CYL_DOME)."""
    for n, k in (('haut', 0.8), ('bas', 0.75), ('bande-feuillus', 0.8), ('bande-fougeres', 0.8), ('bande-aromates', 0.75),
                 ('bande-mixte', 0.8), ('bande-semis', 0.8), ('bande-algues', 0.6), ('poste-analyse', 0.75),
                 ('poste-nutriments', 0.75), ('poste-semis', 0.72)):
        ecrit(f'serre-{n}', affine(sombre(lit(f'serre-{n}'), k)), 1)
    an = affine(sombre(lit('serre-anneau'), 0.78))
    ecrit('serre-anneau-haut', an[:1148], 1)
    ecrit('serre-anneau-bande', boucle(an[1148:1538], an[1148 - 24:1148]), 1)
    ecrit('serre-anneau-bas', amorce(an[1538:], an[1148:1148 + 24]), 1)
    for n in ('dome-gauche', 'dome-droit'):
        d = Image.fromarray((np.clip(lit_alpha(f'serre-{n}'), 0, 1) * 255).astype(np.uint8), 'RGBA')
        d = d.resize((round(d.width * 0.75 * DOME_SERRE), round(d.height * 0.75)), Image.LANCZOS)
        ecrit(f'serre-{n}', affine(np.asarray(d).astype(float) / 255), 1)
    ecrit('serre-berceau', affine(sombre(lit_alpha('serre-berceau'), 0.72)), 1)
    # la capsule de la mini-carte reste petite à l'écran : 1024 de large
    ecrit('serre-cellule-neutre', lit_alpha('serre-cellule'), 1024 / 1536)


# LA CHAUFFERIE — douze pièces rendues dans Blender, toutes à la même caméra
# de face. D'abord rendues à 1024 px par largeur de salle et ramenées à 853
# (l'échelle livrée des tempérées) ; le tableau en plein écran — une salle sur
# ~1900 px — les agrandissait alors plus de deux fois, « pas net du tout »
# (12/11). Elles sont rendues à 1536 px par salle et livrées TELLES QUELLES :
# le moteur connaît leur échelle (module2dCanvas.ts, JEUX, echelle).
PX_BLENDER = 1536
PX_LIVRE = 1536
# la tôle sort de Blender à 0,135 de luminance ; la tôle tempérée LIVRÉE
# mesure 0,085 (12/11) — la coque ne doit pas passer devant la salle
SOMBRE_CHAUD = 0.63


def lit_alpha(nom: str) -> np.ndarray:
    """Une pièce détourée PAR SON RENDU (film transparent) : le remplissage du
    noir depuis les bords mordrait le dessous des fûts, presque noir."""
    return np.asarray(Image.open(SOURCES / 'alpha' / f'{nom}.png').convert('RGBA')).astype(float) / 255


def sombre_sauf_braise(a: np.ndarray, k: float) -> np.ndarray:
    """Assombrit la coque SANS éteindre ce qui luit : une résistance ou une
    veilleuse (clair ET chaud) garde son éclat, le fondu entre les deux est
    continu — un seuil net cernerait chaque barreau."""
    rgb = a[..., :3]
    clair = np.clip((rgb.max(2) - 0.45) / 0.25, 0, 1)
    chaud = np.clip((rgb[..., 0] - rgb[..., 2] - 0.15) / 0.2, 0, 1)
    b = a.copy()
    b[..., :3] *= (k + (1 - k) * clair * chaud)[..., None]
    return b


def affine(a: np.ndarray, force: int = 70) -> np.ndarray:
    """Accentue les arêtes (masque flou, rayon 1,2 px) : un rendu Blender est
    plus doux qu'une peinture — trois à quatre fois moins de contraste local
    que les pièces générées, mesuré le 12/11. La couche alpha n'y passe pas."""
    im = Image.fromarray((np.clip(a[..., :3], 0, 1) * 255).astype(np.uint8), 'RGB').filter(ImageFilter.UnsharpMask(radius=1.2, percent=force, threshold=1))
    b = a.copy()
    b[..., :3] = np.asarray(im).astype(float) / 255
    return b


def reduit(a: np.ndarray, boucle_x: bool = False, boucle_y: bool = False) -> np.ndarray:
    """De 1024 à 853 px par salle. Une pièce qui se répète est réduite ENTRE
    DEUX COPIES d'elle-même, puis recoupée : réduite seule, le filtre lisait
    son bord comme une fin d'image, et la couture revenait."""
    if PX_LIVRE == PX_BLENDER:
        return affine(a)
    h, w = a.shape[:2]
    nh, nw = round(h * PX_LIVRE / PX_BLENDER), round(w * PX_LIVRE / PX_BLENDER)
    t = np.tile(a, (3 if boucle_y else 1, 3 if boucle_x else 1, 1))
    mode = 'RGBA' if a.shape[2] == 4 else 'RGB'
    im = Image.fromarray((np.clip(t, 0, 1) * 255).astype(np.uint8), mode)
    im = im.resize((nw * (3 if boucle_x else 1), nh * (3 if boucle_y else 1)), Image.LANCZOS)
    r = np.asarray(im).astype(float) / 255
    return r[(nh if boucle_y else 0):(2 * nh if boucle_y else nh), (nw if boucle_x else 0):(2 * nw if boucle_x else nw)]


def chaud() -> None:
    """LES PIÈCES DE LA CHAUFFERIE. Sources : chaud-<pièce>.png (les tôles,
    opaques) et alpha/chaud-<pièce>.png (le reste, détouré par le rendu),
    sorties de chaud_biome.py. Ni raccorde() ni detoure() : les tôles et les
    bords se raccordent par construction (rendus au milieu de leurs copies)."""
    b = 'chaud-'
    # la salle des machines, un cran plus sombre que le reste de la coque,
    # comme la tempérée (0,057 contre 0,085, mesuré le 12/11)
    for n, k in (('tole', 1), ('tole-2', 1), ('tole-machines', 0.7)):
        ecrit(b + n, reduit(sombre_sauf_braise(lit(b + n), SOMBRE_CHAUD * k), True, True), 1)
    for n in ('bord-haut', 'bord-bas'):
        ecrit(b + n, reduit(sombre_sauf_braise(lit_alpha(b + n), SOMBRE_CHAUD), boucle_x=True), 1)
    for n in ('bout-gauche', 'bout-droit', 'baie', 'baie-2', 'colonne', 'trappe', 'machinerie'):
        ecrit(b + n, reduit(sombre_sauf_braise(lit_alpha(b + n), SOMBRE_CHAUD)), 1)


def tempere() -> None:
    """Tout ce qui n'est pas la chaufferie : le module tempéré, la serre, les
    équipements, les détails, le tube."""
    b = 'tempere-'
    for n in ('tole', 'tole-2', 'tole-machines'):
        ecrit(f'{b}{n}', sombre(raccorde(lit(b + n)), SOMBRE_COQUE))
    # les bords et les bouts ; les coins et les angles rentrants ne se livrent
    # plus — peints à d'autres échelles que les bords, ils ne s'y raccordaient
    # pas : le moteur dessine un gousset à chaque sommet (module2dCanvas.ts)
    for n in ('bord-haut', 'bord-bas', 'bout-gauche', 'bout-droit'):
        ecrit(f'{b}{n}', sombre(detoure(lit(b + n)), SOMBRE_COQUE))
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
    # son collier d'entrée, l'anneau seul : posé à chaque bout de tube, il en
    # fait une conduite raccordée plutôt qu'un trait (aperçu du 05/10)
    ecrit('tube-collier', c[105:580, 60:145])


def main() -> None:
    quoi = sys.argv[1:]
    if not quoi or 'tempere' in quoi:
        tempere()
    if not quoi or 'chaud' in quoi:
        chaud()
    if not quoi or 'serre' in quoi:
        serre()


if __name__ == '__main__':
    main()
