# map4gen: map4, a four-area map

Generates `tools/maps/data/map4.json`: a 512x512 Tiled map. The left 256x512 is the main area; the right 256x512
holds the cave and house interiors. It uses map2's tilesheet, layer names and draw order, like map3.

- **Four areas, north to south:** volcano, desert, forest and town (`BANDS`, each taking its share of the height,
  `BAND_SHARES`). The borders between them wander by up to about `BAND_WARP` tiles.
- **Blending.** Every area sits on the same dirt ground. The volcano's red rock fades through its own edge tiles into
  the desert. Across `BLEND` tiles on either side of the forest's border, the grass breaks up into patches that
  thin out towards the desert. The forest grass runs straight on into the town's.
- **Town:** two villages side by side, 18 and 14 houses, 8 of each enterable, joined by a dirt trail. Trails also
  lead into the desert and volcano. A river runs through the forest, with plank bridges.
- **Interiors.** Every enterable house and every cave mouth gets its own private interior in the right strip,
  linked by `doors_old` teleports, with a `camera` rect per room:
  - Most houses get a room built by `../common/housekit.py`, in many sizes with carpets; the rest copy one of
    map2's house rooms.
  - Caves are built by `../common/cavekit.py`: 5-7 rooms each, mixing chambers with long horizontal and vertical
    hallways, joined by ladders and cave arches.
- **Big maps:** `LAYOUT = 'noise'` (with `SEA = True`, `TOWNS = 6`, `LAGOONS = 3`) gives the earlier kind of world,
  with several areas of each kind, a south coast with beaches and lagoons:
  `python gen4.py --width 768 --height 1024`.

## Setup

map4gen uses the shared modules and tilesheet cache in `../common` (see `../common/README.md`), so `common` and
`map4gen` must sit side by side in `tools/maps/generator`. It does not need `map3gen`.

```
cd tools/maps/generator/common
pip install -r requirements.txt
python prepare.py              # once: builds common/cache from ../../data/map2.json + tilesheet
cd ../map4gen
python gen4.py                 # writes ../../data/map4.json (seed 4 = the delivered map)
python gen4.py --seed 9 --out ../../data/map5.json --preview map5.png
```

Then split it into map files and convert them (see `../split.py`):

```
cd ..
python split.py map4 --section 256 --section-height 128 --convert
```

That makes five maps in a `map4` folder: `map4_0_0` (volcano), `map4_1_0` (desert), `map4_2_0` (forest), `map4_3_0`
(town, the warp point for "/warp map4") and `map4_int` (interiors). They end up in `client/maps/map4/map4_0_0.json`,
`gameserver/maps/map4/map4_0_0.json` and so on (the Tiled files in `tools/maps/data/map4/`). Edge doors between them keep your position as you cross. Then run
`godot-client/sync-assets-win.bat` (or `-linux.sh`) for the Godot client.

## Map sections (`../split.py`)

`split.py` splits any generated map (or any Tiled map in the same format) into several map files that teleport into
each other at their edges, so only one section is loaded at a time:

- **Sections.** The overworld (the `overworld` camera rect) becomes a grid of sections, `--section` tiles wide and
  `--section-height` tall (default 256x256), named `<map>_<row>_<col>`, in a folder named after the map
  (`client/maps/map4/map4_0_0.json`, `gameserver/maps/map4/map4_0_0.json`; the map list names them `map4/map4_0_0`). No
  terrain is copied between sections, and every section has a camera rect around the whole file (named after it), so
  the edge of the section is the edge of the screen.
- **Edge doors.** Along every edge shared with a neighbour, the section's own outermost row or column is an *edge door*
  (a `doors_old` object of type `edge` with the property `rel` = 1). Stepping on it teleports you to the neighbour's
  facing edge row or column, keeping your position along the edge (cross at column 49, arrive at column 49) and the
  way you were facing. That row is the neighbour's own edge door, but the clients don't fire a door you were
  teleported onto until you turn or step off it, so you walk on into the new section, and turning back takes you
  back. Edge cells that are solid on either side (a tree, a cliff) are blocked on both sides, so you never land in
  anything. `--margin N` instead gives each section N tiles of its neighbours' terrain to look at past each edge,
  with the edge door on the first row or column of that margin (default 0).
- **Interiors.** If the map has an interior strip, all house and cave interiors go into one more map, `<map>_int`.
  House doors and cave mouths lead there (`tmap`), and every interior exit leads back to the section the house or
  cave stands in. Doors that already lead to another map are left as they are.
- **Where doors land.** House, cave and room doors land you right on the entrance they lead to, as in map2: going in,
  on the exit inside; coming out, on the house door or cave mouth; in a cave, on the other arch or ladder top. You
  arrive facing away from it, and the clients don't fire a door you were teleported onto until you turn towards it.
  Set `LAND_ON_DOOR = False` in `common/interiors.py` to land on the tile next to the entrance instead.
- **Start areas.** Every section gets a start checkpoint, used by warps without a door. The section with the map's
  start checkpoint becomes the map's warp point (`/warp map4`, admins only).
