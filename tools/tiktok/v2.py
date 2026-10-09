# V2 — « Les états de l'eau », phonk 130 BPM : une coupe par mesure
import sys
from edit import *
from cartes import *
SND = os.path.join(ICI, '../../public/sound')
b = 60 / 130; bar = 4 * b
REP = json.load(open('reperes.json'))
def seg(rush, a, z, i, nb=1, **kw):
    return dict(rush=rush, out=i * bar, map=[(0, a), (nb * bar, z)], **kw)
C = REP['r6']
segs = [
    seg('r1_traversee', 0.1, 1.7, 0, zoom=1.0, derive=0.05),
    seg('r1_traversee', 2.0, 4.7, 1, zoom=1.05),
    dict(rush='r3_glace', out=2 * bar, map=[(0, 1.45), (0.55 * bar, 2.6), (bar, 4.4)], zoom=1.05),
    dict(rush='r4_vapeur', out=3 * bar, map=[(0, 0.45), (0.6 * bar, 1.0), (bar, 2.3)], zoom=1.0),
    seg('r4_vapeur', 2.3, 7.0, 4, zoom=1.0),
    dict(rush='r2_ecrase', out=5 * bar, map=[(0, 3.3), (0.5 * bar, 4.75), (bar, 5.8)], zoom=1.0),
    dict(rush='r1_traversee', out=6 * bar, map=[(0, 6.9), (0.45 * bar, 7.5), (bar, 8.6)], zoom=1.05),
    seg('r6_cibles', C['a'], C['z'], 7, zoom=1.12),
    dict(out=8 * bar, carte=carte_fin('r4_vapeur', 60, 'LIQUIDE · GLACE · *VAPEUR*', 'Tu choisis lequel ?')),
]
def sortie(rush, ts):
    for s in segs:
        if s.get('rush') != rush: continue
        m = s['map']
        for (u0, s0), (u1, s1) in zip(m, m[1:]):
            if s0 <= ts <= s1 and s1 > s0: return s['out'] + u0 + (ts - s0) / (s1 - s0) * (u1 - u0)
    return None
leg = [
    dict(t0=0.08, t1=bar - 0.04, txt='Ce jeu te fait jouer|*une goutte d’eau*', y=420, size=96),
    dict(t0=bar, t1=2 * bar - 0.04, txt='*LIQUIDE*|tu avances|en te vidant', y=400),
    dict(t0=2 * bar, t1=3 * bar - 0.04, txt='*GLACE*|tu glisses, tu rebondis', y=400, accent=(200, 170, 255)),
    dict(t0=3 * bar, t1=4 * bar - 0.04, txt='*VAPEUR*|tu exploses…', y=400, accent=(255, 205, 130)),
    dict(t0=4 * bar, t1=5 * bar - 0.04, txt='…et tu *fonces*', y=400, accent=(255, 205, 130)),
    dict(t0=5 * bar, t1=5 * bar + 2 * b - 0.04, txt='Mais attention…', y=400),
    dict(t0=5 * bar + 2 * b, t1=6 * bar - 0.04, txt='les murs ont *SOIF*', y=400, size=100, accent=(255, 110, 110)),
    dict(t0=6 * bar, t1=7 * bar - 0.04, txt='Ton but : *le sas*', y=400, accent=(110, 255, 170)),
    dict(t0=7 * bar, t1=8 * bar - 0.04, txt='Et tu peux même|*te tirer dessus*', y=400),
]
sons = [
    (f'{SND}/ejection-1.mp3', sortie('r1_traversee', 2.05), 0.6),
    (f'{SND}/gel.mp3', sortie('r3_glace', 1.75), 0.9),
    (f'{SND}/impact-glace.mp3', sortie('r3_glace', REP['r3']['rebond']), 0.9),
    (f'{SND}/vaporisation.mp3', sortie('r4_vapeur', 0.6), 0.8),
    (f'{SND}/eponge.mp3', sortie('r2_ecrase', 4.75), 1.0),
    (f'{SND}/vortex-sas.mp3', sortie('r1_traversee', 7.3), 0.8),
]
for td in REP['r4']['dashs']:
    o = sortie('r4_vapeur', td)
    if o: sons.append((f'{SND}/souffle-vapeur.mp3', o, 0.8))
for tt in REP['r6'].get('tirs', []):
    o = sortie('r6_cibles', tt)
    if o: sons.append((f'{SND}/impact-glace.mp3', o, 0.5))
tl = dict(duree=8 * bar + 2.3, segs=segs, legendes=leg, punch=[i * bar for i in range(1, 9)] + [i * bar + 2 * b for i in range(1, 8) if i != 5],
          punch_force=0.05, musique=sys.argv[2] if len(sys.argv) > 2 else 'audio/phonk.wav', sons=[s for s in sons if s[1] is not None],
          shake=[(sortie('r2_ecrase', 4.75), 18), (sortie('r4_vapeur', 0.62), 12)])
rend(tl, sys.argv[1])
