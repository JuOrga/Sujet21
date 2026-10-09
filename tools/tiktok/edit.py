# Moteur de montage : rushes (images JPEG) + timeline -> MP4 vertical 1080x1920
import json, math, os, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance

W, H, FPS = 1080, 1920, 30
ICI = os.path.dirname(os.path.abspath(__file__))
F_BLACK = '/usr/share/fonts/opentype/inter/InterDisplay-Black.otf'
F_XB = '/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf'
F_TITRE = os.path.join(ICI, 'fonts/michroma.ttf')  # convertie depuis @fontsource/michroma (voir LISEZ-MOI)
SR = 44100

_cache = {}
def frame(rush, idx):
    d = os.path.join(ICI, 'frames', rush)
    n = _cache.setdefault(('n', rush), len([f for f in os.listdir(d) if f.endswith('.jpg')]))
    idx = max(0, min(n - 1, idx))
    k = (rush, idx)
    if k not in _cache:
        if len(_cache) > 120: _cache.clear(); _cache[('n', rush)] = n
        _cache[k] = np.asarray(Image.open(f'{d}/f{idx:05d}.jpg').convert('RGB'), dtype=np.float32)
    return _cache[k]
def nframes(rush):
    d = os.path.join(ICI, 'frames', rush); return len([f for f in os.listdir(d) if f.endswith('.jpg')])
def journal(rush):
    return json.load(open(os.path.join(ICI, 'frames', rush, 'journal.json')))

def src_time(seg, u):
    """u : temps relatif dans le segment (s) -> temps source (s), carte affine par morceaux"""
    m = seg['map']
    for (u0, s0), (u1, s1) in zip(m, m[1:]):
        if u <= u1 or (u1, s1) == m[-1]:
            k = 0 if u1 == u0 else (u - u0) / (u1 - u0)
            return s0 + (s1 - s0) * min(1, max(0, k))
    return m[-1][1]

def image_seg(seg, u):
    ts = src_time(seg, u)
    fi = ts * FPS
    i0 = int(math.floor(fi)); a = fi - i0
    f0 = frame(seg['rush'], i0)
    if a > 0.15 and a < 0.85:  # ralenti : fondu entre deux images voisines
        f1 = frame(seg['rush'], i0 + 1); return f0 * (1 - a) + f1 * a
    return f0 if a <= 0.15 else frame(seg['rush'], i0 + 1)

_vig = None
def grade(img, sat=1.18, contraste=1.08, vign=0.35):
    global _vig
    if _vig is None:
        y, x = np.mgrid[0:H, 0:W]
        r = np.sqrt(((x - W / 2) / (W / 2)) ** 2 + ((y - H / 2) / (H / 2)) ** 2)
        _vig = (1 - vign * np.clip(r - 0.45, 0, 1) ** 1.6)[..., None].astype(np.float32)
    g = img.mean(2, keepdims=True)
    img = g + (img - g) * sat
    img = (img - 128) * contraste + 128
    return np.clip(img * _vig, 0, 255)

def zoom_crop(img, z, dx=0, dy=0):
    if abs(z - 1) < 1e-3 and dx == 0 and dy == 0: return img
    im = Image.fromarray(img.astype(np.uint8))
    cw, ch = W / z, H / z
    cx, cy = W / 2 + dx, H / 2 + dy
    box = (cx - cw / 2, cy - ch / 2, cx + cw / 2, cy + ch / 2)
    return np.asarray(im.transform((W, H), Image.EXTENT, box, Image.BICUBIC), dtype=np.float32)

# ---------- texte ----------
_fonts = {}
def font(path, size):
    k = (path, size)
    if k not in _fonts: _fonts[k] = ImageFont.truetype(path, size)
    return _fonts[k]
def rend_texte(txt, size=84, interligne_=None, couleur=(255, 255, 255), accent=(120, 220, 255), path=F_BLACK, stroke=9, largeur=920, interligne=1.08):
    """*mot* = mot en couleur d'accent ; | = saut de ligne"""
    f = font(path, size)
    mots = []
    dedans = False
    for ligne in txt.split('|'):
        ws = []
        for m in ligne.split(' '):
            if not m: continue
            debut = m.startswith('*'); fin = '*' in m[1:]
            acc = dedans or debut
            if debut: dedans = True
            if fin: dedans = False
            ws.append((m.replace('*', ''), acc))
        mots.append(ws)
    lignes = []
    for ws in mots:
        cur = []
        for w in ws:
            test = ' '.join(x for x, _ in cur + [w])
            if cur and f.getlength(test) > largeur: lignes.append(cur); cur = [w]
            else: cur.append(w)
        lignes.append(cur)
    lh = int(size * interligne)
    hauteur = lh * len(lignes) + stroke * 2 + 10
    im = Image.new('RGBA', (W, hauteur), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for li, ws in enumerate(lignes):
        total = f.getlength(' '.join(x for x, _ in ws))
        x = (W - total) / 2; y = stroke + li * lh
        for w, acc in ws:
            d.text((x, y), w, font=f, fill=accent if acc else couleur, stroke_width=stroke, stroke_fill=(0, 0, 0))
            x += f.getlength(w + ' ')
    # ombre portée douce
    ombre = Image.new('RGBA', im.size, (0, 0, 0, 0))
    ombre.putalpha(im.getchannel('A').filter(ImageFilter.GaussianBlur(10)).point(lambda v: v * 0.55))
    out = Image.new('RGBA', im.size, (0, 0, 0, 0)); out.alpha_composite(ombre, (0, 6)); out.alpha_composite(im)
    return out
_txt_cache = {}
def colle(base, rgba, cx, cy, echelle=1.0, alpha=1.0):
    if echelle != 1.0:
        rgba = rgba.resize((max(1, int(rgba.width * echelle)), max(1, int(rgba.height * echelle))), Image.BICUBIC)
    if alpha < 1.0:
        a = rgba.getchannel('A').point(lambda v: int(v * alpha)); rgba = rgba.copy(); rgba.putalpha(a)
    base.alpha_composite(rgba, (int(cx - rgba.width / 2), int(cy - rgba.height / 2)))

def pop(t, t0, t1, d_in=0.14, d_out=0.12):
    """échelle et opacité d'une légende qui surgit puis s'efface"""
    if t < t0 or t > t1: return 0, 0
    u = t - t0
    if u < d_in:
        k = u / d_in
        s = 0.6 + 0.4 * (1 - (1 - k) ** 3) + 0.12 * math.sin(k * math.pi)
        return s, min(1, k * 2)
    if t1 - t < d_out: return 1.0, (t1 - t) / d_out
    return 1.0, 1.0

# ---------- audio ----------
def charge_son(path, gain=1.0):
    p = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True)
    return np.frombuffer(p.stdout, dtype=np.float32).reshape(-1, 2) * gain
