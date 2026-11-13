"""One-time: merge a split map's per-part game server data into one pair of files for the whole map.

Before: gameserver/data/maps/map1/map1_0_0/entity.json, .../map1_0_0/entityarea.json, ... (one pair per part,
in that part's own coordinates, ids repeated from part to part, quest ids naming the part's map index).
After:  gameserver/data/maps/map1/entity.json and entityarea.json, in full-map pixel coordinates, which the game
server shares out to the parts when it loads (gameserver/js/map/mapgroup.js) -- so re-splitting the map no
longer touches them.

For every split map in gameserver/maps/maplist.json (a map whose files sit in a folder, "map1/map1_0_0"):

- entities: moved to full-map pixels and given ids unique in the map's file. The map tools' own records keep a
  range each (the ids listed in tools/maps/data/<map>_npcs_written.json from 1001, _npcs_extra_written.json from
  2001, _dungeon_written.json / _chests_written.json from 3001 -- the ranges those scripts now use), every other
  record keeps its id if it is free, else gets <part number> x 1000 + its id;
- areas: moved to full-map pixels and numbered 0, 1, 2, ... in the map's file (admin areas included);
- quest ids (shared/data/quests.json, shared/data/lang.json QUESTS / QUEST_SUMMARY) of those NPCs: from
  1 + <part's map index> + <old id> + nn to 1 + <map's base index> + <new id> + nn (gameserver questid.js);
- the map tools' written lists (tools/maps/data/<map>_*_written.json) get the new ids;
- the per-part folders are removed.

Run it ONCE, BEFORE re-splitting the map (it needs the converted parts the data was made for, in
gameserver/maps/). Players' saved quests no longer match the new ids: the userserver wipes them once at its
next start (wipeQuestsForMapGroups, userserver migration.js).

    python merge_mapdata.py            # every split map
    python merge_mapdata.py map1       # just map1
    python merge_mapdata.py --dry      # report only, write nothing
"""
import os, re, sys, json, shutil, argparse

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..', '..'))
DATA = os.path.normpath(os.path.join(HERE, '..', 'data'))
GS = os.path.join(ROOT, 'gameserver')
STRIDE = 100
RANGES = (('_npcs_written.json', 1001), ('_npcs_extra_written.json', 2001),
          ('_dungeon_written.json', 3001), ('_chests_written.json', 3001))

ap = argparse.ArgumentParser(description="Merge split maps' per-part entity.json/entityarea.json into one per map")
ap.add_argument('maps', nargs='*', help='map names (default: every split map)')
ap.add_argument('--dry', action='store_true', help='report only, write nothing')
args = ap.parse_args()


def load(p, default):
    return json.load(open(p, encoding='utf-8')) if os.path.exists(p) else default


def write_json(p, data, indent):
    eol = '\r\n' if os.path.exists(p) and b'\r\n' in open(p, 'rb').read(4096) else '\n'
    if args.dry: return
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, 'w', encoding='utf-8', newline='').write((json.dumps(data, indent=indent) + '\n').replace('\n', eol))


groups = load(os.path.join(GS, 'maps', 'maplist.json'), {})['maps']
todo = [g for g, files in groups.items() if any('/' in f for f in files) and (not args.maps or g in args.maps)]
remap = {}                      # (old map index, old entity id) -> (base index, new id), every merged map
reports = []

