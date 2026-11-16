"""LE RELIEF DANS L'ALPHA (14/11, chantier « volume des parois ») — monte une
surface rendue par l'atelier en une image RGBA : la couleur sous la lumière
neutre, et dans l'alpha la HAUTEUR du point (blanc = le plus haut), pour que
le shader éclaire rivets, tôles et joints selon les lampes du jeu. Aucune
unité de texture n'était libre : le relief voyage dans la couche alpha de
l'image de couleur, qui était opaque. Ce n'est PAS une transparence
(prepare.py, famille « relief »).

La passe de relief de Blender (chaud_biome.py, rend_relief) écrit
l'élévation vraie, en largeurs de salle, dans un .npy à côté de la couleur.
L'alpha n'a que 256 niveaux : l'étendue entière ne tient pas — sur le mur,
le fond des joints est à 22 mm sous la tôle et un rivet n'en dépasse que de
2,4 ; à l'échelle des joints, le rivet n'aurait que 25 niveaux, et le
biseau des plaques presque rien. Le fond des joints est noir sous toute
lampe : sa profondeur n'apporte rien. La fenêtre va donc du point le plus
haut jusqu'à PLANCHER sous la face dominante (la médiane, pondérée par
l'aire : la tôle, la cire, l'émail) ; plus bas, c'est plat. Un joint reste
une marche franche de PLANCHER.

Chaque surface a sa fenêtre : la `profondeur` (en largeurs de salle) que
l'alpha 0 → 1 représente est écrite par ce script et dans
docs/assets-ia.md §37 — c'est elle qui donne la vraie pente au shader.

usage (hors de Blender, Python avec pillow et numpy) :
    python -I tools/images/blender/relief.py <rendus> masters/images wall wall-a phile phobe
(avec le mur et les deux matières, il écrit aussi legende-surfaces.png)
"""
import os
import sys

import numpy as np

# 6 mm sous la face dominante, à l'échelle de la salle : un joint de l'atelier
# (JEU = 6 mm de large) se lit comme une rainure aussi profonde que large
PLANCHER = 0.006


def fenetre(e):
    """(bas, haut) de la fenêtre d'élévation que l'alpha couvre"""
    haut = float(e.max())
    bas = max(float(e.min()), float(np.median(e)) - PLANCHER)
    return bas, haut


def alpha_de(e):
    """l'alpha (0..255) et la profondeur qu'il représente"""
    bas, haut = fenetre(e)
    prof = max(haut - bas, 1e-6)
    a = np.clip((e - bas) / prof, 0, 1)
    return np.round(a * 255).astype(np.uint8), prof


def monte(dossier, nom):
    """l'image RGBA de la surface `nom` et sa profondeur"""
    from PIL import Image
    c = Image.open(os.path.join(dossier, nom + '.png')).convert('RGB')
    e = np.load(os.path.join(dossier, 'relief', nom + '.npy'))
    if e.shape != (c.height, c.width):
        raise ValueError(f'{nom} : relief {e.shape} ≠ couleur {c.size}')
    a, prof = alpha_de(e)
    im = c.convert('RGBA')
    im.putalpha(Image.fromarray(a, 'L'))
    return im, prof


# LA LÉGENDE (index.html, .lg-sw) montrait le mur et les deux matières en
# fond CSS : un alpha de relief s'y lit en transparence (la cire est presque
# à 0, sous ses gouttes). Elle reçoit sa planche opaque : chaque surface
# entière, réduite à 72 px (la pastille fait 36 px, ×2 pour les écrans fins)
LEGENDE = ('wall', 'phile', 'phobe')


def legende(dossier, sortie, cote=72):
    from PIL import Image
    planche = Image.new('RGB', (cote * len(LEGENDE), cote))
    for i, nom in enumerate(LEGENDE):
        c = Image.open(os.path.join(dossier, nom + '.png')).convert('RGB')
        planche.paste(c.resize((cote, cote), Image.LANCZOS), (i * cote, 0))
    planche.save(os.path.join(sortie, 'legende-surfaces.png'))


if __name__ == '__main__':
    dossier, sortie = sys.argv[1], sys.argv[2]
    os.makedirs(sortie, exist_ok=True)
    for nom in sys.argv[3:]:
        im, prof = monte(dossier, nom)
        im.save(os.path.join(sortie, nom + '.png'))
        print(f'{nom:<16} profondeur {prof:.4f} salle ({prof * 1024:.1f} px à 1024 px par salle)')
    if all(n in sys.argv[3:] for n in LEGENDE):
        legende(dossier, sortie)
