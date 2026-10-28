"""Step 1: build the caches the generator learns from (run again if map2.json or the tilesheet change).

Creates cache/map2.npz (map2 layers), cache/quad.npy (tile opacity per quadrant),
cache/colliding.npy (gids the tileset marks as colliding) and cache/stamps.pkl (objects lifted from map2).
"""
import json, re, sys
import numpy as np
from PIL import Image
from paths import data, cache

src = sys.argv[1] if len(sys.argv) > 1 else 'map2.json'
d = json.load(open(data(src)))
np.savez_compressed(cache('map2.npz'), **{l['name']: np.array(l['data'], dtype=np.int64).reshape(d['height'], d['width'])
                                          for l in d['layers'] if l['type'] == 'tilelayer'})
print('map2 layers cached')

im = np.array(Image.open(data('tilesheet.png')).convert('RGBA'))
rows = im.shape[0] // 16
A = im[:rows * 16, :, 3] > 0
T = A.reshape(rows, 16, 20, 16).transpose(0, 2, 1, 3).reshape(-1, 16, 16)
q = np.stack([T[:, :8, :8].mean((1, 2)), T[:, :8, 8:].mean((1, 2)), T[:, 8:, :8].mean((1, 2)), T[:, 8:, 8:].mean((1, 2))], 1)
np.save(cache('quad.npy'), q)

x = open(data('tilesheet.tsx')).read()
col = set()
for m in re.finditer(r'<tile id="(\d+)"(.*?)</tile>', x, re.S):
    if '<objectgroup' in m.group(2) or re.search(r'name="c"', m.group(2)): col.add(int(m.group(1)) + 1)
np.save(cache('colliding.npy'), np.array(sorted(col)))
print('tileset info cached:', len(col), 'colliding tiles')

import runpy
runpy.run_path(__import__('os').path.join(__import__('os').path.dirname(__file__), 'stamps.py'), run_name='__main__')
print('stamps cached')
