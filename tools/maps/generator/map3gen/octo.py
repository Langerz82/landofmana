"""Octagon-style blob autotiling for the tilesheet's 6x6 terrain blocks."""
import numpy as np
from scipy import ndimage

def block(B, fill=None):
    t = lambda r, c: B + r * 20 + c
    return dict(
        TL=[t(0, 0)], T=[t(0, 1), t(0, 2), t(0, 3), t(0, 4)], TR=[t(0, 5)],
        L=[t(1, 0), t(2, 0), t(3, 0), t(4, 0)], R=[t(1, 5), t(2, 5), t(3, 5), t(4, 5)],
        BL=[t(5, 0)], B=[t(5, 1), t(5, 2), t(5, 3), t(5, 4)], BR=[t(5, 5)],
        dTL=[t(1, 1)], dTR=[t(1, 4)], dBL=[t(2, 1)], dBR=[t(2, 4)],
        fill=fill or [[t(3, 1), t(3, 2), t(3, 3), t(3, 4)], [t(4, 1), t(4, 2), t(4, 3), t(4, 4)]],
    )

FAM = {
    'grass': block(92),
    'dead': block(483),
    'mud': block(489, fill=[[552, 553], [572, 573]]),
    'lsand': block(495),
    'dry2': block(1652),
    'canyon': block(1295),
    # lake set: corners double as diagonals; water fill lives on its own layer
    'lake': dict(TL=[611], T=[612], TR=[613], L=[631], R=[633], BL=[651], B=[652], BR=[653],
                 dTL=[611], dTR=[613], dBL=[651], dBR=[653], fill=None),
}

def neigh(m):
    p = np.pad(m, 1, mode='edge')
    H, W = m.shape
    g = lambda dy, dx: p[1 + dy:1 + dy + H, 1 + dx:1 + dx + W]
    return dict(n=g(-1, 0), s=g(1, 0), e=g(0, 1), w=g(0, -1),
                ne=g(-1, 1), nw=g(-1, -1), se=g(1, 1), sw=g(1, -1))

def clean(mask, iters=20):
    """Remove cells that no tile can represent (1-wide strips, spurs)."""
    m = mask.copy()
    for _ in range(iters):
        N = neigh(m)
        bad = m & ((~N['n'] & ~N['s']) | (~N['e'] & ~N['w']))
        # diagonal-only contact pinches
        bad |= m & N['n'] & N['w'] & ~N['nw'] & ~N['s'] & ~N['e']
        if not bad.any(): break
        m &= ~bad
    return m

def octshape(mask, r=2):
    """Round a blocky mask to 0/45/90-degree outlines."""
    k = 2 * r + 1
    se = np.ones((k, k), bool)
    for i in range(r):
        for j in range(r - i):
            se[i, j] = se[i, -1 - j] = se[-1 - i, j] = se[-1 - i, -1 - j] = False
    m = ndimage.binary_opening(mask, se)
    m = ndimage.binary_closing(np.pad(m, k, mode='edge'), se)[k:-k, k:-k]
    return m

def tile(mask, fam, rng=None, yoff=0, xoff=0):
    F = FAM[fam] if isinstance(fam, str) else fam
    H, W = mask.shape
    out = np.zeros((H, W), np.int32)
    yy, xx = np.mgrid[0:H, 0:W]; yy = yy + yoff; xx = xx + xoff
    N = neigh(mask)
    n, s, e, w = N['n'], N['s'], N['e'], N['w']
    def put(cond, tiles, idx):
        tiles = np.array(tiles); out[cond] = tiles[idx[cond] % len(tiles)]
    m = mask
    if F['fill'] is not None:
        f = np.array(F['fill']); fr, fc = f.shape
        out[m] = f[yy[m] % fr, xx[m] % fc]
    else:
        out[m] = 0
    put(m & ~n & s & e & w, F['T'], xx)
    put(m & ~s & n & e & w, F['B'], xx)
    put(m & ~w & n & s & e, F['L'], yy)
    put(m & ~e & n & s & w, F['R'], yy)
    c = m & ~n & ~w & s & e; d = c & (N['ne'] | N['sw']); put(d, F['dTL'], xx); put(c & ~d, F['TL'], xx)
    c = m & ~n & ~e & s & w; d = c & (N['nw'] | N['se']); put(d, F['dTR'], xx); put(c & ~d, F['TR'], xx)
    c = m & ~s & ~w & n & e; d = c & (N['nw'] | N['se']); put(d, F['dBL'], xx); put(c & ~d, F['BL'], xx)
    c = m & ~s & ~e & n & w; d = c & (N['ne'] | N['sw']); put(d, F['dBR'], xx); put(c & ~d, F['BR'], xx)
    return out
