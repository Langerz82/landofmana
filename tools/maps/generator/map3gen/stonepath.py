"""Cobblestone paths made from the tiles of map2's stone house pads."""
import numpy as np

FILL = np.array([[415, 416], [435, 436]])
FILL_ALT = []                     # (variant fill tiles had gaps; plain 2x2 fill only)
TOP_F = [375, 376, 377]          # fringe above a path (ragged bottom edge of these tiles)
BOT_F = [475, 476, 477]          # fringe below
LEFT_F = [413, 433]              # fringe left of a path
RIGHT_F = [418, 438]             # fringe right
# outer corners of a staircase (diagonal) edge: the pad's corner pieces
C_BELOW_RIGHT = 394              # path is below and to the right of this cell
C_BELOW_LEFT = 398
C_ABOVE_RIGHT = 454
C_ABOVE_LEFT = 457


def tile(mask, rng):
    """mask: path cells. Returns one layer: solid cobbles on the path + ragged fringe around it."""
    H, W = mask.shape
    out = np.zeros((H, W), np.int32)
    yy, xx = np.nonzero(mask)
    out[yy, xx] = FILL[yy % 2, xx % 2]
    alt = mask & (rng.random((H, W)) < (0.18 if FILL_ALT else 0))
    ay, ax = np.nonzero(alt)
    if len(ay): out[ay, ax] = rng.choice(FILL_ALT, size=len(ay))
    P = np.pad(mask, 1)
    up, dn = P[2:, 1:-1], P[:-2, 1:-1]          # path below / above this cell
    lf, rt = P[1:-1, 2:], P[1:-1, :-2]          # path right / left of this cell
    free = ~mask
    def put(m, choices):
        m = m & free & (out == 0)
        y_, x_ = np.nonzero(m)
        out[y_, x_] = np.array(choices)[(y_ + x_) % len(choices)]
    put(up & lf, [C_BELOW_RIGHT]); put(up & rt, [C_BELOW_LEFT])
    put(dn & lf, [C_ABOVE_RIGHT]); put(dn & rt, [C_ABOVE_LEFT])
    put(up, TOP_F); put(dn, BOT_F); put(lf, LEFT_F); put(rt, RIGHT_F)
    return out
