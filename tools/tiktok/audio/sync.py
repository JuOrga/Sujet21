# Les coupes tombent-elles sur des attaques ? attaque moyenne aux coupes / attaque moyenne ailleurs
import os, sys, subprocess, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from beat import enveloppe, FPS, SR
for f, bpm in [('out/V1-pov-goutte-musique-du-jeu.mp4', 85.7), ('out/V2-etats-de-l-eau-musique-du-jeu.mp4', 130), ('out/V3-hypnotique-musique-du-jeu.mp4', 99)]:
    x = np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True).stdout, np.float32)
    on, _ = enveloppe(x)
    def pic(t): i = int(t * FPS); return on[max(0, i - 4):i + 5].max()
    b = 60 / bpm
    temps = np.arange(0, len(x) / SR - 1.5, b)
    contre = temps + b / 2
    print(f.split('/')[-1], 'sur les temps', round(float(np.mean([pic(t) for t in temps])), 1), '| entre les temps', round(float(np.mean([pic(t) for t in contre])), 1))
