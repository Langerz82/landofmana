"""map4: a huge map built from the shared generator pieces in ../common.

Overworld (default 768x1024 tiles): several towns, forests, swamps, deserts and volcano areas spread over
the map. Areas are laid out by two smooth noise fields (heat and moisture), so each one blends into its
neighbours through the terrain's own edge tiles instead of meeting along straight bands. The sea runs
along the south coast, with wider beach sections, and sandy lagoon beaches sit around big lakes inland.
Rivers flow south with plank bridges, and dirt trails join every town.
Right strip (default 256 wide): house and multi-room cave interiors, each with its own camera rect.

Uses the shared modules in ../common (tilesheet cache, stamps, autotiler, cave/house/mesa kits, interiors), so run
`python ../common/prepare.py` once first. Settings live in density4.py.
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
COMMON = os.path.normpath(os.path.join(HERE, '..', 'common'))
sys.path.insert(0, COMMON); sys.path.insert(0, HERE)
import json, pickle, time, argparse, heapq
import numpy as np
from collections import defaultdict, Counter
from scipy import ndimage
from octo import tile as otile, clean, octshape, FAM, block
from noise import fbm
from paths import data, cache
import density4 as DEN

ap = argparse.ArgumentParser(description='Generate map4: a huge map in the style of map2/map3')
ap.add_argument('--seed', type=int, default=4, help='random seed (4 reproduces the delivered map4.json)')
ap.add_argument('--out', default=data('map4.json'), help='output Tiled JSON (default: tools/maps/data/map4.json)')
ap.add_argument('--width', type=int, default=256, help='overworld width (default 256)')
ap.add_argument('--height', type=int, default=512, help='map height (default 512)')
ap.add_argument('--interior-width', type=int, default=256, help='width of the interior strip (default 256)')
ap.add_argument('--preview', default=None, help='optional PNG preview path (2px per tile)')
args = ap.parse_args()
SEED, OUT = args.seed, args.out
W = args.width; INTERIOR_W = args.interior_width; MAPW = W + INTERIOR_W; H = args.height
SY = H / 1024.0
SCALE = W / 1024
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
# ladder holes (map2's hole-with-a-ladder, 1833-1835 / 1853-1855) lead nowhere on this map: never scatter them
LADDER_HOLE = [1833, 1834, 1835, 1853, 1854, 1855]
for _g in list(S):
    S[_g] = [s for s in S[_g] if not any(np.isin(a_, LADDER_HOLE).any() for a_ in s['tiles'].values())]
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
S['house_red'] = [s for s in S['house'] if (_house_door(s) or ('', 0, 0))[0] == 'red']
S['house_blue'] = [s for s in S['house'] if (_house_door(s) or ('', 0, 0))[0] == 'blue']
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
    if check and (ys.min() - margin < 0 or xs.min() - margin < 0 or ys.max() + margin >= H or xs.max() + margin >= W): return False
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
# ---------------------------------------------------------------- world layout
log('world layout')
SEA = getattr(DEN, 'SEA', True)                 # False: no sea / coast beaches along the south edge
BANDS = getattr(DEN, 'LAYOUT', 'noise') == 'bands'
yC = H - max(12, int(round(24 * SY))) if SEA else H + 64     # shoreline row (sea below)
NAMES = ['volcano', 'desert', 'swamp', 'forest']
# coast: a thin sand strip along the whole south coast, widening into BEACH_SECTIONS beaches
beach_d = np.full(W, float(DEN.COAST_SAND))
_bw = W / DEN.BEACH_SECTIONS
for c in (np.arange(DEN.BEACH_SECTIONS) + 0.5) * _bw + rng.uniform(-_bw / 5, _bw / 5, DEN.BEACH_SECTIONS):
    wid = rng.uniform(*DEN.BEACH_SECTION_WIDTH) / 2; dep = rng.uniform(*DEN.BEACH_SECTION_DEPTH)
    beach_d = np.maximum(beach_d, dep * np.clip(1 - ((COLS - c) / wid) ** 2, 0, 1) ** 0.5)
beach_d = beach_d + 2.0 * n1(30, SEED + 1)
yB = np.round(yC - np.clip(beach_d, DEN.COAST_SAND - 1, None)).astype(int)   # beach top row per column
if not SEA: yB = np.full(W, yC)
R_sea = YY >= yC
coast_beach = (YY > yB[None]) & ~R_sea
inland = ~coast_beach & ~R_sea
dist_coast = (yB[None] - YY).astype(float)


def _ranks(a, m):
    out = np.zeros(a.shape); v = a[m]
    out[m] = np.argsort(np.argsort(v)) / max(1, len(v) - 1)
    return out


def layout(seed):
    """Area labels (0 volcano, 1 desert, 2 swamp, 3 forest) from heat and moisture noise."""
    r = np.random.default_rng(seed)
    heat = fbm((H, W), r, DEN.REGION_SCALE, 3) - DEN.NORTH_HEAT * (YY / H - 0.5) * 2
    wet = fbm((H, W), r, int(DEN.REGION_SCALE * 0.9), 3)
    cool = np.clip((DEN.COAST_KEEP + 30 - dist_coast) / 30.0, 0, 1)     # forest along the coast
    edge = np.clip((24 - np.minimum.reduce([YY, XX, W - 1 - XX])) / 24.0, 0, 1)
    heat = heat - 4 * cool; wet = wet - 4 * cool
    rh = _ranks(heat, inland); rw = _ranks(wet, inland)
    lab = np.full((H, W), 3, np.int8)
    lab[rh > 1 - DEN.SHARES['desert'] - DEN.SHARES['volcano']] = 1
    lab[rh > 1 - DEN.SHARES['volcano']] = 0
    lab[(lab == 3) & (rw > 1 - DEN.SHARES['swamp'])] = 2
    st = np.stack([ndimage.gaussian_filter((lab == k).astype(float), 5) for k in range(4)])
    lab = st.argmax(0).astype(np.int8)
    lab[(lab == 0) & (edge > 0.5)] = 1                # no lava right at the map edge
    for k in range(4):                                # small specks join their surroundings
        cl, n = ndimage.label(lab == k)
        if not n: continue
        sz = ndimage.sum(np.ones_like(cl), cl, range(1, n + 1))
        for i in np.flatnonzero(sz < DEN.MIN_AREA) + 1:
            m = cl == i
            ring = ndimage.binary_dilation(m, iterations=2) & ~m
            vals = lab[ring]; vals = vals[vals != k]
            lab[m] = np.bincount(vals, minlength=4).argmax() if len(vals) else 3
    lab[~inland] = 3
    cnt = {nm: ndimage.label(lab == k)[1] for k, nm in enumerate(NAMES)}
    return lab, cnt


def band_layout():
    """One area per band, north to south (DEN.BANDS), with wavy noise-shaped borders so the areas run into
    each other instead of meeting along straight lines. Returns area labels and the band index per cell."""
    lab_of = {'volcano': 0, 'desert': 1, 'swamp': 2, 'forest': 3, 'town': 3}
    shares = np.array(DEN.BAND_SHARES, float); cum = np.cumsum(shares / shares.sum())[:-1]
    band = np.zeros((H, W), np.int8)
    for k, c in enumerate(cum):
        edge_ = H * c + DEN.BAND_WARP * (0.7 * n1(70, SEED + 40 + k) + 0.3 * n1(22, SEED + 50 + k))
        band[YY >= edge_[None]] = k + 1
    lab = np.vectorize(lambda b: lab_of[DEN.BANDS[b]])(band).astype(np.int8)
    return lab, band

best = None
for k in range(0 if BANDS else 60):
    alab, cnt = layout(SEED * 1000 + k)
    score = sum(min(cnt[nm], DEN.SECTIONS[nm]) for nm in NAMES)
    if best is None or score > best[0]: best = (score, alab, cnt, k)
    if score == sum(DEN.SECTIONS.values()): break
if BANDS:
    alab, BAND = band_layout()
    log('areas: bands north to south', DEN.BANDS)
else:
    _, alab, cnt, _k = best
    log('areas', cnt, 'layout try', _k + 1)

# towns: in the forest, away from deserts and volcanoes, spread over the map
hot_far = ndimage.distance_transform_edt(alab >= 2)
cand = (alab == 3) & (hot_far > 30) & (YY > 60) & (dist_coast > DEN.TOWN_RADIUS[0] + 14) & (XX > 64) & (XX < W - 64)
cys, cxs = np.nonzero(cand)
towns = []
if BANDS and 'town' in DEN.BANDS:
    # towns sit in the town band, spread across it
    _tb = BAND == DEN.BANDS.index('town')
    for i in range(DEN.TOWNS):
        tx = int((i + 0.5) * W / DEN.TOWNS)
        rows = np.flatnonzero(_tb[:, tx])
        if len(rows): towns.append((int(rows[len(rows) // 2]), tx))
    cys = cxs = []
if len(cys):
    k = int(np.argmin(np.hypot(cys - 0.72 * H, cxs - 0.5 * W))); towns.append((int(cys[k]), int(cxs[k])))
    while len(towns) < DEN.TOWNS:
        d = np.min([np.hypot(cys - ty, cxs - tx) for ty, tx in towns], axis=0)
        k = int(np.argmax(d))
        if d[k] < DEN.TOWN_SPACING: break
        towns.append((int(cys[k]), int(cxs[k])))
START = 0                                           # start town: the one nearest the middle of the south
vil_centres = towns
NVIL = len(towns)
R_village = np.zeros((H, W), bool)
_tw = noise(18, SEED + 7)
for ty, tx in towns:
    ry, rx = DEN.TOWN_RADIUS
    R_village |= ((YY - ty) / ry) ** 2 + ((XX - tx) / rx) ** 2 <= 1 + 0.12 * _tw
R_village = clean(octshape(R_village, 3))
if BANDS and 'town' in DEN.BANDS:
    R_village = BAND == DEN.BANDS.index('town')     # the whole band is town; houses cluster round the centres
vd = np.full((H, W), 1e9)
for cy, cx in vil_centres: vd = np.minimum(vd, np.hypot(YY - cy, (XX - cx) * 0.8))
log('towns', len(towns), towns)

# lagoons: inland lakes ringed with beach sand, in the forest away from towns and the coast
lagoon = np.zeros((H, W), bool); lagoon_sand = np.zeros((H, W), bool)
lc = (alab == 3) & ~ndimage.binary_dilation(R_village, iterations=40) & (dist_coast > 80) & (YY > 60) & (XX > 50) & (XX < W - 50)
lc &= hot_far > 20
nlag = 0
for _ in range(400):
    if nlag >= DEN.LAGOONS: break
    ys_, xs_ = np.nonzero(lc & ~ndimage.binary_dilation(lagoon_sand, iterations=60) if lagoon_sand.any() else lc)
    if not len(ys_): break
    j = int(rng.integers(len(ys_))); cy, cx = int(ys_[j]), int(xs_[j])
    ry = rng.uniform(*DEN.LAGOON_SIZE[0]); rx = rng.uniform(*DEN.LAGOON_SIZE[1])
    sl = (slice(max(0, cy - 40), cy + 41), slice(max(0, cx - 50), cx + 51))
    yy_, xx_ = YY[sl], XX[sl]
    lk = ((yy_ - cy) / ry) ** 2 + ((xx_ - cx) / rx) ** 2 <= 1 + 0.25 * _tw[sl]
    ring = int(rng.integers(*DEN.LAGOON_SAND))
    sd = ndimage.binary_dilation(lk, np.ones((3, 3), bool), iterations=ring)
    if not lc[sl][sd].all(): continue
    lagoon[sl] |= lk; lagoon_sand[sl] |= sd
    nlag += 1
lagoon = clean(octshape(lagoon, 2))
lagoon_sand = clean(octshape(lagoon_sand | lagoon, 2)) & ~lagoon
log('lagoons', nlag)

# rivers: from the north edge down to the beach, avoiding towns, lagoons and volcanoes
river = np.zeros((H, W), bool); river_x = []
for k in range(DEN.RIVERS):
    bestr = None
    for _ in range(60):
        x0 = int(rng.integers(70, W - 70))
        if any(abs(x0 - o[0]) < W / (DEN.RIVERS + 2) for o in river_x): continue
        wn = fbm((8, H), np.random.default_rng(int(rng.integers(1 << 30))), 140, 3)[3]
        ph, per = rng.uniform(0, 6.3), rng.uniform(40, 70)
        xr = np.clip(x0 + 34 * wn + 10 * np.sin(np.arange(H) / per + ph), 20, W - 21).round().astype(int)
        ys = np.arange(H); ok = ys < yB[xr] + 2
        cost = (R_village[ys[ok], xr[ok]].sum() * 5 + (alab[ys[ok], xr[ok]] == 0).sum() * 3
                + lagoon_sand[ys[ok], xr[ok]].sum() * 5)
        if bestr is None or cost < bestr[0]: bestr = (cost, x0, xr)
    if bestr is None: continue
    _, x0, xr = bestr
    rw_ = 3.0 + 1.0 * (fbm((8, H), np.random.default_rng(900 + k), 90, 3)[3] > 0.6)
    rows_ = []
    for y in range(H):
        if y > yB[xr[y]] + 1: break
        if BANDS and not (alab[y, xr[y]] == 3 and not R_village[y, xr[y]]): continue   # band layout: forest only
        r_ = int(rw_[y]); river[y, max(0, xr[y] - r_):xr[y] + r_ + 1] = True; rows_.append(y)
    if rows_: river_x.append((x0, xr, min(rows_), max(rows_)))
river = finish(river, 2)
water = river | lagoon
lk = otile(water, 'lake'); LY['lakes'][water] = lk[water]
LY['water'][water & (lk == 0)] = 406
R_village &= ~ndimage.binary_dilation(river, iterations=4)
occ |= ndimage.binary_dilation(water, iterations=1)
log('rivers', len(river_x))

# area masks (towns and beaches override the noise areas)
R_beach = coast_beach | lagoon_sand
R_volc = (alab == 0) & inland & ~R_beach
R_desert = (alab == 1) & inland & ~R_beach
R_swamp = (alab == 2) & inland & ~R_beach & ~R_village
R_forest = (alab == 3) & inland & ~R_beach & ~R_village
R_village &= inland & ~R_beach
land = ~R_beach & ~R_sea                      # everything but sand and sea (water included)

# ---- item amounts: density4.py gives items per 100x100 tiles of each area
AREA = dict(volcano=int(R_volc.sum()), desert=int(R_desert.sum()), swamp=int(R_swamp.sum()),
            forest=int(R_forest.sum()), village=int(R_village.sum()), beach=int(R_beach.sum()))
PLACED = []
def amount(biome, item):
    return int(round(DEN.DENSITY[biome][item] * AREA[biome] / 10000.0))
def report(biome, item, placed):
    PLACED.append((biome, item, DEN.DENSITY[biome][item], amount(biome, item), int(placed)))
    return placed
log('area sizes (100x100 blocks)', {k: round(v / 1e4, 1) for k, v in AREA.items()})

# plank bridges across the rivers (map2's 1420 rail, 1440/1460 deck, 1480 rail), evenly spaced
bridges = []                                  # (deck_row, c0, c1)
bridge_deck = np.zeros((H, W), bool)
for x0, xr, ry0, ry1 in river_x:
    ytop = max(24, ry0 + 12)
    ybot = min(int(yB[xr].min()) - 20, ry1 - 12)
    n_b = max(1, int(round((ybot - ytop) / DEN.RIVER_BRIDGE_SPACING)))
    for i in range(n_b):
        yc_ = int(ytop + (i + 0.5) * (ybot - ytop) / n_b)
        cand_ = []
        for by in range(yc_ - 10, yc_ + 11):
            if by < 4 or by + 4 >= H: continue
            seg = river[by:by + 4] & (np.abs(COLS - xr[by + 2])[None] < 14)     # this river only
            cols_ = np.flatnonzero(seg.any(0))
            if not len(cols_): continue
            c0, c1 = int(cols_.min()) - 2, int(cols_.max()) + 2
            if c0 < 2 or c1 >= W - 2: continue
            if R_village[by - 2:by + 6, c0 - 3:c1 + 4].any(): continue
            if water[by:by + 4, c0].any() or water[by:by + 4, c1].any(): continue
            cand_.append((c1 - c0, abs(by - yc_), by, c0, c1))
        if not cand_: continue
        _, _, by, c0, c1 = min(cand_)
        LY['Bridge'][by, c0:c1 + 1] = 1420
        LY['Bridge'][by + 1, c0:c1 + 1] = 1440
        LY['Bridge'][by + 2, c0:c1 + 1] = 1460
        LY['Bridge'][by + 3, c0:c1 + 1] = 1480
        LY['lakes'][by + 1:by + 3, c0:c1 + 1] = 0; LY['water'][by + 1:by + 3, c0:c1 + 1] = 0
        bridge_deck[by + 1:by + 3, c0:c1 + 1] = True
        occ[by - 1:by + 5, c0 - 2:c1 + 3] = True
        bridges.append((by + 1, c0, c1))
log('river bridges', len(bridges))
# ---------------------------------------------------------------- volcano areas
# dark dryground in the middle, map2's reddish dryground2 as a wide rim and in patches, so every volcano
# fades through dryground2's own edge tiles into the desert around it; then cliff-walled lava lakes
log('volcano areas')
R_volc = clean(octshape(R_volc, 2)) & inland & ~R_beach
_ring = R_volc & ~ndimage.binary_erosion(R_volc, iterations=10)
d2 = clean(octshape(blobmask(R_volc, 0.25, 22, 21) | _ring, 2)) & R_volc
d2 = clean(d2)
LY['dryground2'][d2] = otile(d2, 'dry2')[d2]
dark = ndimage.binary_erosion(R_volc, iterations=3) & (ndimage.binary_erosion(d2, iterations=1) |
                                                        ndimage.binary_erosion(R_volc, iterations=9))
put_pattern('dryground', dark, [[419, 420], [439, 440]])
volc_floor = dark | d2
import cavekit as _CK
LAVA_LAKE_W, LAVA_LAKE_H = (10, 26), (6, 15)      # basin floor size range (tiles)
lava_ok = volc_floor & ndimage.binary_erosion(R_volc, iterations=6) & ~ndimage.binary_dilation(occ, iterations=3)
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
def astar(start, goal, passable, pref, margin=30, cost=None):
    """8-direction shortest path on passable cells (existing paths are cheaper)."""
    y0 = max(0, min(start[0], goal[0]) - margin); y1 = min(H, max(start[0], goal[0]) + margin + 1)
    x0 = max(0, min(start[1], goal[1]) - margin); x1 = min(W, max(start[1], goal[1]) + margin + 1)
    P = passable[y0:y1, x0:x1]; C = np.where(pref[y0:y1, x0:x1], 0.6, 1.0)
    if cost is not None: C = C * cost[y0:y1, x0:x1]
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
# ---------------------------------------------------------------- trails
# dirt trails (map2's mud) join the towns: every town is linked (shortest links first) plus EXTRA_ROADS
# more; rivers are crossed on the plank bridges. Optional dead-end trails lead into large areas.
log('trails')
FOREST_PATH_WIDTH = DEN.TRAIL_WIDTH
FOREST_PATH_WIDTH_RANGE = (3, 6)
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

blockedT = water | ndimage.binary_dilation(lava_region, iterations=2) | coast_beach | R_sea
blockedT[:4] = blockedT[-4:] = True; blockedT[:, :4] = blockedT[:, -4:] = True
passT = (~blockedT & ~ndimage.binary_dilation(water, iterations=1)) | bridge_deck
# the bridge ends must be reachable: open a short lane on each side of every deck
for by, c0, c1 in bridges:
    passT[by:by + 2, max(0, c0 - 4):c0 + 1] = True; passT[by:by + 2, c1:c1 + 5] = True
town_core = ndimage.binary_erosion(R_village, iterations=5)
if BANDS: town_core &= vd < 50                     # town band: only the house clusters (trails cross the rest)
# meandering: walking cost varies smoothly over the map, so trails wind instead of running straight
_tn = noise(28, SEED + 77); TRAIL_COST = 1.0 + DEN.TRAIL_WANDER * (_tn - _tn.min()) / (np.ptp(_tn) + 1e-9)
trail_pref = np.zeros((H, W), bool)

def route(a, b):
    for m in (50, 120, 260):
        p = astar(a, b, passT, trail_pref | bridge_deck, margin=m, cost=TRAIL_COST)
        if p: return p
    return None

def lay(p):
    wd = Width()
    for y, x in p:
        trail_pref[y, x] = True
        if town_core[y, x]: continue                       # inside towns the village roads take over
        w = FOREST_PATH_WIDTH if bridge_deck[max(0, y - 3):y + 4, max(0, x - 3):x + 4].any() else wd.step()
        stamp(y, x, w)

def walkable_near(y, x, r=12):
    m = passT & (np.abs(YY - y) <= r) & (np.abs(XX - x) <= r)
    return nearest(m, y, x)

T_ = [walkable_near(*t) for t in towns]
pairs = sorted((np.hypot(a[0] - b[0], a[1] - b[1]), i, j) for i, a in enumerate(towns) for j, b in enumerate(towns) if i < j)
_par = list(range(len(towns)))
def _f(i):
    while _par[i] != i: i = _par[i]
    return i
links_t = []
for d, i, j in pairs:
    if _f(i) != _f(j): _par[_f(i)] = _f(j); links_t.append((i, j))
links_t += [(i, j) for d, i, j in pairs if (i, j) not in links_t][:DEN.EXTRA_ROADS]
n_routes = 0
for i, j in links_t:
    if T_[i] is None or T_[j] is None: continue
    p = route(T_[i], T_[j])
    if p: lay(p); n_routes += 1
    else: log('  no trail between towns', i + 1, j + 1)
n_area = 0
if DEN.AREA_TRAILS:
    for R_ in (R_desert, R_swamp, R_volc):
        cl, n = ndimage.label(R_)
        for i in range(1, n + 1):
            m = cl == i
            if m.sum() < 15000: continue
            dt = ndimage.distance_transform_edt(m & passT)
            ty, tx = np.unravel_index(int(np.argmax(dt)), dt.shape)
            src_ = nearest(paths_c & passT, ty, tx)
            if src_ is None: continue
            p = route((int(ty), int(tx)), src_)
            if p: lay(p); n_area += 1
log('trails: town links', n_routes, 'area trails', n_area)
paths = finish(paths_c & ~ndimage.binary_dilation(water, iterations=1), 1)
paths &= ~water & ~coast_beach
paths = clean(paths)
LY['forest paths'][paths] = otile(paths, 'mud')[paths]
occ |= paths
# ---------------------------------------------------------------- terrain
# every area sits on the same dirt; grass, dead grass, pink sand and red rock fade out through their own
# edge tiles, so areas blend into each other
log('terrain')
put_pattern('ground', land, [[15, 16], [35, 36]])
# desert: pink dsand patches
ds = finish(blobmask(R_desert, 0.35, 18, 31) | blobmask(R_swamp, 1.2, 14, 32), 2) & ~ndimage.binary_dilation(R_volc, iterations=2)
ds = clean(ds & land & ~water)
LY['dryground'][ds] = otile(ds, 'dsand')[ds]
# swamp: dead grass (reaching a little into the neighbouring areas) + graveyard mud
_near_sw = ndimage.binary_dilation(R_swamp, iterations=14) & (R_forest | R_desert)
dg = finish(blobmask(R_swamp, -0.25, 18, 41) | blobmask(_near_sw, 0.7, 12, 44), 2) & land & ~water
dg = clean(dg)
LY['dead grass'][dg] = otile(dg, 'dead')[dg]
gm = finish(blobmask(R_swamp & ndimage.binary_erosion(dg, iterations=2), 0.6, 10, 43), 2)
LY['graveyard mud'][gm] = otile(gm, 'mud')[gm]
# grass: forests (dense) and towns, thinning out over the last BLEND tiles towards other areas;
# grassy river banks; grass runs a few tiles onto the beach sand so its edge tiles blend onto it
Rg = R_forest | R_village
# signed distance to the grass areas' border (inside > 0): across BLEND tiles on either side, grass breaks
# up into patches that get rarer towards the other area (never into a volcano)
_sd = ndimage.distance_transform_edt(Rg) - ndimage.distance_transform_edt(~Rg)
_p = np.clip((_sd + DEN.BLEND) / (2.0 * DEN.BLEND), 0, 1)
gthr = np.where(R_village, -0.3, -1.25)
gr = (noise(22, 51) > gthr) & Rg & (_p >= 1)
_zone = (_p > 0) & (_p < 1) & land & ~ndimage.binary_dilation(R_volc, iterations=4)
_blend = _zone & (noise(6, 53) > 1.8 - 3.6 * _p)      # smoothed on its own (finer) below
gr |= ndimage.binary_dilation(water, iterations=3) & ~R_volc & ~R_beach
gr |= ndimage.binary_dilation(R_beach, iterations=6) & land & ~water & ~R_volc & ~R_desert
gr |= R_beach & ndimage.binary_dilation(land & ~water, np.ones((3, 3), bool), iterations=3)
gr |= ndimage.binary_dilation(paths, iterations=2) & Rg
gr &= ~R_sea
gr = finish(gr, 2) & ~R_sea
gr |= clean(octshape(_blend, 1)) & ~water
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
ponds(ginner & R_forest & ~ndimage.binary_dilation(paths, iterations=3), 1.55, 61, 'forest lakes', 'forest lakes')
ponds(ginner & R_village & (vd > 30), 1.6, 62, 'lakes', 'water')
# beach sand + sea along the south coast; lagoon sand around the inland lakes
bs = R_beach | (YY == yC)
LY['sand'][bs] = 359
alt = bs & (noise(10, 71) > 0.7)
a2 = np.kron(alt[::2, ::2], np.ones((2, 2), bool))[:H, :W] & bs
put_pattern('sand', a2, [[299, 300], [319, 320]])
if SEA:
    put_pattern('sand', (YY == yC), [[319, 320]])
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
def bowls(region, n, plen=(3, 9), tag=None, tries=10):
    ys, xs = np.nonzero(region); c = 0
    for i in range(n * tries):
        if c >= n or not len(ys): break
        k = rng.integers(len(ys)); y, x = int(ys[k]), int(xs[k])
        seq = rand_seq(int(rng.integers(*plen)), y - 6, y + 8, y)
        cells, _, _ = ledge_cells(x, y, seq)
        if commit_ledge(cells, margin=2, region=region, tag=tag): c += 1
    return c
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
    'village': ('grass', [[155, 156], [175, 176]]),
}
TERRAIN_LAYERS = ['sand', 'grass', 'dryground', 'dryground2', 'dead grass', 'graveyard mud', 'canyon', 'lava',
                  'forest paths', 'mud', 'groundvariations', 'grassvariations']

def big_cliff(region, zone=None, tries=80, pieces=None, side_rows=None):
    ys, xs = np.nonzero(region)
    if not len(ys): return False
    for _ in range(tries):
        t, top = MESA.mesa(rng, int(rng.integers(*(pieces or MESA_PIECES))), int(rng.integers(*(side_rows or MESA_SIDE_ROWS))))
        hh, ww = t.shape
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
MESA_TOP_GROUND['village'] = MESA_TOP_GROUND['forest']

def big_cliffs(biome, region, **kw):
    n = amount(biome, 'large cliffs'); made = sum(big_cliff(region, biome, **kw) for _ in range(n))
    report(biome, 'large cliffs', made)

# cliffs keep clear of water, trails, bridges and towns
_clear = ~ndimage.binary_dilation(water | paths | bridge_deck, iterations=3) & ~ndimage.binary_dilation(R_village, iterations=6)
volc_ok = R_volc & volc_floor & ~ndimage.binary_dilation(lava_region, iterations=2) & _clear
desert_ok = R_desert & _clear
swamp_ok = R_swamp & _clear
forest_ok = R_forest & _clear
beach_ok_c = coast_beach & (YY > yB[None] + 8) & (YY < yC - 10)
big_cliffs('volcano', volc_ok, tries=300, pieces=(3, 7), side_rows=(2, 5))
big_cliffs('desert', desert_ok, tries=200)
big_cliffs('swamp', swamp_ok, tries=200)
big_cliffs('forest', forest_ok, tries=300, pieces=(3, 6), side_rows=(2, 5))
report('volcano', 'cliff ledges', bowls(volc_ok, amount('volcano', 'cliff ledges'), (3, 7), tag='volc', tries=40))
report('desert', 'cliff ledges', bowls(desert_ok, amount('desert', 'cliff ledges'), tag='desert', tries=30))
report('swamp', 'cliff ledges', bowls(swamp_ok, amount('swamp', 'cliff ledges'), (3, 7), tag='swamp', tries=40))
report('forest', 'cliff ledges', bowls(forest_ok, amount('forest', 'cliff ledges'), (3, 6), tag='forest', tries=80))
report('beach', 'cliff ledges', bowls(beach_ok_c, amount('beach', 'cliff ledges'), (3, 6), tag='beach', tries=60))

_raw = pickle.load(open(cache('stamps.pkl'), 'rb'))
_ok = {'cliff_volc': [0, 1, 2, 5, 7, 10], 'cliff_desert': [0, 1], 'cliff_beach': [0, 1, 2, 3, 4, 5, 6]}
for _g, _ix in _ok.items():
    S[_g] = [_raw[_g][i] for i in _ix if i < len(_raw[_g])]
cliff_rings = S['cliff_volc'] + S['cliff_desert']
for s in cliff_rings: s['n'] = 1
S['cliffs_any'] = cliff_rings
report('volcano', 'cliff features', scatter('cliffs_any', amount('volcano', 'cliff features'), volc_ok, margin=2))
report('desert', 'cliff features', scatter('cliffs_any', amount('desert', 'cliff features'), desert_ok, margin=2))
report('beach', 'cliff features', scatter('cliff_beach', amount('beach', 'cliff features'), beach_ok_c, margin=2))
# ring interiors stay clear of objects
holes = ndimage.binary_fill_holes(LY['Cliffs'] != 0) & (LY['Cliffs'] == 0)
occ |= holes

# Enclosed cliffs (mesa tops, crater rings) get their own ground on a 'cliff ground' layer drawn right under
# the cliff walls and over every other ground layer, so the terrain around a cliff never shows through or
# runs in under its rim. Each plateau is filled solid with its area's ground (CLIFF_GROUND), across its top and
# under the inner rim of its walls. Lava lake basins keep their own canyon floor.
CLIFF_GROUND = {
    'volcano': [[1715, 1716], [1735, 1736]],   # reddish rock (dryground2)
    'desert': [[871, 872], [891, 892]],        # pink desert sand (dryground)
    'swamp': [[546, 547], [566, 567]],         # dead grass
    'forest': [[155, 156], [175, 176]],        # grass
    'village': [[155, 156], [175, 176]],
    'beach': [[359, 359], [359, 359]],         # beach sand
}
_walls = LY['Cliffs'] != 0
_filled = ndimage.binary_fill_holes(_walls)
_inside = _filled & ~_walls & (LY['lava'] == 0) & (LY['canyon'] == 0)
# wall tiles that don't touch the outside: their see-through parts show the plateau, not the land around it
_inner_walls = _walls & ~ndimage.binary_dilation(~_filled, np.ones((3, 3), bool))
_pl, _npl = ndimage.label(_inside)
_areas = [('volcano', R_volc), ('desert', R_desert), ('swamp', R_swamp), ('forest', R_forest),
          ('village', R_village), ('beach', R_beach)]
n_plateaus = 0
for _i, _sl in enumerate(ndimage.find_objects(_pl), 1):
    _m = _pl[_sl] == _i
    _zone = max(_areas, key=lambda a: (a[1][_sl] & _m).sum())[0]        # the area most of the plateau lies in
    _sl2 = (slice(max(0, _sl[0].start - 2), _sl[0].stop + 2), slice(max(0, _sl[1].start - 2), _sl[1].stop + 2))
    _mm = np.zeros(_walls[_sl2].shape, bool)
    _mm[_sl[0].start - _sl2[0].start:_sl[0].stop - _sl2[0].start,
        _sl[1].start - _sl2[1].start:_sl[1].stop - _sl2[1].start] = _m
    # wall cells up to 2 rows above or 2 columns beside the plateau (the back and side walls); never below it,
    # where the cliff's front face shows the land in front of it
    _p = np.pad(_mm, 2)
    _near = np.zeros_like(_p)
    for _dy in (0, 1, 2):
        for _dx in (-2, -1, 0, 1, 2):
            _near |= np.roll(np.roll(_p, -_dy, 0), _dx, 1)       # padding keeps the rolls from wrapping into view
    _near = _near[2:-2, 2:-2]
    _cells = _mm | (ndimage.binary_dilation(_mm, np.ones((3, 3), bool)) & _walls[_sl2]) \
        | (_near & _inner_walls[_sl2])                                         # top + inner rim (2 deep)
    # a wall tile only gets the plateau ground if most of its see-through area faces the plateau: from each
    # quarter, walking out diagonally through the wall reaches either the plateau or the land outside
    for _cy, _cx in zip(*np.nonzero(_cells & _walls[_sl2])):
        _y, _x = _sl2[0].start + _cy, _sl2[1].start + _cx
        _q = _Q[int(LY['Cliffs'][_y, _x]) - 1]
        _in = _out = 0.0
        for _k, (_dy, _dx) in enumerate(((-1, -1), (-1, 1), (1, -1), (1, 1))):
            _ty, _tx = _y + _dy, _x + _dx
            for _ in range(4):
                if not (0 <= _ty < H and 0 <= _tx < W) or not _walls[_ty, _tx]: break
                _ty += _dy; _tx += _dx
            if 0 <= _ty < H and 0 <= _tx < W and _filled[_ty, _tx]: _in += 1 - _q[_k]
            else: _out += 1 - _q[_k]
        if _out > _in: _cells[_cy, _cx] = False
    _pat = np.array(CLIFF_GROUND[_zone])
    _yy, _xx = np.nonzero(_cells)
    LY['cliff ground'][_sl2][_yy, _xx] = _pat[(_sl2[0].start + _yy) % 2, (_sl2[1].start + _xx) % 2]
    n_plateaus += 1
log('enclosed cliffs with their own ground:', n_plateaus)

log('cave mouths')
MOUTH = np.array([[1351, 1352, 1353], [1371, 1372, 1373], [1391, 1392, 1393]])
FMIDS = set(FM.ravel().tolist())
walk_land = (land | R_beach) & ~R_sea & ~occ & (LY['lava'] == 0) & (LY['water'] == 0) & (LY['lakes'] == 0)
TAG_AREA = {'volc': 'volcano', 'desert': 'desert', 'swamp': 'swamp', 'forest': 'forest', 'beach': 'beach'}
MOUTHS_WANTED = {t: amount(b, 'cave entrances') for t, b in TAG_AREA.items()}
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
# towns: houses clustered around each centre
for vi, (cy, cx) in enumerate(vil_centres):
    near = (np.hypot(YY - cy, (XX - cx) * 0.8) < 42) & R_village
    n_ = DEN.HOUSES_IN_START_TOWN if vi == START else DEN.HOUSES_PER_TOWN
    n_red = max(DEN.ENTERABLE_HOUSES_PER_TOWN + 1, int(round(n_ * DEN.RED_HOUSE_SHARE)))   # red roofs (only red houses can open)
    sc(f'houses{vi}', 'house_red', n_red, near, margin=2, tries=40, scale=False)
    sc(f'houses{vi}b', 'house_blue', n_ - counts[f'houses{vi}'], near, margin=2, tries=40, scale=False)
    counts[f'houses{vi}'] += counts.pop(f'houses{vi}b')
STONE_PATH_WIDTH = 4                         # village paths and roads, ~4 tiles wide
VILLAGE_PATH_STYLE = 'ground'                # 'ground': bare ground cut through the grass; 'stone': cobblestone
GROUND_PATH_WIDTH = 4                        # ground paths: bare tiles across, not counting the grass edge tiles
PATH_PATCH_SPACING = 10                      # roughly one bare patch along the paths per this many tiles
VILLAGES_ALL_GRASS = True                    # with ground paths: the rest of each village is grass

hard = (occ & ~paths & ~FRONTS) | (LY['Cliffs'] != 0) | (LY['water'] != 0) | (LY['lakes'] != 0)
walk_v = ndimage.binary_dilation(R_village, iterations=10) & land & ~R_beach & ~ndimage.binary_dilation(hard, iterations=2)
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
# roads: every town centre to each dirt trail that reaches the town
for i, c in enumerate(centres):
    cy_, cx_ = c
    zone = (np.abs(YY - cy_) < DEN.TOWN_RADIUS[0] + 14) & (np.abs(XX - cx_) < DEN.TOWN_RADIUS[1] + 14)
    tl_, tn_ = ndimage.label(paths & zone & ndimage.binary_dilation(R_village, iterations=4))
    targets = []
    for k_ in range(1, tn_ + 1):
        te = nearest((tl_ == k_) & walk_v, *c)
        if te: targets.append(te)
    for t in targets:
        p = astar(c, t, walk_v, vcl | road, margin=60)
        if p:
            for py, px in p: road[py, px] = True
# cobblestone paths (house doors + roads between villages) go on their own layer, drawn just
# before 'stone' so the house pads sit on top; the forest trails stay dirt
import stonepath
SQ = np.ones((STONE_PATH_WIDTH, STONE_PATH_WIDTH), bool)
sp = ndimage.binary_dilation(vcl | road | stubs, SQ) & ~hard & ~R_beach
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
    vg = R_village & ~ndimage.binary_dilation(hard, iterations=3) & ~water
    vys, vxs = np.nonzero(vg)
    n_loose = amount('village', 'bare ground patches')
    for k in rng.integers(0, len(vys), n_loose):
        blob(int(vys[k]), int(vxs[k]), int(rng.integers(2, 5)), int(rng.integers(3, 7)))
    report('village', 'bare ground patches', n_loose)
    carve &= ~R_beach & ~(LY['stone'] != 0) & ~hard
    if VILLAGES_ALL_GRASS:
        vill = R_village & ~R_beach
        gr = gr | (vill & ~water)
        gr = clean(octshape(gr, 2)) & ~R_sea
    pads = (LY['stone'] != 0) & ~R_beach                               # houses' stone pads
    gr &= ~carve & ~pads               # carved after smoothing so the 2-wide paths stay open;
                                       # pads sit on bare ground that joins the path
    for _ in range(3): gr = clean(gr)
    # cells the clean-up turned back to ground next to a path widen it slightly; that's fine
    _old = LY['grass'].copy()                                    # mesa tops (inside their cliff walls) keep their grass
    _mg = (_old != 0) & ~gr & ndimage.binary_fill_holes(LY['Cliffs'] != 0)
    LY['grass'][:] = 0
    LY['grass'][gr] = otile(gr, 'grass')[gr]
    LY['grass'][_mg] = _old[_mg]
    g_in = ndimage.binary_erosion(gr, iterations=1)
    BGMASK['grass'] = g_in
    BGMASK['ground'] = ndimage.binary_erosion(~gr & ~dg & ~ds & land, iterations=1)
    ground_only = land & ~gr & ~dg & notcliff
    LY['grassvariations'][~g_in] = 0
new_cells = sp & ~paths
occ |= ndimage.binary_dilation(new_cells, iterations=1) & ~(occ & ~paths)
counts['stone path tiles'] = int(new_cells.sum())
def put(biome, item, group, allow, **kw):
    """Scatter `item` (density4.py name) using stamp `group`; records the result for the report."""
    kw.setdefault('scale', False)
    if item in DEN.SPACING: kw['margin'] = gap(item, 1)
    sc(f'{biome}:{item}', group, amount(biome, item), allow, **kw)
    report(biome, item, counts[f'{biome}:{item}'])
g_in = ndimage.binary_erosion(gr, iterations=1) & (LY['Cliffs'] == 0)
dry = land & ~water
# towns
put('village', 'trees', 'vtree', g_in & R_village, tries=20)
put('village', 'rocks', 'rock', R_village & dry)
put('village', 'camps', 'camp', R_village & dry)
put('village', 'grass decorations', 'grassvar', g_in & R_village, margin=0)
put('village', 'ground decorations', 'groundvar', ground_only & R_village, margin=0)
# forest
fbox = g_in & R_forest & ~ndimage.binary_dilation(paths, iterations=1)
put('forest', 'trees', 'ftree', fbox, margin=0, tries=40)
put('forest', 'totem posts', 'fobj', R_forest & dry)
put('forest', 'rocks', 'rock', R_forest & dry)
put('forest', 'camps', 'camp', R_forest & dry)
put('forest', 'grass decorations', 'grassvar', g_in & R_forest, margin=0)
# swamp / graveyard
gyard = ndimage.binary_dilation(gm, iterations=4) & R_swamp
S['grave'] = [s for s in S['grave'] if not _has(s, TOMB)]      # crypts and fences; stones come in clumps
put('swamp', 'crypts and fences', 'grave', gyard)
report('swamp', 'tombstone clumps', tomb_clumps(gyard & dry & notcliff & ~occ, amount('swamp', 'tombstone clumps')))
put('swamp', 'dead trees', 'swamptree', R_swamp & dry)
put('swamp', 'dead leaves', 'leaves', R_swamp & dry, margin=0)
put('swamp', 'bones', 'bones', R_swamp & dry)
put('swamp', 'camps', 'camp', R_swamp & dry)
put('swamp', 'ground decorations', 'groundvar', ground_only & R_swamp, margin=0)
# desert
put('desert', 'cactus', 'cactus', R_desert & dry)
put('desert', 'dead trees', 'dtree_desert', R_desert & dry)
put('desert', 'bones', 'bones', R_desert & dry)
put('desert', 'totems', 'totem', R_desert & dry)
put('desert', 'camps', 'camp', R_desert & dry)
report('desert', 'tombstone clumps', tomb_clumps(R_desert & dry & notcliff & ~occ, amount('desert', 'tombstone clumps')))
put('desert', 'rocks', 'rock', R_desert & dry)
put('desert', 'ground decorations', 'groundvar', ground_only & R_desert, margin=0)
# volcano
put('volcano', 'dead trees', 'dtree_volc', R_volc & volc_floor & ~lava_region)
# beaches: the coast and the lagoon sands
beach_ok = R_beach & ~ndimage.binary_dilation(gr, iterations=1) & (YY < yC - 3)
S['palm'] = [s for s in S['beachobj'] if s['h'] >= 5]           # the 5x5 palm
S['beachobj'] = [s for s in S['beachobj'] if s['h'] < 5]          # umbrellas, tents, shells
put('beach', 'palm trees', 'palm', beach_ok, margin=1, tries=20)
put('beach', 'beach objects', 'beachobj', beach_ok)
put('beach', 'camps', 'camp', beach_ok)
for tag, biome in TAG_AREA.items():
    report(biome, 'cave entrances', sum(1 for m in mouths if m[2] == tag))
log('placed', counts)
print('\n  items per 100x100 tiles (density4.py)  area size   asked  placed')
for biome, item, dens, asked, placed in sorted(PLACED):
    print(f'  {biome:8s} {item:28s} {dens:6g}  {AREA[biome] / 10000:9.1f}  {asked:6d}  {placed:6d}')
# ---------------------------------------------------------------- house doors
houses_doors = []                    # list of trigger lists, one per house
Hs = LY['Houses']
# ENTERABLE_HOUSES_PER_TOWN red houses in each town get map2's open door (1661-1683); every other house keeps
# a closed door (red houses 346-348 / 366-368, blue houses 187/188)
OPEN_DOOR = np.array([[1661, 1662, 1663], [1681, 1682, 1683]]); CLOSED_DOOR = np.array([[346, 347, 348], [366, 367, 368]])
red_doors = [(int(y), int(x)) for y, x in zip(*np.nonzero(Hs == 347))
             if Hs[y, x - 1] == 346 and Hs[y, x + 1] == 348 and Hs[y + 1, x] == 367]
red_doors += [(int(y), int(x)) for y, x in zip(*np.nonzero(Hs == 1662))]
by_vil = {}
for y, x in red_doors:
    v = int(np.argmin([np.hypot(y - vy, x - vx) for vy, vx in vil_centres]))
    by_vil.setdefault(v, []).append((y, x))
for v, ds_ in sorted(by_vil.items()):
    ds_.sort(); pick = set(int(i) for i in rng.permutation(len(ds_))[:DEN.ENTERABLE_HOUSES_PER_TOWN])
    for i, (y, x) in enumerate(ds_):
        Hs[y:y + 2, x - 1:x + 2] = OPEN_DOOR if i in pick else CLOSED_DOOR
        if i in pick: houses_doors.append([(x, y + 1)])
log('enterable houses per town', {v + 1: min(len(d_), DEN.ENTERABLE_HOUSES_PER_TOWN) for v, d_ in sorted(by_vil.items())},
    'houses per town', {v + 1: counts[f'houses{v}'] for v in range(NVIL)})
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
# The overworld's left column and top row are walkable (the map edge itself stops the player there): they
# are blocked here only while laying out the map, and opened again where nothing else blocks them, below.
# The right column stays blocked: it is the seam with the interior strip in the unsplit map.
_edge_open = ~blk
blk[:, 0] = blk[:, -1] = True; blk[0, :] = True
for tx, ty, _ in mouths: blk[ty, tx] = False
for trig in houses_doors:
    for tx, ty in trig: blk[ty, tx] = False
LY['blocking'][blk] = 24
_edge = np.zeros_like(blk); _edge[:, 0] = True; _edge[0, :-1] = True
LY['blocking'][:H, :W][_edge & _edge_open] = 0
# ---------------------------------------------------------------- walkability sanity
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
for nm, R in [('volcano', R_volc), ('desert', R_desert), ('swamp', R_swamp), ('forest', R_forest),
              ('town', R_village), ('beach', R_beach)]:
    if not R.any(): continue
    print(f'  {nm:8s} reachable share {((lab == main) & R).sum() / max(1, (R & ~solid).sum()):.2f}')
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
# ---------------------------------------------------------------- object layers
AREA_OF = np.full((H, W), -1, np.int8)            # 0 volcano .. 5 beach, for mob levels and checkpoints
for k, R in enumerate([R_volc, R_desert, R_swamp, R_forest, R_village, R_beach]): AREA_OF[R] = k
checkpoints = []
cy, cx = vil_centres[START]
start_zone = (np.hypot(YY - cy, XX - cx) < 30)
for i in range(6):
    r = free_rect(start_zone, 5, 3)
    if r: checkpoints.append(obj(type='start', x=r[1] * 16, y=r[0] * 16, width=80, height=48,
                                  **({'properties': [{'name': 's', 'type': 'int', 'value': 1}]} if i == 0 else {})))
CELL = 128                                        # one checkpoint and one mob area per 128x128 cell
for y0 in range(0, H, CELL):
    for x0 in range(0, W, CELL):
        cellm = (YY >= y0) & (YY < y0 + CELL) & (XX >= x0) & (XX < x0 + CELL)
        r = free_rect(cellm & ~R_sea, 4, 3, 600)
        if r: checkpoints.append(obj(x=r[1] * 16, y=r[0] * 16, width=64, height=48))

# mob levels by area (towns easiest, volcanoes hardest)
MOBS = {4: (1, 3, '1', '2,1'), 5: (4, 6, '2', '4,2,1'), 3: (6, 9, '1', '2,1'), 2: (9, 12, '2', '4,2,1'),
        1: (12, 16, '1', '2,1'), 0: (16, 20, '2', '4,2,1')}
mobareas = []
for y0 in range(0, yC - 8, CELL):
    for x0 in range(0, W, CELL):
        y1, x1 = min(yC - 4, y0 + CELL), min(W, x0 + CELL)
        a_ = AREA_OF[y0:y1, x0:x1]; a_ = a_[a_ >= 0]
        if len(a_) < 2000: continue
        k = int(np.bincount(a_, minlength=6).argmax())
        lo, hi, inc, wt = MOBS[k]
        n_ = int(max(10, (y1 - y0) * (x1 - x0) / 1100))
        if k == 4 and np.hypot((y0 + y1) / 2 - cy, (x0 + x1) / 2 - cx) < CELL: n_ = int(n_ * 0.4)   # quieter start town
        props = [{'name': 'count', 'type': 'int', 'value': n_},
                 {'name': 'include', 'type': 'string', 'value': inc},
                 {'name': 'maxLevel', 'type': 'int', 'value': hi},
                 {'name': 'minLevel', 'type': 'int', 'value': lo}]
        if wt: props.append({'name': 'weight', 'type': 'string', 'value': wt})
        mobareas.append(obj(x=(x0 + 4) * 16, y=(y0 + 4) * 16, width=(x1 - x0 - 8) * 16, height=(y1 - y0 - 8) * 16,
                            name=['volcano', 'desert', 'swamp', 'forest', 'town', 'beach'][k], properties=props))

entities = []
r = free_rect(start_zone, 1, 1)
if r:
    entities.append(obj(x=r[1] * 16, y=r[0] * 16, width=16, height=16, properties=[
        {'name': 'kind', 'type': 'int', 'value': 2}, {'name': 'name', 'type': 'string', 'value': 'Beginner Quests'},
        {'name': 'quests', 'type': 'string', 'value': '300000,300001'}, {'name': 'type', 'type': 'string', 'value': 'npc'}]))
entityareas = []
for ty_, tx_ in vil_centres:
    for R in (R_village, R_forest):
        zone_ = R & (np.abs(YY - ty_) < 90) & (np.abs(XX - tx_) < 90)
        r = free_rect(zone_, 6, 5, 800)
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
# ---------------------------------------------------------------- interiors (right strip)
log('interiors')
import interiors
FULL = {}
for nm, a in LY.items():
    f = np.zeros((H, MAPW), np.int32); f[:, :W] = a; FULL[nm] = f
systems = interiors.load_systems()
WHERE = {'volc': 'volcano', 'desert': 'desert', 'swamp': 'swamp', 'forest': 'forest', 'beach': 'beach'}
def _village(t):
    return 1 + int(np.argmin([np.hypot(t[1] - vy, t[0] - vx) for vy, vx in vil_centres]))
houses_doors.sort(key=lambda t: (_village(t[0]), t[0][1], t[0][0]))
mouths.sort(key=lambda m: (m[1], m[0]))
links = [('house', trig, False, f'H{i:02d}', f'town {_village(trig[0])} door') for i, trig in enumerate(houses_doors, 1)] + \
        [('cave', [(x, y)], tag == 'volc', f'C{i:02d}', f'{WHERE[tag]} mouth') for i, (x, y, tag) in enumerate(mouths, 1)]
doors, room_cams, oid[0], linked = interiors.build(FULL, links, systems, (W + 3, 3, MAPW - 3, H - 3), oid[0], rng)
camera += room_cams
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
    if l['name'] == 'Cliffs':                     # enclosed cliffs' own ground, right under the walls
        LAYERS_OUT.append({'name': 'cliff ground', 'type': 'tilelayer', 'opacity': 1, 'visible': True})
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
if args.preview:
    from render import render_layers
    render_layers([FULL[n] for n in order if n in FULL and n != 'blocking'], args.preview, 2)
    log('preview', args.preview)
log('done')
