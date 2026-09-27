# python strip.py wideo.mp4 out.png t0 t1 n — n klatek z odcinka [t0, t1] w jednym pasku (sprawdzanie ruchu i przejść)
import sys, subprocess, os, tempfile
from PIL import Image, ImageDraw
src, out, t0, t1, n = sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4]), int(sys.argv[5])
cols = min(n, 6); rows = (n + cols - 1) // cols
w, h = 216, 384
sheet = Image.new('RGB', (cols * w, rows * h), (30, 30, 30))
tmp = tempfile.mkdtemp()
for i in range(n):
    t = t0 + (t1 - t0) * i / max(1, n - 1)
    f = os.path.join(tmp, f'{i}.png')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', f'{t:.3f}', '-i', src, '-frames:v', '1', f], check=True)
    im = Image.open(f).convert('RGB').resize((w, h), Image.LANCZOS)
    ImageDraw.Draw(im).text((6, 6), f'{t:.2f}', fill=(255, 255, 0))
    sheet.paste(im, ((i % cols) * w, (i // cols) * h))
sheet.save(out)
