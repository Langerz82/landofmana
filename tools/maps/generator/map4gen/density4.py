"""map4 settings: world layout, towns, rivers, and item amounts per 100x100 tiles of each area.

Raise a number for more of that item, lower it for fewer, 0 to remove it. The generator multiplies
each value by the size of that kind of area, so the values keep working at any map size. After
`python gen4.py` the log prints every item's density and how many were actually placed.
"""

# ---- world layout -----------------------------------------------------------------------------
# LAYOUT = 'bands': one area per band, north to south (BANDS), each taking its share of the height
# (BAND_SHARES). The borders between bands wander by up to about BAND_WARP tiles, and each area fades into
# the next through its own edge tiles. This is map4's layout (256x512 overworld).
# LAYOUT = 'noise': several areas of each kind, laid out by two noise fields (the settings below), for big
# maps like the earlier 768x1024 version: python gen4.py --width 768 --height 1024 (and LAYOUT = 'noise').
LAYOUT = 'bands'
BANDS = ['volcano', 'desert', 'forest', 'town']      # north to south ('swamp' works too)
BAND_SHARES = [0.22, 0.25, 0.28, 0.25]
BAND_WARP = 14
SEA = False               # True: sea and beaches along the south coast (the settings under "coast")

# 'noise' layout: areas come from two smooth noise fields: heat (volcano > desert > forest) and moisture (swamp).
REGION_SCALE = 170        # feature size of the noise fields (tiles): bigger = fewer, larger areas
NORTH_HEAT = 0.35         # volcanoes and deserts lean towards the north (0 = anywhere)
SHARES = {                # share of the inland area; everything else is forest (towns sit in the forest)
    'volcano': 0.07,      # the hottest spots, always ringed by desert
    'desert': 0.18,
    'swamp': 0.12,
}
SECTIONS = {'volcano': 3, 'desert': 3, 'swamp': 2, 'forest': 3}   # at least this many separate areas of each
MIN_AREA = 2500           # areas smaller than this (tiles) merge into their neighbour
BLEND = 16                # how far (tiles) grass thins out towards a neighbouring area

# ---- coast and beaches ------------------------------------------------------------------------
COAST_KEEP = 45           # rows above the beach that stay forest, so grass blends onto the sand
COAST_SAND = 6            # sand rows along the whole south coast
BEACH_SECTIONS = 3        # wider beach sections along the coast
BEACH_SECTION_WIDTH = (170, 260)
BEACH_SECTION_DEPTH = (36, 52)
LAGOONS = 0               # inland lake beaches: a lake ringed with sand and palms (3 on big maps)
LAGOON_SIZE = ((9, 14), (14, 22))   # lake half-height, half-width ranges
LAGOON_SAND = (11, 15)    # width of the sand ring

# ---- towns ------------------------------------------------------------------------------------
TOWNS = 2                 # with LAYOUT = 'bands' they share the town band, side by side (6 on big maps)
TOWN_SPACING = 170        # minimum distance between town centres ('noise' layout)
TOWN_RADIUS = (40, 52)    # half-height, half-width of a town
HOUSES_PER_TOWN = 14
HOUSES_IN_START_TOWN = 18
ENTERABLE_HOUSES_PER_TOWN = 8      # houses with an open door per town; the rest are closed
RED_HOUSE_SHARE = 0.6              # share of red-roof houses (only red houses can have an open door)

# ---- rivers and trails ------------------------------------------------------------------------
RIVERS = 1                # rivers flowing south (with LAYOUT = 'bands': through the forest band only)
RIVER_BRIDGE_SPACING = 75 # rows between plank bridges along each river
EXTRA_ROADS = 2           # extra town-to-town trails on top of the ones that join every town
AREA_TRAILS = True        # dead-end trails into every large desert, swamp and volcano area
TRAIL_WIDTH = 4           # average trail width (varies 3..6)
TRAIL_WANDER = 3.0        # how much trails wind (0 = straight lines)

# ---- item amounts per 100x100 tiles of each area -----------------------------------------------
DENSITY = {
    'volcano': {
        'large cliffs': 2.4,          # big mesas with varied outlines and one ladder
        'lava lakes': 3.5,            # cliff-walled basins with black canyon floor and a molten pool
        'dead trees': 45,
        'cliff features': 2.8,        # crater rings and bowls copied from map2
        'cliff ledges': 1.5,          # bowl-shaped ledges built from cliff pieces
        'cave entrances': 1.4,        # cave mouths in the ledges (each gets a multi-room cave)
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
        'cave entrances': 1.6,
    },
    'swamp': {
        'large cliffs': 1.6,
        'dead trees': 44,
        'crypts and fences': 16,      # placed around the graveyard mud
        'tombstone clumps': 2.5,
        'dead leaves': 12,
        'bones': 1.9,
        'camps': 1,
        'ground decorations': 7,
        'cliff ledges': 1.6,
        'cave entrances': 0.9,
    },
    'forest': {
        'large cliffs': 0.9,
        'cliff ledges': 0.8,
        'trees': 72,
        'totem posts': 2.1,
        'rocks': 3.2,
        'camps': 1.3,
        'grass decorations': 24,      # flowers, small rocks in grass
        'cave entrances': 0.6,
    },
    'village': {
        'trees': 60,
        'rocks': 4.8,
        'camps': 2.1,
        'grass decorations': 24,
        'ground decorations': 7,
        'bare ground patches': 4,     # loose bare patches in the town grass
    },
    'beach': {
        'palm trees': 66,
        'beach objects': 17,          # umbrellas, tents, shells
        'camps': 1.7,
        'cliff ledges': 1.2,
        'cliff features': 1.5,
        'cave entrances': 1.2,
    },
}

# Minimum empty tiles between neighbouring objects of the same item, by item name (e.g. 'trees': 2).
SPACING = {
    'tombstones': 2,
    'graveyard fences': 1,
}
