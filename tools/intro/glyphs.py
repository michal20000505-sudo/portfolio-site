"""Wyciąga kontury M, J i kropki ze Space Grotesk 700 -> glyphs.js (używane przez intro.html)."""
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
import json
import os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
f = TTFont('../../fonts/space-grotesk-latin.woff2')
print(f['fvar'].axes[0].axisTag if 'fvar' in f else 'static')
f = instancer.instantiateVariableFont(f, {'wght': 700})
gs = f.getGlyphSet(); cmap = f.getBestCmap(); hm = f['hmtx']
out = {'upm': f['head'].unitsPerEm, 'asc': f['hhea'].ascent, 'glyphs': {}}
for ch in 'MJ.':
    n = cmap[ord(ch)]
    p = SVGPathPen(gs); gs[n].draw(p)
    b = BoundsPen(gs); gs[n].draw(b)
    out['glyphs'][ch] = {'d': p.getCommands(), 'adv': hm[n][0], 'bounds': b.bounds}
    print(ch, hm[n][0], b.bounds, p.getCommands().count('M'))
# kerning M-J ignored
open('glyphs.js', 'w').write('window.GLYPHS=' + json.dumps(out) + ';\n')
