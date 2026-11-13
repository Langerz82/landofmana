# map1gen: map1, a grid of sub-areas

Generates `tools/maps/data/map1.json`: a 1024x1024 Tiled map. The left 512x1024 is the main area; the right
512x1024 holds the cave and house interiors. Based on `../map2gen/gen2.py`: same tilesheet, layers, draw order,
stamps, cliffs, caves, houses and interiors. Only the world layout is new.

- **Sub-areas.** The main area is a 5x11 grid of cells of about 96x96 tiles (`CELL`; they stretch evenly to fill it, ~102x93), each one area: volcano,
  desert, forest, village, coast beach or lagoon beach. The generator prints the grid at the start of each run
  (`V` volcano, `D` desert, `f` forest, `T` village, `B` beach, `L` lagoon).
- **Blending.** Cell borders are warped by smooth noise (`CELL_WARP`), and every area fades into its neighbour
  through its own edge tiles, as in map2. To keep every border blending: volcanoes are always ringed by desert
  (diagonals too), deserts never touch a beach, and beaches only touch forest and villages.
- **Volcanoes** (`VOLCANOES` clusters of `VOLCANO_CELLS` cells) sit in the northern half (`VOLCANO_ROWS`, `VOLCANO_GAP` cells apart), with desert grown out
  around them (`DESERT_CELLS`).
- **Villages:** 3 towns, one per village cell (`VILLAGE_CELLS`). Each has about 14 houses (the start town is the
  village nearest the middle of the south), 8 of them enterable, joined to the others by dirt trails.
- **Beaches:** `COAST_BEACH_CELLS` cells along the south coast run down to the sea; the other coastal cells
  have a thin sand strip. `LAGOON_CELLS` inland cells are sand round a big lake.
- **Rivers** (`RIVERS`) flow south through the forests to the coast, with plank bridges.
- **Mob areas:** one per section, the size of the section, 100 mobs each (`MOB_COUNT`), with that area's mobs (`MOBS` in `density1.py`):
  beach crabs; village rats and snakes; forest goblins, bats and snakes; desert skeletons, ogres and armored
  skeletons; volcano eyes, death knights and spectres. The start town's section is level 1-2 and every section
  further away (walking distance in sections) is two levels higher (`MOB_LEVEL_STEP`: 1-2, 3-4, 5-6, ...); volcanoes
  always start one step above the farthest other section. The log prints each section's minimum level.
- **Dungeon mob areas:** every cave room and hallway gets one mob per 30 walkable floor tiles in it, at least one (`DUNGEON_TILES_PER_MOB`), of the mobs of the section
  the cave's entrance is in, 2 levels higher than that section's mob area (`DUNGEON_LEVEL_BONUS`), with a drop
  bonus of 2 (`bonusDrop`, `DUNGEON_DROP_BONUS`). `split.py` puts them in the interiors map (`map1_int`).
- **Quest NPCs:** one walking NPC per mob area, near the middle of its section, with two quests: kill ten of
  one of the section's mobs, and get 3-5 of a random itemloot item from another of them, both at the section's
  mob levels. Their dialogue is about those mobs and that section (its area, where it lies, what it borders, the
  nearest town). `gen1.py` saves the NPC spots in `tools/maps/data/map1_npcs.json`; `npcs1.py` turns them into
  NPCs and quests once the map is split (see below).
