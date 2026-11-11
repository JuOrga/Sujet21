#!/usr/bin/env python3
"""MESURER LES CLIPS — `python3 tools/clips/mesure.py [clip.mp4 …]`

Ce qu'un téléphone affiche et joue, en chiffres : la règle de la maison est
de ne rien annoncer qu'on n'ait mesuré, et un avis sur un clip (« trop
sombre », « le carton est long ») se discute mieux avec ses nombres.

Sans argument, mesure tout `clips-sortie/final/` (ou `$CLIPS_SORTIE/final/`).
`--carton=2.2` dit la durée du carton de fin, retirée avant de mesurer le plan.

  durée      le fichier entier, carton compris
  carton     la part du fichier occupée par le carton de fin
  lumin.     la luminance moyenne du plan, 0 % noir, 100 % blanc
  clair      la part des pixels du plan au-dessus du gris moyen (Y > 120/255)
  accent     de combien le moment le plus fort dépasse le fond sonore
             (sonie momentanée : maximum moins médiane), et quand il tombe
"""
import os, re, subprocess, sys

args = [a for a in sys.argv[1:] if not a.startswith('--')]
carton = next((float(a.split('=')[1]) for a in sys.argv[1:] if a.startswith('--carton=')), 2.2)
if not args:
    d = os.path.join(os.environ.get('CLIPS_SORTIE') or os.path.join(os.path.dirname(__file__), '../../clips-sortie'), 'final')
    args = sorted(os.path.join(d, f) for f in os.listdir(d) if f.endswith('.mp4'))


def sortie(a):
    return subprocess.run(a, capture_output=True, text=True).stdout


def moyenne_y(f, plan, filtre):
    o = sortie(['ffmpeg', '-v', 'error', '-t', f'{plan:.3f}', '-i', f, '-vf',
                f'{filtre}signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-', '-f', 'null', '-'])
    ys = [float(x) for x in re.findall(r'YAVG=([\d.]+)', o)]
    # Y est en gamme limitée (16-235) : ramené à 0-100 %
    return (sum(ys) / len(ys) - 16) / 219 * 100 if ys else float('nan')


print(f"{'clip':28s} {'durée':>7s} {'carton':>7s} {'lumin.':>7s} {'clair':>7s}   accent sonore")
for f in args:
    total = float(sortie(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]))
    plan = max(0.1, total - carton)
    lum = moyenne_y(f, plan, '')
    clair = moyenne_y(f, plan, "format=gray,lutyuv=y='if(gt(val,120),235,16)',")
    o = sortie(['ffmpeg', '-v', 'error', '-t', f'{plan:.3f}', '-i', f, '-af',
                'ebur128=metadata=1,ametadata=print:key=lavfi.r128.M:file=-', '-f', 'null', '-'])
    ms = [(float(t), float(m)) for t, m in re.findall(r'pts_time:([\d.]+)\s*\nlavfi\.r128\.M=(-?[\d.]+)', o) if float(m) > -70]
    if ms:
        t_max, m_max = max(ms, key=lambda x: x[1])
        mediane = sorted(m for _, m in ms)[len(ms) // 2]
        son = f'+{m_max - mediane:.1f} dB à {t_max:.1f} s'
    else:
        son = 'pas de son'
    print(f'{os.path.basename(f):28s} {total:6.2f}s {carton / total * 100:6.0f}% {lum:6.1f}% {clair:6.2f}%   {son}')