- **Map list.** `client/maps/maplist.json` and `gameserver/maps/maplist.json` list every map by index (map0-2 first,
  then each split map's sections) and the warp points. The game server and both clients read this list. Splitting a
  map again (say with another section size) replaces its old sections and removes their files.
- `--convert` runs the converter (server and client) on every new map; without it, convert each part yourself with
  `node run.js ../data/map4/map4_0_0.json server` (and `client`). The converter puts a map that sits in a subfolder of
  `tools/maps/data` into the same subfolder on both sides.

### How the game handles edge doors
- **Converter:** `_processmap.js` keeps the `rel` property on doors, and a destination tile of 0 is no longer
  dropped. `run.js` writes a map from a subfolder of `tools/maps/data` into that subfolder in `client/maps` and
  `gameserver/maps`.
- **Game server:** `map/map.js` carries `rel` on doors. In `packets/movementhandler.js` an edge door's destination is
  its `tx`/`ty` plus the player's tile offset along the door. `map/mapmanager.js` loads every map in
  `maps/maplist.json` after maps 0-2. `format.js` (and the userserver's) allow map indexes up to 255.
- **Warps:** `/warp [map] [gx gy]` in either client, for admins only (the server checks; anyone else gets "You do not
  have permission to use that command."). `/warp map4` goes to map4's warp point, `/warp map4_2_0` to that section,
  and `/warp` alone to map 0. With coordinates you land on that tile: `/warp map4 300 300` takes full-map tiles (the
  client picks the part holding the tile from the `areas` in `maplist.json`, which the converter fills in from
  each converted part's `worldX`/`worldY` and size), `/warp map4_0_0 100 100` takes that
  part's own tiles. The server refuses a tile that is off the map or solid, and says why in the chat. The TOWN
  button still takes every player to town.
- **Refused teleports:** the server now answers a refused teleport with status -1, and the clients return to the
  map they are still on instead of hanging.
- **Clients** (`client/js`, `godot-client`): take the map list from `maps/maplist.json` only (no built-in map names),
  load a part listed with its folder from that folder
  (`maps/map4/map4_0_0.json`), and treat a map that is still loading as blocked, so mobs moving next to you while you
  cross an edge can't crash the client.

## Settings (`density4.py`)

| Setting | What it does |
|---|---|
| `LAYOUT` | `'bands'` (map4: one area per band) or `'noise'` (several areas of each kind, for big maps). |
| `BANDS`, `BAND_SHARES`, `BAND_WARP` | The bands north to south, their shares of the height, how far their borders wander. |
| `SEA` | Sea and beaches along the south coast (off for map4). |
| `REGION_SCALE` | `'noise'` layout: size of the noise features; bigger means fewer, larger areas. |
| `SHARES` | `'noise'` layout: share of the inland area for volcanoes, deserts and swamps; the rest is forest. |
| `SECTIONS` | `'noise'` layout: minimum number of separate areas of each kind; the generator tries layouts until it gets them. |
| `NORTH_HEAT` | `'noise'` layout: how much volcanoes and deserts lean towards the north (0 = anywhere). |
| `BLEND` | How far (on each side) grass breaks up into patches at the border with another area. |
| `COAST_KEEP`, `COAST_SAND`, `BEACH_SECTIONS`, `BEACH_SECTION_WIDTH`, `BEACH_SECTION_DEPTH` | The south coast and its beaches. |
| `LAGOONS`, `LAGOON_SIZE`, `LAGOON_SAND` | Inland lake beaches. |
| `TOWNS`, `TOWN_SPACING`, `TOWN_RADIUS` | Number, spacing and size of the towns. |
| `HOUSES_PER_TOWN`, `HOUSES_IN_START_TOWN`, `ENTERABLE_HOUSES_PER_TOWN`, `RED_HOUSE_SHARE` | Houses. |
| `RIVERS`, `RIVER_BRIDGE_SPACING` | Rivers and how far apart their bridges are. |
| `EXTRA_ROADS`, `AREA_TRAILS`, `TRAIL_WIDTH`, `TRAIL_WANDER` | Trails: extra links, dead-end trails into big areas, width, how much they wind. |
| `DENSITY` | Items per 100x100 tiles of each kind of area (trees, cacti, cliffs, cave entrances, ...). |
| `SPACING` | Minimum gap between objects, e.g. tombstones. |

After each run `gen4.py` prints the area sizes and a table of every item with its density, the amount asked and the
amount placed.

## Notes
- With `SEA = True`: the tilesheet only has sea tiles for a coast facing south, so the sea is always along the south edge.
  Beach sand has no edge tiles of its own; grass runs a few tiles onto the sand so its edge tiles blend onto it, and
  the land next to every beach is kept grassy (`COAST_KEEP`).
- River bridges are map2's sideways plank bridge (1420 rail, 1440/1460 deck, 1480 rail); the trails route over them.
- Large cliffs (mesas with one ladder), bowl-shaped cliff ledges, crater rings, cliff-walled lava lakes, graveyards and
  all objects work as in the earlier map3 generator. Cave mouths sit in the flat parts of the cliff ledges.
- **Enclosed cliffs have their own ground.** Every mesa top and crater ring is filled with its area's plateau ground
  (`CLIFF_GROUND` in `gen4.py`: volcano red rock, desert sand, forest and town grass) on a `cliff ground` layer drawn
  right under the cliff walls and over every other ground layer. It also runs under the inner rim of the walls (the
  wall tiles whose see-through parts face the plateau), so the land around a cliff never shows on its top. Lava lake
  basins keep their own canyon floor.
- The start town (checkpoint `s`, beginner quest NPC) is the first town (with bands: the left village). Mob areas
  are laid out on a 128x128 grid with levels by area: towns 1-3, beaches 4-6, forests 6-9, swamps 9-12,
  deserts 12-16, volcanoes 16-20.
- Everything outside the walled lava lakes is reachable on foot from the start town.
