"""A map's game server data files, as the map tools see them.

A map's NPCs, bosses and other fixed entities (gameserver/data/maps/<map>/entity.json) and its mob and
entity areas (gameserver/data/maps/<map>/entityarea.json) are ONE pair of files for the whole map, in
full-map pixel coordinates -- also for a map split into parts by split.py. The game server gives each part
what lies inside it when it loads (gameserver/js/map/mapgroup.js), so splitting the map differently
changes nothing in these files.

The tools that work part by part (map1gen/npcs1.py, npcs1_extra.py, levels1.py) use MapData to see the
files the same way: each part's records in that part's own coordinates, written back in full-map
coordinates. Entity ids are unique in the whole file, and quest ids use the map's base index (its number
x 100, e.g. 100 for map1) with them (gameserver questid.js).

    md = MapData(ROOT, 'map1')
    md.parts                                # [{'name', 'index', 'wx', 'wy', 'w', 'h'}] (tiles), maplist order
    md.entities_of('map1/map1_0_0')         # that part's records, its own pixels (copies)
    md.set_entities('map1/map1_0_0', recs)  # replace that part's records (its own pixels)
    md.areas_of('map1/map1_0_0')            # {'mobAreas': [...], 'entityAreas': [...]}, its own pixels (copies)
    md.update_areas('map1/map1_0_0', ea)    # write back changed fields (levels etc.; not the geometry)
    md.new_id(start)                        # next entity id >= start that no record uses
    md.quest_base(eid)                      # '1' + base index + entity id: quest ids '<that>01', '<that>02'
    md.save()                               # sorted by id; a "caption" filled in where missing

Every record and area carries a "caption" (unused by the game server): a short name for what it is, to make
the files easier to read -- "quest_npc_mainarea", "dungeon_boss", "mob_mainarea_forest", "dungeon_mob",
"node_ore", ... (caption_entity() / caption_area() below). save() fills in a caption only where there is none,
so hand-written ones stay.

    python mapdata.py                 # sort and caption every map's entity.json and entityarea.json
    python mapdata.py map1 map3       # just these maps
    python mapdata.py --renumber map1 # also renumber map1's areas 1, 2, 3, ... and its entities 1, 2, 3, ... (in their
                                      # current order), with
                                      # every reference: quest ids in shared/data/quests.json and lang.json, and
                                      # the map tools' written lists (tools/maps/data/map1_*_written.json)
"""
import os, re, sys, json, math

STRIDE = 100
GEOMETRY = ('x', 'y', 'w', 'h', 'count', 'clip')


def _write_json(path, data, indent):
    eol = '\n'
    if os.path.exists(path):
        if b'\r\n' in open(path, 'rb').read(4096): eol = '\r\n'
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, 'w', newline='').write((json.dumps(data, indent=indent) + '\n').replace('\n', eol))


BIOMES = {frozenset({1, 5}): 'village', frozenset({4, 5, 6}): 'forest', frozenset({3, 7, 8}): 'desert',
          frozenset({9, 11, 12}): 'volcano', frozenset({9, 12}): 'volcano', frozenset({2}): 'beach'}
NODE_KINDS = {2: 'node_ore', 99: 'chest'}      # gameserver entity/node.js: kind 2 drops coal and iron


def slug(t):
    return re.sub(r'[^a-z0-9]+', '_', str(t).lower()).strip('_')


def node_caption(kind):
    return NODE_KINDS.get(kind, f'node_kind{kind}')


def with_caption(rec, caption):
    """the record with "caption" right after its id (kept if it already has one)"""
    if rec.get('caption'): return rec
    out = {'id': rec['id']} if 'id' in rec else {}
    out['caption'] = caption
    out.update((k, v) for k, v in rec.items() if k not in ('id', 'caption'))
    return out


