# Cartes et incrustations communes aux trois montages
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from edit import W, H, FPS, frame, rend_texte, colle, font, F_BLACK, F_XB, F_TITRE, ICI, grade

_logo = Image.open(f'{ICI}/../../public/steam/logo-640x360.png').convert('RGBA')
def logo(largeur):
    return _logo.resize((largeur, int(_logo.height * largeur / _logo.width)), Image.LANCZOS)

def carte_fin(rush, idx, accroche, cta, couleur=(120, 220, 255)):
    """fond : l'image du rush, floutée et assombrie ; le logo, la promesse, l'appel"""
    fond = Image.fromarray(frame(rush, idx).astype(np.uint8)).filter(ImageFilter.GaussianBlur(28))
    fond = np.asarray(fond, dtype=np.float32) * 0.45
    lg = logo(980)
    t_acc = rend_texte(accroche, size=46, path=F_TITRE, stroke=0, accent=couleur, interligne=1.5)
    t_cta = rend_texte(cta, size=70, accent=couleur)
    def f(u):
        img = fond.copy()
        # léger zoom lent du fond
        base = Image.fromarray(img.astype(np.uint8)).convert('RGBA')
        k = min(1, u / 0.35)
        e = 1 - (1 - k) ** 3
        colle(base, lg, W / 2, 760 - 40 * (1 - e), 0.85 + 0.15 * e, e)
        if u > 0.35: colle(base, t_acc, W / 2, 1060, 1.0, min(1, (u - 0.35) / 0.25))
        if u > 0.8:
            s = 1 + 0.04 * math.sin((u - 0.8) * 6)
            colle(base, t_cta, W / 2, 1290, s, min(1, (u - 0.8) / 0.2))
        return np.asarray(base.convert('RGB'), dtype=np.float32)
    return f

def compteur(serie, y=1420, etiquette='VOLUME'):
    """serie : liste (t_sortie, litres) ; affiche le volume restant, rouge sous 1 L"""
    ts = [a for a, _ in serie]; vs = [b for _, b in serie]
    f_val = font(F_BLACK, 120); f_lab = font(F_XB, 34)
    def f(base, t):
        v = float(np.interp(t, ts, vs))
        txt = f'{v:.2f} L'.replace('.', ',')
        col = (255, 255, 255) if v > 1.5 else (255, 200, 90) if v > 0.6 else (255, 90, 90)
        im = Image.new('RGBA', (W, 220), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
        lw = f_lab.getlength(etiquette); d.text(((W - lw) / 2, 0), etiquette, font=f_lab, fill=(190, 230, 255), stroke_width=5, stroke_fill=(0, 0, 0))
        vw = f_val.getlength(txt); d.text(((W - vw) / 2, 44), txt, font=f_val, fill=col, stroke_width=10, stroke_fill=(0, 0, 0))
        # jauge
        g = max(0, min(1, v / 4.5)); x0, x1, yb = 290, 790, 196
        d.rounded_rectangle([x0, yb, x1, yb + 16], 8, fill=(0, 0, 0, 170))
        d.rounded_rectangle([x0, yb, x0 + max(16, (x1 - x0) * g), yb + 16], 8, fill=col + (255,))
        base.alpha_composite(im, (0, int(y - 110)))
    return f

def serie_volume(rush, carte_temps, lpp=0.005):
    """journal du rush -> (temps de sortie, litres) via une fonction source->sortie"""
    from edit import journal
    pts = [(e['t'], e['etat']['n'] * lpp) for e in journal(rush) if 'etat' in e]
    return [(carte_temps(t), v) for t, v in pts if carte_temps(t) is not None]
