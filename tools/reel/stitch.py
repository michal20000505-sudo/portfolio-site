"""Skleja kafelki z capture_sites.js w jeden długi zrzut (webp) do telefonu w scenie www."""
from PIL import Image
OFFS = {'bodycreator': [0, 844, 1496, 1496]}
for name in ['sscar', 'bodycreator', 'handybruk', 'rmax', 'mjaro']:
    offs = OFFS.get(name, [0, 844, 1688, 2532])
    tiles = [Image.open(f'assets/mobile/{name}_{k}.png').convert('RGB') for k in range(4)]
    w = tiles[0].width
    h = (offs[-1] + 844) * 2
    out = Image.new('RGB', (w, h))
    for k, t in enumerate(tiles):
        out.paste(t, (0, offs[k] * 2))
    out.save(f'assets/mobile/{name}.webp', quality=92)
    print(name, out.size)
