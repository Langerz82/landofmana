"""How many of each map item to place, per 100x100 tiles (10,000 tiles) of the biome it lives in.

Raise a number for more of that item, lower it for fewer, 0 to remove it. The generator
multiplies each value by the biome's size, so the values keep working if the biome bands or the
overworld width change. After `python gen.py` the log prints every item's density and how many
were actually placed (crowded items can come out a bit lower than asked).

Biome sizes in the delivered map (768 x 1024 overworld), in 100x100 blocks:
  volcano 14.8   desert 16.7   swamp 11.9   forest 14.1   village 14.0   beach 5.3
"""

DENSITY = {
    'volcano': {
        'large cliffs': 2.4,        # big mesas with varied outlines and ladders
        'lava rivers': 1,             # 1 = one main lava river across the volcano (0 = none); its vertical
                                      # feeder rivers: LAVA_TRIBUTARIES in gen.py
        'lava lakes': 3.5,            # cliff-walled basins with black canyon floor and a molten pool
        'dead trees': 45,
        'cliff features': 2.8,        # crater rings and bowls copied from map2
        'cave entrances': 0.8,        # mouths in the volcano/desert cliff wall (each gets a cave)
    },
    'desert': {
        'large cliffs': 2.8,        # big mesas with varied outlines and ladders
        'cactus': 22,
        'dead trees': 32,
        'bones': 3,
        'totems': 3,
        'camps': 1.4,                 # tents, campfires, log piles
        'rocks': 3.6,
        'ground decorations': 7,      # small sand tufts and stones
        'tombstone clumps': 0.6,      # groups of 3-7 tombstones
        'cliff ledges': 4.6,          # bowl-shaped ledges built from cliff pieces
        'cliff features': 1.3,        # crater rings and bowls copied from map2
        'cave entrances': 1.6,
    },
    'swamp': {
        'large cliffs': 1.6,        # big mesas with varied outlines and ladders
        'dead trees': 44,
        'crypts and fences': 16,      # placed around the graveyard mud
        'tombstone clumps': 2.5,
        'dead leaves': 12,
        'bones': 1.9,
        'camps': 1,
        'ground decorations': 7,
        'cliff ledges': 1.4,
        'cave entrances': 1,
    },
    'forest': {
        'large cliffs': 2.6,        # big mesas with varied outlines and ladders (grass on top)
        'cliff ledges': 2.4,          # bowl-shaped ledges built from cliff pieces
        'trees': 72,                  # map2's forest is about 111 per 100x100 tiles of forest grass
        'totem posts': 2.1,
        'rocks': 3.2,
        'camps': 1.3,
        'grass decorations': 24,      # flowers, small rocks in grass
    },
    'village': {
        'large cliffs': 1.8,          # mesas on the outskirts only, away from houses and roads
        'cliff ledges': 2.4,          # bowl-shaped ledges on the outskirts
        'trees': 86,
        'rocks': 4.8,
        'camps': 2.1,
        'grass decorations': 24,
        'ground decorations': 7,
        'bare ground patches': 4,     # loose bare patches in the village grass
    },
    'beach': {
        'palm trees': 66,             # 66 per 100x100 = about 350 on the delivered beach
        'beach objects': 17,          # umbrellas, tents, shells
        'camps': 1.7,
        'cliff ledges': 1.7,
        'cliff features': 2,
        'cave entrances': 1.7,        # in beach ledges
        'cliff wall cave entrances': 1.3,   # in the village/beach cliff wall
    },
}

# Minimum empty tiles between neighbouring objects of the same kind of item (and anything else
# already placed), by item name as used above. Items not listed keep the generator's default
# (1 tile for most objects, 0 for small decorations).
# 'tombstones' is the gap between the stones inside each tombstone clump.
SPACING = {
    'tombstones': 2,
    'graveyard fences': 1,
    # examples: 'trees': 2, 'cactus': 2, 'palm trees': 1, 'crypts and fences': 2,
}

# Houses are placed per village rather than per area.
HOUSES_PER_VILLAGE = 14
HOUSES_IN_START_VILLAGE = 18
# houses with an open door you can walk into, per village; every other house has a closed door
ENTERABLE_HOUSES_PER_VILLAGE = 8
# share of red-roof houses (the only kind that can have an open door); the rest are blue-roof houses
RED_HOUSE_SHARE = 0.6