class MapData:
    def __init__(self, root, name):
        self.root, self.name = root, name
        self.base = int(name[3:]) * STRIDE
        listed = json.load(open(os.path.join(root, 'gameserver', 'maps', 'maplist.json')))['maps'].get(name, [])
        if not listed: raise SystemExit(f'{name} is not in gameserver/maps/maplist.json')
        self.parts = []
        for i, nm in enumerate(listed):
            f = os.path.join(root, 'gameserver', 'maps', nm + '.json')
            hdr = self._header(f)
            self.parts.append(dict(name=nm, index=self.base + i, wx=hdr.get('worldX', 0) or 0,
                                   wy=hdr.get('worldY', 0) or 0, w=hdr['width'], h=hdr['height']))
        self.part = {p['name']: p for p in self.parts}
        d = os.path.join(root, 'gameserver', 'data', 'maps', name)
        self.p_ent, self.p_ea = os.path.join(d, 'entity.json'), os.path.join(d, 'entityarea.json')
        self.entities = json.load(open(self.p_ent)) if os.path.exists(self.p_ent) else []
        self.areas = json.load(open(self.p_ea)) if os.path.exists(self.p_ea) else {'mobAreas': [], 'entityAreas': []}
        self.areas.setdefault('mobAreas', []); self.areas.setdefault('entityAreas', [])

    @staticmethod
    def _header(path):
        """width/height/worldX/worldY of a converted server map, without keeping its big arrays."""
        d = json.load(open(path))
        return {k: d.get(k) for k in ('width', 'height', 'worldX', 'worldY')}

    # ------------------------------------------------------------ where things are
    def _box(self, nm):
        p = self.part[nm]
        return p['wx'] * 16, p['wy'] * 16, (p['wx'] + p['w']) * 16, (p['wy'] + p['h']) * 16

    def part_at(self, x, y):
        """the part holding full-map pixel (x, y), or None"""
        for p in self.parts:
            x0, y0, x1, y1 = self._box(p['name'])
            if x0 <= x < x1 and y0 <= y < y1: return p['name']
        return None

    # ------------------------------------------------------------ entities
    def entities_of(self, nm):
        x0, y0, _, _ = self._box(nm)
        return [dict(e, x=e['x'] - x0, y=e['y'] - y0) for e in self.entities if self.part_at(e['x'], e['y']) == nm]

    def set_entities(self, nm, recs):
        x0, y0, _, _ = self._box(nm)
        rest = [e for e in self.entities if self.part_at(e['x'], e['y']) != nm]
        self.entities = rest + [dict(e, x=e['x'] + x0, y=e['y'] + y0) for e in recs]

    def ids(self):
        return {e.get('id') for e in self.entities}

    def new_id(self, start, taken=()):
        used = self.ids() | set(taken)
        i = start
        while i in used: i += 1
        return i

    def quest_base(self, eid):
        return f'1{self.base:04d}{eid:06d}'

    # ------------------------------------------------------------ areas
    def _share(self, a, nm):
        """how much of area a lies in part nm: pixels for a rectangle (none unless at least a tile each way), tiles
        for an ellipse -- as the game server counts it (mapgroup.js shareIn())"""
        x0, y0, x1, y1 = self._box(nm)
        if a.get('elipse'):
            rx, ry, n = a['w'] / 2, a['h'] / 2, 0
            ty = math.floor(max(a['y'] - ry, y0) / 16)
            while ty * 16 < min(a['y'] + ry, y1):
                tx = math.floor(max(a['x'] - rx, x0) / 16)
                while tx * 16 < min(a['x'] + rx, x1):
                    px, py = tx * 16 + 8, ty * 16 + 8
                    if x0 <= px < x1 and y0 <= py < y1 and ((px - a['x']) / rx) ** 2 + ((py - a['y']) / ry) ** 2 < 1: n += 1
                    tx += 1
                ty += 1
            return n
        w = min(a['x'] + a['w'], x1) - max(a['x'], x0)
        h = min(a['y'] + a['h'], y1) - max(a['y'], y0)
        return w * h if w >= 16 and h >= 16 else 0

    def _count_here(self, a, nm):
        """area a's count shared out over the parts: each its share rounded down, the leftover to the part with the
        biggest piece (the first such in the map list) -- as the game server does it (mapgroup.js countHere())"""
        shares = [self._share(a, p['name']) for p in self.parts]
        total = sum(shares)
        if not a.get('count') or not total: return a.get('count')
        base = [a['count'] * s_ // total for s_ in shares]
        main = max(range(len(shares)), key=lambda i: (shares[i], -i))
        me = [p['name'] for p in self.parts].index(nm)
        return base[me] + (a['count'] - sum(base) if me == main else 0)

    def _local_area(self, nm, a):
        """an area in part nm's own pixels, or None -- as the game server does it (mapgroup.js localizeArea()):
        a rectangle is cut to the part; an ellipse keeps its whole shape plus a 'clip' rectangle; the count is
        shared out over the parts (_count_here())"""
        if not self._share(a, nm): return None
        x0, y0, x1, y1 = self._box(nm)
        if a.get('elipse'):
            out = dict(a, x=a['x'] - x0, y=a['y'] - y0); out.pop('clip', None)
            ex0, ey0, ex1, ey1 = a['x'] - a['w'] / 2, a['y'] - a['h'] / 2, a['x'] + a['w'] / 2, a['y'] + a['h'] / 2
            if ex0 < x0 or ey0 < y0 or ex1 > x1 or ey1 > y1:
                cx0, cy0 = max(ex0, x0), max(ey0, y0)
                out['clip'] = {'x': cx0 - x0, 'y': cy0 - y0, 'w': min(ex1, x1) - cx0, 'h': min(ey1, y1) - cy0}
        else:
            ax0, ay0 = max(a['x'], x0), max(a['y'], y0)
            out = dict(a, x=ax0 - x0, y=ay0 - y0, w=min(a['x'] + a['w'], x1) - ax0, h=min(a['y'] + a['h'], y1) - ay0)
        if a.get('count'):
            out['count'] = self._count_here(a, nm)
            if not out['count']: return None
        return out

    def areas_of(self, nm):
        return {k: [l for l in (self._local_area(nm, a) for a in self.areas[k]) if l] for k in ('mobAreas', 'entityAreas')}

    def update_areas(self, nm, ea):
        """copies every field but the geometry (x, y, w, h, count) of part nm's areas back, by id"""
        for k in ('mobAreas', 'entityAreas'):
            by_id = {a['id']: a for a in self.areas[k]}
            for l in ea.get(k, []):
                g = by_id.get(l['id'])
                if g is None: continue
                for f, v in l.items():
                    if f not in GEOMETRY: g[f] = v

    # ------------------------------------------------------------ captions
    def interior(self, x, y):
        """is full-map pixel (x, y) in the interiors part (house and cave interiors)?"""
        nm = self.part_at(x, y)
        return bool(nm and nm.endswith('_int'))

    def caption_entity(self, e):
        t, eid, name = e.get('type'), e.get('id', 0), e.get('name')
        if t == 'mob':
            if e.get('boss'): return 'dungeon_boss' if self.interior(e['x'], e['y']) else 'boss'
            return 'dungeon_mob' if self.interior(e['x'], e['y']) else 'mob_fixed'
        if t == 'npcmove':
            if self.name == 'map3': return 'quest_npc_oldman' if name == 'Old Man' else 'quest_npc_ring'
            return 'quest_npc_mainarea'      # (the map tools caption their own: npcs1_extra.py's are quest_npc_mobarea)
        if t == 'npcstatic': return 'npc_' + slug(name) if name else 'npc_static'
        if t == 'node': return node_caption(e.get('kind'))
        return slug(t or 'entity')

    def caption_area(self, key, a):
        if key == 'entityAreas': return node_caption(a.get('kind')) if a.get('type') == 10 else 'entity_area'
        cx = a['x'] if a.get('elipse') else a['x'] + a['w'] / 2
        cy = a['y'] if a.get('elipse') else a['y'] + a['h'] / 2
        if self.interior(cx, cy): return 'dungeon_mob'
        if a.get('boss'): return 'mob_boss'
        mobs = frozenset(int(k) for k in str(a.get('include', '')).split(',') if k.strip())
        biome = BIOMES.get(mobs)
        return 'mob_mainarea_' + biome if biome else 'mob_mainarea'

    def save(self):
        """writes both files, sorted by id, with a caption on every record and area that has none"""
        self.entities = sorted((with_caption(e, self.caption_entity(e)) for e in self.entities),
                               key=lambda e: (e.get('id') is None, e.get('id') or 0))
        for k in ('mobAreas', 'entityAreas'):
            self.areas[k] = sorted((with_caption(a, self.caption_area(k, a)) for a in self.areas[k]),
                                   key=lambda a: a.get('id', 0))
        _write_json(self.p_ent, self.entities, 2)
        if os.path.exists(self.p_ea) or self.areas['mobAreas'] or self.areas['entityAreas']:
            _write_json(self.p_ea, self.areas, 1)


def renumber(root, md):
    """Gives md's entities the ids 1, 2, 3, ... in their current order, and updates what refers to them: quest ids
    (1 + base index + entity id + nn) in shared/data/quests.json and lang.json, lang.json NO_MORE_QUESTS lines,
    and the map tools' written lists. Returns {old id: new id}. Players' saved quests no longer match after
    this (the userserver's startup quest wipe, redis.js WIPE_QUESTS_KEY, needs a new key name)."""
    # areas: 1, 2, 3, ... in each list (nothing refers to an area id but the admin /delarea command)
    for k in ('mobAreas', 'entityAreas'):
        md.areas[k].sort(key=lambda a: a.get('id', 0))
        for i, a in enumerate(md.areas[k], 1): a['id'] = i
    md.entities.sort(key=lambda e: (e.get('id') is None, e.get('id') or 0))
    remap = {}
    for i, e in enumerate(md.entities, 1):
        if e.get('id') is not None: remap[e['id']] = i
        e['id'] = i
    remap = {o: n for o, n in remap.items() if o != n}
    if not remap: return remap
    base = f'{md.base:04d}'
    key = re.compile(r'"1' + base + r'(\d{6})(\d{2})"')
    sub = lambda m: f'"1{base}{remap.get(int(m.group(1)), int(m.group(1))):06d}{m.group(2)}"' if int(m.group(1)) in remap else m.group(0)
    for f in (os.path.join(root, 'shared', 'data', 'quests.json'), os.path.join(root, 'shared', 'data', 'lang.json')):
        t = open(f, encoding='utf-8', newline='').read()
        t2 = key.sub(sub, t)
        d = json.loads(t2)
        if f.endswith('lang.json'):
            for lg, sec in d.items():
                nmq = (sec.get('NO_MORE_QUESTS') or {}).get(str(md.base))
                if nmq and any(int(k) in remap for k in nmq):
                    raise SystemExit(f'lang.json {lg}.NO_MORE_QUESTS["{md.base}"] has lines for renumbered NPCs: '
                                     f'move them by hand ({ {o: remap[o] for o in map(int, nmq) if o in remap} })')
        if t2 != t: open(f, 'w', encoding='utf-8', newline='').write(t2)
    data = os.path.join(root, 'tools', 'maps', 'data')
    for f in sorted(os.listdir(data)):
        if not (f.startswith(md.name + '_') and f.endswith('_written.json')): continue
        p = os.path.join(data, f); w = json.load(open(p))
        if isinstance(w.get('quests'), list):
            w['quests'] = sorted(key.sub(sub, '"' + q + '"')[1:-1] for q in w['quests'])
        if isinstance(w.get('entities'), list): w['entities'] = sorted(remap.get(i, i) for i in w['entities'])
        for k, v in list(w.items()):                                  # {"map1": [ids]} (levels1.py's lists)
            if k == md.name and isinstance(v, list): w[k] = sorted(remap.get(i, i) for i in v)
        _write_json(p, w, 1)
    return remap


if __name__ == '__main__':
    root = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..'))
    args = [a for a in sys.argv[1:] if a != '--renumber']
    names = args or list(json.load(open(os.path.join(root, 'gameserver', 'maps', 'maplist.json')))['maps'])
    for nm in names:
        md = MapData(root, nm)
        if '--renumber' in sys.argv:
            r = renumber(root, md)
            print(f'{nm}: {len(r)} entities renumbered' + (f' ({min(r)}..{max(r)} -> 1..{len(md.entities)})' if r else ''))
        before = sum(1 for e in md.entities if not e.get('caption')) + \
                 sum(1 for k in ('mobAreas', 'entityAreas') for a in md.areas[k] if not a.get('caption'))
        if not md.entities and not os.path.exists(md.p_ea): print(f'{nm}: no data files'); continue
        md.save()
        print(f'{nm}: {len(md.entities)} entities, {len(md.areas["mobAreas"])} mob areas, '
              f'{len(md.areas["entityAreas"])} entity areas -- sorted by id, {before} captions added')