for g in todo:
    base = int(g[3:]) * STRIDE
    files = groups[g]
    gdir = os.path.join(GS, 'data', 'maps', g)
    if os.path.exists(os.path.join(gdir, 'entity.json')) or os.path.exists(os.path.join(gdir, 'entityarea.json')):
        print(f'{g}: {gdir} already has entity.json/entityarea.json -- already merged, skipped'); continue
    parts = []
    for i, nm in enumerate(files):
        m = json.load(open(os.path.join(GS, 'maps', nm + '.json')))
        parts.append(dict(name=nm, sub=i, index=base + i, ox=(m.get('worldX') or 0) * 16, oy=(m.get('worldY') or 0) * 16,
                          ent=load(os.path.join(GS, 'data', 'maps', nm, 'entity.json'), []),
                          ea=load(os.path.join(GS, 'data', 'maps', nm, 'entityarea.json'), {})))
    # the map tools' written lists: (part name, old id) -> range start
    tracked, written = {}, {}
    for suffix, start in RANGES:
        p = os.path.join(DATA, g + suffix)
        w = load(p, None)
        if w is None: continue
        written[suffix] = w
        ents = w.get('entities', w) if suffix in ('_npcs_written.json', '_npcs_extra_written.json') else w
        if isinstance(ents, dict):
            for nm, ids in ents.items():
                for oid in ids: tracked[(nm, oid)] = start
    used, new_ids = set(), {}
    # 1) the tools' records, in part order then id order, from their ranges
    for suffix, start in RANGES:
        nxt = start
        for p in parts:
            for e in sorted(p['ent'], key=lambda e: e.get('id', 0)):
                if tracked.get((p['name'], e.get('id'))) != start or (p['name'], e.get('id')) in new_ids: continue
                while nxt in used: nxt += 1
                new_ids[(p['name'], e['id'])] = nxt; used.add(nxt)
    # 2) everything else: its own id if free, else <part number> x 1000 + its id, else the next free one
    for p in parts:
        for e in p['ent']:
            key = (p['name'], e.get('id'))
            if key in new_ids: continue
            oid = e.get('id') if isinstance(e.get('id'), int) else 0
            nid = oid if oid > 0 and oid not in used else p['sub'] * 1000 + oid
            while nid <= 0 or nid in used: nid += 1
            new_ids[key] = nid; used.add(nid)
    entities, areas = [], {'mobAreas': [], 'entityAreas': []}
    for p in parts:
        for e in p['ent']:
            e2 = dict(e, id=new_ids[(p['name'], e.get('id'))])
            if isinstance(e.get('x'), (int, float)): e2['x'] = e['x'] + p['ox']
            if isinstance(e.get('y'), (int, float)): e2['y'] = e['y'] + p['oy']
            entities.append(e2)
            remap[(p['index'], e.get('id'))] = (base, e2['id'])
        for k in ('mobAreas', 'entityAreas'):
            for a in p['ea'].get(k, []):
                areas[k].append(dict(a, id=len(areas[k]), x=a['x'] + p['ox'], y=a['y'] + p['oy']))
    entities.sort(key=lambda e: e['id'])
    write_json(os.path.join(gdir, 'entity.json'), entities, 2)
    write_json(os.path.join(gdir, 'entityarea.json'), areas, 1)
    # the tools' written lists, with the new ids
    for suffix, w in written.items():
        p = os.path.join(DATA, g + suffix)
        if suffix in ('_npcs_written.json', '_npcs_extra_written.json'):
            ents = w.get('entities', {})
            ids = sorted(new_ids[(nm, oid)] for nm, l in ents.items() for oid in l if (nm, oid) in new_ids) \
                if isinstance(ents, dict) else ents
            out = dict(w, entities=ids)
            def nq(k):
                r = remap.get((int(k[1:5]), int(k[5:11])))
                return k if not r else f'1{r[0]:04d}{r[1]:06d}{k[11:]}'
            if isinstance(w.get('quests'), list): out['quests'] = sorted(nq(k) for k in w['quests'])
        else:
            ids = sorted(new_ids[(nm, oid)] for nm, l in w.items() for oid in l if (nm, oid) in new_ids)
            out = {g: ids} if ids else {}
        write_json(p, out, 1)
    reports.append(f'{g}: {len(parts)} parts -> {len(entities)} entities, {len(areas["mobAreas"])} mob areas, '
                   f'{len(areas["entityAreas"])} entity areas in {os.path.relpath(gdir, ROOT)}')
    for p in parts:
        moved = sum(1 for e in p['ent'] if new_ids[(p['name'], e.get('id'))] != e.get('id'))
        reports.append(f'   {p["name"]:16s} offset {p["ox"] // 16},{p["oy"] // 16} tiles: {len(p["ent"])} entities '
                       f'({moved} renumbered), {len(p["ea"].get("mobAreas", []))} mob areas, '
                       f'{len(p["ea"].get("entityAreas", []))} entity areas')

# ---- quest ids: 1 <map index:4> <entity id:6> <nn:2>
qkey = re.compile(r'"(1)(\d{4})(\d{6})(\d{2})"')
def new_key(m):
    r = remap.get((int(m.group(2)), int(m.group(3))))
    return m.group(0) if not r else f'"1{r[0]:04d}{r[1]:06d}{m.group(4)}"'

n_q = 0
for p in (os.path.join(ROOT, 'shared', 'data', 'quests.json'), os.path.join(ROOT, 'shared', 'data', 'lang.json')):
    t = open(p, encoding='utf-8', newline='').read()
    t2, n = qkey.subn(new_key, t)
    changed = sum(1 for m in qkey.finditer(t) if new_key(m) != m.group(0))
    n_q += changed
    json.loads(t2)
    keys = re.findall(r'"(1\d{12})"\s*:', t2)
    dup = {k for k in keys if keys.count(k) > 1} if 'quests.json' in p else set()
    if dup: sys.exit(f'{p}: quest ids would clash after renumbering: {sorted(dup)[:5]} -- nothing written')
    if not args.dry and t2 != t: open(p, 'w', encoding='utf-8', newline='').write(t2)
    print(f'{os.path.relpath(p, ROOT)}: {changed} quest id references renumbered')
# lang.json NO_MORE_QUESTS[<map index>][<entity id>] lines of a merged map's NPCs
lang = json.load(open(os.path.join(ROOT, 'shared', 'data', 'lang.json'), encoding='utf-8'))
for lg, d in lang.items():
    for mi in (d.get('NO_MORE_QUESTS') or {}):
        if any(k[0] == int(mi) for k in remap) and int(mi) != (int(mi) // STRIDE) * STRIDE:
            print(f'  warning: lang.json {lg}.NO_MORE_QUESTS["{mi}"] names a map part: move it to the map\'s base '
                  f'index ({int(mi) // STRIDE * STRIDE}) and its NPCs\' new ids by hand')

# ---- the per-part folders
for g in todo:
    for nm in groups[g]:
        d = os.path.join(GS, 'data', 'maps', nm)
        if os.path.isdir(d) and '/' in nm and not args.dry: shutil.rmtree(d)
for r in reports: print(r)
print('(dry run: nothing written)' if args.dry else 'done. Players\' saved quests are wiped once by the userserver at its next start.')
