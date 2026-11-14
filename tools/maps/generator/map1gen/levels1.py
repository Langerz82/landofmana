"""map1 mob levels: level by distance from the start town, volcanoes up to MAX_VOLCANO.

Run after splitting map1 and adding the quest NPCs (npcs1.py, npcs1_extra.py). It rewrites the levels in
gameserver/data/maps/map1/entityarea.json (the map's one file for all its parts, in full-map coordinates; the
script sees it part by part, common/mapdata.py) and the quest levels in shared/data/quests.json. A re-split
doesn't need it run again: the areas and their levels don't depend on how the map is split.

- The outdoor mob areas form a grid. The start town's areas (the village cell of the first town in
  tools/maps/data/map1_npcs.json) are level 1 only.
- Every other area's range rises one step per area of distance from the start town (steps to a neighbouring
  area, volcanoes not walked through): two-level ranges rising by 2 below level WIDE_FROM (2-3, 4-5, 6-7, 8-9),
  then three-level ranges rising by 3 (10-12, 13-15, ...). So every area borders one exactly one step lower.
- Volcano areas are high level: each volcano cluster is ranked by distance, the farthest cluster tops out at
  MAX_VOLCANO, nearer ones VOLCANO_CLUSTER_STEP lower; inside a cluster levels step by one (38-39 next to 39-40).
- Dungeon (map1_int) areas: a cave's first room is DUNGEON_BONUS levels above the lowest level of the outdoor area
  its entrance is in (a 2-level range: entrance 4-5 -> 6-7), and every room further in is ROOM_STEP higher.
  All their mobs are aggressive ("aggro": 1). Every dead end (a room with one way in and no way out) gets a
  boss (gameserver/data/maps/map1/entity.json, the first free ids from 1): one of its mob area's kinds, at a random spot in the
  room, BOSS_LEVEL_BONUS levels above the area's top level, boss multiplier BOSS_MULTI, aggressive, respawning
  after BOSS_RESPAWN_PER_LEVEL seconds x its level.
- Each map1 quest gets the level range of the mob area its NPC stands in.

    python levels1.py
"""
import os, sys, json, re, random
from collections import deque

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'common'))
from mapdata import MapData
ROOT = os.path.normpath(os.path.join(HERE, '..', '..', '..', '..'))
DATA = os.path.normpath(os.path.join(HERE, '..', '..', 'data'))
PFX = 'map1'
MAX_VOLCANO = 40
VOLCANO_CLUSTER_STEP = 4
DUNGEON_BONUS = 2       # a cave's first room: the entrance area's lowest level + this ...
ROOM_STEP = 1           # ... and this much more for every room further in
DUNGEON_WIDTH = 2       # cave mob areas are 2-level ranges (e.g. entrance 4-5 -> first room 6-7, next 7-8)
FIRST_BOSS_ID = 1        # boss ids: the first free one from here (unique in the map's entity.json)
BOSS_MULTI = 10                 # dead-end bosses: createBoss multiplier ...
BOSS_LEVEL_BONUS = 2            # ... levels above their room's mob area ...
BOSS_RESPAWN_PER_LEVEL = 120    # ... and seconds of respawn per level (2 minutes x level)
rnd = random.Random(7)
LEVEL_STEP = 2          # levels gained per area away from the start town (and each range's width) ...
WIDE_FROM = 10          # ... up to this level; from here on ranges are WIDE_STEP levels wide and rise by WIDE_STEP
WIDE_STEP = 3


def width_at(lo):
    return WIDE_STEP if lo >= WIDE_FROM else LEVEL_STEP


def range_for(d):
    """Level range of an area d steps from the start town: (1, 1), (2, 3), (4, 5), (6, 7), (8, 9), (10, 12), (13, 15), ..."""
    if d == 0: return (1, 1)
    lo = 2
    for _ in range(d - 1): lo += width_at(lo)
    return (lo, lo + width_at(lo) - 1)
