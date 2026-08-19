"""Prépare les masters Suno pour le jeu.

Les fichiers livrés sont des morceaux complets (3 à 5 minutes, stéréo, ~100 kbps)
pour un total de 26 Mo : impossible à charger sur un téléphone. Ce script taille
dans les masters (masters/sound/) les extraits dont le jeu a besoin et les
ré-encode léger dans public/sound/ :

  · les lits et ambiances deviennent des boucles de 30 à 40 s, mono ;
  · les ponctuations sont coupées autour d'une attaque franche, 5 à 11 s ;
  · les bruitages courts sont juste normalisés et allégés.

Les bords sont fondus sur 40 ms : le décodeur MP3 ajoute quelques millisecondes
de silence en tête, autant qu'elles tombent dans le fondu. Le raccord de boucle,
lui, est fait à la lecture (deux voix qui se croisent), pas ici.

Usage : python3 tools/audio/prepare.py
Dépendances : soundfile, numpy, lameenc
"""

import os
import numpy as np
import soundfile as sf
import lameenc

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'masters', 'sound')
DST = os.path.join(ROOT, 'public', 'sound')

# nom master, nom de sortie, début (s), durée (s), cible RMS (dBFS), débit kbps
BOUCLES = [
    ('accueil.mp3', 'accueil.mp3', 32.0, 40.0, -22.0, 56),
    ('cuve-tiede.mp3', 'cuve-tiede.mp3', 26.0, 40.0, -23.0, 56),
    ('cuve-glaciale.mp3', 'cuve-glaciale.mp3', 22.0, 40.0, -23.0, 56),
    ('zone-hublot.mp3', 'zone-hublot.mp3', 24.0, 30.0, -24.0, 48),
    ('zone-conduite.mp3', 'zone-conduite.mp3', 24.0, 30.0, -24.0, 48),
    ('zone-chambre.mp3', 'zone-chambre.mp3', 22.0, 30.0, -24.0, 48),
    # La nappe de vapeur : la seule boucle pilotée à la frame par le jeu
    # (setGasLevel). Tout son contenu tient sous 800 Hz — pas un souffle
    # d'aigu — donc 48 kbps suffisent largement. Elle est livrée déjà bouclée
    # et calibrée ; on la garde entière, la lecture reboucle en son milieu
    # (loopStart/loopEnd dans audio.ts) pour éviter les bords fondus.
    ('vapeur-nappe.wav', 'vapeur-nappe.mp3', 0.0, 30.0, -20.0, 48),
    # La texture du temps suspendu (visée du dash) : drone sombre ~141 Hz.
    # La queue silencieuse (10,8 s →) est coupée, le raccord se fait à la
    # lecture. Cible RMS haute (-19) : elle joue sous un monde étouffé.
    ('temps-suspendu.mp3', 'temps-suspendu.mp3', 0.0, 10.6, -19.0, 48),
]

# Ponctuations : découpées sur une attaque repérée à l'analyse (creux → saut de
# 17 à 25 dB), avec un fondu de sortie pour que la coupe ne s'entende pas.
PONCTUATIONS = [
    ('sting-collecte.mp3', 'sting-collecte.mp3', 39.55, 6.0, 2.0, -18.0, 64),
    ('sting-record.mp3', 'sting-record.mp3', 35.55, 8.0, 2.5, -19.0, 64),
    ('fin-de-course.mp3', 'fin-de-course.mp3', 107.25, 11.0, 4.0, -19.0, 64),
]

# Coups taillés au plus court : nom master, sortie, début (s), durée (s),
# crête visée (dBFS), débit. L'éjection est une goutte qui tombe dans l'eau —
# trois prises de hauteurs différentes (562, 604 et 674 Hz de résonance de
# bulle) tirées au sort à chaque impulsion, pour que la répétition ne
# s'entende pas. Chacune est coupée juste après l'extinction de la bulle.
COUPS = [
    ('ejection-1.mp3', 'ejection-1.mp3', 0.0, 0.55, -3.0, 96),
    ('ejection-2.mp3', 'ejection-2.mp3', 0.0, 0.42, -3.0, 96),
    ('ejection-3.mp3', 'ejection-3.mp3', 0.0, 0.75, -3.0, 96),
]

