"""map1 wizard bosses: one Wizard boss in every main-area mob area.

For every outdoor ("main area") mob area of map1 -- caption mob_mainarea_<biome> in
gameserver/data/maps/map1/entityarea.json -- this adds a second mob area on exactly the same spot
(same x, y, w, h), captioned "wizard_boss_mainarea", that spawns:

    include  WIZARD_KIND (10, Wizard)     count  WIZARD_COUNT (1)
    boss     WIZARD_BOSS (3: 3x HP, longer respawn, better drops -- gameserver MobRespawn.createBoss)
    levels   the same minLevel/maxLevel as the area it sits on
    (no exclude, definite, levelWeight or bonusDrop: the game server's defaults apply)

Running it again updates the wizard areas it made last time (matched by position) instead of adding more, and
removes any whose main area is gone. levels1.py keeps their levels the same as their main area's whenever it sets
the levels again, and it and npcs1_extra.py leave them out of everything else (they're not areas of their own).

    python wizards1.py
"""
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'common'))
from mapdata import MapData
ROOT = os.path.normpath(os.path.join(HERE, '..', '..', '..', '..'))
PFX = 'map1'
WIZARD_KIND = 10
WIZARD_COUNT = 1
WIZARD_BOSS = 3
CAPTION = 'wizard_boss_mainarea'


def is_wizard(a):
    return str(a.get('caption', '')).startswith('wizard_boss')


md = MapData(ROOT, PFX)
areas = md.areas['mobAreas']
main = [a for a in areas if str(a.get('caption', '')).startswith('mob_mainarea')]
spot = lambda a: (a['x'], a['y'], a['w'], a['h'], bool(a.get('elipse')))
old = {spot(a): a for a in areas if is_wizard(a)}
keep, made, updated = set(), 0, 0
next_id = max((a['id'] for a in areas), default=0) + 1
for m in main:
    w = old.get(spot(m))
    if w is None:
        w = {'id': next_id, 'caption': CAPTION}; next_id += 1
        areas.append(w); made += 1
    else:
        updated += 1
    # the same order of fields as the other mob areas: id, caption, count, levels, place, include, boss
    for k in ('count', 'minLevel', 'maxLevel', 'x', 'y', 'w', 'h', 'elipse', 'include', 'boss'): w.pop(k, None)
    w.update(count=WIZARD_COUNT, minLevel=m['minLevel'], maxLevel=m['maxLevel'])
    for k in ('x', 'y', 'w', 'h', 'elipse'):
        if k in m: w[k] = m[k]
    w.update(include=str(WIZARD_KIND), boss=WIZARD_BOSS)
    # not needed for a single wizard: left out, the game server's defaults apply (no exclude or definite list,
    # every level as likely, normal drops)
    for k in ('exclude', 'definite', 'levelWeight', 'bonusDrop', 'kindWeight'):
        w.pop(k, None)
    keep.add(id(w))
gone = [a for a in areas if is_wizard(a) and id(a) not in keep]
md.areas['mobAreas'] = [a for a in areas if not (is_wizard(a) and id(a) not in keep)]
md.save()
print(f'{len(main)} main-area mob areas: {made} wizard boss areas added, {updated} updated, {len(gone)} removed '
      f'(Wizard kind {WIZARD_KIND}, count {WIZARD_COUNT}, boss x{WIZARD_BOSS}, levels as their area)')
