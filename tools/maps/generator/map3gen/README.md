# map3gen: large-map generator in the style of map2

Generates a 512x512 Tiled map (`tools/maps/data/map3.json`) that uses map2's tilesheet,
layer names and draw order. The map is a 256x512 overworld plus a 256x512 interior strip on the right.
Sizes are options: `python gen.py --width 768 --height 1024 --interior-width 512` gives the earlier 1280x1024 map.
The overworld layout (biome bands, ledges, river, shoreline) scales with the height, and item amounts with each biome's area.

- **Left `--width` columns (256): overworld.** North to south: volcano, desert, swamp/graveyard,
  forest, river with bridges, villages, beach, sea.
- **Right `--interior-width` columns (256): interiors.** Every enterable house and every cave mouth gets its own
  private interior, linked by `doors_old` teleports, and every room has its own `camera` rect.
  - Houses are copies of map2's house rooms.
  - Every cave is built by `cavekit.py`: 5-7 rooms where chambers of many shapes alternate with long
    hallways. Each cave has at least 2 chambers and 2 hallways, one horizontal and one vertical.
    Rooms are joined by ladders (top walls) and cave arches (bottom walls).
  - Rooms are packed into the strip one by one (a cave's rooms needn't sit together, since they
    connect by teleports); each room keeps its own camera rect.
  - Copies of map2's own caves can be mixed back in with `GENERATED_SHARE` in `interiors.py` (now 1.0).

## Setup

Requires Python 3 with `pip install -r requirements.txt` (numpy, scipy, pillow).

```
cd tools/maps/generator/map3gen
python prepare.py            # once: builds ./cache from ../../data/map2.json + tilesheet
python gen.py --seed 7       # writes ../../data/map3.json (seed 7 = the delivered map)
python gen.py --seed 42 --out ../../data/map4.json --preview map4.png
python render.py ../../data/map4.json map4.png 2      # preview any map, 2 px per tile
```

Then convert as usual: `cd ../../converter && node run.js ../data/map3.json server` (and `client`).

## How it works

| File | Role |
|---|---|
| `prepare.py` | Caches map2 layers, tile opacity, colliding tiles (from `tilesheet.tsx`) and object stamps. |
| `stamps.py` | Extracts multi-layer objects from map2 (houses, trees, cacti, bones, graves, palms, cliff rings, ...). `GROUPS` maps each group to its source layers and map2 rows. |
| `octo.py` | Autotiler for the tilesheet's 6x6 octagon terrain blocks (grass 92, dead grass 483, mud 489, dsand 808, dryground2 1652, canyon 1295, lake 611). Masks are shaped to 0/45/90 degree outlines so edges and diagonals always have a matching tile. |
| `density.py` | Item amounts per 100x100 tiles of each biome. This is the file to edit for more or fewer trees etc. |
| `gen.py` | Builds the world: biome bands, boundary ledges with gaps, river + trails + bridges, terrain, stamps, blocking layer and the object layers (checkpoints, mobareas, entities, entityareas, camera). |
| `interiors.py` | Loads map2's interior rooms (camera rects at x >= 114) and groups rooms linked by doors into systems. It then packs one copy per house/cave into the right half and writes the door objects (both directions) and camera rects. |
| `cavekit.py` | Builds cave rooms from map2's cave-wall pieces: a rectangle of floor with each corner optionally cut at 45 degrees. The top wall is 3 rows with a 4-tile face, the sides are 2 columns, and the bottom is 2 rows. Diagonals are one tile strip per row (NW `1328..1388`, NE `1383..1323`, SW `1268 1269 1270`, SE `1261 1262 1263`). `make_system` joins rooms and long hallways with ladder/arch doors and adds torches, minerals and pools. |
| `stonepath.py` | Tiles cobblestone paths from map2's stone-pad tiles: solid fill, ragged edge fringe, and corner pieces on diagonals. |
| `render.py` | PNG previews. |

**Item amounts live in `density.py`**: every scattered item group is given as *items per 100x100 tiles
of its biome* (trees, cacti, rocks, camps, palms, tombstone clumps, cliff ledges, cave entrances, ...).
Raise a number for more, lower it for fewer, 0 to remove. The values scale with each biome's size.
After each run `gen.py` prints a table of every item with its density, the amount asked and the amount placed.
Placed can come out a bit lower when an area is crowded. Houses are set per village there too.