# Bruitages courts : gardés entiers, juste normalisés en crête et allégés.
# Les masters en .wav sont les sons refaits sombres (rien au-dessus de 3 kHz) ;
# les .mp3 restants viennent de Suno. Les versions écartées sont archivées sous
# *-v1-aigu.mp3 / *-v1-jet.mp3, plus référencées.
COURTS = [
    ('gel.wav', 'gel.mp3', -3.0, 80),
    # la floraison chaude qui remplace le jet sous pression (l'ancien master
    # est conservé sous vaporisation-v1-jet.mp3, plus référencé)
    ('vaporisation.wav', 'vaporisation.mp3', -3.0, 80),
    ('condensation.wav', 'condensation.mp3', -4.0, 80),
    ('impact-glace.mp3', 'impact-glace.mp3', -3.0, 80),
    ('goutte-rosee.wav', 'goutte-rosee.mp3', -6.0, 80),
    ('eponge.wav', 'eponge.mp3', -5.0, 80),
    ('souffle-vapeur.wav', 'souffle-vapeur.mp3', -6.0, 80),
    ('vortex-sas.wav', 'vortex-sas.mp3', -5.0, 80),
    ('sting-derniere-impulsion.mp3', 'sting-derniere-impulsion.mp3', -3.0, 80),
]


def lire_mono(nom: str) -> tuple[np.ndarray, int]:
    x, sr = sf.read(os.path.join(SRC, nom), dtype='float64')
    return (x.mean(axis=1) if x.ndim > 1 else x), sr


def fondu(sig: np.ndarray, sr: int, entree: float, sortie: float) -> np.ndarray:
    a = max(1, int(entree * sr))
    b = max(1, int(sortie * sr))
    sig = sig.copy()
    sig[:a] *= np.linspace(0, 1, a)
    sig[-b:] *= np.linspace(1, 0, b) ** 1.5
    return sig


def cale_rms(sig: np.ndarray, cible_db: float) -> np.ndarray:
    rms = float(np.sqrt(np.mean(sig ** 2))) + 1e-12
    sig = sig * (10 ** (cible_db / 20) / rms)
    crete = float(np.max(np.abs(sig)))
    if crete > 0.89:  # on ne dépasse pas -1 dBFS
        sig *= 0.89 / crete
    return sig


def cale_crete(sig: np.ndarray, cible_db: float) -> np.ndarray:
    crete = float(np.max(np.abs(sig))) + 1e-12
    return sig * (10 ** (cible_db / 20) / crete)


def encode(sig: np.ndarray, sr: int, debit: int, sortie: str) -> None:
    pcm = np.clip(sig, -1, 1)
    pcm = (pcm * 32767).astype('<i2')
    enc = lameenc.Encoder()
    enc.set_bit_rate(debit)
    enc.set_in_sample_rate(sr)
    enc.set_channels(1)
    enc.set_quality(2)
    data = enc.encode(pcm.tobytes()) + enc.flush()
    with open(os.path.join(DST, sortie), 'wb') as f:
        f.write(bytes(data))


def main() -> None:
    os.makedirs(DST, exist_ok=True)
    total = 0
    for nom, out, t0, duree, cible, debit in BOUCLES:
        x, sr = lire_mono(nom)
        a, b = int(t0 * sr), int((t0 + duree) * sr)
        seg = cale_rms(fondu(x[a:b], sr, 0.04, 0.04), cible)
        encode(seg, sr, debit, out)
        taille = os.path.getsize(os.path.join(DST, out))
        total += taille
        print(f'boucle    {out:30s} {duree:5.1f} s  {taille/1024:6.0f} ko')
    for nom, out, t0, duree, fin, cible, debit in PONCTUATIONS:
        x, sr = lire_mono(nom)
        a, b = int(t0 * sr), int((t0 + duree) * sr)
        seg = cale_rms(fondu(x[a:b], sr, 0.01, fin), cible)
        encode(seg, sr, debit, out)
        taille = os.path.getsize(os.path.join(DST, out))
        total += taille
        print(f'ponctuat. {out:30s} {duree:5.1f} s  {taille/1024:6.0f} ko')
    for nom, out, t0, duree, cible, debit in COUPS:
        x, sr = lire_mono(nom)
        a, b = int(t0 * sr), int((t0 + duree) * sr)
        seg = cale_crete(fondu(x[a:b], sr, 0.002, 0.05), cible)
        encode(seg, sr, debit, out)
        taille = os.path.getsize(os.path.join(DST, out))
        total += taille
        print(f'coup      {out:30s} {duree:5.2f} s  {taille/1024:6.0f} ko')
    for nom, out, cible, debit in COURTS:
        x, sr = lire_mono(nom)
        seg = cale_crete(fondu(x, sr, 0.004, 0.03), cible)
        encode(seg, sr, debit, out)
        taille = os.path.getsize(os.path.join(DST, out))
        total += taille
        print(f'bruitage  {out:30s} {len(x)/sr:5.1f} s  {taille/1024:6.0f} ko')
    print(f'\ntotal embarqué : {total/1024/1024:.2f} Mo')


if __name__ == '__main__':
    main()