- Checkpoints (one per 128x128
  block plus the start town's), the beginner-quest NPC and the resource-node entity areas are made as in map2.
- **Interiors** for every enterable house and cave mouth are packed into the right 512x1024, as in map2.

## Use

Same setup as map2gen (`../common`, see `../common/README.md`):

```
cd tools/maps/generator/map1gen
python gen1.py                         # writes ../../data/map1.json (seed 5 = the delivered map)
python gen1.py --seed 9 --preview map1.png
```

Then split and convert it. map1 is split into sections 512 wide and about 256 tall (one column, four rows),
with every village kept whole in one section (`--keep`: a cut line through a village moves to its nearer edge --
the start-area village at row 512 moves the cut to 474):

```
cd ..
python split.py map1 --section 512 --section-height 256 --keep 1,474,96,551 --keep 302,82,415,175 --keep 200,847,300,926 --convert
```

(The `--keep` rectangles are the villages' houses plus 10 tiles, in full-map tiles; measure them again if
`gen1.py` is run with another seed. `--convert` also converts map0 and map3 again, whose doors into map1 name
the map (`tmap` "map1") rather than a part. The converter needs the `log` package from `gameserver/node_modules`;
if it can't find it, set `NODE_PATH=../../../gameserver/node_modules` before running.)

**Re-splitting changes no game data.** map1's NPCs, bosses, mob areas and entity areas are one pair of files for
the whole map, `gameserver/data/maps/map1/entity.json` and `entityarea.json`, in full-map pixel coordinates; the
game server gives each part what lies inside it when it loads (`gameserver/js/map/mapgroup.js`; a mob or entity
area crossing a section edge is shared out to both sides, ellipses included, with its count split by the share
on each side). Quest ids use map1's base index (100) and those files' entity ids, and saved player positions are
full-map positions, so none of them change with the split either.

After a NEW map (`gen1.py`), write its areas from the Tiled map, then add the quest NPCs and set the levels:

```
cd ../converter
node run.js ../data/map1.json areas     # gameserver/data/maps/map1/entityarea.json (admin areas kept)
cd ../generator/map1gen
python npcs1.py         # quest NPCs: entity.json, shared/data/quests.json, lang.json
python npcs1_extra.py   # a second quest NPC in every outdoor mob area
python levels1.py       # mob levels, quest levels, dead-end cave bosses
python wizards1.py      # a Wizard boss (count 1, boss x3) on every main-area mob area, at its levels
```

Entity ids in `entity.json`, and area ids in `entityarea.json`, run 1, 2, 3, ...: each tool takes the first free
ids, and remembers which records are its own (`tools/maps/data/map1_*_written.json`), so it replaces just those
when run again. Every record and area has a `caption` saying what it is (`quest_npc_mainarea`,
`quest_npc_mobarea`, `dungeon_boss`, `mob_mainarea_forest`, `dungeon_mob`, `wizard_boss_mainarea`, ...), unused by
the game. `python ../common/mapdata.py` sorts both files by id and captions anything without one; `--renumber map1`
closes up gaps in the ids (after records were removed), renumbering their quest ids in `quests.json` and
`lang.json` too.

`wizards1.py` adds a second mob area on exactly the spot of every main-area mob area (`mob_mainarea_<biome>`),
captioned `wizard_boss_mainarea`: one Wizard (kind 10) with boss multiplier 3, at that area's levels. Running it
again updates them; `levels1.py` keeps their levels the same as their area's and leaves them out of its level
grid, and `npcs1_extra.py` gives them no quest NPC of their own. A mob area crossing a section edge shares its
count out between the sections (rounded down by share, the leftover to the bigger piece), so its single Wizard
spawns on the side with more of the area.

`npcs1.py` writes the NPCs to `gameserver/data/maps/map1/entity.json`, their quests to
`shared/data/quests.json` and their dialogue to `shared/data/lang.json` (`QUESTS` and `QUEST_SUMMARY`),
leaving the rest of those files as they are. Running it again first removes what it wrote last time (listed in
`tools/maps/data/map1_npcs_written.json`). Then run `godot-client/sync-assets-win.bat` (or `-linux.sh`).

`levels1.py`: start town level 1; then 2-3, 4-5, 6-7, 8-9 by area away from the town, 10-12, 13-15, ... from
level 10; volcanoes up to 40. Caves: the first room is the entrance area's lowest level + 2 (a 2-level range), +1
per room further in; every cave mob is aggressive (`"aggro": 1`), and every dead-end room gets a boss: one of its
area's mob kinds at a random spot, 2 levels above the area, boss multiplier 10, aggressive, respawning after 5
minutes x its level.

(`../merge_mapdata.py` was the one-time move from the older per-part files,
`gameserver/data/maps/map1/<part>/entity.json`, to these.)

Settings are in `density1.py` (layout at the top, item amounts per 100x100 tiles below, as in `density2.py`).
