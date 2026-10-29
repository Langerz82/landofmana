"""Generate a Tiled map in the style of map2.json (default 1280x1024).

Left 768 columns: overworld. Right INTERIOR_W columns (default 512): house and cave interiors (see interiors.py),
linked to house doors and cave mouths by doors_old teleports, each room with its own camera rect.

Overworld biomes north->south: volcano | desert | swamp/graveyard | forest | river | villages | beach | sea.
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
ap = argparse.ArgumentParser(description='Generate a map in the style of map2.json: 768x1024 overworld + interior strip on the right')
ap.add_argument('--seed', type=int, default=7, help='random seed (7 reproduces the delivered map3.json)')
ap.add_argument('--out', default=data('map3.json'), help='output Tiled JSON (default: tools/maps/data/map3.json)')
ap.add_argument('--width', type=int, default=256, help='overworld width (default 256)')
ap.add_argument('--height', type=int, default=512, help='map height (default 512)')
ap.add_argument('--interior-width', type=int, default=256, help='width of the interior strip right of the overworld (default 256)')
ap.add_argument('--preview', default=None, help='optional PNG preview path (2px per tile)')
args = ap.parse_args()
SEED, OUT = args.seed, args.out
W = args.width                     # overworld width
INTERIOR_W = args.interior_width   # strip right of the overworld that holds the house/cave interiors
MAPW = W + INTERIOR_W              # full map width (512 by default)
H = args.height
SY = H / 1024.0                    # vertical layout below was designed for 1024 rows; scale it
SCALE = W / 1024     # object / feature counts were tuned for a 1024-wide overworld
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
# ground variations must never block: drop any whose tiles the tileset marks as colliding
_COLL = np.load(cache('colliding.npy'))
for _g in ('groundvar', 'grassvar'):          # ground and grass variations must never block:
    S[_g] = [s for s in S[_g] if not _has(s, _COLL)]   # no tileset-colliding tiles,
    for s in S[_g]: s['blk'] = np.zeros_like(s['blk'])  # and no blocking copied from map2
S['house'] = [s for s in S['house'] if s['h'] >= 4 and s['w'] >= 3]


def _rebuild(s, tiles):
    """Re-trim a stamp after editing its tile layers."""
    tiles = {k: v for k, v in tiles.items() if v.any()}
    nz = np.zeros_like(next(iter(tiles.values())), bool)
    for v in tiles.values(): nz |= v != 0
    ys, xs = np.nonzero(nz); y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    s = dict(s); s['tiles'] = {k: v[y0:y1, x0:x1] for k, v in tiles.items()}
    s['foot'] = nz[y0:y1, x0:x1]; s['h'], s['w'] = y1 - y0, x1 - x0
    blk_ = s.get('blk_full', None)
    s['blk'] = (blk_[y0:y1, x0:x1] if blk_ is not None else np.zeros_like(s['foot'])) & s['foot']
    s.pop('blk_full', None)
    return s


def _house_door(s):
    """(kind, row, col) of the door's bottom tile: blue houses 187|188, red houses 367/1682."""
    Hs_ = s['tiles'].get('Houses')
    if Hs_ is None: return None
    for kind, ids in (('blue', [187]), ('red', [367, 1682])):
        hit = np.argwhere(np.isin(Hs_, ids))
        if len(hit): return kind, int(hit[0][0]), int(hit[0][1])
    return None


# every house stands on a cobblestone pad: houses without one get the pad of a same-colour house
# (lined up on the door); bits of other objects stuck to two of map2's houses are removed
EXTRAS = list(range(837, 841)) + list(range(857, 861)) + list(range(877, 881)) + list(range(897, 901))
_clean = []
for s in S['house']:
    t = {k: v.copy() for k, v in s['tiles'].items()}
    for k in t: t[k][np.isin(t[k], EXTRAS)] = 0
    if _house_door(s) and 'Houses layer 2' in t and np.isin(t['Houses layer 2'], [234, 314]).any():
        t.pop('Houses layer 2')                                        # tree grown into a house
    _clean.append(_rebuild(dict(s, blk_full=s['blk']), t))
S['house'] = _clean
PAD = {}
for s in S['house']:
    d = _house_door(s)
    if d and 'stone' in s['tiles'] and d[0] not in PAD:
        ys, xs = np.nonzero(s['tiles']['stone'])
        PAD[d[0]] = [(int(y - d[1]), int(x - d[2]), int(s['tiles']['stone'][y, x])) for y, x in zip(ys, xs)]
_padded = []
for s in S['house']:
    d = _house_door(s)
    if d and 'stone' not in s['tiles'] and d[0] in PAD:
        pad = PAD[d[0]]
        oy = max(0, -min(dy + d[1] for dy, dx, t in pad)); ox = max(0, -min(dx + d[2] for dy, dx, t in pad))
        Hn = max(s['h'] + oy, oy + d[1] + max(dy for dy, dx, t in pad) + 1)
        Wn = max(s['w'] + ox, ox + d[2] + max(dx for dy, dx, t in pad) + 1)
        t = {k: np.zeros((Hn, Wn), np.int32) for k in s['tiles']}
        for k, v in s['tiles'].items(): t[k][oy:oy + s['h'], ox:ox + s['w']] = v
        st = np.zeros((Hn, Wn), np.int32)
        for dy, dx, tt in pad: st[oy + d[1] + dy, ox + d[2] + dx] = tt
        t['stone'] = st
        b = np.zeros((Hn, Wn), bool); b[oy:oy + s['h'], ox:ox + s['w']] = s['blk']
        s = _rebuild(dict(s, blk_full=b), t)
    _padded.append(s)
S['house'] = _padded
TOMB = [61, 62, 81, 82, 101, 102, 121, 122]
S['tombs'] = [s for s in S['camp'] + S['grave'] if _has(s, TOMB) and s['h'] <= 3 and s['w'] <= 3]
S['fence'] = [s for s in S['grave'] + S['camp'] if _has(s, [736, 737, 738, 739, 740]) and s['h'] <= 2]
S['camp'] = [s for s in S['camp'] if not _has(s, TOMB + [736, 737, 738, 739, 740])]   # tombstones only in clumps
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
occ = np.zeros((H, W), bool)
FRONTS = np.zeros((H, W), bool)   # kept-clear ground in front of house doors (for paths)      # cells taken by cliffs / objects / reserved features
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

LTIP = [956, 976, 996, 1016]   # curled ledge ends, as used by map2's bowls
RTIP = [955, 975, 995, 1015]

FLATS = []          # (x, y, tag) of committed flat FM pieces: candidate cave mouths
_last_flats = []

def ledge_cells(x, y, seq, tips=True):
    global _last_flats
    cells = {}; _last_flats = []
    if tips:
        for k, g in enumerate(LTIP): cells[(y - 1 + k, x - 1)] = g
    for c in seq:
        if c == 'F': p, py = FM, y; _last_flats.append((x, y))
        elif c == 'D': p, py = FL, y; y += 4
        else: p, py = FR, y - 4; y -= 4
        for j, i in zip(*np.nonzero(p)):
            cells.setdefault((py + j, x + i), int(p[j, i]))
        x += 4
    if tips:
        for k, g in enumerate(RTIP): cells[(y - 1 + k, x)] = g
    return cells, x + (1 if tips else 0), y

def rand_seq(n, ylo, yhi, y):
    """Bowl-shaped ledge: starts descending, ends ascending, flat between slopes of opposite
    direction (no sharp V or peak), slope runs of at most 3 pieces."""
    seq = ['D']; y += 4; run = 1
    for k in range(n - 2):
        r = rng.random()
        if y > yhi: c = 'U' if r < 0.5 else 'F'
        elif y < ylo: c = 'D' if r < 0.5 else 'F'
        else: c = 'F' if r < 0.5 else ('D' if r < 0.75 else 'U')
        if c != 'F' and seq[-1] != 'F' and c != seq[-1]: c = 'F'
        if c == seq[-1] and c != 'F' and run >= 3: c = 'F'
        run = run + 1 if c == seq[-1] else 1
        seq.append(c); y += 4 if c == 'D' else (-4 if c == 'U' else 0)
    if seq[-1] == 'D': seq.append('F')
    seq.append('U')
    return ''.join(seq)

