#!/usr/bin/env python3
"""
LA PLANCHE DE VUES — fabrique la bande animée d'un décalque.

CE QUE C'EST. Une seule image, les vues côte à côte dans une bande
horizontale : `<fichier>-anime.webp` posé à côté de `<fichier>.webp`, et le
moteur y puise la vue du moment (src/render/planche.ts). Le nombre de vues
n'est écrit nulle part : il se déduit du rapport entre la bande et l'image
fixe — c'est pourquoi CHAQUE VUE DOIT AVOIR LE RAPPORT DE L'IMAGE FIXE, et
ce script le vérifie avant de coller quoi que ce soit.

D'OÙ VIENNENT LES VUES. D'une vidéo courte tirée de l'image fixe (un
générateur image-vers-vidéo, avec la consigne « seamless loop, static
camera, only the <pièce> moves »), ou d'une suite d'images déjà découpées.
Le script accepte les deux : un dossier de PNG numérotés, ou une vidéo
(il appelle `ffmpeg` pour en tirer les vues, réparties sur toute sa durée).

CE QU'IL PRODUIT : le MASTER de la planche, dans masters/images/, que
tools/images/prepare.py livre ensuite dans public/assets/ comme le reste
(famille « planche de vues » : alpha exigé, bande ≤ 4096 px de large —
le plancher de MAX_TEXTURE_SIZE sur les téléphones encore en service).

  · 8 vues par défaut : à 12 vues par seconde (la cadence du moteur), une
    boucle de deux tiers de seconde — une vanne qui tourne, une vapeur qui
    sort ; 12 vues pour un mouvement plus long ;
  · les vues sont réduites pour que la bande tienne dans 4096 : 8 vues de
    512 de large, 12 de 341. Un décalque se dessine petit à l'écran, ça ne
    se voit pas ; une bande trop large ne se chargerait pas du tout.

Usage :
  python3 tools/images/planche.py decal-vanne vues/           # un dossier de PNG (ordre alphabétique)
  python3 tools/images/planche.py decal-vanne vanne.mp4       # une vidéo (ffmpeg requis)
  python3 tools/images/planche.py decal-vanne vanne.mp4 --vues 12
  puis : python3 tools/images/prepare.py decal-vanne-anime

Dépendances : pillow ; ffmpeg sur le PATH pour lire une vidéo
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import tempfile

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ASSETS = os.path.join(ROOT, 'public', 'assets')
MASTERS = os.path.join(ROOT, 'masters', 'images')

LARGEUR_MAX = 4096
VIDEO = ('.mp4', '.webm', '.mov', '.mkv', '.gif')
IMAGES = ('.png', '.webp', '.jpg', '.jpeg', '.tif', '.tiff')


def vues_du_dossier(dossier: str) -> list[Image.Image]:
    noms = sorted(f for f in os.listdir(dossier) if f.lower().endswith(IMAGES))
    return [Image.open(os.path.join(dossier, f)).convert('RGBA') for f in noms]


def vues_de_la_video(chemin: str, n: int) -> list[Image.Image]:
    """`n` vues réparties sur toute la durée — la dernière juste avant la
    fin, pour qu'une boucle parfaite ne montre pas deux fois la même vue."""
    ffmpeg = shutil.which('ffmpeg')
    if not ffmpeg:
        sys.exit('ffmpeg introuvable sur le PATH : donnez un dossier de vues, ou installez-le')
    sonde = subprocess.run(
        [ffmpeg, '-i', chemin], capture_output=True, text=True,
    ).stderr
    duree = 0.0
    for ligne in sonde.splitlines():
        if 'Duration:' in ligne:
            h, m, s_ = ligne.split('Duration:')[1].split(',')[0].strip().split(':')
            duree = int(h) * 3600 + int(m) * 60 + float(s_)
    if duree <= 0:
        sys.exit(f'durée illisible pour {chemin}')
    # Un WebM VP9/VP8 porte sa transparence dans une piste à côté que le
    # décodeur natif d'ffmpeg ignore : il faut demander celui de libvpx,
    # AVANT l'entrée, pour que les vues sortent détourées. Un MP4 n'a pas
    # d'alpha de toute façon (→ --sans-alpha).
    decodeur: list[str] = []
    if chemin.lower().endswith('.webm'):
        codecs = subprocess.run([ffmpeg, '-hide_banner', '-decoders'], capture_output=True, text=True).stdout
        if 'libvpx-vp9' in codecs:
            decodeur = ['-c:v', 'libvpx-vp9']
    with tempfile.TemporaryDirectory() as tmp:
        # fps = n / durée : ffmpeg pose une vue tous les durée/n — n vues,
        # la première à 0, la dernière à durée × (n-1)/n
        subprocess.run(
            [ffmpeg, '-v', 'error', *decodeur, '-i', chemin, '-vf', f'fps={n}/{duree:.6f}', '-frames:v', str(n),
             os.path.join(tmp, 'vue-%03d.png')],
            check=True,
        )
        return vues_du_dossier(tmp)


