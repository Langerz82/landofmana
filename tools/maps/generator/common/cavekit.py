"""Rule-based cave rooms using map2's cave-wall tiles.

A room is a rectangle of open floor (x0..x1, y0..y1) whose four corners can be cut at 45 degrees
(chamfers a=NW, b=NE, c=SW, d=SE). Walls are laid with the same pieces map2's caves use:
  top wall    3 rows, 4-tile repeating face (1344-1347 / 1364-1367 / 1384-1387)
  left wall   2 columns (1289 1290), right wall 2 columns (1301 1302)
  bottom wall 2 rows (1227 / 1247)
  diagonals   one strip per row next to the floor, shifting one tile per row:
              NW 1328 1348 1368 1388   NE 1383 1363 1343 1323
              SW 1268 1248 1228        SE 1222 1242 1262
The strip rule also reproduces map2's square corners when a chamfer is 0.
"""
import numpy as np

TOP = np.array([[1344, 1345, 1346, 1347], [1364, 1365, 1366, 1367], [1384, 1385, 1386, 1387]])
S_NW = [1328, 1348, 1368, 1388]          # right-aligned, ends next to the floor
S_NE = [1383, 1363, 1343, 1323]          # left-aligned, starts next to the floor
S_SW = [1268, 1269, 1270]
S_SE = [1261, 1262, 1263]
LEFT = (1289, 1290); RIGHT = (1301, 1302); BOT = (1227, 1247)
FLOOR = np.array([[552, 553], [572, 573]])
EXIT = np.array([[1163, 1164, 1165], [1183, 1184, 1185], [1203, 1204, 1205]])
LADDER = [1829, 1849, 1869]
TORCH = [1747, 1767]


def room(w, h, a=0, b=0, c=0, d=0, pad=4):
    """Return (floor tiles, wall tiles, open mask) for a room with an open floor of w x h."""
    H, W = h + 2 * pad, w + 2 * pad
    x0, y0 = pad, pad; x1, y1 = pad + w - 1, pad + h - 1
    Wt = np.zeros((H, W), np.int32); I = np.zeros((H, W), bool)
    def L(y):
        if y < y0: return x0 + a + (y0 - y)
        if y > y1: return x0 + c + (y - y1)
        return x0 + max(0, a - (y - y0), c - (y1 - y))
    def R(y):
        if y < y0: return x1 - b - (y0 - y)
        if y > y1: return x1 - d - (y - y1)
        return x1 - max(0, b - (y - y0), d - (y1 - y))
    for y in range(y0, y1 + 1): I[y, L(y):R(y) + 1] = True
    def put(y, x, t):
        if 0 <= y < H and 0 <= x < W and not I[y, x]: Wt[y, x] = t
    # straight walls
    for x in range(L(y0), R(y0) + 1):
        for k in range(3): put(y0 - 3 + k, x, TOP[k][x % 4])
    for x in range(L(y1), R(y1) + 1):
        put(y1 + 1, x, BOT[0]); put(y1 + 2, x, BOT[1])
    for y in range(y0 + a - 1, y1 - c + 1): put(y, x0 - 2, LEFT[0])
    for y in range(y0 + a, y1 - c + 1): put(y, x0 - 1, LEFT[1])
    for y in range(y0 + b - 1, y1 - d + 1): put(y, x1 + 2, RIGHT[1])
    for y in range(y0 + b, y1 - d + 1): put(y, x1 + 1, RIGHT[0])
    # diagonal strips (top ones under the top wall, bottom ones over the bottom wall)
    for y in range(y0 - 3, y0 + a):
        l = L(y)
        for k, t in enumerate(S_NW):
            x = l - 4 + k
            if x < x0 - 2: continue
            if Wt[y, x] == 0 or (y >= y0 and x >= x0 - 1): put(y, x, t)
    for y in range(y0 - 3, y0 + b):
        r = R(y)
        for k, t in enumerate(S_NE):
            x = r + 1 + k
            if x > x1 + 2: continue
            if Wt[y, x] == 0 or (y >= y0 and x <= x1 + 1): put(y, x, t)
    for y in range(y1 - c + 1, y1 + 3):
        l = L(y)
        for k, t in enumerate(S_SW):
            x = l - 3 + k
            if x < x0 - 2: continue
            if Wt[y, x] == 0: put(y, x, t)
    for y in range(y1 - d + 1, y1 + 3):
        r = R(y)
        for k, t in enumerate(S_SE):
            x = r + 1 + k
            if x > x1 + 2: continue
            if Wt[y, x] == 0: put(y, x, t)
    # floor under the open area and under the walls' inner edge
    Fl = I.copy()
    Fl[:-1] |= I[1:]; Fl[1:] |= I[:-1]; Fl[:, :-1] |= I[:, 1:]; Fl[:, 1:] |= I[:, :-1]
    yy, xx = np.nonzero(Fl)
    Ft = np.zeros((H, W), np.int32); Ft[yy, xx] = FLOOR[yy % 2, xx % 2]
    return Ft, Wt, I


