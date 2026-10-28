import numpy as np
from scipy import ndimage
def fbm(shape, rng, scale, octaves=4, persist=0.5):
    """Smooth fractal value noise, normalised to mean 0 / std 1."""
    H, W = shape; out = np.zeros(shape); amp = 1; tot = 0
    for o in range(octaves):
        s = max(2, int(scale / (2 ** o)))
        g = rng.random((H // s + 3, W // s + 3))
        z = ndimage.zoom(g, s, order=3)[:H, :W]
        out += amp * z; tot += amp; amp *= persist
    out /= tot
    return (out - out.mean()) / (out.std() + 1e-9)
