"""Split a map into several map files (sections) that teleport into each other at their edges.

Works on any map made by the generators (map4gen), or any Tiled map in the same format.

- **Sections.** The overworld (the map's 'overworld' camera rect, or the whole map if it has none) is cut into
  a grid of sections, SECTION x SECTION tiles each (or --section-height for rectangular ones; the last row and
  column take whatever is left). Each is written as its own map, <prefix>_<row>_<col>.
- **Interiors.** If the map has an interior strip right of the overworld (house and cave interiors), it becomes
  one more map, <prefix>_int.
- **Folders.** A map's parts live in a folder named after it: tools/maps/data/map4/map4_0_0.json, and after
  converting client/maps/map4/map4_0_0.json and gameserver/maps/map4/map4_0_0.json. The map list names them
  with the folder ("map4/map4_0_0").
- **Camera.** Every section gets a camera rect around the whole file (named after the section), so the map's
  edge is the edge of the screen.
- **Edge doors.** Along every edge shared with a neighbour, the section's own outermost row or column is an
  *edge door*: a door object with the `rel` property, which keeps your position along the edge. Stepping onto
  it at row 120 lands you on row 120 of the next section, on that section's own edge door, facing the way you
  were going. The clients don't fire a door you were teleported onto until you turn (or step off it), so you
  keep walking into the new section, and turning back takes you back. No terrain is duplicated.
- **Margins (optional).** --margin N gives each section N tiles of its neighbours' terrain past each shared
  edge, to look at (blocked except for the edge door, which is then the first row or column of the margin).
  Default 0.
- **Doors.** House doors and cave mouths are re-pointed across maps: overworld trigger -> interiors map (`tmap`),
  and every interior exit -> the section the house or cave stands in. Doors that already lead to another map
  are kept as they are.
- **Full-map position.** Every part gets the map properties worldX/worldY (where its top-left tile sits in the
  full map); the converter passes them on, and the clients' HUD shows the player's full-map gx/gy with them.
- **Start areas.** Every section gets a start area (its first checkpoint) for warps without a door.
- **Warp point.** The section holding the map's start checkpoint becomes its warp point ("/warp <prefix>", admins only).
- **Map list.** client/maps/maplist.json and gameserver/maps/maplist.json (map index -> name, read by the
  gameserver and both clients) get this map's parts appended after the other maps (map0, map1, map2, ...).
  Each part's area in the full map ("areas": name -> [worldX, worldY, width, height], which
  "/warp map4 300 300" uses to find the part holding a full-map tile) is added by the converter from the
  part's worldX/worldY and size when it converts the part (--convert, or node run.js by hand).
  Parts of an earlier split of the same map that no longer exist are removed from the list and the folders
  (also parts in the older flat layout, client/maps/map4_0_0/map4_0_0.json).

    python split.py map4                    # tools/maps/data/map4.json -> data/map4/map4_0_0.json, map4_1_0.json, map4_int.json
    python split.py map4 --convert          # ... and run the converter (server + client) on each of them
    python split.py map3 --section 128      # any map, any section size: map3 -> 8 sections of 128x128 + interiors

Options: --section, --section-height, --margin, --prefix, --overworld-width, --convert.
"""
import os, sys, json, argparse, subprocess
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))                      # tools/maps/generator
DATA = os.path.normpath(os.path.join(HERE, '..', 'data'))               # tools/maps/data
ROOT = os.path.normpath(os.path.join(HERE, '..', '..', '..'))           # the project folder
def data(name): return os.path.join(DATA, name)

ap = argparse.ArgumentParser(description='Split a map into sections that teleport into each other at their edges')
ap.add_argument('map', help='map name in tools/maps/data (e.g. map4) or a path to a Tiled .json map')
ap.add_argument('--section', type=int, default=256, help='section width (and height) in tiles (default 256)')
ap.add_argument('--section-height', type=int, default=None, help='section height, if different from its width')
ap.add_argument('--margin', type=int, default=0, help="tiles of neighbouring terrain shown past each edge (default 0: none)")
ap.add_argument('--prefix', default=None, help='name prefix of the new maps (default: the map name)')
ap.add_argument('--overworld-width', type=int, default=None,
                help="overworld width; default: the 'overworld' camera rect's width, or the whole map")
