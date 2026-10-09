# V3 — « Hypnotique », 100 BPM (mesure = 2,4 s) : la ronde, les éclats, la glace
import sys
from edit import *
from cartes import *
SND = os.path.join(ICI, '../../public/sound')
b = 60 / 100; bar = 4 * b
REP = json.load(open('reperes.json'))
R5, R6, C = 'r5_ronde', 'r6_cibles', REP['r6']
segs = [
    dict(rush=R5, out=0, map=[(0, 0.4), (2 * bar, 5.2)], zoom=1.0, derive=0.012),
    dict(rush=R6, out=2 * bar, map=[(0, C['a3']), (2 * bar, C['z3'])], zoom=1.05),
    dict(rush='r3_glace', out=4 * bar, map=[(0, 2.0), (bar, 4.6)], zoom=1.0),
    dict(rush=R5, out=5 * bar, map=[(0, 7.0), (bar * 0.55, 8.4)], zoom=1.0),
    dict(out=5 * bar + bar * 0.55, carte=carte_fin(R5, 200, 'SE DÉPLACER,|C’EST *RÉTRÉCIR*', 'Tu regardes encore ?')),
]
def sortie(rush, ts):
    for s in segs:
        if s.get('rush') != rush: continue
        m = s['map']
        for (u0, s0), (u1, s1) in zip(m, m[1:]):
            if s0 <= ts <= s1 and s1 > s0: return s['out'] + u0 + (ts - s0) / (s1 - s0) * (u1 - u0)
    return None
leg = [
    dict(t0=0.08, t1=bar - 0.05, txt='Une goutte de *glace*…', y=400, size=92, accent=(200, 230, 255)),
    dict(t0=bar, t1=2 * bar - 0.05, txt='…prise dans|*la gravité*', y=400, size=92, accent=(200, 170, 255)),
    dict(t0=2 * bar, t1=3 * bar - 0.05, txt='Chaque tir arrache|*un morceau de toi*', y=400),
    dict(t0=3 * bar, t1=4 * bar - 0.05, txt='…et elle ne s’arrête *jamais*', y=400),
    dict(t0=4 * bar, t1=5 * bar - 0.05, txt='Aucune animation :|*que de la physique*', y=400, accent=(120, 255, 200)),
]
sons = [(f'{SND}/impact-glace.mp3', sortie('r3_glace', REP['r3']['rebond']), 0.7)]
for tt in C.get('tirs', []):
    o = sortie(R6, tt)
    if o: sons.append((f'{SND}/ejection-{1 + len(sons) % 3}.mp3', o, 0.55))
tl = dict(duree=6 * bar + 0.3, segs=segs, legendes=leg, punch=[i * bar for i in range(1, 6)], punch_force=0.03,
          musique=sys.argv[2] if len(sys.argv) > 2 else 'audio/hypno.wav', sons=[s for s in sons if s[1] is not None])
rend(tl, sys.argv[1])
