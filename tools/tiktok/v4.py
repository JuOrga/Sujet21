# V4 — devlog « J'ai codé un jeu où tu ES de l'eau » : l'accroche en suspens,
# le dessous des cartes (les particules), la mécanique, puis la scène du début résolue.
import sys
from edit import *
from cartes import *
SND = os.path.join(ICI, '../../public/sound')
# MUSIQUE, DEBUT et BPM (environnement) : coupes posées en temps de musique
b = 60 / float(os.environ.get('BPM', 130))
R1, R2, R3, R4, R7 = 'r1_traversee', 'r2_ecrase', 'r3_glace', 'r4_vapeur', 'r7_devoile'
def S(rush, t0, t1, a, z, **kw):  # t0, t1 en temps (battements)
    return dict(rush=rush, out=t0 * b, map=[(0, a), ((t1 - t0) * b, z)], **kw)
segs = [
    # l'accroche : l'anneau file vers le mur — coupé juste avant le choc
    S(R2, 0, 4, 3.35, 4.7, zoom=1.22, dx=95),
    # le dessous des cartes : les particules, puis l'eau
    S(R7, 4, 12, 0.0, 4.5, zoom=1.0, grade=dict(lum=1.25)),
    S(R1, 12, 20, 2.0, 5.6, zoom=1.0),
    dict(rush=R3, out=20 * b, map=[(0, 1.5), (2 * b, 2.6), (4 * b, 4.3)], zoom=1.05),
    dict(rush=R4, out=24 * b, map=[(0, 0.45), (2.5 * b, 1.05), (4 * b, 1.9)], zoom=1.0),
    # la scène du début, résolue
    dict(rush=R2, out=28 * b, map=[(0, 4.3), (2 * b, 4.75), (6 * b, 6.8)], zoom=1.0),
    dict(rush=R1, out=34 * b, map=[(0, 6.6), (3 * b, 7.6), (6 * b, 9.0)], zoom=1.05),
    dict(out=40 * b, carte=carte_fin(R7, 130, 'SE DÉPLACER,|C’EST *RÉTRÉCIR*', 'Je continue le dev ?')),
]
def sortie(rush, ts):
    for s in segs:
        if s.get('rush') != rush: continue
        m = s['map']
        for (u0, s0), (u1, s1) in zip(m, m[1:]):
            if s0 <= ts <= s1 and s1 > s0: return s['out'] + u0 + (ts - s0) / (s1 - s0) * (u1 - u0)
    return None
L = lambda t0, t1, txt, **kw: dict(t0=t0 * b + 0.03, t1=t1 * b - 0.04, txt=txt, y=kw.pop('y', 400), **kw)
leg = [
    L(0, 4, 'J’ai codé un jeu|où tu *ES* de l’eau', size=100, y=420),
    L(4, 8, '*900 particules*|simulées une à une'),
    L(8, 12, 'qui tiennent ensemble|par *tension de surface*'),
    L(12, 16, 'Pour avancer,|tu *craches*|ta propre eau'),
    L(16, 20, 'Chaque geste|te fait *rétrécir*'),
    L(20, 24, '*GELÉE*|tu glisses, tu rebondis', accent=(200, 170, 255)),
    L(24, 28, '*VAPEUR*|tu exploses', accent=(255, 205, 130)),
    L(28, 30.5, 'Et la scène du début ?'),
    L(30.5, 34, 'Les murs|*boivent* l’eau', accent=(255, 110, 110), size=96),
    L(34, 40, 'Le but : le sas…|*avant de disparaître*', accent=(110, 255, 170)),
]
vol = [(t, v) for t, v in serie_volume(R1, lambda ts: sortie(R1, ts)) if t is not None and 12 * b <= t <= 20 * b]
sons = [
    (f'{SND}/ejection-2.mp3', sortie(R7, 0.75), 0.6),
    (f'{SND}/condensation.mp3', 4 * b + 1.9, 0.5),  # les particules se fondent
    (f'{SND}/gel.mp3', sortie(R3, 1.75), 0.9),
    (f'{SND}/impact-glace.mp3', sortie(R3, 3.8), 0.9),
    (f'{SND}/vaporisation.mp3', sortie(R4, 0.6), 0.8),
    (f'{SND}/eponge.mp3', sortie(R2, 4.75), 1.0),
    (f'{SND}/vortex-sas.mp3', sortie(R1, 7.3), 0.8),
]
for e in journal(R1):
    if e.get('ejecte'):
        o = sortie(R1, e['t'])
        if o and 12 * b <= o < 20 * b: sons.append((f'{SND}/ejection-{1 + len(sons) % 3}.mp3', o, 0.5))
tl = dict(duree=40 * b + 2.6, segs=segs, legendes=leg,
          punch=[t * b for t in (4, 12, 20, 24, 28, 34)], punch_force=0.04,
          shake=[(sortie(R2, 4.75), 16), (sortie(R4, 0.62), 10)],
          flash=[],
          overlays=[dict(t0=12 * b, t1=20 * b - 0.05, f=compteur(vol, y=1420))],
          musique_debut=float(os.environ.get('DEBUT', 0)), sans_musique=os.environ.get('SANS', '1') == '1',
          fondu=float(os.environ.get('FONDU', 1.0)), gain_musique=float(os.environ.get('GAIN', 0.8)),
          musique=sys.argv[2] if len(sys.argv) > 2 else None, sons=[s for s in sons if s[1] is not None])
rend(tl, sys.argv[1])