# ------------------------------------------------------------------ cave systems
from scipy import ndimage as _nd


def _chamfers(rng, w, h):
    m = max(0, min(w, h) // 2 - 1)
    return [int(rng.integers(0, m + 1)) if rng.random() < 0.7 else 0 for _ in range(4)]


# floor sizes (w, h ranges); 'compact' sizes are used when caves must shrink to fit the strip
SIZES = {
    'hall_h':  dict(w=(30, 64), h=(2, 4)),  'hall_v':  dict(w=(3, 5), h=(22, 46)),
    'big':     dict(w=(24, 40), h=(12, 20)), 'chamber': dict(w=(10, 24), h=(6, 14)),
}
COMPACT = {
    'hall_h':  dict(w=(16, 26), h=(2, 3)),  'hall_v':  dict(w=(3, 4), h=(12, 18)),
    'big':     dict(w=(14, 20), h=(8, 11)),  'chamber': dict(w=(8, 13), h=(5, 8)),
}


def random_room(rng, kind, compact=False):
    sz = (COMPACT if compact else SIZES)[kind]
    w, h = int(rng.integers(*sz['w'])), int(rng.integers(*sz['h']))
    if kind == 'hall_h':
        ch = [1, 1, 1, 1] if h >= 3 and rng.random() < 0.5 else [0, 0, 0, 0]
    elif kind == 'hall_v':
        ch = [0, 0, 0, 0]
    else:
        ch = _chamfers(rng, w, h)
    Ft, Wt, I = room(w, h, *ch)
    pad = 4
    return dict(F=Ft, W=Wt, I=I, x0=pad, y0=pad, x1=pad + w - 1, y1=pad + h - 1, used=set(), kind=kind,
                deco=[])


def _bottom_spot(r, rng):
    I = r['I']; y1 = r['y1']
    # the arch is 3 tiles wide, so it fits even a 3-wide vertical hallway
    xs = [x for x in range(2, I.shape[1] - 2) if I[y1, x - 1:x + 2].all()
          and not any(abs(x - u) < 4 for u in r['used'])]
    if not xs: return None
    x = xs[int(rng.integers(len(xs)))]; r['used'].add(x)
    # as in map2: the arch's top row (1163-1165) sits on the room's last floor row and its lower two rows
    # replace the two bottom-wall rows (1227 / 1247), so the arch lines up with the wall around it
    r['W'][y1:y1 + 3, x - 1:x + 2] = EXIT
    r['F'][y1:y1 + 2, x - 1:x + 2] = FLOOR[0, 0]
    return (x, y1 + 1)                       # trigger on 1184


def _top_spot(r, rng):
    I = r['I']; y0 = r['y0']
    xs = [x for x in range(2, I.shape[1] - 2) if I[y0, x - 1:x + 2].all()
          and not any(abs(x - u) < 4 for u in r['used'])]
    if not xs: return None
    x = xs[int(rng.integers(len(xs)))]; r['used'].add(x)
    for k, t in enumerate(LADDER): r['W'][y0 - 3 + k, x] = t
    return (x, y0 - 3)                       # trigger on the ladder top (1829), as in map2


def _decorate(r, rng):
    W, I, y0 = r['W'], r['I'], r['y0']
    # torches on the top wall face
    for x in range(r['x0'] + 2, r['x1'] - 1, int(rng.integers(5, 9))):
        if I[y0, x] and x not in r['used'] and all(abs(x - u) > 1 for u in r['used']) and rng.random() < 0.6:
            W[y0 - 2, x], W[y0 - 1, x] = TORCH
    deco = {}
    inner = _nd.binary_erosion(I, iterations=2)
    # a pool in big chambers
    if r['kind'] == 'big' and rng.random() < 0.6:
        from octo import tile as otile, clean, octshape
        cy, cx = (r['y0'] + r['y1']) // 2, (r['x0'] + r['x1']) // 2
        P = np.zeros_like(I)
        P[cy - int(rng.integers(1, 3)):cy + int(rng.integers(2, 4)), cx - int(rng.integers(2, 5)):cx + int(rng.integers(3, 6))] = True
        P = clean(octshape(P, 1)) & _nd.binary_erosion(I, iterations=3)
        if P.sum() >= 6:
            t = otile(P, 'lake')
            pool = np.where(P, np.where(t == 0, 406, t), 0)
            deco['caveriver'] = pool
            inner &= ~_nd.binary_dilation(P, iterations=2)
    # mineral nodes
    ys, xs = np.nonzero(inner)
    mins = np.zeros_like(W)
    for _ in range(int(rng.integers(0, 3))):
        if len(ys) == 0: break
        k = int(rng.integers(len(ys))); y, x = ys[k], xs[k]
        if inner[y + 1, x] if y + 1 < I.shape[0] else False:
            top, bot = [(1886, 1906), (1894, 1914)][int(rng.integers(2))]
            mins[y, x], mins[y + 1, x] = top, bot
    if mins.any(): deco['minerals'] = mins
    r['deco'] = deco


# rooms per cave (chambers + hallways); every cave gets at least 2 chambers and 2 hallways,
# one horizontal and one vertical
ROOM_COUNTS = ([5, 6, 7], [0.35, 0.35, 0.3])
MIN_CHAMBERS, MIN_HALLS = 2, 2


def _kinds(rng, n):
    """Rooms alternate with hallways: chamber, hallway, chamber, hallway, ...
    At least MIN_CHAMBERS chambers and MIN_HALLS hallways (both a horizontal and a vertical one)."""
    n = max(n, MIN_CHAMBERS + MIN_HALLS)
    kinds = ['chamber' if rng.random() < 0.6 else 'big']
    halls = [i for i in range(1, n) if i % 2 == 1]
    extra = [i for i in range(2, n) if i % 2 == 0]
    while len(halls) < MIN_HALLS and extra: halls.append(extra.pop())
    while (n - len(halls)) < MIN_CHAMBERS and len(halls) > MIN_HALLS: halls.pop()
    halls.sort()
    htypes = [('hall_h' if rng.random() < 0.55 else 'hall_v') for _ in halls]
    if len(halls) >= 2 and len(set(htypes)) == 1:
        htypes[int(rng.integers(len(htypes)))] = 'hall_v' if htypes[0] == 'hall_h' else 'hall_h'
    for i in range(1, n):
        kinds.append(htypes[halls.index(i)] if i in halls else ('chamber' if rng.random() < 0.65 else 'big'))
    return kinds


def make_system(rng, n_rooms=None, max_w=110, compact=False):
    """A cave of 1-5 rooms: chambers alternating with horizontal and vertical hallways, linked by
    ladders (top wall) and arches (bottom wall). Returns a system dict for interiors.build."""
    n = n_rooms or int(rng.choice(ROOM_COUNTS[0], p=ROOM_COUNTS[1]))
    kinds = _kinds(rng, n)
    rooms = [random_room(rng, k, compact) for k in kinds]
    exit_ = _bottom_spot(rooms[0], rng)                     # way back out to the overworld
    if exit_ is None: return None
    links = []                                              # (room a, trigger a, room b, trigger b)
    for i in range(1, n):
        # mostly a chain (room -> hallway -> room ...), sometimes a side branch
        order = [i - 1] + [p for p in rng.permutation(i - 1).tolist()] if rng.random() < 0.75 else \
                rng.permutation(i).tolist()
        b = _bottom_spot(rooms[i], rng)
        if b is None: return None
        a = None
        for parent in order:
            pr = rooms[parent]
            first, second = (_top_spot, _bottom_spot) if (pr['kind'] == 'hall_v' or rng.random() < 0.6) else (_bottom_spot, _top_spot)
            a = first(pr, rng) or second(pr, rng)
            if a is not None: break
        if a is None: return None
        links.append((parent, a, i, b))
    for r in rooms: _decorate(r, rng)
    # place rooms side by side (shelf), 3-tile gaps
    pos, x, y, rowh = [], 0, 0, 0
    for r in rooms:
        h, w = r['W'].shape
        if x and x + w > max_w: x, y, rowh = 0, y + rowh + 3, 0
        pos.append((x, y)); x += w + 3; rowh = max(rowh, h)
    W_ = max(px + r['W'].shape[1] for (px, py), r in zip(pos, rooms))
    H_ = max(py + r['W'].shape[0] for (px, py), r in zip(pos, rooms))
    tiles = {nm: np.zeros((H_, W_), np.int32) for nm in ('cave', 'cavewalls', 'caveriver', 'minerals')}
    rects = []
    for (px, py), r in zip(pos, rooms):
        h, w = r['W'].shape
        for nm, a in (('cave', r['F']), ('cavewalls', r['W'])):
            sub = tiles[nm][py:py + h, px:px + w]; m = a != 0; sub[m] = a[m]
        for nm, a in r['deco'].items():
            sub = tiles[nm][py:py + h, px:px + w]; m = a != 0; sub[m] = a[m]
        # camera: the room's walls (trimmed to what is drawn)
        ys, xs = np.nonzero((r['W'] != 0) | (r['F'] != 0))
        rects.append((px + int(xs.min()), py + int(ys.min()), int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1)))
    # walls are solid except the doorway tiles (ladder, arch centre column)
    walk = np.isin(tiles['cavewalls'], LADDER + [1164, 1184])
    tiles['blocking'] = np.where((tiles['cavewalls'] != 0) & ~walk, 24, 0).astype(np.int32)
    # seal the far side of every doorway: nothing to walk onto past an arch or a ladder top
    ys, xs = np.nonzero(tiles['cavewalls'] == LADDER[0])
    for y, x in zip(ys, xs):
        if y > 0: tiles['blocking'][y - 1, x] = 24
    ys, xs = np.nonzero(tiles['cavewalls'] == 1204)
    for y, x in zip(ys, xs):
        if y + 1 < tiles['blocking'].shape[0]: tiles['blocking'][y + 1, x - 1:x + 2] = 24
    tiles = {k: v for k, v in tiles.items() if v.any()}
    off = lambda i, t: (pos[i][0] + t[0], pos[i][1] + t[1])
    ex = off(0, exit_)
    internal = []
    for (ia, ta, ib, tb) in links:
        A, B = off(ia, ta), off(ib, tb)
        oa = 'd' if rooms[ia]['W'][ta[1], ta[0]] == LADDER[0] else 'u'
        # destinations name the other door's trigger; interiors.build lands the player next to it, inside
        # the room (above an arch, below a ladder), facing away from it
        internal.append((A[0], A[1], B[0], B[1], {'o': 'u', 'cx': '1'}))      # deeper: arrive at B's arch
        internal.append((B[0], B[1], A[0], A[1], {'o': oa}))                 # back: arrive at A's door
    return dict(kind='cave', lava=False, rooms=rects, w=W_, h=H_, tiles=tiles,
                exits=[(ex[0], ex[1], 'd')], internal=internal, src=('generated',))