VOLCANO_MOBS = {9, 11, 12}

maplist = json.load(open(os.path.join(ROOT, 'gameserver', 'maps', 'maplist.json')))['maps'][PFX]
index = {nm: int(PFX[3:]) * 100 + i for i, nm in enumerate(maplist)}
outdoor = [nm for nm in maplist if not nm.endswith('_int')]
inner = [nm for nm in maplist if nm.endswith('_int')]
mapjson = {nm: json.load(open(os.path.join(ROOT, 'gameserver', 'maps', nm + '.json'))) for nm in maplist}
md = MapData(ROOT, PFX)
ea = {nm: md.areas_of(nm) for nm in maplist}      # each part's areas, in its own pixels (copies)
# the wizard boss areas (wizards1.py) sit on top of the main-area mob areas: they are left out of the grid below,
# and given the levels of the area they sit on at the end
wizard = lambda a: str(a.get('caption', '')).startswith('wizard_boss')

# ---------------------------------------------------------------- outdoor grid
areas = []
for nm in outdoor:
    m = mapjson[nm]; wx, wy = m['worldX'] * 16, m['worldY'] * 16
    for a in ea[nm]['mobAreas']:
        if wizard(a): continue
        areas.append(dict(part=nm, rec=a, x=wx + a['x'], y=wy + a['y'], w=a['w'], h=a['h'],
                          mobs={int(k) for k in str(a.get('include', '')).split(',') if k.strip()}))


def touching(a, b):
    ox = min(a['x'] + a['w'], b['x'] + b['w']) - max(a['x'], b['x'])
    oy = min(a['y'] + a['h'], b['y'] + b['h']) - max(a['y'], b['y'])
    return (ox > 0 and oy == 0) or (oy > 0 and ox == 0)


nb = [[j for j, b in enumerate(areas) if j != i and touching(a, b)] for i, a in enumerate(areas)]
volcano = [bool(a['mobs'] & VOLCANO_MOBS) for a in areas]
spots = json.load(open(os.path.join(DATA, PFX + '_npcs.json')))
town = spots['towns'][0]
tx, ty = town['x'] * 16, town['y'] * 16
start_cell = (town['row'], town['col'])
W = max(a['x'] + a['w'] for a in areas); H = max(a['y'] + a['h'] for a in areas)


def cell(a):
    cx, cy = a['x'] + a['w'] / 2, a['y'] + a['h'] / 2
    return (min(spots['rows'] - 1, int(cy * spots['rows'] / H)), min(spots['cols'] - 1, int(cx * spots['cols'] / W)))


start = [i for i, a in enumerate(areas) if cell(a) == start_cell and a['mobs'] & {1, 5} and not volcano[i]]
if not start:   # fall back to the area holding the town centre
    start = [i for i, a in enumerate(areas) if a['x'] <= tx < a['x'] + a['w'] and a['y'] <= ty < a['y'] + a['h']]


def bfs(sources, blocked):
    d = [None] * len(areas); q = deque()
    for s in sources: d[s] = 0; q.append(s)
    while q:
        i = q.popleft()
        for j in nb[i]:
            if d[j] is None and not blocked[j]: d[j] = d[i] + 1; q.append(j)
    return d


dist = bfs(start, volcano)
dist_all = bfs(start, [False] * len(areas))
level = {}
for i in range(len(areas)):
    if volcano[i]: continue
    d = dist[i] if dist[i] is not None else dist_all[i]
    level[i] = range_for(d)
# volcano clusters
seen, clusters = set(), []
for i in range(len(areas)):
    if not volcano[i] or i in seen: continue
    comp, q = [], [i]; seen.add(i)
    while q:
        k = q.pop(); comp.append(k)
        for j in nb[k]:
            if volcano[j] and j not in seen: seen.add(j); q.append(j)
    clusters.append(sorted(comp, key=lambda k: dist_all[k]))