ap.add_argument('--convert', action='store_true', help='run the converter (server + client) on every new map')
args = ap.parse_args()
SRC = args.map if args.map.endswith('.json') else data(args.map + '.json')
PFX = args.prefix or os.path.splitext(os.path.basename(SRC))[0]
SW = args.section; SH = args.section_height or args.section; M = args.margin
BLOCK_ID = 24

src = json.load(open(SRC))
MW, H = src['width'], src['height']
layers = src['layers']
objs = {l['name']: l for l in layers if l['type'] == 'objectgroup'}
cams = objs['camera']['objects']
ow = [c for c in cams if c.get('name') == 'overworld']
W = min(MW, args.overworld_width or (int(ow[0]['width']) // 16 if ow else MW))
NC, NR = (W + SW - 1) // SW, (H + SH - 1) // SH
HAS_INT = W < MW
print(f'{SRC}: {MW}x{H}, overworld {W}x{H} -> {NR} rows x {NC} cols of {SW}x{SH} sections'
      + (f' + interiors ({MW - W}x{H})' if HAS_INT else ''))

# ---- map list: existing maps first, then this map's sections and its interiors
lists = [os.path.join(ROOT, 'client', 'maps', 'maplist.json'), os.path.join(ROOT, 'gameserver', 'maps', 'maplist.json')]
names = None; warps = []; areas = {}
for p in lists:
    if os.path.exists(p):
        _l = json.load(open(p)); names = _l['maps']; warps = _l.get('warps', []); areas = _l.get('areas', {}); break
if names is None: names = ['map0', 'map1', 'map2']
SRC_ID = names.index(PFX) if PFX in names else -1          # the unsplit map, if the game lists it itself
# this map's parts from an earlier split: "map4/map4_0_0" (in a folder), or "map4_0_0" (the older flat layout)
mine = lambda n: n.startswith(PFX + '/') or n.startswith(PFX + '_')
old_parts = [n for n in names if mine(n)]
names = [n for n in names if not mine(n)]
warps = [n for n in warps if not mine(n)]
areas = {n: a for n, a in areas.items() if not mine(n)}
# the parts are listed with their folder: client/maps/map4/map4_0_0.json, gameserver/maps/map4/map4_0_0.json
# (and tools/maps/data/map4/map4_0_0.json for the Tiled files)
SEC = {(r, c): f'{PFX}/{PFX}_{r}_{c}' for r in range(NR) for c in range(NC)}
INT = f'{PFX}/{PFX}_int' if HAS_INT else None
names += [SEC[(r, c)] for r in range(NR) for c in range(NC)] + ([INT] if INT else [])
ID = {n: i for i, n in enumerate(names)}


def bounds(r, c):
    """core (x0, y0, x1, y1) and file (fx0, fy0, fx1, fy1) of a section, in world tiles."""
    x0, y0 = c * SW, r * SH; x1, y1 = min(W, x0 + SW), min(H, y0 + SH)
    fx0 = x0 - (M if c > 0 else 0); fy0 = y0 - (M if r > 0 else 0)
    fx1 = x1 + (M if c < NC - 1 else 0); fy1 = y1 + (M if r < NR - 1 else 0)
    return (x0, y0, x1, y1), (fx0, fy0, fx1, fy1)


def section_of(tx, ty):
    """section holding world tile (tx, ty) of the overworld, or None for the interior strip."""
    if tx >= W: return None
    return (min(NR - 1, max(0, ty) // SH), min(NC - 1, max(0, tx) // SW))


def props(o):
    return {q['name']: q['value'] for q in o.get('properties', [])}


def set_props(o, pr):
    types = {q['name']: q['type'] for q in o.get('properties', [])}
    out = []
    for k, v in pr.items():
        t = types.get(k) or ('int' if isinstance(v, (int, np.integer)) else 'string')
        out.append({'name': k, 'type': t, 'value': int(v) if t == 'int' else v})
    o['properties'] = out


def shifted(o, dx, dy):
    o = json.loads(json.dumps(o)); o['x'] -= dx * 16; o['y'] -= dy * 16
    return o


def tile_layers(fx0, fy0, fx1, fy1):
    out = {}
    for l in layers:
        if l['type'] != 'tilelayer': continue
        a = np.asarray(l['data'], np.int64).reshape(H, MW)
        out[l['name']] = a[fy0:fy1, fx0:fx1].copy()
    return out


def colliding_gids():
    """gids the map's tilesets mark as colliding (a 'c' property or a collision shape), as the converter reads them."""
    import re
    out = set()
    for ts in src.get('tilesets', []):
        if 'source' not in ts: continue
        p = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(SRC)), ts['source']))
        if not os.path.exists(p): continue
        for m in re.finditer(r'<tile id="(\d+)"(.*?)</tile>', open(p).read(), re.S):
            if '<objectgroup' in m.group(2) or re.search(r'name="c"', m.group(2)):
                out.add(int(m.group(1)) + ts.get('firstgid', 1))
    return out


def solid_cells():
    """World cells nobody can stand on, as the converter sees them: a colliding tile on any layer, any tile on
    the blocking layer, or no tile at all."""
    col = np.array(sorted(colliding_gids()), np.int64)
    solid = np.zeros((H, MW), bool); filled = np.zeros((H, MW), bool)
    for l in layers:
        if l['type'] != 'tilelayer' or l['name'] in ('plateau', '_entities', 'collision'): continue
        a = np.asarray(l['data'], np.int64).reshape(H, MW)
        if l['name'] == 'blocking': solid |= a > 0; continue
        filled |= a > 0; solid |= np.isin(a, col)
    return solid | ~filled


# every map file to write: name -> dict(tiles, objects, offset)
OUT = {}
for (r, c), nm in SEC.items():
    (x0, y0, x1, y1), (fx0, fy0, fx1, fy1) = bounds(r, c)
    OUT[nm] = dict(tiles=tile_layers(fx0, fy0, fx1, fy1), off=(fx0, fy0), size=(fx1 - fx0, fy1 - fy0),
                   core=(x0, y0, x1, y1), objs={k: [] for k in objs}, rc=(r, c))
if INT:
    OUT[INT] = dict(tiles=tile_layers(W, 0, MW, H), off=(W, 0), size=(MW - W, H), core=None,
                    objs={k: [] for k in objs}, rc=None)

oid = [1]
def new_id():
    oid[0] += 1; return oid[0]

# ---- doors: house doors and cave mouths <-> interiors
n_cross = 0
for o in objs.get('doors_old', {'objects': []})['objects']:
    pr = props(o)
    tx, ty = int(o['x'] // 16), int(o['y'] // 16)
    s_from = section_of(tx, ty)
    m_from = SEC[s_from] if s_from else INT
    if 'x' not in pr or 'y' not in pr or ('tmap' in pr and int(pr['tmap']) != SRC_ID):
        # leads to another map (or has no destination): only the trigger moves
        o2 = shifted(o, *OUT[m_from]['off']); o2['id'] = new_id()
        OUT[m_from]['objs']['doors_old'].append(o2); continue
    dx, dy = int(pr['x']), int(pr['y'])
    s_to = section_of(dx, dy)
    m_to = SEC[s_to] if s_to else INT
    fo = OUT[m_from]['off']; to = OUT[m_to]['off']
    o2 = shifted(o, *fo); o2['id'] = new_id()
    pr['x'] = dx - to[0]; pr['y'] = dy - to[1]
    if 'cx' in pr: pr['cx'] = int(pr['cx']) - to[0]
    if 'cy' in pr: pr['cy'] = int(pr['cy']) - to[1]
    if m_to != m_from: pr['tmap'] = ID[m_to]; n_cross += 1
    set_props(o2, pr)
    OUT[m_from]['objs']['doors_old'].append(o2)

# ---- edge doors between neighbouring sections
DIRS = {'e': (0, 1, 'r'), 'w': (0, -1, 'l'), 's': (1, 0, 'd'), 'n': (-1, 0, 'u')}
n_edge = 0
SOLID = solid_cells() if M == 0 else None
n_edge_blocked = 0
for (r, c), nm in SEC.items():
    (x0, y0, x1, y1), (fx0, fy0, fx1, fy1) = bounds(r, c)
    sec = OUT[nm]
    blk = sec['tiles'].setdefault('blocking', np.zeros((fy1 - fy0, fx1 - fx0), np.int64))
    # the whole margin is blocked except the edge door lines
    margin = np.ones((fy1 - fy0, fx1 - fx0), bool); margin[y0 - fy0:y1 - fy0, x0 - fx0:x1 - fx0] = False
    door_cells = np.zeros_like(margin)
    for d, (dr, dc, o) in DIRS.items():
        nb = (r + dr, c + dc)
        if nb not in SEC: continue
        # the door line, along the shared edge: with a margin, its first row/column (past this section's
        # core), arriving at that same world row/column in the neighbour (just inside its core); without
        # one, this section's own outermost row/column, arriving on the neighbour's facing edge line
        # (which is its own edge door: the clients don't fire it until the player turns)
        if d == 'e': wx, wy, w, h = x1, y0, 1, y1 - y0
        elif d == 'w': wx, wy, w, h = x0 - 1, y0, 1, y1 - y0
        elif d == 's': wx, wy, w, h = x0, y1, x1 - x0, 1
        else: wx, wy, w, h = x0, y0 - 1, x1 - x0, 1
        ax, ay = wx, wy                                    # arrival line, in world tiles
        if M == 0:
            wx -= dc; wy -= dr
        door_cells[wy - fy0:wy - fy0 + h, wx - fx0:wx - fx0 + w] = True
        if M == 0:
            # an edge cell is only a way across where both sides are open: block this side's cell where
            # either is solid, so nobody lands in a tree (the neighbour blocks its own cell the same way)
            closed = SOLID[wy:wy + h, wx:wx + w] | SOLID[ay:ay + h, ax:ax + w]
            sub = blk[wy - fy0:wy - fy0 + h, wx - fx0:wx - fx0 + w]
            n_edge_blocked += int((closed & (sub == 0)).sum())
            sub[closed] = BLOCK_ID
        nfo = OUT[SEC[nb]]['off']
        sec['objs']['doors_old'].append({
            'height': h * 16, 'id': new_id(), 'name': f'to {SEC[nb]} ({ {"e": "east", "w": "west", "s": "south", "n": "north"}[d] } edge)',
            'rotation': 0, 'type': 'edge', 'visible': True, 'width': w * 16,
            'x': (wx - fx0) * 16, 'y': (wy - fy0) * 16,
            'properties': [{'name': 'o', 'type': 'string', 'value': o},
                           {'name': 'rel', 'type': 'int', 'value': 1},
                           {'name': 'tmap', 'type': 'int', 'value': ID[SEC[nb]]},
                           {'name': 'dest', 'type': 'string', 'value': SEC[nb]},
                           {'name': 'x', 'type': 'int', 'value': ax - nfo[0]},
                           {'name': 'y', 'type': 'int', 'value': ay - nfo[1]}]})
        n_edge += 1
    blk[margin & ~door_cells] = BLOCK_ID

# ---- cameras, checkpoints, mob areas, entities, entity areas
def where(o):
    cx = int((o['x'] + o.get('width', 0) / 2) // 16); cy = int((o['y'] + o.get('height', 0) / 2) // 16)
    s = section_of(cx, cy)
    return SEC[s] if s else INT

for c_ in cams:
    if c_.get('name') == 'overworld': continue
    m_ = where(c_); o2 = shifted(c_, *OUT[m_]['off']); o2['id'] = new_id()
    OUT[m_]['objs'].setdefault('camera', []).append(o2)
for nm, sec in OUT.items():
    if sec['core'] is None: continue
    fw, fh = sec['size']
    sec['objs']['camera'].insert(0, {'height': fh * 16, 'id': new_id(), 'name': nm, 'rotation': 0, 'type': 'camera',
                                     'visible': True, 'width': fw * 16, 'x': 0, 'y': 0})
for key in ('checkpoints', 'entities', 'entityareas'):
    for o in objs.get(key, {'objects': []})['objects']:
        m_ = where(o); o2 = shifted(o, *OUT[m_]['off']); o2['id'] = new_id()
        OUT[m_]['objs'].setdefault(key, []).append(o2)
def clip_area(o, sec):
    """The part of area object `o` inside a section's core (so mobs stay out of the margins), or None."""
    x0, y0, x1, y1 = sec['core']; fx0, fy0 = sec['off']
    ax0, ay0 = max(x0, o['x'] / 16), max(y0, o['y'] / 16)
    ax1, ay1 = min(x1, (o['x'] + o['width']) / 16), min(y1, (o['y'] + o['height']) / 16)
    if ax1 - ax0 < 4 or ay1 - ay0 < 4: return None
    o2 = json.loads(json.dumps(o)); o2['id'] = new_id()
    o2.update(x=(ax0 - fx0) * 16, y=(ay0 - fy0) * 16, width=(ax1 - ax0) * 16, height=(ay1 - ay0) * 16)
    if o2.get('properties'):                                         # mob count in proportion to the part kept
        part = (ax1 - ax0) * (ay1 - ay0) / max(1.0, o['width'] * o['height'] / 256)
        for q in o2['properties']:
            if q['name'] == 'count': q['value'] = max(1, int(round(q['value'] * part)))
    return o2

for o in objs.get('mobareas', {'objects': []})['objects']:
    for sec in OUT.values():                                         # a mob area may span several sections
        if sec['core'] is None: continue
        o2 = clip_area(o, sec)
        if o2: sec['objs'].setdefault('mobareas', []).append(o2)

# warp point ("/warp <prefix>"): the section holding the map's start checkpoint
for o in objs.get('checkpoints', {'objects': []})['objects']:
    if props(o).get('s') == 1:
        s_ = section_of(int(o['x'] // 16), int(o['y'] // 16))
        if s_: warps.append(SEC[s_]); break

# every section gets a start area (used for warps without a door): the first of its checkpoints
for nm, sec in OUT.items():
    if sec['core'] is None: continue
    cps = sec['objs'].setdefault('checkpoints', [])
    if not cps:
        print(f'  note: {nm} has no checkpoints, so warps without a door cannot land there')
    elif not any(props(o).get('s') == 1 for o in cps):
        cps[0]['properties'] = [{'name': 's', 'type': 'int', 'value': 1}]
        cps[0]['type'] = 'start'

# ---- write the map files (same layer order and header fields as the source)
def write(nm, sec):
    fw, fh = sec['size']; parts = []; lid = 1
    for l in layers:
        if l['type'] == 'tilelayer':
            a = sec['tiles'].get(l['name'])
            if a is None or (not a.any() and l['name'] not in ("don't remove this layer", 'blocking')): continue
            hdr = {k: v for k, v in l.items() if k != 'data'}
            hdr.update(id=lid, width=fw, height=fh, data=None)
            s = json.dumps(hdr).replace('"data": null', '"data":[' + ','.join(map(str, a.ravel().tolist())) + ']')
            parts.append(s)
        else:
            hdr = {k: v for k, v in l.items() if k != 'objects'}
            hdr.update(id=lid, objects=sec['objs'].get(l['name'], []))
            parts.append(json.dumps(hdr))
        lid += 1
    head = {k: v for k, v in src.items() if k not in ('layers',)}
    head.update(width=fw, height=fh, nextlayerid=lid, nextobjectid=oid[0] + 1)
    # where this file's top-left tile sits in the full map (worldX/worldY map properties): the clients add it to
    # the player's tile position in the HUD, so it shows full-map coordinates on every section
    keep = [q for q in head.get('properties', []) if q['name'] not in ('worldX', 'worldY')]
    head['properties'] = keep + [{'name': 'worldX', 'type': 'int', 'value': int(sec['off'][0])},
                                 {'name': 'worldY', 'type': 'int', 'value': int(sec['off'][1])}]
    out = data(nm + '.json')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    # Tiled finds a tileset relative to the map file: the parts sit in a subfolder (data/map4/), so point
    # each external tileset back at the same file the source map uses (tilesheet.tsx -> ../tilesheet.tsx)
    head['tilesets'] = []
    for ts in src.get('tilesets', []):
        ts = dict(ts)
        if 'source' in ts and not os.path.isabs(ts['source']):
            full = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(SRC)), ts['source']))
            ts['source'] = os.path.relpath(full, os.path.dirname(out)).replace(os.sep, '/')
        head['tilesets'].append(ts)
    with open(out, 'w') as f:
        f.write(json.dumps(head)[:-1] + ',\n "layers":[\n' + ',\n'.join(parts) + ']}\n')
    return out

files = [write(nm, sec) for nm, sec in OUT.items()]
# Each part's area in the full map ("areas" in the map list, which "/warp map4 300 300" uses to find the part
# holding a full-map tile) is not written here: the converter works it out from each converted part's
# worldX/worldY and size and adds it to that side's map list, so it always matches the converted files.
# This map's old areas were dropped above.
for p in lists:
    os.makedirs(os.path.dirname(p), exist_ok=True)
    json.dump({'maps': names, 'warps': warps, 'areas': areas}, open(p, 'w'), indent=1)
print(f'wrote {len(files)} maps ({len(SEC)} sections' + (' + interiors' if INT else '') + f'), {n_edge} edge doors, '
      f'{n_cross} house/cave doors re-pointed across maps'
      + (f', {n_edge_blocked} edge cells blocked (solid on the other side)' if M == 0 else ''))
# sections of an earlier split of this map that no longer exist (e.g. after changing the section size)
import shutil
for n in old_parts:
    if n in ID: continue
    if '/' in n:      # folder layout: <folder>/<name>.json on every side
        cands = [data(n + '.json'), os.path.join(ROOT, 'gameserver', 'maps', n + '.json'),
                 os.path.join(ROOT, 'client', 'maps', n + '.json'),
                 os.path.join(ROOT, 'godot-client', 'assets', 'maps', n + '.json')]
    else:             # older flat layout: client/maps/<name>/<name>.json, gameserver/maps/<name>.json
        cands = [data(n + '.json'), os.path.join(ROOT, 'gameserver', 'maps', n + '.json'),
                 os.path.join(ROOT, 'client', 'maps', n), os.path.join(ROOT, 'godot-client', 'assets', 'maps', n)]
    gone = [p for p in cands if os.path.exists(p)]
    for p in gone:
        shutil.rmtree(p) if os.path.isdir(p) else os.remove(p)
    if gone: print('  removed old part', n)
print('map list:', ', '.join(f'{i}={n}' for i, n in enumerate(names)), '| warp points:', ', '.join(warps))
for p in lists: print('  ', p)

if args.convert:
    conv = os.path.normpath(os.path.join(HERE, '..', 'converter'))      # tools/maps/converter
    for f in files:
        rel = os.path.relpath(f, conv)
        for mode in ('server', 'client'):
            r = subprocess.run(['node', '--max-old-space-size=4096', 'run.js', rel, mode], cwd=conv,
                               capture_output=True, text=True)
            if r.returncode: sys.exit(f'converter failed on {f} ({mode}):\n{r.stdout[-2000:]}\n{r.stderr[-2000:]}')
        print('  converted', os.path.basename(f))
