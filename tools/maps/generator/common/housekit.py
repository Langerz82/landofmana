"""Generated house interiors in many sizes, built from map2's own house-room pieces.

The walls come from map2's 13x12 house room: its columns and rows are stretched (repeating the
plain wall/floor columns and rows) to any size, and the doorway can sit left of centre, centred or
right of centre. Each room gets a carpet or two (map2's red and blue carpets, any size). Rooms have no
furniture by default; with FURNISHED = True they also get furniture against the back wall (TV stand,
desk, throne), plus a pair of pillars in the bigger rooms.

make_house(rng) returns a system dict in the same format as interiors.load_systems().
"""
import numpy as np
from scipy import ndimage
from paths import cache

# map2's 13x12 house room (walls + wooden floor), its doormat and the blocking under the doorway
WALLS = np.array([
    [1445, 1446, 1447, 1447, 1448, 1449, 1446, 1447, 1446, 1447, 1448, 1449, 1450],
    [1465, 1466, 1467, 1467, 1468, 1467, 1468, 1467, 1468, 1467, 1468, 1469, 1470],
    [1485, 1486, 1487, 1487, 1488, 1487, 1488, 1487, 1488, 1487, 1488, 1489, 1490],
    [1505, 1506, 1507, 1507, 1508, 1507, 1508, 1507, 1508, 1507, 1508, 1509, 1510],
    [1525, 1486, 1487, 1487, 1488, 1487, 1488, 1487, 1488, 1487, 1488, 1489, 1530],
    [1465, 1506, 1507, 1507, 1508, 1507, 1508, 1507, 1508, 1507, 1508, 1509, 1470],
    [1485, 1486, 1487, 1487, 1488, 1487, 1488, 1487, 1488, 1487, 1488, 1489, 1490],
    [1465, 1506, 1507, 1507, 1508, 1507, 1508, 1507, 1508, 1507, 1508, 1509, 1470],
    [1485, 1486, 1487, 1487, 1488, 1487, 1488, 1487, 1488, 1487, 1488, 1489, 1490],
    [1505, 1506, 1507, 1507, 1508, 1507, 1508, 1507, 1508, 1507, 1508, 1509, 1510],
    [1525, 1526, 1527, 1527, 1528, 1487, 1488, 1487, 1528, 1527, 1528, 1529, 1530],
    [1545, 1546, 1547, 1547, 1548, 0, 0, 0, 1548, 1547, 1548, 1549, 1550]])
DOORMAT = np.array([[1606, 1607, 1608], [1626, 1627, 1628], [1646, 1647, 1648]])   # rows 9-11, cols 5-7
BLOCK_ID = 24

CARPETS = {'red': np.array([[825, 826, 827], [845, 846, 847], [865, 866, 867]]),
           'blue': np.array([[1609, 1610, 1611], [1629, 1630, 1631], [1649, 1650, 1651]])}
# furniture that stands against the back wall (each carries its own tileset collision)
BACK = {'tv': np.array([[1669, 1670, 1671], [1689, 1690, 1691], [1709, 1710, 1711]]),
        'desk': np.array([[1666, 1667, 1668], [1686, 1687, 1688], [1706, 1707, 1708]]),
        'throne': np.array([[885, 886, 887], [905, 906, 907]])}
PILLAR = np.array([[1561, 1562, 1563, 0, 0], [1581, 1582, 1583, 1584, 0], [1601, 1602, 1603, 1604, 1605],
                   [1621, 1622, 1623, 1624, 0], [1641, 1642, 1643, 0, 0]])     # map2's column, with its shadow

# sizes: width = 11, 13, 15, ...; height = 10, 12, 14, 16
SIZES_W = ([11, 13, 15, 17, 19, 21], [0.12, 0.26, 0.24, 0.18, 0.12, 0.08])
SIZES_H = ([10, 12, 14, 16], [0.25, 0.35, 0.28, 0.12])

FURNISHED = False      # False: no furniture (rooms keep their carpets); True: furniture and pillars too

_COLL = None


def _cols(w, rng):
    """Template column for every column of a w-wide room, plus the doorway's first column."""
    if w == 11:
        cols = [0, 1, 2, 3, 5, 6, 7, 9, 10, 11, 12]
        return cols, 4
    extra = (w - 13) // 2                       # pairs of plain columns to add
    a = int(rng.integers(0, extra + 1))         # left of the doorway (rest go right of it)
    if rng.random() < 0.5: a = extra // 2       # often centred
    cols = [0, 1, 2, 3, 4] + [8, 9] * a + [5, 6, 7] + [8, 9] * (extra - a) + [8, 9, 10, 11, 12]
    return cols, 5 + 2 * a


