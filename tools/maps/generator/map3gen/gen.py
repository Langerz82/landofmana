"""Generate a 1024x1024 Tiled map in the style of map2.json.

Biomes north->south: volcano | desert | swamp/graveyard | forest | river | villages | beach | sea.
Terrain uses the tilesheet's octagon blob sets; objects and cliff features are stamps lifted
from map2.json; long ledges use the cliff piece grammar from generator/run.js.
"""
import json, pickle, sys, time
import numpy as np
from collections import defaultdict
from scipy import ndimage
from octo import tile as otile, clean, octshape, FAM, block
from noise import fbm

import argparse, os
from paths import data, cache
ap = argparse.ArgumentParser(description='Generate a 1024x1024 map in the style of map2.json')
ap.add_argument('--seed', type=int, default=7, help='random seed (7 reproduces the delivered map3.json)')
ap.add_argument('--out', default=data('map3.json'), help='output Tiled JSON (default: tools/maps/data/map3.json)')
ap.add_argument('--preview', default=None, help='optional PNG preview path (2px per tile)')
args = ap.parse_args()
SEED, OUT = args.seed, args.out
W = H = 1024
rng = np.random.default_rng(SEED)
t0 = time.time()
def log(*a): print(f'[{time.time()-t0:6.1f}s]', *a, flush=True)

FAM['dsand'] = block(808, fill=[[871, 872], [891, 892]])
FAM['dead'] = block(483, fill=[[546, 547], [566, 567]])
FAM['canyon'] = block(1295, fill=[[1358, 1359], [1378, 1379]])
FAM['forestlake'] = dict(FAM['lake'])

S = pickle.load(open(cache('stamps.pkl'), 'rb'))
# drop stamps that were clipped by map2's strip edges
for g in S:
    S[g] = [s for s in S[g] if s['src'][1] > 0 and s['src'][1] + s['w'] < 92]
def _has(s, ids): return any(np.isin(a, ids).any() for a in s['tiles'].values())
S['ftree'] = [s for s in S['ftree'] if _has(s, [234])]
S['house'] = [s for s in S['house'] if s['h'] >= 4 and s['w'] >= 3]
S['vtree'] = [s for s in S['vtree'] if not _has(s, [241, 261, 141])]
_Q = np.load(cache('quad.npy')); OPQ = np.flatnonzero(_Q.min(1) > 0.97) + 1
_M2 = np.load(cache('map2.npz'))
_GR = (_M2['grass'] != 0) | (_M2['forest'] != 0)
_DG = _M2['dead grass'] != 0
for g in S:
    for s in S[g]:
        y, x = s['src']; f = s['foot']
        s['opq'] = _has(s, OPQ)
        s['bg'] = 'grass' if _GR[y:y + s['h'], x:x + s['w']][f].mean() > 0.5 else (
                  'dead' if _DG[y:y + s['h'], x:x + s['w']][f].mean() > 0.5 else 'ground')

LY = defaultdict(lambda: np.zeros((H, W), np.int32))
occ = np.zeros((H, W), bool)      # cells taken by cliffs / objects / reserved features
blk = np.zeros((H, W), bool)      # extra blocking (map2 'blocking' layer semantics)
YY, XX = np.mgrid[0:H, 0:W]
COLS = np.arange(W)

def n1(scale, seed, octaves=3):
    return fbm((8, W), np.random.default_rng(seed), scale, octaves)[3]

def noise(scale, seed, octaves=4):
    return fbm((H, W), np.random.default_rng(seed), scale, octaves)