**Spacing** is also in `density.py`: `SPACING` gives the minimum number of empty tiles between neighbouring
objects, by item name (e.g. `'trees': 2`). The gap also holds diagonally. `'tombstones'` is the gap between
the stones inside each graveyard clump (2 by default), and clump areas grow with it so the clumps still fit.

Other knobs live near the top of each section of `gen.py`. They include:
- the `boundary_ledge(...)` y positions
- `yD`/`yS`/`yR` for the band edges
- `mob_specs` for mob levels

Cliff ledges use the same FL/FM/FR pieces as `generator/run.js`.

## Doors and interiors
- **Teleports sit only on open doorways.**
  - Red-roof houses get map2's open-door tiles (1661-1683), with the trigger on the doorway tile 1682.
  - Blue-roof houses only have a closed door in the tilesheet, so they are not enterable.
  - Cave mouths are the 3x3 doorway piece (1351-1393) set into flat cliff sections, with the trigger on 1392.
  - Inside rooms, triggers are map2's own exits and ladders. The one map2 cave whose rooms use invisible platform-hop teleports is left out.
- **Labels.** Every teleport is named after where it leads, e.g. `to C07 room 2 (612,140)` or `to desert mouth C07 (88,412)`.
  The name is also stored in a `to` property, and the object `type` is `door`.
  Houses are numbered `H01`.., caves `C01`.. (top to bottom), and camera rects carry the same names.
  In Tiled, turn on View > Show Object Names to see them on the map.
- **Solid walls.** Generated cave walls get blocking on every tile except the doorway tiles. The far side of every doorway is sealed,
  and every empty cell of the interior strip is blocked, so nobody can walk out of a room.
- **Wide doors.** Side-by-side triggers that go to the same place are merged into one wider object
  (e.g. 32 px wide) instead of separate tiles.
- **Door object format** follows map2: `x`/`y` destination tile, `o` facing, and `cx`/`cy` on doors
  that lead inside, in symmetric pairs.
- **Settings and templates.**
  - The `cave entrances` values in `density.py` set how many caves each area gets. More caves need more room in the interior strip.
  - `GENERATED_SHARE` in `interiors.py` sets the share of generated vs copied caves.
  - If the caves don't fit the interior strip, the largest caves are rebuilt with compact rooms (same rooms, shorter
    hallways, smaller chambers) until they do. If even that fails, `gen.py` asks you to lower the cave entrance densities.
  - Room sizes are in `cavekit.SIZES` / `COMPACT`; rooms per cave in `cavekit.ROOM_COUNTS`; the minimums in `MIN_CHAMBERS` / `MIN_HALLS`.
  Interior templates are any map2 interior room with a `camera` rect, picked up on the next `gen.py` run.

## Notes
- The forest's default tree density is close to map2's (`density.py`: forest trees 96 per 100x100).
- **Forest mud paths:** north-south trails to the river (each kept in its own column band, bridged at the river),
  east-west connectors spread down the forest, and short winding side branches. Each path's width wanders between 3 and 6 tiles,
  averaging about 4 (`FOREST_PATH_WIDTH`, `FOREST_PATH_WIDTH_RANGE`). How many of each per 100 columns:
  `FOREST_TRAILS_PER_100`, `FOREST_CONNECTORS_PER_100`, `FOREST_BRANCHES_PER_100` in `gen.py`.
- **Houses** all stand on a cobblestone pad (`stone` layer); houses that had none in map2 get the pad of a same-colour house.
  The ground in front of every door is kept clear.
- **Village paths:** paths run from every house door to its village centre, and roads join the villages to each other
  and to the dirt forest trails at the river bridges. Cobblestone paths are about 4 tiles wide (`STONE_PATH_WIDTH`).
  - By default they are bare ground, 4 tiles across (`GROUND_PATH_WIDTH`), bordered by the grass's own edge tiles
    (`VILLAGE_PATH_STYLE = 'ground'`). The rest of each village is grass (`VILLAGES_ALL_GRASS`), so the paths
    are the only bare ground there. Each path runs right up to its house's stone pad, and the pads sit on bare ground.
  - For a natural look, random bare patches bulge out of the paths (about one per `PATH_PATCH_SPACING` tiles of path).
    Loose bare patches are also scattered in the village grass (`density.py`: village `bare ground patches`).
  - Set `VILLAGE_PATH_STYLE = 'stone'` for cobblestone paths instead, on a `stone paths` layer drawn before `stone` (`stonepath.py`).