def _rows(h):
    k = (h - 8) // 2
    return [0, 1, 2, 3, 4] + [5, 6] * k + [9, 10, 11]


def make_house(rng):
    global _COLL
    if _COLL is None: _COLL = np.load(cache('colliding.npy'))
    w = int(rng.choice(SIZES_W[0], p=SIZES_W[1])); h = int(rng.choice(SIZES_H[0], p=SIZES_H[1]))
    cols, d0 = _cols(w, rng); rows = _rows(h)
    walls = WALLS[np.ix_(rows, cols)].astype(np.int32)
    doors = np.zeros((h, w), np.int32); doors[h - 3:h, d0:d0 + 3] = DOORMAT
    blocking = np.zeros((h, w), np.int32); blocking[h - 1, d0:d0 + 3] = BLOCK_ID
    carpets = np.zeros((h, w), np.int32); objs = np.zeros((h, w), np.int32)
    # floor: rows 2 .. h-3, columns 2 .. w-3; the doorway lane up from the door stays clear
    fy0, fy1, fx0, fx1 = 2, h - 3, 2, w - 3
    lane = np.zeros((h, w), bool); lane[fy1 - 2:h, d0:d0 + 3] = True
    used = np.zeros((h, w), bool)

    # carpets: one big one, sometimes a second small one
    colour = 'red' if rng.random() < 0.5 else 'blue'
    for k in range(1 if rng.random() < 0.6 else 2):
        for _ in range(30):
            fw, fh = fx1 - fx0 + 1, fy1 - fy0 + 1                     # floor size
            if k == 0:                                                # main carpet: at least half the floor
                cw = int(rng.integers(max(3, fw // 2), max(4, fw - 1))); ch = int(rng.integers(max(3, fh // 2), max(4, fh)))
            else:                                                     # small rug
                cw = int(rng.integers(3, 5)); ch = int(rng.integers(3, 5))
            x = int(rng.integers(fx0, fx1 - cw + 2)); y = int(rng.integers(fy0, fy1 - ch + 2))
            if x + cw > fx1 + 1 or y + ch > fy1 + 1: continue
            if (carpets[max(0, y - 1):y + ch + 1, max(0, x - 1):x + cw + 1] != 0).any(): continue
            C = CARPETS[colour if not k else ('blue' if colour == 'red' else 'red')]
            ri = [0] + [1] * (ch - 2) + [2]; ci = [0] + [1] * (cw - 2) + [2]
            carpets[y:y + ch, x:x + cw] = C[np.ix_(ri, ci)]
            break

    def put(piece, y, x, keep_clear=1):
        ph, pw = piece.shape
        if y < fy0 or x < fx0 or y + ph - 1 > fy1 or x + pw - 1 > fx1: return False
        foot = piece != 0
        if (used[y:y + ph, x:x + pw] & foot).any() or (lane[y:y + ph, x:x + pw] & foot).any(): return False
        if keep_clear and used[max(0, y - keep_clear):y + ph + keep_clear,
                               max(0, x - keep_clear):x + pw + keep_clear].any(): return False
        objs[y:y + ph, x:x + pw][foot] = piece[foot]
        used[y:y + ph, x:x + pw] |= foot
        return True

    # pillars first in big rooms, mirrored left and right
    if FURNISHED and w >= 15 and h >= 12 and rng.random() < 0.6:
        py = int(rng.integers(fy0 + 2, max(fy0 + 3, fy1 - 6)))
        put(PILLAR, py, fx0, 0); put(PILLAR, py, fx1 - 4, 0)
    # back-wall furniture
    n = (1 + int(rng.random() < 0.6) + int(w >= 15 and rng.random() < 0.6)) if FURNISHED else 0
    names = list(BACK); rng.shuffle(names)
    for nm in names[:n]:
        for _ in range(20):
            x = int(rng.integers(fx0, fx1 - 1))
            if put(BACK[nm], fy0, x): break

    tiles = {'indoorwalls': walls, 'indoor doors': doors, 'carpets': carpets, 'indoor objects': objs,
             'blocking': blocking}
    tiles = {k: v for k, v in tiles.items() if v.any()}
    exit_ = (d0 + 1, h - 2, 'd')
    # every floor tile must still be reachable from the doorway
    solid = np.isin(walls, _COLL) | np.isin(objs, _COLL) | (blocking != 0) | (walls == 0)
    lab, _ = ndimage.label(~solid)
    floor = ~solid; floor[:2] = False
    if lab[exit_[1], exit_[0]] == 0 or (floor & (lab != lab[exit_[1], exit_[0]])).any():
        return make_house(rng)
    return dict(kind='house', lava=False, rooms=[(0, 0, w, h)], w=w, h=h, tiles=tiles, exits=[exit_],
                internal=[], src=('generated-house',))
