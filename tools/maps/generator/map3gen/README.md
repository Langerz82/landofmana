# map3gen: large-map generator in the style of map2

Generates a 1024x1024 Tiled map (`tools/maps/data/map3.json`) that uses map2's tilesheet,
layer names and draw order. North to south: volcano, desert, swamp/graveyard, forest,
river with bridges, villages, beach, sea.

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
| `gen.py` | Builds the world: biome bands, boundary ledges with gaps, river + trails + bridges, terrain, stamps, blocking layer and the object layers (checkpoints, mobareas, entities, entityareas, camera). |
| `render.py` | PNG previews. |

The main knobs live near the top of each section of `gen.py`. They include:
- the `boundary_ledge(...)` y positions
- `yD`/`yS`/`yR` for the band edges
- the `sc(...)` counts for each object type
- `mob_specs` for mob levels

Cliff ledges use the same FL/FM/FR pieces as `generator/run.js`.

## Notes
- Long ledges between the volcano and desert, and between the villages and beach, block movement except at their gaps. The river can only be crossed at bridges. `gen.py` prints a reachability check after each run.
- The converter only keeps checkpoints that have properties (same as map2), so only the first start checkpoint survives conversion.
- Mob `include` values reuse map2's "1"/"2"; adjust `mob_specs` to your real mob sets.
- No doors or interiors are generated.
- `stamps.py` assumes map2's layout (93-tile-wide overworld strip, biome rows in `BANDS`). Update `BANDS` if map2 is reorganised.
