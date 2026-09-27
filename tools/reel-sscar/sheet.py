# python sheet.py out.png t1 t2 ... — zestawia stills/t*.png w arkusz (podgląd kadrów)
import sys
from PIL import Image, ImageDraw
out, ts = sys.argv[1], sys.argv[2:]
cols = min(4, len(ts)); rows = (len(ts) + cols - 1) // cols
w, h = 1080 // 3, 1920 // 3
sheet = Image.new('RGB', (cols * w, rows * h), (30, 30, 30))
for i, t in enumerate(ts):
    im = Image.open(f'stills/t{t}.png').convert('RGB').resize((w, h), Image.LANCZOS)
    ImageDraw.Draw(im).text((8, 8), t, fill=(255, 255, 0))
    sheet.paste(im, ((i % cols) * w, (i // cols) * h))
sheet.save(out)
