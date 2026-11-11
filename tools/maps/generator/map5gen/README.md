# map5gen: map5, a grid of sub-areas

Generates `tools/maps/data/map5.json`: a 1024x1024 Tiled map. The left 512x1024 is the main area; the right
512x1024 holds the cave and house interiors. Based on `../map4gen/gen4.py`: same tilesheet, layers, draw order,
stamps, cliffs, caves, houses and interiors. Only the world layout is new.

- **Sub-areas.** The main area is a 5x11 grid of cells of about 96x96 tiles (`CELL`; they stretch evenly to fill it, ~102x93), each one area: volcano,
  desert, forest, village, coast beach or lagoon beach. The generator prints the grid at the start of each run
  (`V` volcano, `D` desert, `f` forest, `T` village, `B` beach, `L` lagoon).
- **Blending.** Cell borders are warped by smooth noise (`CELL_WARP`), and every area fades into its neighbour
  through its own edge tiles, as in map4. To keep every border blending: volcanoes are always ringed by desert
  (diagonals too), deserts never touch a beach, and beaches only touch forest and villages.
- **Volcanoes** (`VOLCANOES` clusters of `VOLCANO_CELLS` cells) sit in the northern half (`VOLCANO_ROWS`, `VOLCANO_GAP` cells apart), with desert grown out
  around them (`DESERT_CELLS`).
- **Villages:** 3 towns, one per village cell (`VILLAGE_CELLS`). Each has about 14 houses (the start town is the
  village nearest the middle of the south), 8 of them enterable, joined to the others by dirt trails.
- **Beaches:** `COAST_BEACH_CELLS` cells along the south coast run down to the sea; the other coastal cells
  have a thin sand strip. `LAGOON_CELLS` inland cells are sand round a big lake.
- **Rivers** (`RIVERS`) flow south through the forests to the coast, with plank bridges.
- **Mob areas:** one per section, the size of the section, 50 mobs each (`MOB_COUNT`), with that area's mobs (`MOBS` in `density5.py`):
  beach crabs; village rats and snakes; forest goblins, bats and snakes; desert skeletons, ogres and armored
  skeletons; volcano eyes, death knights and spectres. The start town's section is level 1-2 and every section
  further away (walking distance in sections) is two levels higher (`MOB_LEVEL_STEP`: 1-2, 3-4, 5-6, ...); volcanoes
  always start one step above the farthest other section. The log prints each section's minimum level.
- **Dungeon mob areas:** every cave room and hallway gets 2-3 mobs (`DUNGEON_MOBS`) of the mobs of the section
  the cave's entrance is in, 2 levels higher than that section's mob area (`DUNGEON_LEVEL_BONUS`), with a drop
  bonus of 2 (`bonusDrop`, `DUNGEON_DROP_BONUS`). `split.py` puts them in the interiors map (`map5_int`).
- **Quest NPCs:** one walking NPC per mob area, near the middle of its section, with two quests: kill ten of
  one of the section's mobs, and get 3-5 of a random itemloot item from another of them, both at the section's
  mob levels. Their dialogue is about those mobs and that section (its area, where it lies, what it borders, the
  nearest town). `gen5.py` saves the NPC spots in `tools/maps/data/map5_npcs.json`; `npcs5.py` turns them into
  NPCs and quests once the map is split (see below).
- Checkpoints (one per 128x128
  block plus the start town's), the beginner-quest NPC and the resource-node entity areas are made as in map4.
- **Interiors** for every enterable house and cave mouth are packed into the right 512x1024, as in map4.

## Use

Same setup as map4gen (`../common`, see `../common/README.md`):

```
cd tools/maps/generator/map5gen
python gen5.py                         # writes ../../data/map5.json (seed 5 = the delivered map)
python gen5.py --seed 9 --preview map5.png
```

Then split and convert it like map4 (map5 is split into 256x256 sections, 2 wide and 4 tall):

```
cd ..
python split.py map5 --section 256 --convert
```

(The converter needs the `log` package from `gameserver/node_modules`; if it can't find it, set
`NODE_PATH=../../../gameserver/node_modules` before running.)

Then add the quest NPCs. Do this after every split, since a quest belongs to its NPC's map part:

```
cd map5gen
python npcs5.py
```

It writes the NPCs to `gameserver/data/maps/map5/<part>/entity.json` (ids from 101), their quests to
`shared/data/quests.json` and their dialogue to `shared/data/lang.json` (`QUESTS` and `QUEST_SUMMARY`),
leaving the rest of those files as they are. Running it again first removes what it wrote last time (listed in
`tools/maps/data/map5_npcs_written.json`). Then run `godot-client/sync-assets-win.bat` (or `-linux.sh`).

Settings are in `density5.py` (layout at the top, item amounts per 100x100 tiles below, as in `density4.py`).
