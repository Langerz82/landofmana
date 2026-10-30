"""Shared paths for the generators. Inputs come from tools/maps/data; derived caches go to common/cache."""
import os
HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.normpath(os.path.join(HERE, '..', '..', 'data'))
CACHE = os.path.join(HERE, 'cache')
os.makedirs(CACHE, exist_ok=True)
def data(name): return os.path.join(DATA, name)
def cache(name): return os.path.join(CACHE, name)
