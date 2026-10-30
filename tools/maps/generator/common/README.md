# common: modules shared by the map generators

`map4gen` (and `map3gen`, if you keep it) load these modules from here: the tilesheet cache, the object stamps lifted
from map2, the terrain autotiler, the house, cave and mesa kits, the interior packer and the PNG renderer.

## Setup

Requires Python 3 with numpy, scipy and pillow.

```
cd tools/maps/generator/common
pip install -r requirements.txt
python prepare.py            # once: builds common/cache from ../../data/map2.json + tilesheet
python render.py ../../data/map4.json map4.png 2      # preview any map, 2 px per tile
```

Run `prepare.py` again if `map2.json` or the tilesheet changes. The generators read everything from `common/cache`.

## Files

| File | Role |
|---|---|
| `prepare.py` | Caches map2 layers, tile opacity, colliding tiles (from `tilesheet.tsx`) and object stamps. |
| `stamps.py` | Extracts multi-layer objects from map2 (houses, trees, cacti, bones, graves, palms, cliff rings, ...). `GROUPS` maps each group to its source layers and map2 rows. |
| `octo.py` | Autotiler for the tilesheet's 6x6 octagon terrain blocks (grass 92, dead grass 483, mud 489, dsand 808, dryground2 1652, canyon 1295, lake 611). Masks are shaped to 0/45/90 degree outlines so edges and diagonals always have a matching tile. |
| `interiors.py` | Loads map2's interior rooms (camera rects at x >= 114) and groups rooms linked by doors into systems. It then packs one copy per house/cave into the right half and writes the door objects (both directions) and camera rects. |
| `housekit.py` | Builds house rooms in many sizes from map2's house-room walls, doormat and carpets (furniture optional). |
| `cavekit.py` | Builds cave rooms from map2's cave-wall pieces: a rectangle of floor with each corner optionally cut at 45 degrees. The top wall is 3 rows with a 4-tile face, the sides are 2 columns, and the bottom is 2 rows. Diagonals are one tile strip per row (NW `1328..1388`, NE `1383..1323`, SW `1268 1269 1270`, SE `1261 1262 1263`). `make_system` joins rooms and long hallways with ladder/arch doors and adds torches, minerals and pools. Arches sit in the bottom wall as in map2: the top row on the room's last floor row, the lower two rows in place of the two wall rows. |
| `stonepath.py` | Tiles cobblestone paths from map2's stone-pad tiles: solid fill, ragged edge fringe, and corner pieces on diagonals. |
| `mesa.py` | Builds large mesas from map2's brown cliff ring set, with random dips in the front face. |
| `render.py` | PNG previews. |
| `noise.py` | Smooth noise (`fbm`) for area borders, trails and patches. |
| `paths.py` | Where things live: inputs in `tools/maps/data`, the cache in `common/cache`. |
