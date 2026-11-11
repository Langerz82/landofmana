"""map5 settings: the grid of sub-areas, towns, rivers, and item amounts per 100x100 tiles of each area.

Raise a number for more of that item, lower it for fewer, 0 to remove it. The generator multiplies
each value by the size of that kind of area, so the values keep working at any map size. After
`python gen5.py` the log prints the cell grid, every item's density and how many were actually placed.
"""

# ---- world layout: a grid of sub-areas -----------------------------------------------------------
# The 512x1024 overworld is cut into cells of about CELL x CELL (5 x 10), each one sub-area. Rules that keep every
# border blending: volcanoes are always ringed by desert (diagonals too), deserts never touch a beach,
# and beaches only touch forest and villages. Cells that are none of the below are forest.
CELL = 96                 # sub-area size (tiles); cells stretch evenly to fill the overworld (512x1024 -> 5x10 cells of ~102)
CELL_WARP = 16            # how far (tiles, roughly) the borders between cells wander
VOLCANOES = 2             # volcano clusters, in the northern rows
VOLCANO_CELLS = (2, 3)    # cells per volcano cluster (min, max)
VOLCANO_GAP = 2           # at least this many cells between two volcanoes
VOLCANO_ROWS = 6          # volcanoes start in the top VOLCANO_ROWS rows of cells
DESERT_CELLS = 15         # total desert cells (the rings round the volcanoes count)
VILLAGE_CELLS = 3         # (at most 3) one town per village cell; the first, near the middle of the south, is the start town
COAST_BEACH_CELLS = 3     # beach cells along the bottom row (the south coast)
LAGOON_CELLS = 2          # inland beach cells: a big lake ringed with sand
BLEND = 16                # how far (tiles) grass thins out towards a neighbouring area
MIN_AREA = 2500           # (kept for gen4 compatibility)

# ---- coast and beaches ------------------------------------------------------------------------
SEA_ROWS = 18             # rows of sea along the south edge
COAST_SAND = 5            # sand rows along the coast where the bottom cell is not a beach
COAST_KEEP = 45
LAGOON_SIZE = ((12, 18), (16, 24))   # lagoon lake half-height, half-width ranges
LAGOON_SAND_MIN = 13      # sand at least this wide round each lagoon lake

# ---- towns ------------------------------------------------------------------------------------
TOWN_RADIUS = (40, 52)    # half-height, half-width of a town
HOUSES_PER_TOWN = 14
HOUSES_IN_START_TOWN = 18
ENTERABLE_HOUSES_PER_TOWN = 8      # houses with an open door per town; the rest are closed
RED_HOUSE_SHARE = 0.6              # share of red-roof houses (only red houses can have an open door)

# ---- rivers and trails ------------------------------------------------------------------------
RIVERS = 2                # rivers flowing south through the forests to the coast
RIVER_MIN_LEN = 140       # shortest river (rows)
RIVER_TOWN_GAP = 60       # rivers keep this far from a town's middle
RIVER_BRIDGE_SPACING = 75 # rows between plank bridges along each river
EXTRA_ROADS = 1           # extra town-to-town trails on top of the ones that join every town
AREA_TRAILS = True        # dead-end trails into every large desert and volcano area
TRAIL_WIDTH = 4           # average trail width (varies 3..6)
TRAIL_WANDER = 3.0        # how much trails wind (0 = straight lines)

# ---- item amounts per 100x100 tiles of each area -----------------------------------------------
# Cave entrances are lower than map4's: every cave gets 5-7 rooms in the interior strip.
DENSITY = {
    'volcano': {
        'large cliffs': 2.4,          # big mesas with varied outlines and one ladder
        'lava lakes': 3.5,            # cliff-walled basins with black canyon floor and a molten pool
        'dead trees': 45,
        'cliff features': 2.8,        # crater rings and bowls copied from map2
        'cliff ledges': 1.5,          # bowl-shaped ledges built from cliff pieces
        'cave entrances': 0.8,        # cave mouths in the ledges (each gets a multi-room cave)
    },
    'desert': {
        'large cliffs': 1.8,
        'cactus': 22,
        'dead trees': 32,
        'bones': 3,
        'totems': 3,
        'camps': 1.4,                 # tents, campfires, log piles
        'rocks': 3.6,
        'ground decorations': 7,      # small sand tufts and stones
        'tombstone clumps': 0.6,      # groups of 3-7 tombstones
        'cliff ledges': 2.8,
        'cliff features': 1.3,
        'cave entrances': 0.6,
    },
    'swamp': {                        # no swamp cells in map5; kept so the shared code finds its names
        'large cliffs': 0, 'dead trees': 0, 'crypts and fences': 0, 'tombstone clumps': 0, 'dead leaves': 0,
        'bones': 0, 'camps': 0, 'ground decorations': 0, 'cliff ledges': 0, 'cave entrances': 0,
    },
    'forest': {
        'large cliffs': 0.9,
        'cliff ledges': 0.8,
        'trees': 72,
        'totem posts': 2.1,
        'rocks': 3.2,
        'camps': 1.3,
        'grass decorations': 24,      # flowers, small rocks in grass
        'cave entrances': 0.3,
    },
    'village': {
        'trees': 50,
        'rocks': 4.8,
        'camps': 2.1,
        'grass decorations': 24,
        'ground decorations': 7,
        'bare ground patches': 4,     # loose bare patches in the town grass
    },
    'beach': {
        'palm trees': 40,
        'beach objects': 14,          # umbrellas, tents, shells
        'camps': 1.7,
        'cliff ledges': 1.2,
        'cliff features': 1.5,
        'cave entrances': 0.5,
    },
}

# Minimum empty tiles between neighbouring objects of the same item, by item name (e.g. 'trees': 2).
SPACING = {
    'tombstones': 2,
    'graveyard fences': 1,
}

# ---- mob areas: one per section ---------------------------------------------------------------
# Mob kinds (shared/data/mobs.json): 1 Rat, 2 Crab, 3 Skeleton, 4 Goblin, 5 Snake, 6 Bat, 7 Skeleton2 (armored
# skeleton), 8 Ogre, 9 Eye, 10 Wizard, 11 Spectre, 12 DeathKnight. Lagoons count as beach.
MOBS = {
    'beach':   [2],              # crabs
    'village': [1, 5],           # rats, snakes
    'forest':  [4, 6, 5],        # goblins, bats, snakes
    'desert':  [3, 8, 7],        # skeletons, ogres, armored skeletons
    'volcano': [9, 12, 11],      # eyes, death knights, spectres
}
MOB_START_LEVELS = (1, 2)   # the start town's section; each section further away is MOB_LEVEL_STEP higher
MOB_LEVEL_STEP = 2          # (volcanoes always start one step above the farthest other section)
MOB_COUNT = 100             # mobs per mob area (every section)

# ---- dungeon mob areas: every cave room and hallway ------------------------------------------------
DUNGEON_TILES_PER_MOB = 30  # one mob per this many walkable floor tiles in a cave room (at least one)
DUNGEON_LEVEL_BONUS = 2     # levels above the mob area of the section the cave's entrance is in
DUNGEON_DROP_BONUS = 2      # bonusDrop: drop-rate multiplier for every mob in a cave
