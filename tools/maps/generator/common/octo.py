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
    if F.get('inner'):                        # optional inner-corner tiles, keyed by the missing diagonal
        full = m & n & s & e & w
        for k in ('se', 'sw', 'ne', 'nw'):
            if k in F['inner']: put(full & ~N[k], F['inner'][k], xx)
    return out

def rectify(mask, b=3, pinch='fill', allowed=None):
    """Snap a mask to a b x b block grid, so its outline is only horizontal and vertical runs at least b long.
    Blocks touching only at a corner are merged ('fill') or dropped ('cut'). With `allowed`, only blocks
    lying wholly inside it are kept."""
    H, W = mask.shape; h = -(-H // b); w = -(-W // b)
    def coarse(m, how):
        p = np.zeros((h * b, w * b), bool); p[:H, :W] = m
        r = p.reshape(h, b, w, b)
        return r.mean((1, 3)) >= 0.5 if how == 'half' else r.all((1, 3))
    c = coarse(mask, 'half')
    if allowed is not None: c &= coarse(allowed, 'all')
    for _ in range(100):
        a, bb, cc, d = c[:-1, :-1], c[:-1, 1:], c[1:, :-1], c[1:, 1:]
        diag = (a & d & ~bb & ~cc) | (bb & cc & ~a & ~d)
        if not diag.any(): break
        for y, x in zip(*np.nonzero(diag)):
            c[y:y + 2, x:x + 2] = pinch == 'fill'
    return np.kron(c, np.ones((b, b), bool))[:H, :W]

def shore(water):
    """map2's lake shore tiles, laid on the land ring around a rectified water mask (water fill 406 goes on the
    water itself). Thin blue rims on the west, east and south shores, a cliff bank on the north shore."""
    N = neigh(water); n, s, e, w = N['n'], N['s'], N['e'], N['w']
    L = ~water; out = np.zeros(water.shape, np.int32)
    out[L & n] = 629                                        # water to the north
    out[L & s & ~N['sw']] = 649                             # water to the south: bank, west end
    out[L & s & N['sw'] & ~N['se']] = 669                   #                     bank, east end
    out[L & s & N['sw'] & N['se']] = 689                    #                     bank
    out[L & w] = 668; out[L & e] = 670                      # water to the west / east
    out[L & n & w] = 628; out[L & n & e] = 630              # land corners jutting into the water
    out[L & s & w] = 688; out[L & s & e] = 690
    out[L & ~n & ~s & ~e & ~w & N['se']] = 746              # end of a bank above the water's north-west corner
    out[L & ~n & ~s & ~e & ~w & N['sw']] = 747              # end of a bank above the water's north-east corner
    return out

def match_joints(out, F, img, where=None, groups=('T', 'B', 'L', 'R')):
    """Re-pick the variant of each edge tile along every straight run so neighbouring tiles join cleanly
    (dynamic programming over the run, scoring the pixels where tiles meet, ends included). img(gid) returns
    the tile's pixels as an array (composited over whatever shows through it). Only runs with a cell in
    `where` are changed."""
    cache = {}
    def px(g):
        if g not in cache: cache[g] = np.asarray(img(int(g)), dtype=float)
        return cache[g]
        return float(np.abs(px(a)[-1] - px(b)[0]).mean())
    for g in groups:
        var = [int(v) for v in F[g]]
        if len(var) < 2: continue
        vertical = g in ('L', 'R')
        o = out if vertical else out.T                         # a view: runs along axis 0
        wh = None if where is None else (where if vertical else where.T)
        pxs = px if vertical else (lambda t, _p=px: np.swapaxes(_p(t), 0, 1))
        def c(a, b): return 0.0 if not a or not b else float(np.abs(pxs(a)[-1] - pxs(b)[0]).mean())
        member = np.isin(o, var)
        K = len(var)
        for x in range(o.shape[1]):
            col = member[:, x]; y = 0
            while y < o.shape[0]:
                if not col[y]: y += 1; continue
                y0 = y
                while y < o.shape[0] and col[y]: y += 1
                y1 = y - 1
                if wh is not None and not wh[y0:y1 + 1, x].any(): continue
                up = int(o[y0 - 1, x]) if y0 > 0 else 0
                dn = int(o[y1 + 1, x]) if y1 + 1 < o.shape[0] else 0
                D = np.array([c(up, v) for v in var]); back = []
                for i in range(y1 - y0):
                    M = np.array([[D[a] + c(var[a], var[b]) for a in range(K)] for b in range(K)])
                    back.append(M.argmin(1)); D = M.min(1)
                D = D + np.array([c(v, dn) for v in var])
                k = int(D.argmin()); seq = [k]
                for bk in reversed(back): k = int(bk[k]); seq.append(k)
                for i, k in enumerate(reversed(seq)): o[y0 + i, x] = var[k]
    return out