def choisit(vues: list[Image.Image], n: int) -> list[Image.Image]:
    """`n` vues réparties dans la suite (la première, puis tous les len/n)."""
    if len(vues) <= n:
        return vues
    return [vues[round(i * len(vues) / n)] for i in range(n)]


def fond_transparent(img: Image.Image) -> bool:
    """La bande doit être détourée comme l'image fixe : un coin opaque trahit
    une vidéo rendue sur fond plein."""
    a = img.getchannel('A')
    coins = [a.getpixel((0, 0)), a.getpixel((img.width - 1, 0)), a.getpixel((0, img.height - 1)),
             a.getpixel((img.width - 1, img.height - 1))]
    return max(coins) < 26  # 10 % d'opacité


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('nom', help='le fichier du décalque, sans extension (ex. decal-vanne)')
    ap.add_argument('source', help='un dossier de vues, ou une vidéo')
    ap.add_argument('--vues', type=int, default=8, help='le nombre de vues (défaut 8)')
    ap.add_argument('--fixe', help='l’image fixe de référence (défaut : public/assets/<nom>.webp)')
    ap.add_argument('--sortie', help='le master produit (défaut : masters/images/<nom>-anime.png)')
    ap.add_argument('--sans-alpha', action='store_true', help='accepte des vues sur fond plein (pièce non détourée)')
    args = ap.parse_args(argv)

    fixe_chemin = args.fixe or os.path.join(ASSETS, args.nom + '.webp')
    if not os.path.exists(fixe_chemin):
        sys.exit(f'image fixe introuvable : {fixe_chemin} — la planche se déduit d’elle')
    fixe = Image.open(fixe_chemin)
    rapport = fixe.width / fixe.height

    if os.path.isdir(args.source):
        vues = vues_du_dossier(args.source)
    elif args.source.lower().endswith(VIDEO):
        vues = vues_de_la_video(args.source, args.vues)
    else:
        sys.exit(f'source inconnue : {args.source} (dossier de vues ou vidéo)')
    if len(vues) < 2:
        sys.exit(f'{len(vues)} vue(s) : il en faut au moins deux')
    vues = choisit(vues, args.vues)
    n = len(vues)

    for i, v in enumerate(vues):
        if abs(v.width / v.height - rapport) > 0.02 * rapport:
            sys.exit(
                f'vue {i + 1} : {v.width}×{v.height}, rapport {v.width / v.height:.3f} ≠ {rapport:.3f} '
                f'de l’image fixe ({fixe.width}×{fixe.height}) — recadrez la vidéo au format de la pièce'
            )
        if not args.sans_alpha and not fond_transparent(v):
            sys.exit(f'vue {i + 1} : les coins ne sont pas transparents — la pièce doit être détourée (ou --sans-alpha)')

    # la largeur d'une vue : celle de l'image fixe, réduite pour tenir dans
    # LARGEUR_MAX ; jamais agrandie
    largeur = min(fixe.width, vues[0].width, LARGEUR_MAX // n)
    hauteur = max(1, round(largeur / rapport))
    bande = Image.new('RGBA', (largeur * n, hauteur), (0, 0, 0, 0))
    for i, v in enumerate(vues):
        bande.paste(v.resize((largeur, hauteur), Image.LANCZOS), (i * largeur, 0))

    sortie = args.sortie or os.path.join(MASTERS, args.nom + '-anime.png')
    os.makedirs(os.path.dirname(sortie), exist_ok=True)
    bande.save(sortie, 'PNG', optimize=True)
    print(f'{sortie} — {n} vues de {largeur}×{hauteur}, bande {bande.width}×{bande.height}')
    print(f'ensuite : python3 tools/images/prepare.py {args.nom}-anime')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
