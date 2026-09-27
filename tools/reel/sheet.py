"""python sheet.py out.png stills/t0.5.png stills/t1.png ...  → podgląd kilku klatek obok siebie (z podpisami)."""
import sys
from PIL import Image, ImageDraw
out, files = sys.argv[1], sys.argv[2:]
tw, th = 360, 640
cols = min(len(files), int(sys.argv[0] and 6))
rows = (len(files) + cols - 1) // cols
sheet = Image.new('RGB', (cols * tw, rows * (th + 22)), (25, 25, 25))
d = ImageDraw.Draw(sheet)
for i, f in enumerate(files):
    im = Image.open(f).convert('RGB').resize((tw, th), Image.LANCZOS)
    x, y = (i % cols) * tw, (i // cols) * (th + 22)
    sheet.paste(im, (x, y))
    d.text((x + 6, y + th + 4), f.split('/')[-1], fill=(230, 230, 230))
sheet.save(out)
