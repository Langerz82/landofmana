"""Render a Tiled map JSON (or the generator's cache/gen_layers.npz) to PNG.

usage: python render.py ../../data/map4.json out.png [px_per_tile=2] [y0 y1 x0 x1]
"""
import json, sys
import numpy as np
from PIL import Image
from paths import data

def _atlas(s):
    im = np.array(Image.open(data('tilesheet.png')).convert('RGBA'))
    rows = im.shape[0] // 16
    T = (im[:rows * 16].astype(np.float32) / 255).reshape(rows, 16, 20, 16, 4).transpose(0, 2, 1, 3, 4).reshape(-1, 16, 16, 4)
    if s != 16:
        f = 16 // s
        T = T.reshape(-1, s, f, s, f, 4).mean((2, 4))
    return np.concatenate([np.zeros((1, s, s, 4), np.float32), T])

def render_layers(layers, out, s=2, win=None):
    A = _atlas(s)
    H, W = layers[0].shape
    y0, y1, x0, x1 = win or (0, H, 0, W)
    img = np.zeros((y1 - y0, x1 - x0, s, s, 3), np.float32)
    for a in layers:
        g = a[y0:y1, x0:x1] & 0x1FFFFFFF
        if not g.any(): continue
        t = A[np.where(g < len(A), g, 0)]
        al = t[..., 3:4]
        img = img * (1 - al) + t[..., :3] * al
    img = img.transpose(0, 2, 1, 3, 4).reshape((y1 - y0) * s, (x1 - x0) * s, 3)
    Image.fromarray((img * 255).astype(np.uint8)).save(out)

if __name__ == '__main__':
    src, out = sys.argv[1], sys.argv[2]
    s = int(sys.argv[3]) if len(sys.argv) > 3 else 2
    win = tuple(int(v) for v in sys.argv[4:8]) if len(sys.argv) > 7 else None
    skip = {'portals', 'plateau', 'blocking', "don't remove this layer"}
    d = json.load(open(src)); W = d['width']
    layers = [np.array(l['data'], np.int64).reshape(-1, W) for l in d['layers']
              if l['type'] == 'tilelayer' and l['name'] not in skip and l.get('visible', True)]
    render_layers(layers, out, s, win)
