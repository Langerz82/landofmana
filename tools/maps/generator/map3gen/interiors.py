"""House and cave interiors, lifted from map2.json and packed into the right half of the map.

map2 keeps its interiors east of the overworld strip (x >= 114). Each interior room has its own
'camera' rect; rooms linked to each other by doors (ladders inside caves) form a 'system'.
Each system is copied whole (all tile layers inside its room rects, plus its internal doors),
so every house / cave mouth in the new overworld gets its own private copy.

Door objects follow map2's 'doors_old' format: a 16x16 trigger, properties x/y = destination
tile, o = facing after arrival, and cx/cy (camera hint) on doors that lead into an interior.
"""
import json
from collections import defaultdict, deque
import numpy as np
from scipy import ndimage
from paths import data, cache

INDOOR = ['indoor', 'indoorwalls', 'indoor doors', 'carpets', 'indoor objects']
SKIP_LAYERS = {'portals', "don't remove this layer"}


def _props(o):
    return {q['name']: q['value'] for q in o.get('properties', [])}


def load_systems(src='map2.json', x_min=114):
    d = json.load(open(data(src)))
    Ld = {l['name']: l for l in d['layers']}
    W = d['width']
    tl = {l['name']: np.array(l['data'], np.int64).reshape(d['height'], W)
          for l in d['layers'] if l['type'] == 'tilelayer' and l['name'] not in SKIP_LAYERS}
    cams = {}
    for o in Ld['camera']['objects']:
        x, y = int(round(o['x'] / 16)), int(round(o['y'] / 16))
        if x >= x_min:
            cams[o['id']] = (x, y, int(round(o['width'] / 16)), int(round(o['height'] / 16)))

    def room(x, y):
        for i, (cx, cy, w, h) in cams.items():
            if cx <= x < cx + w and cy <= y < cy + h: return i

    parent = {i: i for i in cams}
    def find(i):
        while parent[i] != i: i = parent[i]
        return i
    internal, exits = [], {i: [] for i in cams}
    for o in Ld['doors_old']['objects']:
        p = _props(o)
        if 'x' not in p: continue
        tx, ty = int(o['x'] // 16), int(o['y'] // 16)
        dx, dy = int(p['x']), int(p['y'])
        a, b = room(tx, ty), room(dx, dy)
        if a and b:
            parent[find(a)] = find(b)
            internal.append((a, tx, ty, dx, dy, p))
        elif a and not b:
            exits[a].append((tx, ty, p.get('o', 'd')))

    groups = {}
    for i in cams: groups.setdefault(find(i), []).append(i)
    systems = []
    for rooms in groups.values():
        rects = [cams[r] for r in rooms]
        x0 = min(r[0] for r in rects); y0 = min(r[1] for r in rects)
        x1 = max(r[0] + r[2] for r in rects); y1 = max(r[1] + r[3] for r in rects)
        mask = np.zeros((y1 - y0, x1 - x0), bool)
        for (x, y, w, h) in rects: mask[y - y0:y - y0 + h, x - x0:x - x0 + w] = True
        tiles = {}
        for nm, a in tl.items():
            sub = np.where(mask, a[y0:y1, x0:x1], 0)
            if sub.any(): tiles[nm] = sub.astype(np.int32)
        has_indoor = any(nm in tiles for nm in INDOOR)
        small = all(r[2] <= 14 and r[3] <= 14 for r in rects)
        kind = 'house' if has_indoor and small and len(rooms) == 1 else 'cave'
        lava = 'lava' in tiles
        ex = [(tx - x0, ty - y0, o) for r in rooms for (tx, ty, o) in exits[r]]
        if not ex: continue
        ints = [(tx - x0, ty - y0, dx - x0, dy - y0, p) for (r, tx, ty, dx, dy, p) in internal if r in rooms]
        if any(p.get('o') in ('l', 'r') for (*_, p) in ints):
            continue        # invisible platform-hop teleports (no doorway): not used
        if not _all_exits_connected(tiles, mask, ex, ints):
            continue        # e.g. twin-ladder rooms whose halves each need their own entrance
        systems.append(dict(kind=kind, lava=lava, rooms=[(x - x0, y - y0, w, h) for (x, y, w, h) in rects],
                            w=x1 - x0, h=y1 - y0, tiles=tiles, exits=ex, internal=ints, src=(x0, y0)))
    return systems


def _all_exits_connected(tiles, mask, exits, ints):
    """True if every exit can be reached from the first one (walking + internal doors)."""
    colliding = np.load(cache('colliding.npy'))
    solid = ~mask.copy()
    anyt = np.zeros_like(mask)
    for nm, a in tiles.items():
        if nm == 'blocking': solid |= a != 0; continue
        anyt |= a != 0
        solid |= np.isin(a, colliding)
    solid |= ~anyt
    lab, _ = ndimage.label(~solid)
    g = defaultdict(set)
    for (tx, ty, dx, dy, p) in ints: g[lab[ty, tx]].add(lab[dy, dx])
    first = lab[exits[0][1], exits[0][0]]
    seen = {first}; q = deque([first])
    while q:
        u = q.popleft()
        for v in g[u]:
            if v not in seen: seen.add(v); q.append(v)
    return all(lab[ty, tx] in seen for tx, ty, o in exits)


def layout(sizes, x0, y0, x1, y1, gap=6):
    """Shelf-pack (w,h) boxes, then spread rows and boxes evenly over the whole rectangle.
    Returns a list of (x, y) or None if they do not fit."""
    rows, cur, cw, = [], [], 0
    for i, (w, h) in enumerate(sizes):
        if cur and cw + w > x1 - x0:
            rows.append(cur); cur, cw = [], 0
        cur.append(i); cw += w + gap
    if cur: rows.append(cur)
    heights = [max(sizes[i][1] for i in r) for r in rows]
    spare_y = (y1 - y0) - sum(heights)
    if spare_y < gap * (len(rows) - 1): return None
    gy = spare_y / max(1, len(rows))
    pos = [None] * len(sizes); y = y0 + gy / 2
    for r, rh in zip(rows, heights):
        widths = sum(sizes[i][0] for i in r)
        gx = ((x1 - x0) - widths) / len(r); x = x0 + gx / 2
        for i in r:
            w, h = sizes[i]
            pos[i] = (int(x), int(y + (rh - h) / 2)); x += w + gx
        y += rh + gy
    return pos


def door(oid, tx, ty, dx, dy, o, cam=False, name='', w=1):
    """One doors_old teleport. name labels it in Tiled (also stored as a 'to' property);
    w = trigger width in tiles."""
    props = []
    if cam:
        props += [{'name': 'cx', 'type': 'string', 'value': str(dx - 7)},
                  {'name': 'cy', 'type': 'string', 'value': str(dy - 5)}]
    props += [{'name': 'o', 'type': 'string', 'value': o},
              {'name': 'to', 'type': 'string', 'value': name},
              {'name': 'x', 'type': 'string', 'value': str(dx)},
              {'name': 'y', 'type': 'string', 'value': str(dy)}]
    return {'height': 16, 'id': oid, 'name': name, 'properties': props, 'rotation': 0, 'type': 'door',
            'visible': True, 'width': 16 * w, 'x': tx * 16, 'y': ty * 16}


def merge_adjacent(doors):
    """Side-by-side triggers that go to the same place become one wider trigger."""
    key = lambda d: tuple(p['value'] for p in d['properties'] if p['name'] in ('x', 'y'))
    doors = sorted(doors, key=lambda d: (d['y'], d['x']))
    out = []
    for d in doors:
        prev = out[-1] if out else None
        if prev and prev['y'] == d['y'] and prev['x'] + prev['width'] == d['x'] and key(prev) == key(d) \
                and prev['height'] == d['height']:
            prev['width'] += d['width']
        else:
            out.append(d)
    return out


WIDE_DOORS = {1765: (1764, 1766)}     # map2's 3-wide cave opening: trigger spans all of it
GENERATED_SHARE = 1.0      # share of caves built by cavekit (the rest are copies of map2's single-room caves)


def build(FULL, links, systems, region, next_id, rng):
    """links: list of (kind, triggers[(x,y)], prefer_lava, label, where).
    label: short id such as 'C07' / 'H12'; where: text for the overworld side, e.g. 'desert mouth'.
    Writes interiors into FULL (dict of full-size arrays); returns (doors, cameras, next_id, n)."""
    doors, cams = [], []
    by_kind = {k: [s for s in systems if s['kind'] == k] for k in ('house', 'cave')}
    lava_caves = [s for s in by_kind['cave'] if s['lava']]
    uses = {id(s): 0 for s in systems}
    chosen = []
    import cavekit
    def new_cave():
        while True:
            c = cavekit.make_system(rng)
            if c is not None: return c
    for kind, triggers, prefer_lava, label, where in links:
        if kind == 'cave' and rng.random() < GENERATED_SHARE:
            chosen.append((new_cave(), triggers, label, where)); continue
        pool = lava_caves if (prefer_lava and lava_caves) else by_kind[kind]
        m = min(uses[id(s)] for s in pool)            # spread copies evenly over the templates
        cand = [s for s in pool if uses[id(s)] == m]
        s = cand[int(rng.integers(len(cand)))]
        uses[id(s)] += 1
        chosen.append((s, triggers, label, where))
    # Every room is packed on its own (rooms of one cave only connect through teleports, so they
    # need not sit together). Each room keeps its own camera rect; door coordinates are mapped to
    # wherever their room lands.
    def boxes():
        out = []
        for ci, (s_, *_r) in enumerate(chosen):
            for ri, (rx, ry, rw, rh) in enumerate(s_['rooms']):
                out.append((ci, ri, rw, rh))
        out.sort(key=lambda b: -b[3])                      # tall rooms first: balanced shelves
        return out
    bx = boxes()
    pos = layout([(b[2], b[3]) for b in bx], *region, gap=2)
    shrinks = 0
    while pos is None:
        # too big for the strip: rebuild the largest full-size generated cave with compact rooms
        # (same number of chambers and hallways, shorter hallways and smaller chambers)
        gen_ix = [i for i, c in enumerate(chosen) if c[0]['src'] == ('generated',) and not c[0].get('compact')]
        if not gen_ix:
            raise SystemExit('interiors do not fit in the interior strip; lower the cave entrance '
                             'densities in density.py (or the house counts)')
        i = max(gen_ix, key=lambda i: sum(r[2] * r[3] for r in chosen[i][0]['rooms']))
        s_, t_, l_, w_ = chosen[i]
        new = None
        while new is None: new = cavekit.make_system(rng, n_rooms=len(s_['rooms']), compact=True)
        new['compact'] = True
        chosen[i] = (new, t_, l_, w_); shrinks += 1
        bx = boxes()
        pos = layout([(b[2], b[3]) for b in bx], *region, gap=2)
    if shrinks: print(f'  (rebuilt {shrinks} caves with compact rooms to fit the interior strip)')
    where_room = {(b[0], b[1]): p for b, p in zip(bx, pos)}
    shape = next(iter(FULL.values())).shape
    blk = FULL.setdefault('blocking', np.zeros(shape, np.int32))
    for ci, (s, triggers, label, where) in enumerate(chosen):
        rooms = s['rooms']
        def room_ix(x, y):
            for ri, (rx, ry, rw, rh) in enumerate(rooms):
                if rx <= x < rx + rw and ry <= y < ry + rh: return ri
            # outside every rect (should not happen): nearest room
            return min(range(len(rooms)), key=lambda ri: abs(rooms[ri][0] + rooms[ri][2] / 2 - x) + abs(rooms[ri][1] + rooms[ri][3] / 2 - y))
        def G(x, y):
            ri = room_ix(x, y); rx, ry = rooms[ri][:2]; X, Y = where_room[(ci, ri)]
            return X + x - rx, Y + y - ry
        multi = len(rooms) > 1
        def rname(x, y):
            return f'{label} room {room_ix(x, y) + 1}' if multi else label
        for ri, (rx, ry, rw, rh) in enumerate(rooms):
            X, Y = where_room[(ci, ri)]
            for nm, a_ in s['tiles'].items():
                tgt = FULL.setdefault(nm, np.zeros(shape, np.int32))
                sub = a_[ry:ry + rh, rx:rx + rw]; m_ = sub != 0
                tgt[Y:Y + rh, X:X + rw][m_] = sub[m_]
            cams.append({'height': rh * 16, 'id': next_id, 'name': f'{label} room {ri + 1}' if multi else label,
                         'rotation': 0, 'type': 'camera', 'visible': True, 'width': rw * 16,
                         'x': X * 16, 'y': Y * 16})
            next_id += 1
            # seal the far side of doorways (below arch bottoms, above ladder tops, the 3-deep
            # opening) so nobody can step past a trigger into the empty space between rooms
            cw = s['tiles'].get('cavewalls')
            if cw is not None:
                cwr = cw[ry:ry + rh, rx:rx + rw]
                for y, x in zip(*np.nonzero(cwr == 1204)):
                    blk[Y + y, X + x] = 24
                    if Y + y + 1 < shape[0]: blk[Y + y + 1, X + x - 1:X + x + 2] = 24
                for y, x in zip(*np.nonzero(cwr == 1829)):
                    if Y + y - 1 >= 0: blk[Y + y - 1, X + x] = 24
                    for dx_ in (-1, 1):
                        if 0 <= x + dx_ < cwr.shape[1] and cwr[y, x + dx_] not in (0, 1829):
                            blk[Y + y, X + x + dx_] = 24
                for y, x in zip(*np.nonzero(cwr == 1765)):
                    yy = y
                    while yy > 0 and cwr[yy - 1, x] in (1745, 1725): yy -= 1
                    blk[Y + yy - 1, X + x - 1:X + x + 2] = 24
        def span(tx, ty):
            """Doorways wider than one tile get one trigger across their full width."""
            row = FULL.get('cavewalls')
            if row is None: return tx, 1
            t = row[ty, tx]
            if t in WIDE_DOORS:
                l, r = tx, tx
                while row[ty, l - 1] in WIDE_DOORS[t]: l -= 1
                while row[ty, r + 1] in WIDE_DOORS[t]: r += 1
                return l, r - l + 1
            return tx, 1
        for (tx, ty, dx, dy, p) in s['internal']:
            T_, D_ = G(tx, ty), G(dx, dy)
            l, w = span(*T_)
            doors.append(door(next_id, l, T_[1], D_[0], D_[1], p.get('o', 'd'), cam='cx' in p,
                              name=f'to {rname(dx, dy)} ({D_[0]},{D_[1]})', w=w))
            next_id += 1
        ow = triggers[0]; E0 = G(*s['exits'][0][:2])
        inside = rname(*s['exits'][0][:2])
        # overworld trigger(s) -> first interior exit; every interior exit -> overworld trigger
        for (ox, oy) in triggers:
            doors.append(door(next_id, ox, oy, E0[0], E0[1], 'u', cam=True,
                              name=f'to {inside} ({E0[0]},{E0[1]})')); next_id += 1
        for (tx, ty, o) in s['exits']:
            T_ = G(tx, ty); l, w = span(*T_)
            doors.append(door(next_id, l, T_[1], ow[0], ow[1], 'd',
                              name=f'to {where} {label} ({ow[0]},{ow[1]})', w=w)); next_id += 1
    return merge_adjacent(doors), cams, next_id, len(chosen)