def mixe(duree, musique, sons, gain_mus=1.0, fondu=0.4):
    L = int((duree + 0.1) * SR)
    out = np.zeros((L, 2), np.float32)
    if musique:
        m = charge_son(musique, gain_mus)[:L]
        out[: len(m)] += m
    for (path, t, g) in sons:
        s = charge_son(path, g); i = int(t * SR)
        if i >= L: continue
        s = s[: L - i]; out[i:i + len(s)] += s
    n = int(fondu * SR); out[-n:] *= np.linspace(1, 0, n)[:, None]
    pk = np.max(np.abs(out))
    if pk > 0.97: out = np.tanh(out / pk * 1.4) / np.tanh(1.4) * 0.97
    return out
def ecrit_wav(path, x):
    from scipy.io import wavfile
    wavfile.write(path, SR, (np.clip(x, -1, 1) * 32767).astype(np.int16))

# ---------- rendu ----------
def rend(tl, sortie):
    duree = tl['duree']
    N = int(round(duree * FPS))
    tmpv = sortie + '.video.mp4'
    ff = subprocess.Popen(['ffmpeg', '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                           '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-profile:v', 'high', tmpv], stdin=subprocess.PIPE)
    beats = tl.get('punch', [])
    flashs = [s['out'] for s in tl['segs'][1:]] + tl.get('flash', [])
    shakes = tl.get('shake', [])
    rng = np.random.default_rng(3)
    for f in range(N):
        t = f / FPS
        seg = next((s for s in reversed(tl['segs']) if s['out'] <= t + 1e-9), tl['segs'][0])
        u = t - seg['out']
        if seg.get('carte'):
            img = seg['carte'](u)
        else:
            img = image_seg(seg, u)
            z = seg.get('zoom', 1.0) + seg.get('derive', 0.0) * u
            for tb in beats:
                if 0 <= t - tb < 0.35: z += tl.get('punch_force', 0.045) * math.exp(-(t - tb) / 0.09)
            dx = dy = 0
            for (ts, force) in shakes:
                if 0 <= t - ts < 0.4:
                    a = force * math.exp(-(t - ts) / 0.1); dx += rng.uniform(-a, a); dy += rng.uniform(-a, a); z = max(z, 1.0 + force / 300)
            img = zoom_crop(img, max(1.0, z), dx + seg.get('dx', 0), dy + seg.get('dy', 0))
            img = grade(img, **seg.get('grade', {}))
        for tf in flashs:
            if 0 <= t - tf < 0.12: img = img + (255 - img) * (0.55 * (1 - (t - tf) / 0.12))
        base = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).convert('RGBA')
        for c in tl.get('legendes', []):
            s, a = pop(t, c['t0'], c['t1'])
            if a <= 0: continue
            key = (c['txt'], c.get('size', 84), c.get('accent'))
            if key not in _txt_cache:
                _txt_cache[key] = rend_texte(c['txt'], size=c.get('size', 84), accent=tuple(c.get('accent', (120, 220, 255))), path=c.get('font', F_BLACK), stroke=c.get('stroke', 9))
            colle(base, _txt_cache[key], W / 2, c.get('y', 380), s, a)
        for o in tl.get('overlays', []):
            if o['t0'] <= t <= o['t1']: o['f'](base, t)
        ff.stdin.write(np.asarray(base.convert('RGB')).tobytes())
        if f % 60 == 0: print(f'{os.path.basename(sortie)} {f}/{N}', flush=True)
    ff.stdin.close(); ff.wait()
    muxe(tl, tmpv, sortie)
    os.remove(tmpv)

def muxe(tl, tmpv, sortie):
    duree = tl['duree']
    for (dest, mus, g) in ((sortie, tl.get('musique'), 1.0), (sortie.replace('.mp4', '-sans-musique.mp4'), None, 1.6)):
        wav = dest + '.wav'
        ecrit_wav(wav, mixe(duree, mus, [(p, t, gg * g) for (p, t, gg) in tl.get('sons', [])], tl.get('gain_musique', 1.0)))
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', tmpv, '-i', wav, '-c:v', 'copy',
                        # -14 LUFS, crête à -1,5 dB : la norme des plateformes — la boucle hypnotique
                        # sortait à +0,7 dBFS, écrêtée par l'encodeur AAC
                        '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11,aresample=44100',
                        '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', dest], check=True)
        os.remove(wav)
