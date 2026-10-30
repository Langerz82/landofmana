import numpy as np, pickle
from scipy import ndimage
from paths import cache
M = np.load(cache('map2.npz'))
BLK = M['blocking'] != 0
BANDS = {'volc': (0, 56), 'desert': (56, 100), 'swamp': (100, 140), 'forest': (136, 191),
         'village': (191, 256), 'beach': (255, 298)}
X1 = 93  # overworld strip width

def extract(layers, band, maxw=12, maxh=12, minn=2, dil=1, x1=X1):
    y0, y1 = BANDS[band] if isinstance(band, str) else band
    arrs = {n: M[n][y0:y1, 0:x1] for n in layers}
    mask = np.zeros_like(next(iter(arrs.values())), bool)
    for a in arrs.values(): mask |= a != 0
    lab, n = ndimage.label(mask, structure=np.ones((3, 3)))
    out = {}
    for i, sl in enumerate(ndimage.find_objects(lab), 1):
        h = sl[0].stop - sl[0].start; w = sl[1].stop - sl[1].start
        comp = lab[sl] == i
        if comp.sum() < minn or h > maxh or w > maxw: continue
        if sl[0].start == 0 or sl[0].stop == mask.shape[0]: continue
        tiles = {nm: np.where(comp, a[sl], 0).astype(np.int32) for nm, a in arrs.items()}
        tiles = {k: v for k, v in tiles.items() if v.any()}
        blk = BLK[y0:y1, 0:x1][sl] & comp
        key = b''.join(k.encode() + v.tobytes() for k, v in sorted(tiles.items()))
        if key in out: out[key]['n'] += 1; continue
        out[key] = dict(tiles=tiles, foot=comp, blk=blk, h=h, w=w, n=1, src=(sl[0].start + y0, sl[1].start))
    return list(out.values())

GROUPS = {
    'house':       (['Houses', 'Houses layer 2', 'stone'], 'village', 12, 14),
    'vtree':       (['Trees2'], 'village', 8, 8),
    'dtree_desert':(['Trees2'], 'desert', 8, 8),
    'dtree_volc':  (['Trees2'], 'volc', 8, 8),
    'ftree':       (['forest trees'], 'forest', 6, 8),
    'swamptree':   (['dead trees'], 'swamp', 8, 8),
    'grave':       (['graveyard'], 'swamp', 10, 8),
    'cactus':      (['cactus'], (56, 140), 4, 6),
    'bones':       (['bones'], (56, 140), 8, 8),
    'totem':       (['totems'], (56, 256), 8, 8),
    'camp':        (['camps'], (56, 256), 6, 6),
    'rock':        (['Big Rocks'], (56, 256), 5, 5),
    'beachobj':    (['sand objects'], 'beach', 6, 8),
    'grassvar':    (['grassvariations'], 'village', 3, 3),
    'groundvar':   (['groundvariations'], (56, 298), 3, 3),
    'leaves':      (['dead leaves'], 'swamp', 3, 3),
    'fobj':        (['forest objects 1', 'forest objects 2'], 'forest', 8, 8),
    'cliff_desert':(['Cliffs', 'Cliffs 2'], 'desert', 34, 30),
    'cliff_volc':  (['Cliffs', 'Cliffs 2'], (0, 60), 34, 30),
    'cliff_beach': (['Cliffs', 'village boundaries'], 'beach', 34, 20),
}
if __name__ == '__main__':
    S = {}
    for g, (ls, band, mw, mh) in GROUPS.items():
        S[g] = extract(ls, band, mw, mh)
        print(g, len(S[g]), [(s['h'], s['w'], s['n']) for s in S[g]][:12])
    pickle.dump(S, open(cache('stamps.pkl'), 'wb'))
