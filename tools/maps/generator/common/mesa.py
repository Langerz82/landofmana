"""Raised mesas (plateaus) edged with map2's brown cliff set (the ring template at gids 931-1100).

Layout, using the template grid T[row][col] (rows of 20 gids starting at 931):
  top    : top-left corner T[0..2][0..3], plain top rim (T[0..2][6]) repeated, top-right corner T[0..2][6..9]
  sides  : T[3][0..1] / T[3][8..9] once, then T[4], T[5] rows of the side columns alternating
  front  : bottom-left corner T[6..8][0..2], ledge pieces (flat FM, down FL, up FR) in steps of 4
           columns, bottom-right corner T[6..8][7..9]. Dips in the front give each mesa its own shape.
"""
import numpy as np

T = np.array([[931 + r * 20 + c for c in range(10)] for r in range(9)])
FL = np.array([1033, 0, 0, 0, 1032, 1033, 0, 0, 1052, 1053, 1033, 0, 1072, 1073, 1032, 1033,
               1092, 1093, 1052, 1053, 0, 0, 1072, 1073, 0, 0, 1092, 1093]).reshape(7, 4)
FR = np.array([0, 0, 0, 1038, 0, 0, 1038, 1039, 0, 1038, 1058, 1059, 1038, 1039, 1078, 1079,
               1058, 1059, 1098, 1099, 1078, 1079, 0, 0, 1098, 1099, 0, 0]).reshape(7, 4)
FM = T[6:9, 3:7]


def front_sequence(rng, m, max_dip=3):
    """m pieces of 4 columns: flats with 0-2 dips (k down-steps, flat, k up-steps)."""
    seq = ['F'] * m
    budget = m - 2                          # keep a flat piece at each end
    out = []
    dips = int(rng.integers(1, 3))
    for _ in range(dips):
        k = int(rng.integers(1, max_dip + 1))
        while k > 1 and budget < 2 * k + 1: k -= 1
        if budget < 2 * k + 1: break
        out.append(k); budget -= 2 * k + 1
    # lay out: F* (D^k F+ U^k F*)...
    s = []
    flats = budget
    slots = len(out) + 1
    cuts = sorted(rng.integers(0, flats + 1, slots - 1).tolist()) if slots > 1 else []
    parts = np.diff([0] + cuts + [flats]).tolist()
    s = ['F']
    for i, k in enumerate(out):
        s += ['F'] * parts[i] + ['D'] * k + ['F'] + ['U'] * k
    s += ['F'] * parts[-1] + ['F']
    return ''.join(s)


def mesa(rng, m, side_rows):
    """m front pieces (width 6 + 4m), side_rows rows of plain side wall. Returns (tiles, top_mask)."""
    seq = front_sequence(rng, m)
    depth = max(0, max(np.cumsum([4 if c == 'D' else (-4 if c == 'U' else 0) for c in seq]))) if seq else 0
    Wd = 6 + 4 * m
    y_bl = 3 + side_rows                     # row of the bottom-left corner block
    Hd = y_bl + 3 + depth + 4
    out = np.zeros((Hd, Wd), np.int32)
    n = Wd - 8
    out[0:3, 0:4] = T[0:3, 0:4]
    for i in range(n): out[0:3, 4 + i] = T[0:3, 6]
    out[0:3, Wd - 4:Wd] = T[0:3, 6:10]
    out[3, 0:2] = T[3, 0:2]; out[3, Wd - 2:Wd] = T[3, 8:10]
    for r in range(4, y_bl):                 # side rows: T[4] repeated, T[5] just above the corner
        src = 5 if r == y_bl - 1 else 4
        out[r, 0:2] = T[src, 0:2]; out[r, Wd - 2:Wd] = T[src, 8:10]
    out[y_bl:y_bl + 3, 0:3] = T[6:9, 0:3]
    out[y_bl:y_bl + 3, Wd - 3:Wd] = T[6:9, 7:10]
    x, y = 3, y_bl
    for c in seq:
        if c == 'F': p, py = FM, y
        elif c == 'D': p, py = FL, y; y += 4
        else: p, py = FR, y - 4; y -= 4
        for j, i in zip(*np.nonzero(p)):
            if out[py + j, x + i] == 0: out[py + j, x + i] = p[j, i]
        x += 4
    # plateau top: inside the outline
    from scipy import ndimage
    walls = out != 0
    filled = ndimage.binary_fill_holes(walls | np.pad(np.zeros((Hd - 2, Wd - 2), bool), 1))
    top = filled & ~walls
    nz = np.nonzero(walls.any(1))[0]
    out = out[:nz.max() + 1]; top = top[:nz.max() + 1]
    return out, top
