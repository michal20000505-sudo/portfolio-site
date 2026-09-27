"""Kontury M, J i kropki ze Space Grotesk 700 → assets/glyphs.json (morfing logo w outro)."""
import json, os
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
os.chdir(os.path.dirname(os.path.abspath(__file__)))
f = instancer.instantiateVariableFont(TTFont('../../fonts/space-grotesk-latin.woff2'), {'wght': 700})
gs, cmap, hm = f.getGlyphSet(), f.getBestCmap(), f['hmtx']
out = {}
for ch in 'MJ.':
    n = cmap[ord(ch)]
    p = SVGPathPen(gs); gs[n].draw(p)
    b = BoundsPen(gs); gs[n].draw(b)
    out[ch] = {'d': p.getCommands(), 'adv': hm[n][0], 'bounds': b.bounds}
json.dump(out, open('assets/glyphs.json', 'w'))
print({k: v['adv'] for k, v in out.items()})