def commit_ledge(cells, margin=1, check=True, region=None, tag=None):
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
    if tag: FLATS.extend((fx, fy, tag) for fx, fy in _last_flats)
    return True

def boundary_ledge(ybase, seed, gapw=(8, 14), tag=None):
    """Full-width ledge with gaps. Returns rim row per column (float, interpolated in gaps)."""
    top = np.full(W, np.nan); x = 0; y = ybase; gaps = []
    while x < W - 12:
        n = int(rng.integers(8, 22))
        n = min(n, (W - x - 10) // 4)
        if n < 3: break
        seq = rand_seq(n, ybase - 14, ybase + 14, y)
        cells, x2, y2 = ledge_cells(x + 1, y, seq)
        commit_ledge(cells, check=False, tag=tag)
        cells = {k: v for k, v in cells.items() if 0 <= k[1] < W}
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
topV, gapsV = boundary_ledge(int(196 * SY), 1, tag='volc')     # volcano / desert
topB, gapsB = boundary_ledge(int(922 * SY), 2, tag='vbeach')   # village / beach
yD = (410 * SY + 22 * SY * n1(160, 11)).astype(int)
yS = (565 * SY + 22 * SY * n1(160, 12)).astype(int)
yR = (748 * SY + 14 * SY * n1(220, 13) + 6 * SY * n1(60, 14))
yC = H - max(12, int(round(24 * SY)))        # shoreline row

R_volc = YY <= topV[None]
R_desert = (YY > topV[None]) & (YY < yD[None])
R_swamp = (YY >= yD[None]) & (YY < yS[None])
R_forest = (YY >= yS[None]) & (YY < yR[None])
R_village = (YY >= yR[None]) & (YY <= topB[None])
R_beach = (YY > topB[None]) & (YY < yC)
R_sea = YY >= yC

# ---- item amounts: density.py gives items per 100x100 tiles of each biome
import density as DEN
AREA = dict(volcano=int(R_volc.sum()), desert=int(R_desert.sum()), swamp=int(R_swamp.sum()),
            forest=int(R_forest.sum()), village=int(R_village.sum()), beach=int(R_beach.sum()))
PLACED = []                                   # (biome, item, density, asked, placed) for the report
def amount(biome, item):
    return int(round(DEN.DENSITY[biome][item] * AREA[biome] / 10000.0))
def report(biome, item, placed):
    PLACED.append((biome, item, DEN.DENSITY[biome][item], amount(biome, item), int(placed)))
    return placed
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

# forest mud paths: north-south trails to the river (bridged), east-west connectors and side
# branches; each path's width wanders between FOREST_PATH_WIDTH_RANGE, averaging FOREST_PATH_WIDTH
FOREST_PATH_WIDTH = 4
FOREST_PATH_WIDTH_RANGE = (3, 6)
FOREST_TRAILS_PER_100 = 1.6        # north-south trails per 100 columns of forest
FOREST_CONNECTORS_PER_100 = 1.0    # east-west connectors per 100 columns
FOREST_BRANCHES_PER_100 = 1.5      # short side branches per 100 columns
paths_c = np.zeros((H, W), bool)

class Width:
    """Path width that drifts by +-1 now and then and is pulled back toward the average."""
    def __init__(self):
        self.w = FOREST_PATH_WIDTH
    def step(self):
        if rng.random() < 0.12:
            d = int(rng.integers(-1, 2))
            if self.w > FOREST_PATH_WIDTH and rng.random() < 0.5: d = -1
            if self.w < FOREST_PATH_WIDTH and rng.random() < 0.5: d = 1
            self.w = int(np.clip(self.w + d, *FOREST_PATH_WIDTH_RANGE))
        return self.w

def stamp(y, x, w):
    a = w // 2
    paths_c[max(0, y - a):max(0, y - a + w), max(0, x - a):max(0, x - a + w)] = True

def walk_trail(x, y0, y1, wig=0.25, lo=6, hi=None):
    hi = W - 7 if hi is None else hi
    pts = []; dx = 0; wd = Width()
    for y in range(y0, y1):
        if rng.random() < wig: dx = int(rng.integers(-1, 2))
        if (x <= lo and dx < 0) or (x >= hi and dx > 0): dx = -dx      # stay in its own column band
        if abs(y - yR[x]) < 14: dx = 0
        x = int(np.clip(x + dx, 6, W - 7)); pts.append((y, x))
        stamp(y, x, wd.step() if abs(y - yR[x]) >= 14 else FOREST_PATH_WIDTH)   # steady width at bridges
    return pts

trail_x = []
NTR = max(2, int(round(FOREST_TRAILS_PER_100 * W / 100)))
for k, x in enumerate(((np.arange(NTR) + 0.5) * W / NTR).astype(int) + rng.integers(-W // (4 * NTR), W // (4 * NTR) + 1, NTR)):
    x = int(np.clip(x, 8, W - 9)); colw = W / NTR
    y0 = int(yS[x]) - 25; pts = walk_trail(x, y0, int(yR[x]) + 18,
                                           lo=max(6, int(k * colw + colw * 0.2)), hi=min(W - 7, int((k + 1) * colw - colw * 0.2)))
    trail_x.append([px for y, px in pts if abs(y - yR[px]) < 1][0])   # where it meets the river
f_top = int(np.median(yS)) + 8; f_bot = int(np.median(yR)) - 14
NCON = max(2, int(round(FOREST_CONNECTORS_PER_100 * W / 100)))
for k in range(NCON):                                  # east-west connectors, spread down the forest
    band = (f_bot - f_top) / NCON
    y = int(f_top + (k + 0.5) * band + rng.uniform(-band / 4, band / 4)); x = int(rng.integers(4, max(5, W // 2)))
    L = int(rng.integers(W // 4, max(W // 4 + 1, 2 * W // 3))); dy = 0; wd = Width()
    for i in range(L):
        if rng.random() < 0.25: dy = int(rng.integers(-1, 2))
        if abs(y + dy - (f_top + (k + 0.5) * band)) > band / 3: dy = -dy   # stay in its own strip
        y = int(np.clip(y + dy, f_top, f_bot)); xx = x + i
        if xx >= W - 6: break
        stamp(y, xx, wd.step())
for k in range(max(2, int(round(FOREST_BRANCHES_PER_100 * W / 100)))):    # short winding side branches
    ys_, xs_ = np.nonzero(paths_c & (YY > f_top)[...] & (YY < f_bot))
    if not len(ys_): break
    j = int(rng.integers(len(ys_))); y, x = int(ys_[j]), int(xs_[j])
    ang = rng.uniform(0, 2 * np.pi); wd = Width()
    before = paths_c.copy()
    for i in range(int(rng.integers(12, 32))):
        ang += rng.normal(0, 0.25)
        y = int(np.clip(round(y + np.sin(ang)), f_top, f_bot)); x = int(np.clip(round(x + np.cos(ang)), 4, W - 5))
        if i > 6 and before[max(0, y - 4):y + 5, max(0, x - 4):x + 5].any(): break   # don't run into other paths
        stamp(y, x, wd.step())
paths = finish(paths_c & ~ndimage.binary_dilation(river, iterations=1), 1)   # r=1 keeps 3-wide stretches
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

# lava rivers: meandering channels across the volcano. Molten lava in the middle, black canyon banks
# whose glowing edge faces the lava, and the volcano's reddish rock fading into the banks (drawn on a
# 'lava banks' layer above 'canyon' so the canyon's outer edge is covered). Plank bridges cross them.
LAVA_RIVER_WIDTH = (1, 3)          # half-width of the molten channel (tiles), varies along the river
LAVA_RIVER_BANK = 3                # black canyon on each side
LAVA_RIVER_BRIDGES = 2             # plank bridges per river
lava_rivers = np.zeros((H, W), bool); river_lava = np.zeros((H, W), bool); river_bridges = []
want_rivers = amount('volcano', 'lava rivers')
_vtop, _vbot = 10, int(np.min(topV)) - 16
LAVA_RIVER_SPREAD = 0.9            # 0..1: how much of the volcano's height the rivers are spread over
_mid, _half = (_vtop + _vbot) / 2, (_vbot - _vtop) / 2 * LAVA_RIVER_SPREAD
_ys = (np.linspace(_mid - _half, _mid + _half, want_rivers) if want_rivers > 1 else [_mid] * want_rivers)
for _ri, _y0 in enumerate(_ys):
    _ph = rng.uniform(0, 2 * np.pi)
    _yc = _y0 + 4 * np.sin(COLS / rng.uniform(25, 45) + _ph) + 3 * n1(40, 300 + _ri)
    _yc = np.clip(_yc, _vtop, _vbot)
    _wl = np.clip(np.round(2 + 1.0 * n1(30, 400 + _ri)), *LAVA_RIVER_WIDTH)
    core = np.zeros((H, W), bool); bank = np.zeros((H, W), bool); cover = np.zeros((H, W), bool)
    _cn = n1(12, 500 + _ri)
    for x_ in range(W):
        yc_ = int(round(_yc[x_])); r_ = int(_wl[x_])
        cv_ = r_ + LAVA_RIVER_BANK + 3 + int(round(1.5 * (1 + _cn[x_])))   # reddish rock width wanders
        for (m_, rr_) in ((core, r_), (bank, r_ + LAVA_RIVER_BANK + 1), (cover, cv_)):
            m_[max(0, yc_ - rr_):yc_ + rr_ + 1, max(0, x_ - rr_ // 2):x_ + rr_ // 2 + 1] = True
    core = clean(octshape(core, 1)); bank = clean(octshape(bank | ndimage.binary_dilation(core, iterations=3), 1))
    cover = clean(octshape(cover | ndimage.binary_dilation(bank, iterations=2), 2))
    core = ndimage.binary_closing(core, np.ones((3, 3), bool)) | core   # no stray black tiles inside the lava
    # banks always at least LAVA_RIVER_BANK + 1 tiles wide around the (final) lava, so they never thin out
    bank = clean(octshape(bank | ndimage.binary_dilation(core, np.ones((3, 3), bool), iterations=LAVA_RIVER_BANK + 1), 1))
    cover = cover | ndimage.binary_dilation(bank, iterations=2)
    canyon_m = clean(bank & ~core)                              # glow edge faces the lava
    LY['canyon'][canyon_m] = otile(canyon_m, 'canyon')[canyon_m]
    lv = ndimage.binary_dilation(core, np.ones((3, 3), bool)) & bank
    LY['lava'][lv] = 1181
    # reddish rock from 2 tiles off the lava outward: its solid part covers the bank's outer (glow) edge
    ring = cover & ~ndimage.binary_dilation(core, iterations=LAVA_RIVER_BANK - 1)
    ring = clean(octshape(ring, 1)) & ~ndimage.binary_dilation(core, iterations=2)
    LY['lava banks'][ring] = otile(ring, 'dry2')[ring]
    for _ln in ('dryground', 'dryground2'): LY[_ln][bank] = 0
    lava_rivers |= cover; river_lava |= lv
    # plank bridges (map2's bridge pieces) at evenly spread columns
    for _bx in ((np.arange(LAVA_RIVER_BRIDGES) + 0.5) * W / LAVA_RIVER_BRIDGES + rng.integers(-W // 10, W // 10 + 1, LAVA_RIVER_BRIDGES)).astype(int):
        _bx = int(np.clip(_bx, 4, W - 6)); x0_ = _bx - 1
        rows_ = np.flatnonzero(lv[:, x0_:x0_ + 4].any(1))
        if not len(rows_): continue
        r0_, r1_ = rows_.min() - 2, rows_.max() + 2
        LY['Bridge'][r0_:r1_ + 1, x0_:x0_ + 4] = np.array([7, 8, 9, 10])[None]
        LY['lava'][r0_:r1_ + 1, x0_ + 1:x0_ + 3] = 0           # deck walkable; banks stay drawn under the bridge
        LY['bridges shadows'][r0_ + 1, x0_ + 3] = 63; LY['bridges shadows'][r0_ + 2:r1_, x0_ + 3] = 83
        LY['bridges shadows'][r1_, x0_ + 3] = 103
        river_bridges.append((r0_, r1_, x0_))
report('volcano', 'lava rivers', len(_ys))
_cl, _cn2 = ndimage.label(LY['canyon'] != 0)              # drop stray canyon specks
if _cn2:
    _cs = ndimage.sum(np.ones_like(_cl), _cl, range(1, _cn2 + 1))
    LY['canyon'][np.isin(_cl, 1 + np.flatnonzero(_cs < 6))] = 0
deco_r = river_lava & ndimage.binary_erosion(river_lava, iterations=2) & (rng.random((H, W)) < 0.05)
LY['lava'][deco_r] = rng.choice([1401, 1411, 1421, 1428], size=int(deco_r.sum()))
occ |= ndimage.binary_dilation(lava_rivers, iterations=2)

# lava lakes, built the way map2 builds its lava: a basin walled by map2's dark cliff pieces
# (corners cut at 45 degrees in random amounts), black canyon floor inside, and an irregular molten
# pool whose glowing edge tiles face the lava. Count from density.py.
import cavekit as _CK
LAVA_LAKE_W, LAVA_LAKE_H = (10, 26), (6, 15)      # basin floor size range (tiles)
lava_ok = volc_floor & (YY > 4) & (YY < topV[None] - 8) & ~ndimage.binary_dilation(lava_rivers, iterations=4)
lava_region = np.zeros((H, W), bool); n_lakes = 0
lavam = np.zeros((H, W), bool)
want_lakes = amount('volcano', 'lava lakes')
for _ in range(want_lakes * 60):
    if n_lakes >= want_lakes: break
    w_ = int(rng.integers(*LAVA_LAKE_W)); h_ = int(rng.integers(*LAVA_LAKE_H))
    m_ = max(0, min(w_, h_) // 2 - 1)
    ch_ = [int(rng.integers(0, m_ + 1)) if rng.random() < 0.8 else 0 for _c in range(4)]
    Ft_, Wt_, I_ = _CK.room(w_, h_, *ch_)
    foot_ = (Wt_ != 0) | I_
    hh_, ww_ = foot_.shape
    ys_, xs_ = np.nonzero(lava_ok)
    k = int(rng.integers(len(ys_))); y_, x_ = int(ys_[k]) - hh_ // 2, int(xs_[k]) - ww_ // 2
    if y_ < 4 or x_ < 4 or y_ + hh_ + 4 >= H or x_ + ww_ + 4 >= W: continue
    sl_ = (slice(y_, y_ + hh_), slice(x_, x_ + ww_))
    win_ = (slice(y_ - 3, y_ + hh_ + 3), slice(x_ - 3, x_ + ww_ + 3))
    if (lava_region[win_] | occ[win_]).any() or not lava_ok[sl_][foot_].all():
        continue
    # molten pool: an irregular blob inside the floor, away from the walls
    inner_ = ndimage.binary_erosion(I_, iterations=2)
    if inner_.sum() < 12: continue
    rr_, cc_ = np.mgrid[0:hh_, 0:ww_]
    pool_ = np.zeros_like(I_)
    cy_, cx_ = np.argwhere(inner_).mean(0)
    for _o in range(int(rng.integers(2, 5))):
        oy_ = cy_ + rng.uniform(-h_ / 4, h_ / 4); ox_ = cx_ + rng.uniform(-w_ / 4, w_ / 4)
        ry_ = rng.uniform(1.5, max(2.0, h_ / 2.5)); rx_ = rng.uniform(2.0, max(2.5, w_ / 2.5))
        pool_ |= ((rr_ - oy_) / ry_) ** 2 + ((cc_ - ox_) / rx_) ** 2 <= 1
    pool_ = clean(octshape(pool_ & inner_, 1)) & inner_
    pool_ = clean(pool_)
    if pool_.sum() < 8: continue
    # canyon floor: the basin floor minus the pool, running under the walls' see-through inner rim
    can_ = (I_ | (ndimage.binary_dilation(I_, np.ones((3, 3), bool)) & (Wt_ != 0))) & ~pool_
    can_t = otile(np.pad(can_, 2), 'canyon')[2:-2, 2:-2]
    LY['Cliffs'][sl_][Wt_ != 0] = Wt_[Wt_ != 0]
    LY['canyon'][sl_][can_] = can_t[can_]
    lv_ = ndimage.binary_dilation(pool_, np.ones((3, 3), bool)) & (I_ | pool_)   # lava runs under the glow edge
    LY['lava'][sl_][lv_] = 1181
    for _ln in ('dryground', 'dryground2'):
        LY[_ln][sl_][I_] = 0
    lava_region[sl_] |= foot_; lavam[sl_] |= lv_
    n_lakes += 1
report('volcano', 'lava lakes', n_lakes)
deco = lavam & ndimage.binary_erosion(lavam, iterations=2) & (rng.random((H, W)) < 0.06)
LY['lava'][deco] = rng.choice([1401, 1411, 1421, 1428], size=int(deco.sum()))
occ |= ndimage.binary_dilation(lava_region, iterations=1)

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
NVIL = max(2, int(round(6 * SCALE)))
vil_centres = [(int(yR[x] + (topB[x] - yR[x]) * f), int(x)) for x, f in
               zip(((np.arange(NVIL) + 0.5) * W / NVIL).astype(int), [0.55, 0.45, 0.6, 0.5, 0.45, 0.55])]
START = NVIL // 2                                              # start village in the middle
_sx = vil_centres[START][1]; vil_centres[START] = (int((yR[_sx] + topB[_sx]) / 2), _sx)
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
        fp = ndimage.binary_dilation(fp, np.ones((3, 3), bool), iterations=margin)   # gap holds diagonally too
        sub = occ[y - margin:y + h + margin, x - margin:x + w + margin]
        if (sub & fp).any(): return False
    elif (occ[y:y + h, x:x + w] & foot).any(): return False
    if allow is not None and not allow[y:y + h, x:x + w][foot].all(): return False
    d_ = _house_door(s) if 'Houses' in s['tiles'] else None
    if d_:                                    # keep the ground in front of the door clear
        fy, fx = y + h, x + d_[2]
        front = (slice(fy, fy + 4), slice(fx - 2, fx + 3))
        if fy + 4 >= H or fx - 2 < 0 or fx + 3 > W or occ[front].any(): return False
        if allow is not None and not allow[front].all(): return False
    for nm, a in s['tiles'].items():
        m = a != 0
        LY[nm][y:y + h, x:x + w][m] = a[m]
    blk[y:y + h, x:x + w] |= s['blk']
    occ[y:y + h, x:x + w] |= foot
    if d_: occ[front] = True; FRONTS[front] = True
    return True

BGMASK = {}
def scatter(group, n, allow, margin=1, tries=8, weights=True, region_box=None):
    st = S[group]
    if group in ('grassvar', 'groundvar', 'rock', 'leaves', 'camp') and BGMASK:
        # stamps with an opaque background only go on matching terrain; the rest go anywhere.
        # The count is shared among the backgrounds that actually exist in `allow`.
        groups = {}
        for s in st: groups.setdefault(s['bg'] if s['opq'] else 'any', []).append(s)
        masks = {k: (allow if k == 'any' else allow & BGMASK[k]) for k in groups}
        live = {k: v for k, v in groups.items() if masks[k].any()}
        tot = sum(len(v) for v in live.values()); out = 0
        for k, sub in live.items():
            S['_tmp'] = sub
            out += scatter('_tmp', int(round(n * len(sub) / tot)), masks[k], margin, tries, weights)
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
def bowls(region, n, plen=(3, 9), tag=None):
    ys, xs = np.nonzero(region); c = 0
    for i in range(n * 10):
        if c >= n: break
        k = rng.integers(len(ys)); y, x = int(ys[k]), int(xs[k])
        seq = rand_seq(int(rng.integers(*plen)), y - 6, y + 8, y)
        cells, _, _ = ledge_cells(x, y, seq)
        if commit_ledge(cells, margin=2, region=region, tag=tag): c += 1
    return c

desert_ok = R_desert & (YY > (topV + 8)[None]) & (YY < yD[None] - 4)
# ---- large cliffs: raised mesas edged with map2's brown cliff set; the front face has random
# dips so each mesa has its own outline, and ladders climb the face onto the top
import mesa as MESA
MESA_PIECES = (4, 10)          # front pieces (4 tiles each): mesa width = 6 + 4 * pieces
MESA_SIDE_ROWS = (2, 8)        # rows of side wall: plateau depth
MESA_LADDERS = (1, 1)          # ladders per mesa (min, max)
LADDER = [1829, 1849, 1869]                            # single ladder: top, middle, bottom
MESAS = []

# ground on top of each mesa, by zone: (layer, 2x2 fill)
MESA_TOP_GROUND = {
    'volcano': ('dryground2', [[1715, 1716], [1735, 1736]]),
    'desert':  ('dryground', [[871, 872], [891, 892]]),
    'swamp':   ('dead grass', [[546, 547], [566, 567]]),
    'forest':  ('grass', [[155, 156], [175, 176]]),
}
TERRAIN_LAYERS = ['sand', 'grass', 'dryground', 'dryground2', 'dead grass', 'graveyard mud', 'canyon', 'lava',
                  'forest paths', 'mud', 'groundvariations', 'grassvariations']

def big_cliff(region, zone=None, tries=80, pieces=None, side_rows=None):
    for _ in range(tries):
        t, top = MESA.mesa(rng, int(rng.integers(*(pieces or MESA_PIECES))), int(rng.integers(*(side_rows or MESA_SIDE_ROWS))))
        hh, ww = t.shape
        ys, xs = np.nonzero(region)
        if not len(ys): return False
        k = int(rng.integers(len(ys))); y, x = int(ys[k]) - hh // 2, int(xs[k]) - ww // 2
        if y < 2 or x < 2 or y + hh + 4 >= H or x + ww + 3 >= W: continue
        foot = (t != 0) | top
        win = (slice(y - 2, y + hh + 2), slice(x - 2, x + ww + 2))
        fpd = ndimage.binary_dilation(np.pad(foot, 2), np.ones((3, 3), bool), iterations=2)
        if (occ[win] & fpd).any() or not region[win][fpd].all(): continue
        # ladders on flat front pieces: the ladder covers the 3-row face, from the plateau down to the ground
        cand = []
        for cx in range(4, ww - 5):
            for cy in range(hh - 3, 2, -1):
                if t[cy, cx] in (1096, 1097) and t[cy, cx + 1] in (1096, 1097) and t[cy - 2, cx] in (1054, 1055, 1056, 1057):
                    if top[cy - 3, cx:cx + 2].all() and (cy + 1 >= hh or not foot[cy + 1, cx:cx + 2].any()):
                        cand.append((cy - 2, cx))
                    break
        rng.shuffle(cand); lad = []
        want = int(rng.integers(MESA_LADDERS[0], MESA_LADDERS[1] + 1))
        for cy, cx in cand:
            if len(lad) >= want: break
            if any(abs(cx - o) < 6 for _, o in lad): continue
            gy = y + cy + 3
            if gy + 2 >= H or occ[gy:gy + 2, x + cx - 1:x + cx + 3].any(): continue
            lad.append((cy, cx))
        if not lad: continue
        sl = (slice(y, y + hh), slice(x, x + ww))
        m_ = t != 0
        if zone in MESA_TOP_GROUND:
            # the zone's own ground on the plateau (and under the wall tiles' inner rim)
            cells = top | (ndimage.binary_dilation(top, np.ones((3, 3), bool)) & m_)
            for ln in TERRAIN_LAYERS:
                LY[ln][sl][cells] = 0
            ln, pat = MESA_TOP_GROUND[zone]; pat = np.array(pat)
            yy_, xx_ = np.nonzero(cells)
            LY[ln][sl][yy_, xx_] = pat[(y + yy_) % 2, (x + xx_) % 2]
        LY['Cliffs'][sl][m_] = t[m_]
        blk[sl] |= m_
        for cy, cx in lad:
            for r, t_ in enumerate(LADDER):
                LY['Cliffs'][y + cy + r, x + cx] = t_
                blk[y + cy + r, x + cx] = False
        occ[win] |= fpd
        for cy, cx in lad:                                   # keep the ladder foot clear
            occ[y + cy + 3:y + cy + 6, x + cx - 1:x + cx + 3] = True
        MESAS.append((y, x, hh, ww, lad))
        return True
    return False

def big_cliffs(biome, region, **kw):
    n = amount(biome, 'large cliffs'); made = sum(big_cliff(region, biome, **kw) for _ in range(n))
    report(biome, 'large cliffs', made)

big_cliffs('volcano', R_volc & volc_floor & (YY > 4) & (YY < topV[None] - 8) & ~ndimage.binary_dilation(lava_region, iterations=2),
           tries=300, pieces=(3, 7), side_rows=(2, 5))   # smaller: they fit between the lava rivers
big_cliffs('desert', R_desert & (YY > (topV + 8)[None]) & (YY < yD[None] - 4))
big_cliffs('swamp', R_swamp & (YY > yD[None] + 4) & (YY < yS[None] - 8))
big_cliffs('forest', R_forest & (YY > yS[None] + 4) & (YY < yR[None] - 6) & ~ndimage.binary_dilation(paths | river, iterations=1),
           tries=300, pieces=(3, 6), side_rows=(2, 5))   # smaller: they fit between the trails

report('desert', 'cliff ledges', bowls(desert_ok, amount('desert', 'cliff ledges'), tag='desert'))
report('swamp', 'cliff ledges', bowls(R_swamp & (YY > yD[None] + 6) & (YY < yS[None] - 10), amount('swamp', 'cliff ledges'), (3, 7), tag='swamp'))
report('beach', 'cliff ledges', bowls(R_beach & (YY > topB[None] + 10) & (YY < yC - 12), amount('beach', 'cliff ledges'), (3, 6), tag='beach'))

volc_ok = R_volc & volc_floor & (YY > 4) & (YY < topV[None] - 6) & ~lava_region
_raw = pickle.load(open(cache('stamps.pkl'), 'rb'))
_ok = {'cliff_volc': [0, 1, 2, 5, 7, 10], 'cliff_desert': [0, 1], 'cliff_beach': [0, 1, 2, 3, 4, 5, 6]}
for _g, _ix in _ok.items():
    S[_g] = [_raw[_g][i] for i in _ix if i < len(_raw[_g])]
cliff_rings = S['cliff_volc'] + S['cliff_desert']
for s in cliff_rings: s['n'] = 1
S['cliffs_any'] = cliff_rings
report('volcano', 'cliff features', scatter('cliffs_any', amount('volcano', 'cliff features'), volc_ok, margin=2))
report('desert', 'cliff features', scatter('cliffs_any', amount('desert', 'cliff features'), desert_ok, margin=2))
report('beach', 'cliff features', scatter('cliff_beach', amount('beach', 'cliff features'), R_beach & (YY > topB[None] + 8) & (YY < yC - 8), margin=2))

# lava crater: fill some ring interiors with lava
lab, nl = ndimage.label(LY['Cliffs'] != 0, structure=np.ones((3, 3)))
holes = ndimage.binary_fill_holes(LY['Cliffs'] != 0) & (LY['Cliffs'] == 0)
hl, nh = ndimage.label(holes)
for i, sl in enumerate(ndimage.find_objects(hl), 1):
    m = hl[sl] == i
    yc = (sl[0].start + sl[0].stop) // 2; xc = (sl[1].start + sl[1].stop) // 2
    occ[sl][m] = True

log('cave mouths')
MOUTH = np.array([[1351, 1352, 1353], [1371, 1372, 1373], [1391, 1392, 1393]])
FMIDS = set(FM.ravel().tolist())
walk_land = (land | R_beach) & ~R_sea & ~occ & (LY['lava'] == 0) & (LY['water'] == 0) & (LY['lakes'] == 0)
MOUTHS_WANTED = {'volc': amount('volcano', 'cave entrances'), 'desert': amount('desert', 'cave entrances'),
                 'swamp': amount('swamp', 'cave entrances'), 'beach': amount('beach', 'cave entrances'),
                 'vbeach': amount('beach', 'cliff wall cave entrances')}
mouths = []                          # (trigger_x, trigger_y, tag)
for tag, want in MOUTHS_WANTED.items():
    cand = [f for f in FLATS if f[2] == tag]
    order_ = rng.permutation(len(cand))
    got = 0
    for k in order_:
        if got >= want: break
        fx, fy, _ = cand[k]
        mx = fx + int(rng.integers(0, 2))
        if mx < 2 or mx + 4 >= W or fy + 7 >= H: continue
        face = LY['Cliffs'][fy:fy + 3, mx:mx + 3]
        if not all(int(v) in FMIDS for v in face.ravel()): continue
        below = (slice(fy + 3, fy + 7), slice(mx - 1, mx + 4))
        if not walk_land[below].all(): continue
        if any(abs(mx - ox) < 12 and abs(fy + 2 - oy) < 12 for ox, oy, _ in mouths): continue
        LY['Cliffs'][fy:fy + 3, mx:mx + 3] = MOUTH
        occ[below] = True
        mouths.append((mx + 1, fy + 2, tag)); got += 1
log('cave mouths', {t: sum(1 for m in mouths if m[2] == t) for t in MOUTHS_WANTED})

log('objects')
BGMASK.update(grass=ndimage.binary_erosion(gr, iterations=1),
              ground=ndimage.binary_erosion(~gr & ~dg & ~ds & land, iterations=1),
              dead=ndimage.binary_erosion(dg, iterations=1))
notcliff = LY['Cliffs'] == 0
ground_only = land & ~gr & ~dg & notcliff
g_in = ndimage.binary_erosion(gr, iterations=1)
counts = {}
def sc(name, group, n, allow, margin=1, tries=8, scale=True):
    if scale: n = int(round(n * SCALE))
    counts[name] = scatter(group, n, allow & notcliff, margin, tries)

# tombstones only ever appear in clumps (3-7 stones, sometimes a fence)
def gap(item, default):
    """Minimum empty tiles between neighbouring objects of `item` (density.SPACING)."""
    return int(DEN.SPACING.get(item, default))

def tomb_clumps(region, n_clumps, size=(3, 8)):
    sp = gap('tombstones', 0)                  # stones inside a clump keep this many tiles apart
    ry, rx = 3 + 2 * sp, 5 + 3 * sp            # clump area grows with the spacing
    ys, xs = np.nonzero(region); made = 0
    for _ in range(n_clumps * 20):
        if made >= n_clumps or len(ys) == 0: break
        k = rng.integers(len(ys)); cy, cx = int(ys[k]), int(xs[k])
        near = region & (np.abs(YY - cy) <= ry) & (np.abs(XX - cx) <= rx)
        if near.sum() < 0.6 * (2 * ry + 1) * (2 * rx + 1): continue
        want = int(rng.integers(*size)); got = 0
        nys, nxs = np.nonzero(near)
        win = (slice(max(0, cy - ry - 8), cy + ry + 8), slice(max(0, cx - rx - 8), cx + rx + 8))
        backup = {k: v[win].copy() for k, v in LY.items()}; bocc = occ[win].copy(); bblk = blk[win].copy()
        for _ in range(want * 15):
            if got >= want: break
            s = S['tombs'][int(rng.integers(len(S['tombs'])))]
            j = rng.integers(len(nys))
            if place(s, int(nys[j]) - s['h'] + 1, int(nxs[j]), near, margin=sp): got += 1
        if got >= 3:
            made += 1
            if S['fence'] and rng.random() < 0.5:
                f = S['fence'][int(rng.integers(len(S['fence'])))]
                for _ in range(20):
                    j = rng.integers(len(nys))
                    if place(f, int(nys[j]), int(nxs[j]) - f['w'] // 2, near, margin=gap('graveyard fences', 0)): break
        else:                                  # too small to be a clump: undo it
            for k, v in backup.items(): LY[k][win] = v
            occ[win] = bocc; blk[win] = bblk
    return made

# villages: houses clustered around centres
for vi, (cy, cx) in enumerate(vil_centres):
    near = (np.hypot(YY - cy, (XX - cx) * 0.8) < 42) & R_village & (YY < topB[None] - 8)
    sc(f'houses{vi}', 'house', DEN.HOUSES_IN_START_VILLAGE if vi == START else DEN.HOUSES_PER_VILLAGE,
       near, margin=2, scale=False)
# ---- village paths: dirt paths from every house door to its village centre, plus roads joining
# the villages to each other and to the forest trails that cross the river
import heapq
STONE_PATH_WIDTH = 4                         # village paths and roads, ~4 tiles wide
VILLAGE_PATH_STYLE = 'ground'                # 'ground': bare ground cut through the grass; 'stone': cobblestone
GROUND_PATH_WIDTH = 4                        # ground paths: bare tiles across, not counting the grass edge tiles
PATH_PATCH_SPACING = 10                      # roughly one bare patch along the paths per this many tiles
VILLAGES_ALL_GRASS = True                    # with ground paths: the rest of each village is grass

def astar(start, goal, passable, pref, margin=30):
    """8-direction shortest path on passable cells (existing paths are cheaper)."""
    y0 = max(0, min(start[0], goal[0]) - margin); y1 = min(H, max(start[0], goal[0]) + margin + 1)
    x0 = max(0, min(start[1], goal[1]) - margin); x1 = min(W, max(start[1], goal[1]) + margin + 1)
    P = passable[y0:y1, x0:x1]; C = np.where(pref[y0:y1, x0:x1], 0.6, 1.0)
    s = (start[0] - y0, start[1] - x0); t = (goal[0] - y0, goal[1] - x0)
    if not (P[s] and P[t]): return None
    dist = {s: 0.0}; prev = {}; q = [(0.0, 0.0, s)]
    hgt, wid = P.shape
    while q:
        _, d, u = heapq.heappop(q)
        if u == t: break
        if d > dist.get(u, 1e18): continue
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)):
            v = (u[0] + dy, u[1] + dx)
            if not (0 <= v[0] < hgt and 0 <= v[1] < wid) or not P[v]: continue
            if dy and dx and not (P[u[0] + dy, u[1]] and P[u[0], u[1] + dx]): continue
            nd = d + C[v] * (1.41 if dy and dx else 1.0)
            if nd < dist.get(v, 1e18):
                dist[v] = nd; prev[v] = u
                heapq.heappush(q, (nd + 0.9 * max(abs(v[0] - t[0]), abs(v[1] - t[1])), nd, v))
    if t not in prev and t != s: return None
    out = [t]
    while out[-1] != s: out.append(prev[out[-1]])
    return [(y + y0, x + x0) for y, x in out]

def nearest(mask, y, x):
    ys, xs = np.nonzero(mask)
    if len(ys) == 0: return None
    k = int(np.argmin(np.abs(ys - y) + np.abs(xs - x))); return int(ys[k]), int(xs[k])

hard = (occ & ~paths & ~FRONTS) | (LY['Cliffs'] != 0) | (LY['water'] != 0) | (LY['lakes'] != 0)
walk_v = (R_village | (R_forest & (YY > (yR - 25)[None]))) & ~ndimage.binary_dilation(hard, iterations=2) & (YY < topB[None] - 4)
vcl = np.zeros((H, W), bool); road = np.zeros((H, W), bool)
Hs0 = LY['Houses']
doors_v = [(int(y), int(x)) for y, x in zip(*np.nonzero(np.isin(Hs0, [367, 1682])))] + \
          [(int(y), int(x)) for y, x in zip(*np.nonzero(Hs0 == 188)) if Hs0[y, x - 1] == 187]
centres = []
for cy, cx in vil_centres:
    c = nearest(walk_v & (np.abs(YY - cy) < 30) & (np.abs(XX - cx) < 30), cy, cx)
    if c: centres.append(c)
DOOR_STUB = 3                                # straight path tiles below each pad before it turns
stubs = np.zeros((H, W), bool)
hard_near = ndimage.binary_dilation(hard, iterations=2)   # 3-wide paths stay clear of buildings
for dy_, dx_ in doors_v:
    # walk straight down from the door to the first tile below the stone pad
    y = dy_ + 1
    while y < H and (LY['stone'][y, dx_] != 0 or Hs0[y, dx_] != 0): y += 1
    win_ = (np.abs(YY - dy_) <= 12) & (np.abs(XX - dx_) <= 10)
    own = (np.abs(YY - dy_) <= 8) & (np.abs(XX - dx_) <= 6) & ((LY['stone'] != 0) | (Hs0 != 0))
    passable_d = walk_v | (ndimage.binary_dilation(own, iterations=4) & win_ & ~hard_near)
    ys_ = list(range(y, min(H, y + DOOR_STUB)))
    if not hard[y, dx_]: stubs[y, dx_] = True       # the path always touches the pad
    if all(not hard[yy, dx_ - 1:dx_ + 2].any() for yy in ys_):
        for yy in ys_: stubs[yy, dx_] = True
        start = (ys_[-1], dx_)
    else:
        start = (y, dx_) if passable_d[y, dx_] else nearest(passable_d & win_, y, dx_)
        if start is None: continue
    if not passable_d[start]: passable_d = passable_d.copy(); passable_d[start] = True
    c = min(centres, key=lambda c: abs(c[0] - start[0]) + abs(c[1] - start[1]))
    p = astar(start, c, passable_d, vcl | road | stubs)
    if p is None:                                   # tight spot between houses: allow closer passes
        p = astar(start, c, passable_d | (ndimage.binary_dilation(own, iterations=6) & win_ & ~hard), vcl | road | stubs)
    if p:
        for py, px in p: vcl[py, px] = True
vcl |= stubs
# roads: village centres to each other and to the nearest forest-trail end south of the river
trail_ends = paths & R_village
for i, c in enumerate(centres):
    targets = []
    if i + 1 < len(centres): targets.append(centres[i + 1])
    te = nearest(trail_ends & walk_v, *c)
    if te: targets.append(te)
    for t in targets:
        p = astar(c, t, walk_v, vcl | road, margin=60)
        if p:
            for py, px in p: road[py, px] = True
# cobblestone paths (house doors + roads between villages) go on their own layer, drawn just
# before 'stone' so the house pads sit on top; the forest trails stay dirt
import stonepath
SQ = np.ones((STONE_PATH_WIDTH, STONE_PATH_WIDTH), bool)
sp = ndimage.binary_dilation(vcl | road | stubs, SQ) & ~hard & (YY < topB[None] - 2)
sp = (clean(octshape(sp, 1)) | (ndimage.binary_dilation(stubs, SQ) & ~hard)) & ~hard
_pl, _n = ndimage.label(sp)
if _n:                                              # drop small leftover pieces
    _sz = ndimage.sum(sp, _pl, range(1, _n + 1))
    sp &= ~np.isin(_pl, 1 + np.flatnonzero(_sz < 60))
# stone paths stop at a dirt trail (the dirt layer is drawn on top where they meet)
if VILLAGE_PATH_STYLE == 'stone':
    LY['stone paths'] = stonepath.tile(sp, rng)
    LY['stone paths'][(LY['stone'] != 0) | hard] = 0
else:
    # ground paths: cut the paths out of the grass and re-tile the grass, so the grass's own edge
    # tiles border the bare ground (the ground layer is already under everything)
    cl = vcl | road | stubs
    carve = ndimage.binary_dilation(cl, np.ones((GROUND_PATH_WIDTH, GROUND_PATH_WIDTH), bool))
    # natural look: random bare patches that bulge out of the paths, plus loose patches in the grass
    def blob(cy, cx, ry, rx):
        sl = (slice(max(0, cy - ry), min(H, cy + ry + 1)), slice(max(0, cx - rx), min(W, cx + rx + 1)))
        yy_, xx_ = np.ogrid[sl[0], sl[1]]
        e = ((yy_ - cy) / (ry + 0.5)) ** 2 + ((xx_ - cx) / (rx + 0.5)) ** 2 <= 1.0
        carve[sl] |= e
    cys, cxs = np.nonzero(cl)
    for k in rng.permutation(len(cys))[:len(cys) // PATH_PATCH_SPACING]:
        cy, cx = int(cys[k]) + int(rng.integers(-2, 3)), int(cxs[k]) + int(rng.integers(-2, 3))
        blob(cy, cx, int(rng.integers(1, 4)), int(rng.integers(2, 5)))
    vg = (R_village & (YY < topB[None] - 6)) & ~ndimage.binary_dilation(hard, iterations=3) & ~river
    vys, vxs = np.nonzero(vg)
    n_loose = amount('village', 'bare ground patches')
    for k in rng.integers(0, len(vys), n_loose):
        blob(int(vys[k]), int(vxs[k]), int(rng.integers(2, 5)), int(rng.integers(3, 7)))
    report('village', 'bare ground patches', n_loose)
    carve &= (YY < topB[None] - 2) & ~(LY['stone'] != 0) & ~hard
    if VILLAGES_ALL_GRASS:
        vill = (R_village | (R_forest & (YY > (yR - 25)[None]))) & (YY <= topB[None] + 3) & ~R_beach
        gr = gr | (vill & ~river)
        gr = clean(octshape(gr, 2)) & (YY <= topB[None] + 3)
    pads = (LY['stone'] != 0) & ~R_beach                               # houses' stone pads
    gr &= ~carve & ~pads               # carved after smoothing so the 2-wide paths stay open;
                                       # pads sit on bare ground that joins the path
    for _ in range(3): gr = clean(gr)
    # cells the clean-up turned back to ground next to a path widen it slightly; that's fine
    LY['grass'][:] = 0
    LY['grass'][gr] = otile(gr, 'grass')[gr]
    g_in = ndimage.binary_erosion(gr, iterations=1)
    BGMASK['grass'] = g_in
    BGMASK['ground'] = ndimage.binary_erosion(~gr & ~dg & ~ds & land, iterations=1)
    ground_only = land & ~gr & ~dg & notcliff
    LY['grassvariations'][~g_in] = 0
new_cells = sp & ~paths
occ |= ndimage.binary_dilation(new_cells, iterations=1) & ~(occ & ~paths)
counts['stone path tiles'] = int(new_cells.sum())

def put(biome, item, group, allow, **kw):
    """Scatter `item` (density.py name) using stamp `group`; records the result for the report."""
    kw.setdefault('scale', False)
    if item in DEN.SPACING: kw['margin'] = gap(item, 1)
    sc(f'{biome}:{item}', group, amount(biome, item), allow, **kw)
    report(biome, item, counts[f'{biome}:{item}'])
# village
put('village', 'trees', 'vtree', g_in & R_village, tries=20)
put('village', 'rocks', 'rock', R_village & land)
put('village', 'camps', 'camp', R_village & land)
put('village', 'grass decorations', 'grassvar', g_in & R_village, margin=0)
put('village', 'ground decorations', 'groundvar', ground_only & R_village, margin=0)
# forest
fbox = g_in & R_forest & ~ndimage.binary_dilation(paths, iterations=1)
put('forest', 'trees', 'ftree', fbox, margin=0, tries=40)
put('forest', 'totem posts', 'fobj', R_forest & land)
put('forest', 'rocks', 'rock', R_forest & land)
put('forest', 'camps', 'camp', R_forest & land)
put('forest', 'grass decorations', 'grassvar', g_in & R_forest, margin=0)
# swamp / graveyard
gyard = ndimage.binary_dilation(gm, iterations=4) & R_swamp
S['grave'] = [s for s in S['grave'] if not _has(s, TOMB)]      # crypts and fences; stones come in clumps
put('swamp', 'crypts and fences', 'grave', gyard)
report('swamp', 'tombstone clumps', tomb_clumps(gyard & land & notcliff & ~occ, amount('swamp', 'tombstone clumps')))
put('swamp', 'dead trees', 'swamptree', R_swamp & land)
put('swamp', 'dead leaves', 'leaves', R_swamp & land, margin=0)
put('swamp', 'bones', 'bones', R_swamp & land)
put('swamp', 'camps', 'camp', R_swamp & land)
put('swamp', 'ground decorations', 'groundvar', ground_only & R_swamp, margin=0)
# desert
put('desert', 'cactus', 'cactus', R_desert & land)
put('desert', 'dead trees', 'dtree_desert', R_desert & land)
put('desert', 'bones', 'bones', R_desert & land)
put('desert', 'totems', 'totem', R_desert & land)
put('desert', 'camps', 'camp', R_desert & land)
report('desert', 'tombstone clumps', tomb_clumps(R_desert & land & notcliff & ~occ & (YY > (topV + 8)[None]),
                                                  amount('desert', 'tombstone clumps')))
put('desert', 'rocks', 'rock', R_desert & land)
put('desert', 'ground decorations', 'groundvar', ground_only & R_desert, margin=0)
# volcano
put('volcano', 'dead trees', 'dtree_volc', R_volc & volc_floor & ~lava_region)
# beach
beach_ok = R_beach & (YY > topB[None] + 4) & (YY < yC - 3)
S['palm'] = [s for s in S['beachobj'] if s['h'] >= 5]           # the 5x5 palm
S['beachobj'] = [s for s in S['beachobj'] if s['h'] < 5]          # umbrellas, tents, shells
put('beach', 'palm trees', 'palm', beach_ok, margin=1, tries=20)
put('beach', 'beach objects', 'beachobj', beach_ok)
put('beach', 'camps', 'camp', beach_ok)
for tag, (biome, item) in {'volc': ('volcano', 'cave entrances'), 'desert': ('desert', 'cave entrances'),
                           'swamp': ('swamp', 'cave entrances'), 'beach': ('beach', 'cave entrances'),
                           'vbeach': ('beach', 'cliff wall cave entrances')}.items():
    report(biome, item, sum(1 for m in mouths if m[2] == tag))
log('placed', counts)
print('\n  items per 100x100 tiles (density.py)   biome size   asked  placed')
for biome, item, dens, asked, placed in sorted(PLACED):
    print(f'  {biome:8s} {item:28s} {dens:6g}  {AREA[biome] / 10000:9.1f}  {asked:6d}  {placed:6d}')

# ---------------------------------------------------------------- house doors
houses_doors = []                    # list of trigger lists, one per house
Hs = LY['Houses']
for y, x in zip(*np.nonzero(Hs == 347)):          # red houses: use map2's open-door variant
    if Hs[y, x - 1] == 346 and Hs[y, x + 1] == 348 and Hs[y + 1, x] == 367:
        Hs[y, x - 1:x + 2] = [1661, 1662, 1663]; Hs[y + 1, x - 1:x + 2] = [1681, 1682, 1683]
for y, x in zip(*np.nonzero(Hs == 1662)):
    houses_doors.append([(int(x), int(y + 1))])
# blue-roof houses only have a closed door (187/188) in the tilesheet, so they are not enterable
log('enterable houses', len(houses_doors))

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
# every cliff tile blocks, except ladders and doorways (cave mouth trigger tile)
CLIFF_WALKABLE = LADDER + [1392]
for nm in ('Cliffs', 'Cliffs 2'):
    blk |= (LY[nm] != 0) & ~np.isin(LY[nm], CLIFF_WALKABLE)
# ...but inside cliffs, wall tiles on the inner rim that mostly show ground (see-through tiles) are walkable
RIM_OPACITY = 0.4
_walls = LY['Cliffs'] != 0
_inside = ndimage.binary_fill_holes(_walls) & ~_walls
_rim = _walls & ndimage.binary_dilation(_inside, np.ones((3, 3), bool))
_see_through = _Q[np.clip(LY['Cliffs'] - 1, 0, len(_Q) - 1)].mean(-1) < RIM_OPACITY
blk[_rim & _see_through] = False
blk[:, 0] = blk[:, -1] = True; blk[0, :] = True
for tx, ty, _ in mouths: blk[ty, tx] = False
for trig in houses_doors:
    for tx, ty in trig: blk[ty, tx] = False
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
cy, cx = vil_centres[START]
start_zone = (np.hypot(YY - cy, XX - cx) < 30)
for i in range(6):
    r = free_rect(start_zone, 5, 3)
    if r: checkpoints.append(obj(type='start', x=r[1] * 16, y=r[0] * 16, width=80, height=48,
                                  **({'properties': [{'name': 's', 'type': 'int', 'value': 1}]} if i == 0 else {})))
for nm, R in [('village', R_village), ('beach', R_beach), ('forest', R_forest), ('swamp', R_swamp),
              ('desert', R_desert), ('volc', R_volc)]:
    for gx in range(W // 8, W, max(64, W // 4)):
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
        aw = min(240, W - 16 - x0)
        ya, yb = int(y0 + 4), int(y1 - 4)
        if nm == 'volc': ya = max(4, int(8 * SY))
        area = (yb - ya) * aw
        props = [{'name': 'count', 'type': 'int', 'value': int(max(15, area / 900))},
                 {'name': 'include', 'type': 'string', 'value': inc},
                 {'name': 'maxLevel', 'type': 'int', 'value': hi},
                 {'name': 'minLevel', 'type': 'int', 'value': lo}]
        if wt: props.append({'name': 'weight', 'type': 'string', 'value': wt})
        if nm == 'village' and x0 <= cx < x0 + 256:
            props[0]['value'] = int(props[0]['value'] * 0.4)
        mobareas.append(obj(x=x0 * 16, y=ya * 16, width=aw * 16, height=(yb - ya) * 16, properties=props))

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
camera = [obj(x=0, y=0, width=W * 16, height=H * 16, name='overworld', type='camera')]

# door triggers must be reachable from the overworld
bad = [t for trig in houses_doors for t in trig if lab[t[1], t[0]] != main] + \
      [(x, y) for x, y, _ in mouths if lab[y, x] != main]
log('unreachable door triggers', len(bad))

# ---------------------------------------------------------------- interiors (right half)
log('interiors')
import interiors
FULL = {}
for nm, a in LY.items():
    f = np.zeros((H, MAPW), np.int32); f[:, :W] = a; FULL[nm] = f
systems = interiors.load_systems()
AREA = {'volc': 'volcano', 'desert': 'desert', 'swamp': 'swamp', 'beach': 'beach', 'vbeach': 'beach cliff'}
def _village(t):
    return 1 + int(np.argmin([np.hypot(t[1] - vy, t[0] - vx) for vy, vx in vil_centres]))
houses_doors.sort(key=lambda t: (_village(t[0]), t[0][1], t[0][0]))
mouths.sort(key=lambda m: (m[1], m[0]))
links = [('house', trig, False, f'H{i:02d}', f'village {_village(trig[0])} door') for i, trig in enumerate(houses_doors, 1)] + \
        [('cave', [(x, y)], tag == 'volc', f'C{i:02d}', f'{AREA[tag]} mouth') for i, (x, y, tag) in enumerate(mouths, 1)]
doors, room_cams, oid[0], linked = interiors.build(FULL, links, systems, (W + 3, 3, MAPW - 3, H - 3), oid[0], rng)
camera += room_cams
# every empty cell of the interior strip is solid (the converter would otherwise leave it walkable)
anyt = np.zeros((H, MAPW), bool)
for nm, a_ in FULL.items():
    if nm != 'blocking': anyt |= a_ != 0
FULL.setdefault('blocking', np.zeros((H, MAPW), np.int32))[:, W:][~anyt[:, W:]] = 24
log(f'interiors linked {linked}/{len(links)} ({len(houses_doors)} houses, {len(mouths)} caves), '
    f'{len(room_cams)} rooms, {len(doors)} door objects')

# ---------------------------------------------------------------- write Tiled JSON
# seal rooms with darkness: every empty cell of the interior strip that touches a walkable tile
# gets map2's black cave tile (gid 4, colliding in the tileset), so no room can be walked out of
VOID_TILE = 4
_coll = set(np.load(cache('colliding.npy')).tolist())
_anyt = np.zeros((H, MAPW), bool); _solid = FULL.get('blocking', np.zeros((H, MAPW), np.int32)) != 0
for _nm, _a in FULL.items():
    if _nm == 'blocking': continue
    _anyt |= _a != 0
    _solid |= np.isin(_a, list(_coll))
_walk = _anyt & ~_solid
_touch = ndimage.binary_dilation(_walk, np.ones((3, 3), bool))
_seal = _touch & ~_anyt
_seal[:, :W] = False
FULL.setdefault('cave', np.zeros((H, MAPW), np.int32))[_seal] = VOID_TILE
log('void cells sealed with darkness:', int(_seal.sum()))
# tiles with nothing in them except blocking: no blocking
_anyt = np.zeros((H, MAPW), bool)
for _nm, _a in FULL.items():
    if _nm != 'blocking': _anyt |= _a != 0
if 'blocking' in FULL:
    log('blocking removed from empty tiles:', int(((FULL['blocking'] != 0) & ~_anyt).sum()))
    FULL['blocking'][~_anyt] = 0
log('writing', OUT)
src = json.load(open(data('map2.json')))
order = [l['name'] for l in src['layers']]
tilelayers = []; lid = 1
objlayers = {'doors_old': doors, 'entityareas': entityareas, 'mobareas': mobareas, 'entities': entities,
             'checkpoints': checkpoints, 'camera': camera}
parts = []
LAYERS_OUT = []
for l in src['layers']:
    if l['name'] == 'stone':
        LAYERS_OUT.append({'name': 'stone paths', 'type': 'tilelayer', 'opacity': 1, 'visible': True})
    LAYERS_OUT.append(l)
    if l['name'] == 'canyon':
        LAYERS_OUT.append({'name': 'lava banks', 'type': 'tilelayer', 'opacity': 1, 'visible': True})
order = [l['name'] for l in LAYERS_OUT]
for l in LAYERS_OUT:
    nm = l['name']
    if l['type'] == 'tilelayer':
        a = FULL.get(nm)
        keep = nm in ("don't remove this layer", 'blocking') or (a is not None and a.any())
        if not keep: continue
        if a is None: a = np.zeros((H, MAPW), np.int32)
        hdr = {'data': None, 'height': H, 'id': lid, 'name': nm, 'opacity': l.get('opacity', 1),
               'type': 'tilelayer', 'visible': l.get('visible', True), 'width': MAPW, 'x': 0, 'y': 0}
        if l.get('locked'): hdr['locked'] = True
        s = json.dumps(hdr)
        s = s.replace('"data": null', '"data":[' + ','.join(map(str, a.ravel().tolist())) + ']')
        parts.append(s); lid += 1
    else:
        if nm not in objlayers: continue
        hdr = {'draworder': 'topdown', 'id': lid, 'name': nm, 'objects': objlayers[nm], 'opacity': 1,
               'type': 'objectgroup', 'visible': l.get('visible', True), 'x': 0, 'y': 0}
        if l.get('locked'): hdr['locked'] = True
        parts.append(json.dumps(hdr)); lid += 1
head = {'compressionlevel': -1, 'height': H, 'infinite': False}
tail = {'nextlayerid': lid, 'nextobjectid': oid[0], 'orientation': 'orthogonal', 'renderorder': 'right-down',
        'tiledversion': '1.10.2', 'tileheight': 16, 'tilesets': [{'firstgid': 1, 'source': 'tilesheet.tsx'}],
        'tilewidth': 16, 'type': 'map', 'version': '1.10', 'width': MAPW}
with open(OUT, 'w') as f:
    f.write(json.dumps(head)[:-1] + ',\n "layers":[\n' + ',\n'.join(parts) + '],\n ' + json.dumps(tail)[1:] + '\n')
np.savez(cache('bounds.npz'), topV=topV, topB=topB, gapsV=np.array(gapsV), gapsB=np.array(gapsB), yR=yR)
np.savez_compressed(cache('gen_layers.npz'), **{k: v for k, v in FULL.items()})
if args.preview:
    from render import render_layers
    render_layers([FULL[n] for n in order if n in FULL and n != 'blocking'], args.preview, 2)
    log('preview', args.preview)
log('done')
