"""Ladders into sealed cliff pockets.

Cliff rings stamped from the older maps (the 'cliff_volc' / 'cliff_desert' craters) enclose a patch of walkable
ground with no way in: the cave mouth in their front face is a door to the interiors, not a way onto the floor
behind it. Mobs spawn or roam onto those floors and the game server can't path them in or out
("findPath - Error while finding the path to ..."). This step gives every such pocket a ladder down its
front face, the same way big_cliff() climbs a mesa: the three LADDER tiles replace one column of the face,
the plateau floor above the top tile and open ground below the bottom tile.

Used by map1gen/gen1.py after the blocking layer is built, and runnable on an existing Tiled map:

    python ladders.py ../../data/map1.json --width 512 --rows 256,474,768   # map1's overworld, in place
    python ladders.py ../../data/map1.json --width 512 --rows 256,474,768 --dry-run

--rows/--cols are the cut lines split.py cuts the map at (map1: 256, 474, 768; split.py prints them). The game
server paths each section by itself, so every section is checked on its own. Running it again only adds
ladders where a pocket is still sealed. split.py also runs it with its own cut lines (see split.py).
"""
import numpy as np
from scipy import ndimage

LADDER = [1829, 1849, 1869]                       # top, middle, bottom (as in gen1.py / cavekit.py)
FACE_TOP = {1054, 1055, 1056, 1057}               # mesa set flat front face (FM = T[6:9, 3:7]): top row
FACE_BOT = {1094, 1095, 1096, 1097}               # ... and bottom row
MOUTH = {1351, 1352, 1353, 1371, 1372, 1373, 1391, 1392, 1393}   # cave mouth tiles: never cover them
MIN_POCKET = 4                                    # smaller enclosed bits are wall seams, not floors


def sealed_pockets(cliffs, solid, inside=None):
    """Walkable components other than the main one that lie (mostly) inside a cliff outline.
    Returns (labels, main label, [(label, size)])."""
    lab, n = ndimage.label(~solid)
    if n == 0: return lab, 0, []
    sizes = np.bincount(lab.ravel(), minlength=n + 1); sizes[0] = 0
    main = int(np.argmax(sizes))
    if inside is None: inside = ndimage.binary_fill_holes(cliffs != 0)
    ins = np.bincount(lab[inside].ravel(), minlength=n + 1)
    out = [(i, int(sizes[i])) for i in range(1, n + 1)
           if i != main and sizes[i] >= MIN_POCKET and ins[i] * 2 >= sizes[i]]
    return lab, main, out


def _candidates(cliffs, solid, fixed, lab, main, pocket):
    """(score, x, top_row) ladder spots for one pocket, best first. Score 0: a flat front-face column below the
    pocket (as on mesas); 1: any other 3-tile wall run below it; 2: a 3-tile wall run above it (back wall)."""
    H, W = solid.shape
    ys, xs = np.nonzero(lab == pocket)
    cx = xs.mean()
    out = []
    def run_ok(y0, x):
        rows = slice(y0, y0 + 3)
        c = cliffs[rows, x]
        return (solid[rows, x].all() and (c != 0).all() and not fixed[rows, x].any()
                and not any(int(v) in MOUTH for v in c))
    for y, x in zip(ys.tolist(), xs.tolist()):
        # down the front face: pocket at y, wall y+1..y+3, open ground at y+4
        if y + 4 < H and run_ok(y + 1, x) and lab[y + 4, x] == main:
            face = int(cliffs[y + 1, x]) in FACE_TOP and int(cliffs[y + 3, x]) in FACE_BOT
            out.append((0 if face else 1, abs(x - cx), x, y + 1))
        # up the back wall: pocket at y, wall y-3..y-1, open ground at y-4
        if y - 4 >= 0 and run_ok(y - 3, x) and lab[y - 4, x] == main:
            out.append((2, abs(x - cx), x, y - 3))
    out.sort()
    return [(s, x, y) for s, _, x, y in out]


def add_ladders(cliffs, blocking, solid, fixed=None, rows=None, cols=None, log=print):
    """Give every sealed cliff pocket a ladder to the main walkable area. Edits cliffs, blocking and solid in
    place (2D arrays of the same shape: Cliffs layer gids, blocking layer gids, walkability with True = blocked).
    `fixed`: cells blocked by anything other than the Cliffs and blocking layers (a ladder never goes there).
    `rows` / `cols`: the cut lines split.py will cut the map at (inner lines only, in tiles). The game server
    paths every section on its own, so each section is checked by itself: a pocket must reach its own
    section's main area, and a ladder (with the tile at its foot) never touches a section's outer row or
    column, which split.py turns into an edge door.
    Deterministic (no random numbers), so a generator's later random draws don't change.
    Returns [(x, top_row, pocket_size)] for the ladders placed and [(x, y, size)] for pockets left sealed
    (full-map tiles)."""
    if fixed is None: fixed = np.zeros_like(solid)
    H, W = solid.shape
    inside = ndimage.binary_fill_holes(cliffs != 0)          # whole map: a ring cut by a section line still counts
    ys_ = [0] + sorted(r for r in (rows or []) if 0 < r < H) + [H]
    xs_ = [0] + sorted(c for c in (cols or []) if 0 < c < W) + [W]
    placed, sealed = [], []
    for y0, y1 in zip(ys_, ys_[1:]):
        for x0, x1 in zip(xs_, xs_[1:]):
            sl = (slice(y0, y1), slice(x0, x1))
            edged = len(ys_) > 2 or len(xs_) > 2
            p, s = _add_ladders_section(cliffs[sl], blocking[sl], solid[sl], fixed[sl], inside[sl], edged, log, x0, y0)
            placed += [(x + x0, y + y0, n) for x, y, n in p]
            sealed += [(x + x0, y + y0, n) for x, y, n in s]
    return placed, sealed


