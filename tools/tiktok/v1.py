# V1 — « POV : tu es une goutte d'eau », lo-fi 90 BPM (mesure = 2,667 s)
import sys
from edit import *
from cartes import *
SND = os.path.join(ICI, '../../public/sound')
# MUSIQUE, DEBUT et BPM (environnement) : poser un autre morceau, coupes recalées sur son tempo
b = 60 / float(os.environ.get('BPM', 90)); bar = 4 * b
R1, R2 = 'r1_traversee', 'r2_ecrase'
E = json.load(open('reperes.json'))['r2']  # repères mesurés sur le rush de l'échec
segs = [
    dict(rush=R1, out=0, map=[(0, 0.05), (bar, 1.75)], zoom=1.0, derive=0.03),
    dict(rush=R1, out=bar, map=[(0, 1.75), (bar, 4.5)], zoom=1.0),
    dict(rush=R1, out=2 * bar, map=[(0, 4.5), (bar, 6.3)], zoom=1.0),
    # la montée : on ralentit à l'approche du sas
    dict(rush=R1, out=3 * bar, map=[(0, 6.3), (bar, 7.55)], zoom=1.0, derive=0.03),
    # le temps fort : aspiré
    dict(rush=R1, out=4 * bar, map=[(0, 7.55), (0.9, 8.15), (bar, 9.6)], zoom=1.08),
    dict(rush=R2, out=5 * bar, map=[(0, E['a']), (bar * 0.55, E['choc']), (bar, E['z'])], zoom=1.0),
    dict(out=6 * bar, carte=carte_fin(R1, 30, 'SE DÉPLACER,|C’EST *RÉTRÉCIR*', 'Tu irais jusqu’où ?')),
]
def r1_vers_sortie(ts):
    for s in segs[:5]:
        m = s['map']
        for (u0, s0), (u1, s1) in zip(m, m[1:]):
            if s0 <= ts <= s1 and s1 > s0: return s['out'] + u0 + (ts - s0) / (s1 - s0) * (u1 - u0)
    return None
vol = serie_volume(R1, r1_vers_sortie)
vol = [(t, v) for t, v in vol if t is not None]
leg = [
    dict(t0=0.12, t1=bar - 0.05, txt='POV : tu es|*une goutte d’eau*|en apesanteur', y=420, size=92),
    dict(t0=bar, t1=2 * bar - 0.05, txt='Pour avancer,|tu dois *cracher*|une partie de toi', y=420),
    dict(t0=2 * bar, t1=3 * bar - 0.05, txt='Chaque geste|te fait *rétrécir*', y=400),
    dict(t0=3 * bar, t1=4 * bar - 0.05, txt='Objectif : le sas…|avant de *disparaître*', y=400),
    dict(t0=4 * bar + 0.05, t1=5 * bar - 0.05, txt='*SAS ATTEINT*', y=420, size=110, accent=(110, 255, 170)),
    dict(t0=5 * bar, t1=5 * bar + bar * 0.5, txt='Mais si tu fonces|trop vite…', y=400),
    dict(t0=5 * bar + bar * 0.5, t1=6 * bar - 0.05, txt='…le mur te *boit*.', y=400, accent=(255, 120, 120)),
]
sons = [
    (f'{SND}/vortex-sas.mp3', r1_vers_sortie(7.45), 0.9),
    (f'{SND}/eponge.mp3', 5 * bar + bar * 0.55 - 0.05, 0.9),
]
for e in journal(R1):
    if e.get('ejecte'):
        to = r1_vers_sortie(e['t'])
        if to is not None: sons.append((f'{SND}/ejection-{1 + len(sons) % 3}.mp3', to, 0.55))
tl = dict(duree=7 * bar, segs=segs, legendes=leg, punch=[i * bar for i in range(1, 7)], musique_debut=float(os.environ.get('DEBUT', 0)), sans_musique=os.environ.get('SANS', '1') == '1',
          fondu=float(os.environ.get('FONDU', 0.4)), gain_musique=float(os.environ.get('GAIN', 1.0)),
          musique=sys.argv[2] if len(sys.argv) > 2 else 'audio/lofi.wav',
          sons=sons, shake=[(5 * bar + bar * 0.55, 14)],
          overlays=[dict(t0=bar, t1=4 * bar - 0.05, f=compteur(vol, y=1420))])
rend(tl, sys.argv[1])
