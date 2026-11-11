"""Smooth the terrain edges of an existing Tiled map: re-pick the variant of every straight edge tile so the edge
lines up where tiles meet (common/octo.smooth_joints -- the same pass the generators run before writing a map),
and fill the ground layer under see-through grass edges where the sand below would show through
(common/octo.fill_under_edges, also run by the generators). The file's own formatting is kept (only the layers'
numbers change).

    python smooth_edges.py map1                 # tools/maps/data/map1.json
    python smooth_edges.py map3 --only-bad      # only runs with a visibly uneven joint (fewer changes)
    python smooth_edges.py map2 --dry-run       # just report

Then split/convert the map as usual (python split.py map1 --section 256 --convert, or node run.js for a map that
isn't split) so the game's copies get the change.
"""
import os, re, sys, json, argparse
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, 'common'))
from octo import FAM, smooth_joints, tile_alpha, fill_under_edges
from paths import data

ap = argparse.ArgumentParser(description='Smooth terrain edges in a Tiled map')
ap.add_argument('map', help='map name in tools/maps/data (e.g. map1) or a path to a Tiled .json map')
ap.add_argument('--layer', default='grass', help='tile layer (default grass)')
ap.add_argument('--family', default='grass', help='edge tile family in common/octo.py FAM (default grass)')
ap.add_argument('--only-bad', action='store_true', help='only change runs with a joint more than 3 pixels off')
ap.add_argument('--no-fill', action='store_true', help='do not fill the ground layer under see-through grass edges')
ap.add_argument('--dry-run', action='store_true', help='report only, do not write')
args = ap.parse_args()
src = args.map if args.map.endswith('.json') else data(args.map + '.json')

text = open(src, 'rb').read().decode('utf-8')
d = json.loads(text); W, H = d['width'], d['height']
lay = [l for l in d['layers'] if l['name'] == args.layer and l['type'] == 'tilelayer']
if not lay: sys.exit(f'{src} has no tile layer "{args.layer}"')
grid = np.array(lay[0]['data'], np.int64).reshape(H, W)
before = grid.copy()
alpha = tile_alpha(data('tilesheet.png'))
F = FAM[args.family]

def bad_joints(g):
    edge = np.isin(g, [v for k in ('T', 'B', 'L', 'R') for v in F[k]]); n = 0
    for y, x in zip(*np.nonzero(edge[:-1] | edge[1:])):
        a, b = g[y, x], g[y + 1, x]
        if a and b and (alpha(a)[-1] ^ alpha(b)[0]).sum() > 3: n += 1
    for y, x in zip(*np.nonzero(edge[:, :-1] | edge[:, 1:])):
        a, b = g[y, x], g[y, x + 1]
        if a and b and (alpha(a)[:, -1] ^ alpha(b)[:, 0]).sum() > 3: n += 1
    return n

b0 = bad_joints(grid)
n = smooth_joints(grid, F, alpha, only_bad=args.only_bad)
print(f'{src}: uneven joints {b0} -> {bad_joints(grid)}, {n} tiles re-picked')
layers = {args.layer: (before, grid)}
names = {l['name'] for l in d['layers'] if l['type'] == 'tilelayer'}
if not args.no_fill and {'ground', 'sand'} <= names:
    grab = lambda nm: np.array([l for l in d['layers'] if l['name'] == nm][0]['data'], np.int64).reshape(H, W)
    ground = grab('ground'); g0 = ground.copy()
    k = fill_under_edges(grid, ground, grab('sand'), tile_alpha(data('tilesheet.png'), threshold=254), covers=[grab(nm) for nm in ('water', 'lakes') if nm in names])
    print(f'  ground filled under see-through grass edges: {k}')
    if k: layers['ground'] = (g0, ground)
if args.dry_run or all((a == b).all() for a, b in layers.values()): sys.exit()

# put the new numbers into each layer's own "data":[...] array, keeping the file's whitespace and line breaks
for name, (old, new) in layers.items():
    if (old == new).all(): continue
    m = re.search(r'"name"\s*:\s*"' + re.escape(name) + '"', text)
    i = text.rfind('"data"', 0, m.start()); a = text.index('[', i); b = text.index(']', a)
    if [int(v) for v in re.findall(r'\d+', text[a:b])] != old.reshape(-1).tolist():
        sys.exit(f'could not find the {name} layer data in the file; nothing written')
    it = iter(new.reshape(-1).tolist())
    text = text[:a] + re.sub(r'\d+', lambda _: str(next(it)), text[a:b]) + text[b:]
open(src, 'wb').write(text.encode('utf-8'))
print('  written')
