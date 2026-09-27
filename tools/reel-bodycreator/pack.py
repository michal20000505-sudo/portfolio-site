"""Przygotowanie assetów z lokalnej kopii strony Body Creator (python pack.py [ścieżka do strony]).

- assets/site/*.png (z capture.js, DPR 3) → *.webp; sekcje dodatkowo w 2× dla ekranu telefonu (*_2x.webp)
- Logo.psb → logo rozcięte na części do animacji (B, C, napis, podpis) + logo.json z ich położeniem
- zdjęcia studia i trenerów → assets/img/*.webp
- klatki z klipu wideo ze studia (tło sceny ze stroną) → assets/clip/*.jpg
"""
import json
import os
import subprocess
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', '..', '..', 'BodycreatorTEST'))
A = os.path.join(HERE, 'assets')
GOLD = (245, 202, 0)          # --yellow ze strony (#F5CA00)


def site_captures():
    d = os.path.join(A, 'site')
    for f in sorted(os.listdir(d)):
        if not f.endswith('.png'):
            continue
        name = f[:-4]
        im = Image.open(os.path.join(d, f))
        im = im.convert('RGBA' if name == 'nav' else 'RGB')      # nawigacja nad hero jest przezroczysta
        im.save(os.path.join(d, name + '.webp'), quality=92, method=6)
        if name.startswith(('sec_', 'nav', 'index_view')):
            im.resize((im.width * 2 // 3, im.height * 2 // 3), Image.LANCZOS).save(os.path.join(d, name + '_2x.webp'), quality=92, method=6)
        print('site', name, im.size)


def logo():
    from psd_tools import PSDImage
    im = PSDImage.open(os.path.join(SITE, 'Logo.psb')).composite().convert('RGBA')
    a = np.array(im)
    al = a[..., 3]

    def bands(mask):
        out, s = [], None
        for i, o in enumerate(mask):
            if o and s is None:
                s = i
            if not o and s is not None:
                out.append((s, i - 1))
                s = None
        if s is not None:
            out.append((s, len(mask) - 1))
        return out

    rows = bands((al > 8).any(1))
    (m0, m1), (w0, w1), (g0, g1) = rows[:3]
    cols = bands((al[m0:m1 + 1] > 8).any(0))
    (b0, b1), (c0, c1) = cols[0], cols[-1]
    wc = bands((al[w0:w1 + 1] > 8).any(0))
    gc = bands((al[g0:g1 + 1] > 8).any(0))
    parts = {
        'b': (b0, m0, b1 + 1, m1 + 1, GOLD),
        'c': (c0, m0, c1 + 1, m1 + 1, GOLD),
        'word': (wc[0][0], w0, wc[-1][1] + 1, w1 + 1, None),
        'tag': (gc[0][0], g0, gc[-1][1] + 1, g1 + 1, GOLD),
    }
    d = os.path.join(A, 'logo')
    os.makedirs(d, exist_ok=True)
    meta = {'w': im.width, 'h': im.height, 'parts': {}}
    for k, (x0, y0, x1, y1, col) in parts.items():
        p = 6
        crop = a[max(0, y0 - p):y1 + p, max(0, x0 - p):x1 + p].copy()
        if col is not None:          # jednolity złoty jak na stronie (w PSB złoto jest jaśniejsze)
            crop[..., 0], crop[..., 1], crop[..., 2] = col
        Image.fromarray(crop).save(os.path.join(d, k + '.png'), optimize=True)
        meta['parts'][k] = {'x': max(0, x0 - p), 'y': max(0, y0 - p), 'w': crop.shape[1], 'h': crop.shape[0]}
        print('logo', k, meta['parts'][k])
    json.dump(meta, open(os.path.join(d, 'logo.json'), 'w'), indent=1)


def photos():
    d = os.path.join(A, 'img')
    os.makedirs(d, exist_ok=True)
    for src, name, maxw in [
        ('zdjecia_obiektu/silownia_srodek.webp', 'studio', 2048),
        ('zdjecia_obiektu/silownia_srodek2.webp', 'studio2', 2048),
        ('Trenerzy/jakub_cyndecki.webp', 'jakub', 1086),
        ('Trenerzy/aleksandra_dunajewska.webp', 'aleksandra', 1086),
        ('Trenerzy/konrad.webp', 'konrad', 1086),
        ('Trenerzy/marta.webp', 'marta', 1086),
    ]:
        im = Image.open(os.path.join(SITE, src)).convert('RGB')
        if im.width > maxw:
            im = im.resize((maxw, round(im.height * maxw / im.width)), Image.LANCZOS)
        im.save(os.path.join(d, name + '.webp'), quality=90, method=6)
        print('img', name, im.size)


def clip():
    # czarno-białe, rozmyte ujęcia ze studia (strona używa ich jako tła) — 24 kl/s, do tła sceny ze stroną
    d = os.path.join(A, 'clip')
    os.makedirs(d, exist_ok=True)
    for f in os.listdir(d):
        os.remove(os.path.join(d, f))
    counts = {}
    for name, src, ss, dur in [('rack', 'video/bg/bg-20260630_204844.mp4', 17.0, 7.2), ('wall', 'video/bg/bg-20260630_204725.mp4', 2.0, 8.0)]:
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(ss), '-t', str(dur), '-i', os.path.join(SITE, src),
                        '-vf', 'scale=360:640:flags=lanczos', '-q:v', '4', os.path.join(d, name + '_%03d.jpg')], check=True)
        counts[name] = len([f for f in os.listdir(d) if f.startswith(name)])
        print('clip', name, counts[name])
    json.dump(counts, open(os.path.join(d, 'clip.json'), 'w'))


if __name__ == '__main__':
    site_captures()
    logo()
    photos()
    clip()