def blobmask(region, thr, scale, seed, r=2, coarse=2):
    f = fbm((H // coarse + 2, W // coarse + 2), np.random.default_rng(seed), max(2, scale // coarse))
    m = np.kron(f > thr, np.ones((coarse, coarse), bool))[:H, :W]
    return m & region

def finish(m, r=2):
    return clean(octshape(m, r))

def put_pattern(layer, mask, pat):
    pat = np.array(pat); ph, pw = pat.shape
    LY[layer][mask] = pat[YY[mask] % ph, XX[mask] % pw]

# ---------------------------------------------------------------- ledges
FL = np.array([1033, 0, 0, 0, 1032, 1033, 0, 0, 1052, 1053, 1033, 0, 1072, 1073, 1032, 1033,
               1092, 1093, 1052, 1053, 0, 0, 1072, 1073, 0, 0, 1092, 1093]).reshape(7, 4)
FR = np.array([0, 0, 0, 1038, 0, 0, 1038, 1039, 0, 1038, 1058, 1059, 1038, 1039, 1078, 1079,
               1058, 1059, 1098, 1099, 1078, 1079, 0, 0, 1098, 1099, 0, 0]).reshape(7, 4)
FM = np.array([1054, 1055, 1056, 1057, 1074, 1075, 1076, 1077, 1094, 1095, 1096, 1097]).reshape(3, 4)

def ledge_cells(x, y, seq):
    cells = {}
    for c in seq:
        if c == 'F': p, py = FM, y
        elif c == 'D': p, py = FL, y; y += 4
        else: p, py = FR, y - 4; y -= 4
        for j, i in zip(*np.nonzero(p)):
            cells.setdefault((py + j, x + i), int(p[j, i]))
        x += 4
    return cells, x, y

def rand_seq(n, ylo, yhi, y):
    seq = ['D']; y += 4
    for k in range(n - 2):
        r = rng.random()
        if y > yhi: c = 'U' if r < 0.5 else 'F'
        elif y < ylo: c = 'D' if r < 0.5 else 'F'
        else: c = 'F' if r < 0.5 else ('D' if r < 0.75 else 'U')
        if c == 'D' and seq[-1] == 'U': c = 'F'
        seq.append(c); y += 4 if c == 'D' else (-4 if c == 'U' else 0)
    if seq[-1] == 'U' and False: pass
    seq.append('U')
    return ''.join(seq)

def commit_ledge(cells, margin=1, check=True, region=None):
    ys = np.array([c[0] for c in cells]); xs = np.array([c[1] for c in cells])
    if ys.min() < 1 or ys.max() >= H - 1 or xs.min() < 0 or xs.max() >= W: return False
    if check:
        y0, y1, x0, x1 = ys.min() - margin, ys.max() + margin + 1, max(0, xs.min() - margin), min(W, xs.max() + margin + 1)
        fp = np.zeros((y1 - y0, x1 - x0), bool); fp[ys - y0, xs - x0] = True
        fp = ndimage.binary_dilation(fp, iterations=margin)
        if (occ[y0:y1, x0:x1] & fp).any(): return False
        if region is not None and not region[y0:y1, x0:x1][fp].all(): return False
    for (y, x), g in cells.items():
        LY['Cliffs'][y, x] = g
    occ[ys, xs] = True
    return True

def boundary_ledge(ybase, seed, gapw=(8, 14)):
    """Full-width ledge with gaps. Returns rim row per column (float, interpolated in gaps)."""
    top = np.full(W, np.nan); x = 0; y = ybase; gaps = []
    while x < W - 12:
        n = int(rng.integers(8, 22))
        n = min(n, (W - x) // 4)
        if n < 3: break
        seq = rand_seq(n, ybase - 14, ybase + 14, y)
        cells, x2, y2 = ledge_cells(x, y, seq)
        commit_ledge(cells, check=False)
        for (cy, cx), g in cells.items():
            if np.isnan(top[cx]) or cy < top[cx]: top[cx] = cy
        x, y = x2, y2
        g0 = x; x += int(rng.integers(*gapw)); gaps.append((g0, min(x, W)))
    if gaps: gaps[-1] = (gaps[-1][0], W)     # trailing columns behave as a gap
    # rim -> interpolate gaps
    idx = np.flatnonzero(~np.isnan(top))
    top = np.interp(COLS, idx, top[idx])
    return np.round(top).astype(int), gaps

log('boundary ledges')
topV, gapsV = boundary_ledge(196, 1)     # volcano / desert
topB, gapsB = boundary_ledge(922, 2)     # village / beach
yD = (410 + 22 * n1(160, 11)).astype(int)
yS = (565 + 22 * n1(160, 12)).astype(int)
yR = (748 + 14 * n1(220, 13) + 6 * n1(60, 14))
yC = 1000                                   # shoreline row

R_volc = YY <= topV[None]
R_desert = (YY > topV[None]) & (YY < yD[None])
R_swamp = (YY >= yD[None]) & (YY < yS[None])
R_forest = (YY >= yS[None]) & (YY < yR[None])
R_village = (YY >= yR[None]) & (YY <= topB[None])
R_beach = (YY > topB[None]) & (YY < yC)
R_sea = YY >= yC
in_gapB = np.zeros(W, bool)
for a, b in gapsB: in_gapB[max(0, a - 2):min(W, b + 2)] = True

# ---------------------------------------------------------------- river & paths
log('river, paths')
rw = 3.0 + 1.0 * (n1(90, 15) > 0.6)
river = np.abs(YY - yR[None]) <= rw[None]
river = finish(river, 2)
LY['water'][otile(river, 'lake') == 0] = 0
lk = otile(river, 'lake'); LY['lakes'][river] = lk[river]
LY['water'][river & (lk == 0)] = 406
occ |= ndimage.binary_dilation(river, iterations=1)
rtop = np.where(river.any(0), river.argmax(0), 0)
rbot = np.where(river.any(0), H - 1 - river[::-1].argmax(0), 0)

def walk_trail(x, y0, y1, wig=0.25):
    pts = []; dx = 0
    for y in range(y0, y1):
        if rng.random() < wig: dx = int(rng.integers(-1, 2))
        if abs(y - yR[x]) < 14: dx = 0
        x = int(np.clip(x + dx, 6, W - 7)); pts.append((y, x))
    return pts

paths_c = np.zeros((H, W), bool)
trail_x = []
for k, x in enumerate(np.linspace(70, W - 70, 6).astype(int) + rng.integers(-30, 30, 6)):
    y0 = int(yS[x]) - 25; pts = walk_trail(int(x), y0, int(yR[x]) + 18)
    for y, px in pts: paths_c[y, px - 1:px + 2] = True
    # x where it meets the river centre
    trail_x.append([px for y, px in pts if abs(y - yR[px]) < 1][0])
for k in range(4):                       # east-west forest connectors
    y = int(rng.integers(600, 700)); x = int(rng.integers(40, W - 300)); L = int(rng.integers(120, 260)); dy = 0
    for i in range(L):
        if rng.random() < 0.25: dy = int(rng.integers(-1, 2))
        y = int(np.clip(y + dy, 590, 715)); xx = x + i
        if xx >= W - 6: break
        paths_c[y - 1:y + 2, xx] = True
paths = finish(paths_c & ~ndimage.binary_dilation(river, iterations=1), 1)
paths &= ~river
paths = clean(paths)
LY['forest paths'][paths] = otile(paths, 'mud')[paths]
occ |= paths

def bridge(xc):
    x0 = xc - 1
    if x0 < 2 or x0 + 4 >= W: return
    cols = slice(x0, x0 + 4)
    rr = np.flatnonzero(river[:, cols].any(1))
    if len(rr) == 0: return
    r0, r1 = rr.min() - 2, rr.max() + 2
    LY['Bridge'][r0:r1 + 1, x0:x0 + 4] = np.array([7, 8, 9, 10])[None]
    LY['water'][r0:r1 + 1, x0 + 1:x0 + 3] = 0; LY['lakes'][r0:r1 + 1, x0 + 1:x0 + 3] = 0
    LY['bridges shadows'][r0 + 1, x0 + 3] = 63
    LY['bridges shadows'][r0 + 2:r1, x0 + 3] = 83
    LY['bridges shadows'][r1, x0 + 3] = 103
    occ[r0 - 1:r1 + 2, x0 - 1:x0 + 5] = True
    paths_ok = np.zeros((H, W), bool); paths_ok[r0 - 2:r1 + 3, x0:x0 + 4] = True
    return paths_ok
for x in trail_x: bridge(int(x))
for x in range(130, W - 60, 240):        # extra crossings between trails
    if min(abs(x - t) for t in trail_x) > 40: bridge(x)

# ---------------------------------------------------------------- base terrain
log('terrain')
land = ~R_beach & ~R_sea
put_pattern('ground', land | (R_beach & (YY <= topB[None] + 2)), [[15, 16], [35, 36]])

# volcano: dark dryground base with reddish dryground2 patches.
# Near gaps in the boundary ledge the dark base stops and dryground2 edges blend onto the sand.
in_gapV = np.zeros(W, bool)
for a, b in gapsV: in_gapV[max(0, a - 3):min(W, b + 3)] = True
gapzoneV = in_gapV[None] & (YY > topV[None] - 6) & (YY <= topV[None] + 1)
d2 = blobmask(R_volc, 0.25, 22, 21) | gapzoneV
d2 &= YY <= (topV + 1)[None]
d2 = finish(d2, 2) & (YY <= (topV + 1)[None]); d2 = clean(d2)
LY['dryground2'][d2] = otile(d2, 'dry2')[d2]
above = YY <= (topV + 1)[None]
# dry2 edge cells that touch the desert directly (only happens inside ledge gaps): no dark under them
touch = d2 & ndimage.binary_dilation(~above, structure=np.ones((3, 3)))
dark = above & ~touch
put_pattern('dryground', dark, [[419, 420], [439, 440]])
volc_floor = dark | d2

# lava fields: black canyon floor with lava pools, set into the dark ground
lava_region = blobmask(R_volc & (YY > 10) & (YY < topV[None] - 16), 0.9, 40, 23, coarse=4)
lava_region = finish(lava_region, 3) & ndimage.binary_erosion(volc_floor & (YY < topV[None] - 10), iterations=4)
lava_region = clean(lava_region)
pools = finish(blobmask(lava_region, 0.2, 14, 24) & ndimage.binary_erosion(lava_region, iterations=3), 2)
canyon = clean(lava_region & ~pools)
lavam = ndimage.binary_dilation(pools, iterations=1) & lava_region
LY['lava'][lavam] = 1181
deco = lavam & ndimage.binary_erosion(lavam, iterations=1) & (noise(3, 25) > 1.6)
LY['lava'][deco] = rng.choice([1401, 1411, 1421, 1428], size=int(deco.sum()))
LY['canyon'][canyon] = otile(canyon, 'canyon')[canyon]
occ |= ndimage.binary_dilation(lavam, iterations=1)

# desert: pink dsand patches
ds = finish(blobmask(R_desert & (YY > (topV + 4)[None]), 0.35, 18, 31) |
            blobmask(R_swamp, 1.2, 14, 32), 2)
LY['dryground'][ds] = otile(ds, 'dsand')[ds]

# swamp: dead grass + graveyard mud
dg = finish(blobmask(R_swamp | (R_desert & (YY > yD[None] - 40)), -0.25, 18, 41) &
            ~(R_desert & (noise(30, 42) < 0.4 + (yD[None] - YY) / 40.0)), 2)
LY['dead grass'][dg] = otile(dg, 'dead')[dg]
gm = finish(blobmask(R_swamp & ndimage.binary_erosion(dg, iterations=2), 0.6, 10, 43), 2)
LY['graveyard mud'][gm] = otile(gm, 'mud')[gm]

# lush grass: forest (dense) + villages (patchy) ; banks of the river always grassy
vil_centres = [(int(yR[x] + (topB[x] - yR[x]) * f), int(x)) for x, f in
               zip(np.linspace(100, W - 100, 6).astype(int), [0.55, 0.45, 0.6, 0.5, 0.45, 0.55])]
vil_centres[2] = (int((yR[512] + topB[512]) / 2), 512)       # start village in the middle
vd = np.full((H, W), 1e9)
for cy, cx in vil_centres: vd = np.minimum(vd, np.hypot(YY - cy, (XX - cx) * 0.8))
gthr = np.where(R_forest, -1.25, -0.3) + np.where(vd < 45, 0.9 * (1 - vd / 45), 0)
gr = (noise(22, 51) > gthr) & (R_forest | R_village)
gr &= ~(R_forest & (YY < yS[None] + 12) & (noise(16, 52) < (yS[None] + 12 - YY) / 12.0))
gr |= ndimage.binary_dilation(river, iterations=3)
gap_rows = (YY >= topB[None] - 6) & (YY <= topB[None] + 3) & in_gapB[None]
gr |= gap_rows
gr |= ndimage.binary_dilation(paths, iterations=2)
gr &= (YY <= topB[None] + 3)
gr = finish(gr, 2) & (YY <= topB[None] + 3)
gr = clean(gr)
LY['grass'][gr] = otile(gr, 'grass')[gr]

# ponds
def ponds(region, thr, seed, layer, fillayer):
    p = finish(blobmask(region & ~occ, thr, 12, seed), 2)
    p = clean(p & ndimage.binary_erosion(region & ~occ, iterations=2))
    t = otile(p, 'lake')
    LY[layer][p] = t[p]
    LY[fillayer][p & (t == 0)] = 406
    occ[ndimage.binary_dilation(p, iterations=1)] = True
ginner = ndimage.binary_erosion(gr, iterations=3)
ponds(ginner & R_forest, 1.55, 61, 'forest lakes', 'forest lakes')
ponds(ginner & R_village & (vd > 30), 1.6, 62, 'lakes', 'water')

# beach sand + sea
bs = R_beach | (YY == yC) | ((YY > topB[None]) & (YY <= topB[None] + 4) & ~R_sea)
LY['sand'][bs] = 359
alt = bs & (noise(10, 71) > 0.7)
alt = ndimage.binary_dilation(alt[::2, ::2], iterations=0)
a2 = np.kron(alt, np.ones((2, 2), bool))[:H, :W] & bs
put_pattern('sand', a2, [[299, 300], [319, 320]])
put_pattern('sand', (YY == yC) & bs, [[319, 320]])
LY['sand'][yC - 1] = 400
LY['sea'][yC] = 1781; LY['sea'][yC + 1] = 1801; LY['sea'][yC + 2] = 1921; LY['water'][yC + 2] = 1800
LY['sea'][yC + 3:] = 1820
occ[yC - 2:] = True

# ---------------------------------------------------------------- stamps
log('cliffs & stamps')
def place(s, y, x, allow, margin=1, mark=None):
    h, w = s['h'], s['w']
    if y - margin < 1 or x - margin < 1 or y + h + margin >= H - 1 or x + w + margin >= W - 1: return False
    foot = s['foot']
    if margin:
        fp = np.pad(foot, margin)
        fp = ndimage.binary_dilation(fp, iterations=margin)
        sub = occ[y - margin:y + h + margin, x - margin:x + w + margin]
        if (sub & fp).any(): return False
    elif (occ[y:y + h, x:x + w] & foot).any(): return False
    if allow is not None and not allow[y:y + h, x:x + w][foot].all(): return False
    for nm, a in s['tiles'].items():
        m = a != 0
        LY[nm][y:y + h, x:x + w][m] = a[m]
    blk[y:y + h, x:x + w] |= s['blk']
    occ[y:y + h, x:x + w] |= foot
    return True

BGMASK = {}
def scatter(group, n, allow, margin=1, tries=8, weights=True, region_box=None):
    st = S[group]
    if group in ('grassvar', 'groundvar', 'rock', 'leaves', 'camp') and BGMASK:
        out = 0
        for bgname in ('grass', 'ground', 'dead'):
            sub = [s for s in st if (s['bg'] == bgname) or not s['opq']]
            if not sub: continue
            S['_tmp'] = sub
            k = int(round(n * len([s for s in st if s['bg'] == bgname or not s['opq']]) / len(st)))
            out += scatter('_tmp', k, allow & BGMASK[bgname], margin, tries, weights)
        return out
    if not st: return 0
    w = np.array([s['n'] for s in st], float) if weights else np.ones(len(st))
    w = w ** 0.5; w /= w.sum()
    ys, xs = np.nonzero(allow)
    if len(ys) == 0: return 0
    placed = 0
    for i in range(n * tries):
        if placed >= n: break
        s = st[rng.choice(len(st), p=w)]
        k = rng.integers(len(ys))
        y, x = int(ys[k]) - s['h'] + 1, int(xs[k]) - s['w'] // 2
        if place(s, y, x, allow, margin): placed += 1
    return placed

# desert / swamp / beach bowls built from the ledge grammar
def bowls(region, n, plen=(3, 9)):
    ys, xs = np.nonzero(region); c = 0
    for i in range(n * 10):
        if c >= n: break
        k = rng.integers(len(ys)); y, x = int(ys[k]), int(xs[k])
        seq = rand_seq(int(rng.integers(*plen)), y - 6, y + 8, y)
        cells, _, _ = ledge_cells(x, y, seq)
        if commit_ledge(cells, margin=2, region=region): c += 1
    return c

desert_ok = R_desert & (YY > (topV + 8)[None]) & (YY < yD[None] - 4)
print('desert bowls', bowls(desert_ok, 70), file=sys.stderr)
print('swamp bowls', bowls(R_swamp & (YY > yD[None] + 6) & (YY < yS[None] - 10), 14, (3, 7)), file=sys.stderr)
print('beach bowls', bowls(R_beach & (YY > topB[None] + 10) & (YY < yC - 12), 12, (3, 6)), file=sys.stderr)

volc_ok = R_volc & volc_floor & (YY > 4) & (YY < topV[None] - 6) & ~lava_region
cliff_rings = S['cliff_volc'] + S['cliff_desert']
for s in cliff_rings: s['n'] = 1
S['cliffs_any'] = cliff_rings
print('volc cliffs', scatter('cliffs_any', 55, volc_ok, margin=2), file=sys.stderr)
print('desert cliffs', scatter('cliffs_any', 30, desert_ok, margin=2), file=sys.stderr)
print('beach cliffs', scatter('cliff_beach', 14, R_beach & (YY > topB[None] + 8) & (YY < yC - 8), margin=2), file=sys.stderr)

# lava crater: fill some ring interiors with lava
lab, nl = ndimage.label(LY['Cliffs'] != 0, structure=np.ones((3, 3)))
holes = ndimage.binary_fill_holes(LY['Cliffs'] != 0) & (LY['Cliffs'] == 0)
hl, nh = ndimage.label(holes)
for i, sl in enumerate(ndimage.find_objects(hl), 1):
    m = hl[sl] == i
    yc = (sl[0].start + sl[0].stop) // 2; xc = (sl[1].start + sl[1].stop) // 2
    if R_volc[yc, xc] and m.sum() >= 6 and rng.random() < 0.6:
        LY['lava'][sl][m] = 1181
    occ[sl][m] = True

log('objects')
BGMASK.update(grass=ndimage.binary_erosion(gr, iterations=1),
              ground=ndimage.binary_erosion(~gr & ~dg & ~ds & land, iterations=1),
              dead=ndimage.binary_erosion(dg, iterations=1))
notcliff = LY['Cliffs'] == 0
ground_only = land & ~gr & ~dg & notcliff
g_in = ndimage.binary_erosion(gr, iterations=1)
counts = {}
def sc(name, group, n, allow, margin=1, tries=8):
    counts[name] = scatter(group, n, allow & notcliff, margin, tries)

# villages: houses clustered around centres
for vi, (cy, cx) in enumerate(vil_centres):
    near = (np.hypot(YY - cy, (XX - cx) * 0.8) < 42) & R_village & (YY < topB[None] - 8)
    sc(f'houses{vi}', 'house', 14 if vi != 2 else 18, near, margin=2)
sc('vtrees', 'vtree', 1600, g_in & R_village, tries=20)
sc('vrocks', 'rock', 90, R_village & land)
sc('vcamps', 'camp', 40, R_village & land)
sc('grassvar', 'grassvar', 900, g_in & (R_village | R_forest), margin=0)
# forest
fbox = g_in & R_forest & ~ndimage.binary_dilation(paths, iterations=1)
sc('ftrees', 'ftree', 9000, fbox, margin=0, tries=40)
sc('fobj', 'fobj', 40, R_forest & land)
sc('frocks', 'rock', 60, R_forest & land)
sc('fcamps', 'camp', 25, R_forest & land)
# swamp / graveyard
gyard = ndimage.binary_dilation(gm, iterations=4) & R_swamp
sc('graves', 'grave', 600, gyard)
sc('swamptrees', 'swamptree', 700, R_swamp & land)
sc('leaves', 'leaves', 200, R_swamp & land, margin=0)
sc('sbones', 'bones', 30, R_swamp & land)
sc('scamps', 'camp', 15, R_swamp & land)
# desert
sc('cactus', 'cactus', 500, R_desert & land)
sc('dtrees', 'dtree_desert', 160, R_desert & land)
sc('bones', 'bones', 70, R_desert & land)
sc('totems', 'totem', 70, R_desert & land)
sc('dcamps', 'camp', 30, R_desert & land)
sc('drocks', 'rock', 80, R_desert & land)
sc('groundvar', 'groundvar', 900, ground_only & (R_desert | R_swamp | R_village), margin=0)
# volcano
sc('vtrees_volc', 'dtree_volc', 300, R_volc & volc_floor & ~lava_region)
# beach
sc('beach', 'beachobj', 380, R_beach & (YY > topB[None] + 4) & (YY < yC - 3))
sc('bcamps', 'camp', 12, R_beach & (YY > topB[None] + 4) & (YY < yC - 3))
log('placed', counts)

# ---------------------------------------------------------------- blocking
M2 = np.load(cache('map2.npz')); B2 = M2['blocking'] != 0
colliding = set(np.load(cache('colliding.npy')).tolist())
from collections import Counter
cnt = Counter(); tot = Counter()
for nm in ['Cliffs', 'Cliffs 2', 'village boundaries', 'forest boundaries']:
    a = M2[nm]; nz = a > 0
    for g, b in zip(a[nz].tolist(), B2[nz].tolist()): tot[g] += 1; cnt[g] += b
HIB = [g for g in tot if tot[g] >= 3 and cnt[g] / tot[g] > 0.6 and g not in colliding]
for nm in ['Cliffs', 'Cliffs 2']:
    blk |= np.isin(LY[nm], HIB)
# ledge bodies: block the face rows so ledges can't be walked through
blk |= np.isin(LY['Cliffs'], [1074, 1075, 1076, 1077, 1032, 1052, 1072, 1053, 1073, 1039, 1058, 1059, 1078, 1079])
blk[:, 0] = blk[:, -1] = True; blk[0, :] = True
LY['blocking'][blk] = 24

# ---------------------------------------------------------------- walkability sanity: open gaps
def is_solid():
    sol = blk.copy()
    for nm, a in LY.items():
        if nm == 'blocking': continue
        nz = a > 0
        if nz.any(): sol |= nz & np.isin(a, list(colliding))
    # bridge deck is walkable over water
    deck = np.isin(LY['Bridge'], [8, 9])
    return sol & ~deck
solid = is_solid()
lab, n = ndimage.label(~solid)
sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
main = int(np.argmax(sizes)) + 1
walk_frac = (lab == main).sum() / (~solid).sum()
log(f'walkable regions={n}, main component covers {walk_frac:.3f} of walkable cells')
# probe: are biome centres reachable?
for nm, R in [('volc', R_volc), ('desert', R_desert), ('swamp', R_swamp), ('forest', R_forest),
              ('village', R_village), ('beach', R_beach)]:
    print(f'  {nm:8s} reachable share {((lab == main) & R).sum() / max(1, (R & ~solid).sum()):.2f}')

# ---------------------------------------------------------------- object layers
oid = [1]
def obj(**kw):
    o = dict(height=0, id=oid[0], name='', rotation=0, type='', visible=True, width=0, x=0, y=0)
    o.update(kw); oid[0] += 1; return o
def free_rect(region, w, h, tries=4000):
    ys, xs = np.nonzero(region & (lab == main))
    for _ in range(tries):
        k = rng.integers(len(ys)); y, x = int(ys[k]), int(xs[k])
        sub = solid[y:y + h, x:x + w]
        if sub.shape == (h, w) and not sub.any() and (lab[y:y + h, x:x + w] == main).all():
            return y, x
    return None

checkpoints = []
cy, cx = vil_centres[2]
start_zone = (np.hypot(YY - cy, XX - cx) < 30)
for i in range(6):
    r = free_rect(start_zone, 5, 3)
    if r: checkpoints.append(obj(type='start', x=r[1] * 16, y=r[0] * 16, width=80, height=48,
                                  **({'properties': [{'name': 's', 'type': 'int', 'value': 1}]} if i == 0 else {})))
for nm, R in [('village', R_village), ('beach', R_beach), ('forest', R_forest), ('swamp', R_swamp),
              ('desert', R_desert), ('volc', R_volc)]:
    for gx in range(64, W, 192):
        r = free_rect(R & (np.abs(XX - gx) < 60), 4, 3, 600)
        if r: checkpoints.append(obj(x=r[1] * 16, y=r[0] * 16, width=64, height=48))

mob_specs = [  # name, region, minLevel, maxLevel, include, weight
    ('village', R_village, 1, 3, '1', '2,1'), ('beach', R_beach, 4, 6, '2', '4,2,1'),
    ('forest', R_forest, 6, 9, '1', '2,1'), ('swamp', R_swamp, 9, 12, '2', '4,2,1'),
    ('desert', R_desert, 12, 16, '1', '2,1'), ('volc', R_volc, 16, 20, '2', '4,2,1')]
mobareas = []
for nm, R, lo, hi, inc, wt in mob_specs:
    rows = np.flatnonzero(R.any(1)); y0, y1 = rows.min(), rows.max()
    if nm == 'village':  # keep the start village itself free of mobs
        pass
    for x0 in range(16, W - 16, 256):
        ya, yb = int(y0 + 4), int(y1 - 4)
        if nm == 'volc': ya = 8
        area = (yb - ya) * 240
        props = [{'name': 'count', 'type': 'int', 'value': int(max(15, area / 900))},
                 {'name': 'include', 'type': 'string', 'value': inc},
                 {'name': 'maxLevel', 'type': 'int', 'value': hi},
                 {'name': 'minLevel', 'type': 'int', 'value': lo}]
        if wt: props.append({'name': 'weight', 'type': 'string', 'value': wt})
        if nm == 'village' and x0 <= cx < x0 + 256:
            props[0]['value'] = int(props[0]['value'] * 0.4)
        mobareas.append(obj(x=x0 * 16, y=ya * 16, width=240 * 16, height=(yb - ya) * 16, properties=props))

entities = []
r = free_rect(start_zone, 1, 1)
if r:
    entities.append(obj(x=r[1] * 16, y=r[0] * 16, width=16, height=16, properties=[
        {'name': 'kind', 'type': 'int', 'value': 2}, {'name': 'name', 'type': 'string', 'value': 'Beginner Quests'},
        {'name': 'quests', 'type': 'string', 'value': '300000,300001'}, {'name': 'type', 'type': 'string', 'value': 'npc'}]))
entityareas = []
for (yy0, R) in [(0, R_village), (0, R_forest)]:
    r = free_rect(R, 6, 5)
    if r: entityareas.append(obj(x=r[1] * 16, y=r[0] * 16, width=96, height=80, properties=[
        {'name': 'animName', 'type': 'string', 'value': 'node2'}, {'name': 'count', 'type': 'int', 'value': 5},
        {'name': 'distanceApart', 'type': 'string', 'value': '2'}, {'name': 'kind', 'type': 'int', 'value': 2},
        {'name': 'level', 'type': 'int', 'value': 2}, {'name': 'type', 'type': 'string', 'value': 'node'},
        {'name': 'weaponType', 'type': 'string', 'value': 'any'}]))
camera = [obj(x=0, y=0, width=W * 16, height=H * 16)]

# ---------------------------------------------------------------- write Tiled JSON
log('writing', OUT)
src = json.load(open(data('map2.json')))
order = [l['name'] for l in src['layers']]
tilelayers = []; lid = 1
objlayers = {'doors_old': [], 'entityareas': entityareas, 'mobareas': mobareas, 'entities': entities,
             'checkpoints': checkpoints, 'camera': camera}
parts = []
for l in src['layers']:
    nm = l['name']
    if l['type'] == 'tilelayer':
        a = LY.get(nm)
        keep = nm in ("don't remove this layer", 'blocking') or (a is not None and a.any())
        if not keep: continue
        if a is None: a = np.zeros((H, W), np.int32)
        hdr = {'data': None, 'height': H, 'id': lid, 'name': nm, 'opacity': l.get('opacity', 1),
               'type': 'tilelayer', 'visible': l.get('visible', True), 'width': W, 'x': 0, 'y': 0}
        if l.get('locked'): hdr['locked'] = True
        s = json.dumps(hdr)
        s = s.replace('"data": null', '"data":[' + ','.join(map(str, a.ravel().tolist())) + ']')
        parts.append(s); lid += 1
    else:
        if nm not in objlayers or (nm == 'doors_old'): continue
        hdr = {'draworder': 'topdown', 'id': lid, 'name': nm, 'objects': objlayers[nm], 'opacity': 1,
               'type': 'objectgroup', 'visible': l.get('visible', True), 'x': 0, 'y': 0}
        if l.get('locked'): hdr['locked'] = True
        parts.append(json.dumps(hdr)); lid += 1
head = {'compressionlevel': -1, 'height': H, 'infinite': False}
tail = {'nextlayerid': lid, 'nextobjectid': oid[0], 'orientation': 'orthogonal', 'renderorder': 'right-down',
        'tiledversion': '1.10.2', 'tileheight': 16, 'tilesets': [{'firstgid': 1, 'source': 'tilesheet.tsx'}],
        'tilewidth': 16, 'type': 'map', 'version': '1.10', 'width': W}
with open(OUT, 'w') as f:
    f.write(json.dumps(head)[:-1] + ',\n "layers":[\n' + ',\n'.join(parts) + '],\n ' + json.dumps(tail)[1:] + '\n')
np.savez(cache('bounds.npz'), topV=topV, topB=topB, gapsV=np.array(gapsV), gapsB=np.array(gapsB), yR=yR)
np.savez_compressed(cache('gen_layers.npz'), **{k: v for k, v in LY.items()})
if args.preview:
    from render import render_layers
    render_layers([LY[n] for n in order if n in LY and n != 'blocking'], args.preview, 2)
    log('preview', args.preview)
log('done')