def _add_ladders_section(cliffs, blocking, solid, fixed, inside, edged, log, ox, oy):
    placed, sealed, skip = [], [], set()
    H, W = solid.shape
    while True:
        lab, main, pockets = sealed_pockets(cliffs, solid, inside)
        todo = []
        for p, size in pockets:
            ys, xs = np.nonzero(lab == p)
            key = (int(ys.min()), int(xs.min()))
            if key not in skip: todo.append((p, size, key))
        if not todo: break
        p, size, key = todo[0]
        cand = _candidates(cliffs, solid, fixed, lab, main, p)
        if edged:       # keep the ladder and its foot off the section's outer rows/columns (edge doors)
            cand = [(s, x, y) for s, x, y in cand if 1 <= x <= W - 2 and y >= 2 and y + 3 <= H - 2]
        if not cand:
            skip.add(key); sealed.append((key[1], key[0], size))
            log(f'  ladders: no spot for a ladder into the pocket at tile {key[1] + ox},{key[0] + oy} ({size} tiles)')
            continue
        _, x, y = cand[0]
        for r, t in enumerate(LADDER):
            cliffs[y + r, x] = t
            blocking[y + r, x] = 0
            solid[y + r, x] = False
        placed.append((x, y, size))
    return placed, sealed


# ------------------------------------------------------------------ patch an existing Tiled map
GID_MASK = 0x1FFFFFFF
NON_TILE = {'blocking', 'plateau', '_entities', 'collision'}


def _solid_from_tiled(layers, colliding, shape):
    """As tools/maps/converter/_processmap.js builds a server map's collision: the blocking layer, any tile the
    tileset marks colliding, and cells with no tile at all. Returns (solid, fixed) where fixed leaves out the
    Cliffs and blocking layers."""
    solid = np.zeros(shape, bool); fixed = np.zeros(shape, bool); anyt = np.zeros(shape, bool)
    for nm, a in layers.items():
        if nm == 'blocking':
            solid |= a != 0; continue
        if nm in NON_TILE: continue
        g = a & GID_MASK
        anyt |= g != 0
        c = np.isin(g, colliding)
        solid |= c
        if nm != 'Cliffs': fixed |= c
    solid |= ~anyt; fixed |= ~anyt
    return solid, fixed


def patch_tiled(path, width=None, out=None, dry_run=False, rows=None, cols=None):
    import json
    from paths import cache
    d = json.load(open(path))
    H, Wf = d['height'], d['width']
    W = width or Wf
    tl = {l['name']: l for l in d['layers'] if l.get('type') == 'tilelayer'}
    full = {nm: np.array(l['data'], dtype=np.int64).reshape(H, Wf) for nm, l in tl.items()}
    view = {nm: a[:, :W] for nm, a in full.items()}           # views: edits land in `full`
    colliding = np.load(cache('colliding.npy'))
    solid, fixed = _solid_from_tiled(view, colliding, (H, W))
    placed, sealed = add_ladders(view['Cliffs'], view['blocking'], solid, fixed, rows, cols)
    for x, y, n in placed:
        print(f'ladder at tile {x},{y}..{y + 2} into a pocket of {n} tiles')
    print(f'{len(placed)} ladders placed, {len(sealed)} pockets left sealed')
    if dry_run or not placed: return placed, sealed
    _write_layers(path, out or path, {nm: full[nm].ravel().tolist() for nm in ('Cliffs', 'blocking')}, d, tl)
    print('written', out or path)
    return placed, sealed


def _write_layers(src, dst, new_data, d, tl):
    """Write the map with new tile data for some layers. The generators write one layer per line
    ('{"data":[...], ...'): then only those layers' data arrays are swapped and every other byte stays as it
    was, so a diff shows just the changed layers. Any other layout is written out again as compact JSON."""
    import json
    raw = open(src, 'rb').read().decode('utf-8')
    lines = raw.splitlines(keepends=True)
    done = set()
    for i, ln in enumerate(lines):
        if not ln.startswith('{"data":['): continue
        for nm, data in new_data.items():
            if nm not in done and ('"name": "%s"' % nm) in ln[ln.index(']'):]:
                lines[i] = '{"data":[' + ','.join(str(v) for v in data) + ln[ln.index(']'):]
                done.add(nm)
    if done == set(new_data):
        open(dst, 'wb').write(''.join(lines).encode('utf-8'))
        return
    for nm, data in new_data.items(): tl[nm]['data'] = data
    with open(dst, 'w') as f:
        json.dump(d, f, separators=(',', ':'))


if __name__ == '__main__':
    import argparse, os, sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    ap = argparse.ArgumentParser(description='Add ladders into sealed cliff pockets of a Tiled map (in place).')
    ap.add_argument('map', help='Tiled JSON, e.g. ../../data/map1.json')
    ap.add_argument('--width', type=int, default=None, help='only the left N columns (map1: 512, the overworld)')
    ap.add_argument('--out', default=None, help='write here instead of over the input')
    ap.add_argument('--rows', default=None, help="split.py's row cut lines, e.g. 256,474,768 (map1)")
    ap.add_argument('--cols', default=None, help="split.py's column cut lines, if any")
    ap.add_argument('--dry-run', action='store_true', help='report only')
    a = ap.parse_args()
    _cuts = lambda v: [int(t) for t in v.split(',') if t.strip()] if v else None
    patch_tiled(a.map, a.width, a.out, a.dry_run, _cuts(a.rows), _cuts(a.cols))