clusters.sort(key=lambda c: max(dist_all[k] for k in c), reverse=True)
for ci, comp in enumerate(clusters):
    top = MAX_VOLCANO - ci * VOLCANO_CLUSTER_STEP
    for rank, k in enumerate(reversed(comp)):           # farthest area of the cluster is the highest
        hi = top - rank * width_at(top - 1)
        level[k] = (hi - width_at(hi - 1) + 1, hi)
for i, (lo, hi) in level.items():
    r = areas[i]['rec']; r['minLevel'], r['maxLevel'] = lo, hi
    r['levelWeight'] = '1' if lo == hi else '2' + ',1' * (hi - lo)


def area_at(nm, x, y):
    for a in ea[nm]['mobAreas']:
        if wizard(a): continue
        if a['x'] <= x < a['x'] + a['w'] and a['y'] <= y < a['y'] + a['h']: return a
    return None


# ---------------------------------------------------------------- dungeons: by the cave entrance
dungeon_done, bosses, dungeon_report = 0, {}, []
for nm_in in inner:
    m = mapjson[nm_in]; w, h, col = m['width'], m['height'], m['collision']
    comp = [0] * (w * h); ncomp = 0                     # every walkable room / hallway
    for s0 in range(w * h):
        if col[s0] or comp[s0]: continue
        ncomp += 1; comp[s0] = ncomp; q = deque([s0])
        while q:
            c = q.popleft(); x, y = c % w, c // w
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if 0 <= nx < w and 0 <= ny < h:
                    k = ny * w + nx
                    if not col[k] and not comp[k]: comp[k] = ncomp; q.append(k)

    def tile_near(px, py):
        x0, y0 = px // 16, py // 16
        for r_ in range(3):                             # a door tile itself may be solid: look next to it
            for yy in range(y0 - r_, y0 + r_ + 1):
                for xx in range(x0 - r_, x0 + r_ + 1):
                    if 0 <= xx < w and 0 <= yy < h and comp[yy * w + xx]: return yy * w + xx
        return None

    def comp_at(px, py):
        t = tile_near(px, py)
        return comp[t] if t is not None else 0

    links, arrive, door_tiles = {}, {}, set()          # rooms joined by the interior's own doors
    for door in m.get('doors', []):
        if door.get('tmap') not in (None, index[nm_in]): continue
        door_tiles.add((door['y'] // 16) * w + door['x'] // 16)
        a_, b_ = comp_at(door['x'], door['y']), comp_at(door['tx'], door['ty'])
        if a_ and b_ and a_ != b_:
            links.setdefault(a_, set()).add(b_); links.setdefault(b_, set()).add(a_)
            arrive.setdefault((a_, b_), tile_near(door['tx'], door['ty']))
    entry = {}                                          # room -> lowest level of the outdoor area leading into it
    for nm in outdoor:
        for door in mapjson[nm].get('doors', []):
            if door.get('tmap') != index[nm_in]: continue
            src = area_at(nm, door['x'], door['y'])
            c_ = comp_at(door['tx'], door['ty'])
            if src and c_:
                entry[c_] = min(entry.get(c_, 10 ** 9), src['minLevel'])
                arrive.setdefault((0, c_), tile_near(door['tx'], door['ty']))
    # room level: the entrance's level + DUNGEON_BONUS, +ROOM_STEP for every room further in
    base, parent, q = {}, {}, deque()
    for c_, lv in sorted(entry.items(), key=lambda kv: kv[1]):
        base[c_] = lv + DUNGEON_BONUS; parent[c_] = 0; q.append(c_)
    while q:
        k = q.popleft()
        for j in sorted(links.get(k, ())):
            if j not in base: base[j] = base[k] + ROOM_STEP; parent[j] = k; q.append(j)
    room_hi, room_area = {}, {}
    for a in ea[nm_in]['mobAreas']:
        ids = {comp[yy * w + xx] for yy in range(a['y'] // 16, (a['y'] + a['h']) // 16)
               for xx in range(a['x'] // 16, (a['x'] + a['w']) // 16) if comp[yy * w + xx] in base}
        if not ids: print(f'  {nm_in} mob area {a["id"]}: no cave entrance reaches it, left at {a["minLevel"]}-{a["maxLevel"]}'); continue
        room = min(ids, key=lambda c_: base[c_])
        lo = base[room]
        a['minLevel'], a['maxLevel'], a['levelWeight'], a['aggro'] = lo, lo + DUNGEON_WIDTH - 1, '2' + ',1' * (DUNGEON_WIDTH - 1), 1
        room_hi[room] = max(room_hi.get(room, 0), a['maxLevel'])
        if room not in room_area or a['maxLevel'] > room_area[room]['maxLevel']: room_area[room] = a
        dungeon_done += 1
    # a boss in every dead end: a cave room with one way in and no way out
    for room in sorted(room_hi):
        if parent.get(room) in (None, 0) or len(links.get(room, ())) != 1 or room in entry: continue
        ar = room_area[room]
        tiles = [yy * w + xx for yy in range(ar['y'] // 16, (ar['y'] + ar['h']) // 16)
                 for xx in range(ar['x'] // 16, (ar['x'] + ar['w']) // 16)
                 if comp[yy * w + xx] == room and yy * w + xx not in door_tiles]
        roomy = [t for t in tiles if all(0 <= t % w + dx < w and 0 <= t // w + dy < h and comp[t + dy * w + dx] == room
                                         for dx in (-1, 0, 1) for dy in (-1, 0, 1))]
        t = rnd.choice(roomy or tiles)
        kinds = [int(k) for k in str(ar.get('include', '')).split(',') if k.strip()]
        lv = ar['maxLevel'] + BOSS_LEVEL_BONUS
        bosses.setdefault(nm_in, []).append({'caption': 'dungeon_boss', 'type': 'mob', 'kind': rnd.choice(kinds), 'x': t % w * 16,
                                             'y': t // w * 16, 'level': lv, 'boss': BOSS_MULTI, 'aggro': 1,
                                             'spawnDelay': BOSS_RESPAWN_PER_LEVEL * lv})
    def root(r):
        while parent.get(r): r = parent[r]
        return r
    for c_ in sorted(entry, key=lambda k: entry[k]):
        rooms_ = [r for r in room_hi if root(r) == c_]
        if not rooms_: continue
        ends = sum(1 for r in rooms_ if len(links.get(r, ())) == 1 and r not in entry)
        dungeon_report.append(f'entrance level {entry[c_]:>2}: {len(rooms_)} rooms, mobs {min(base[r] for r in rooms_)}-{max(room_hi[r] for r in rooms_)}, {ends} bosses')

# wizard boss areas: the levels of the main-area mob area they sit on (same spot)
for nm in maplist:
    base = {(a['x'], a['y'], a['w'], a['h']): a for a in ea[nm]['mobAreas'] if not wizard(a)}
    for a in ea[nm]['mobAreas']:
        b = base.get((a['x'], a['y'], a['w'], a['h'])) if wizard(a) else None
        if not b: continue
        a['minLevel'], a['maxLevel'] = b['minLevel'], b['maxLevel']      # (no levelWeight: wizards1.py)
for nm in maplist:
    md.update_areas(nm, ea[nm])

# bosses: in the interiors part, in the map's entity.json (other records kept; what this script wrote last time
# replaced -- the dead-end chests of earlier runs, listed in map1_chests_written.json, included). The written
# lists hold ids of the map's entity.json: {"map1": [ids]}.
p_bw = os.path.join(DATA, PFX + '_dungeon_written.json')
p_cw = os.path.join(DATA, PFX + '_chests_written.json')
prev = set()
for f_ in (p_bw, p_cw):
    if os.path.exists(f_):
        for k, v in json.load(open(f_)).items(): prev.update(v)
md.entities = [e for e in md.entities if e.get('id') not in prev]
used_ids = md.ids()
nid = FIRST_BOSS_ID
for nm_in in inner:
    for b_ in bosses.get(nm_in, []):
        while nid in used_ids: nid += 1
        b_['id'] = nid; used_ids.add(nid)
    out = md.entities_of(nm_in) + [dict(id=b_['id'], **{k: v for k, v in b_.items() if k != 'id'})
                                   for b_ in bosses.get(nm_in, [])]
    md.set_entities(nm_in, out)
md.save()
json.dump({PFX: [b_['id'] for v in bosses.values() for b_ in v]}, open(p_bw, 'w'), indent=1)
if os.path.exists(p_cw): json.dump({}, open(p_cw, 'w'))      # its chests are gone now

# ---------------------------------------------------------------- quests: the level range of the NPC's area
p_quests = os.path.join(ROOT, 'shared', 'data', 'quests.json')
qt = open(p_quests, encoding='utf-8').read()
quests = json.loads(qt)
npc_level = {}
for nm in outdoor:
    for e in md.entities_of(nm):
        a = area_at(nm, e['x'], e['y'])
        if a: npc_level[md.quest_base(e['id'])] = (a['minLevel'], a['maxLevel'], a.get('include', ''))
changed, warn = 0, []
dec = json.JSONDecoder()
for qid in quests:
    lv = npc_level.get(qid[:11])
    if not lv: continue
    kind = quests[qid].get('object', {}).get('kind')
    if kind is not None and str(kind) not in str(lv[2]).split(','):
        warn.append(f'{qid} ({quests[qid].get("name")}) mob kind {kind} is not in its area ({lv[2]})')
    i = qt.index('"' + qid + '"'); j = qt.index(':', i) + 1
    j = re.compile(r'\s*').match(qt, j).end()
    _, e_ = dec.raw_decode(qt, j)
    body = re.sub(r'("level"\s*:\s*\[)\s*\d+\s*,\s*\d+\s*(\])', rf'\g<1>{lv[0]}, {lv[1]}\g<2>', qt[j:e_])
    if body != qt[j:e_]: changed += 1
    qt = qt[:j] + body + qt[e_:]
json.loads(qt)
open(p_quests, 'w', encoding='utf-8', newline='').write(qt)

# ---------------------------------------------------------------- report
rows = sorted({a['y'] for a in areas}); cols = sorted({a['x'] for a in areas})
grid = {(rows.index(a['y']), cols.index(a['x'])): (i, a) for i, a in enumerate(areas)}
letter = lambda a: 'V' if a['mobs'] & VOLCANO_MOBS else 'T' if a['mobs'] == {1, 5} else 'B' if a['mobs'] == {2} else 'D' if a['mobs'] & {3, 7, 8} else 'f'
print(f'{len(areas)} outdoor areas (start town: {len(start)}), {dungeon_done} dungeon areas (aggressive), '
      f'{sum(len(v) for v in bosses.values())} dead-end bosses, {changed} quests updated')
for r in range(len(rows)):
    print('  ' + ' '.join(f"{letter(grid[(r, c)][1])}{grid[(r, c)][1]['rec']['minLevel']:>2}-{grid[(r, c)][1]['rec']['maxLevel']:<2}"
                          if (r, c) in grid else '   .    ' for c in range(len(cols))))
bad = [areas[i]['part'] + '#' + str(areas[i]['rec']['id']) for i in level if level[i][0] > 1 and not volcano[i]
       and not any(dist[j] is not None and level.get(j) == range_for(dist[i] - 1) for j in nb[i])]
print('  areas without a neighbour one step lower:', bad or 'none')
for d_ in dungeon_report: print('  cave, ' + d_)
for w_ in warn: print('  warning:', w_)
