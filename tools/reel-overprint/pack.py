# python pack.py — surowe zrzuty z capture.js (assets/cap/*.png, w .gitignore) → assets/img/*.webp (w repo)
import json, os, shutil
from PIL import Image
src, dst = 'assets/cap', 'assets/img'
os.makedirs(dst, exist_ok=True)
for f in sorted(os.listdir(src)):
    p = os.path.join(src, f)
    if f.endswith('.json'):
        shutil.copy(p, os.path.join(dst, f)); continue
    if not f.endswith('.png'):
        continue
    im = Image.open(p)
    out = os.path.join(dst, f[:-4] + '.webp')
    if im.mode == 'RGBA' and im.getextrema()[3][0] < 255:
        im.save(out, 'WEBP', quality=92, method=6)
    else:
        im.convert('RGB').save(out, 'WEBP', quality=90, method=6)
    print(f, im.size, os.path.getsize(out) // 1024, 'KB')
