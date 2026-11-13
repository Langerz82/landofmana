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
    md.save()
"""
import os, json, math

STRIDE = 100
GEOMETRY = ('x', 'y', 'w', 'h', 'count', 'clip')


def _write_json(path, data, indent):
    eol = '\n'
    if os.path.exists(path):
        if b'\r\n' in open(path, 'rb').read(4096): eol = '\r\n'
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, 'w', newline='').write((json.dumps(data, indent=indent) + '\n').replace('\n', eol))


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
    def _local_area(self, nm, a):
        """an area in part nm's own pixels, or None -- as the game server does it (mapgroup.js localizeArea()):
        a rectangle is cut to the part; an ellipse keeps its whole shape plus a 'clip' rectangle; either way the
        count is scaled to the share in the part"""
        x0, y0, x1, y1 = self._box(nm)
        if a.get('elipse'):
            ex0, ey0, ex1, ey1 = a['x'] - a['w'] / 2, a['y'] - a['h'] / 2, a['x'] + a['w'] / 2, a['y'] + a['h'] / 2
            cx0, cy0, cx1, cy1 = max(ex0, x0), max(ey0, y0), min(ex1, x1), min(ey1, y1)
            if cx1 - cx0 < 16 or cy1 - cy0 < 16: return None
            out = dict(a, x=a['x'] - x0, y=a['y'] - y0); out.pop('clip', None)
            if (cx0, cy0, cx1, cy1) == (ex0, ey0, ex1, ey1): return out
            rx, ry, n_all, mine = a['w'] / 2, a['h'] / 2, 0, 0      # a true ellipse, as area.js insideEllipse()
            ty = math.floor(ey0 / 16)
            while ty * 16 < ey1:
                tx = math.floor(ex0 / 16)
                while tx * 16 < ex1:
                    px, py = tx * 16 + 8, ty * 16 + 8
                    if ((px - a['x']) / rx) ** 2 + ((py - a['y']) / ry) ** 2 < 1:
                        n_all += 1
                        if x0 <= px < x1 and y0 <= py < y1: mine += 1
                    tx += 1
                ty += 1
            if not mine: return None
            out['clip'] = {'x': cx0 - x0, 'y': cy0 - y0, 'w': cx1 - cx0, 'h': cy1 - cy0}
            if mine < n_all and a.get('count'): out['count'] = max(1, round(a['count'] * mine / n_all))
            return out
        ax0, ay0 = max(a['x'], x0), max(a['y'], y0)
        ax1, ay1 = min(a['x'] + a['w'], x1), min(a['y'] + a['h'], y1)
        if ax1 - ax0 < 16 or ay1 - ay0 < 16: return None
        out = dict(a, x=ax0 - x0, y=ay0 - y0, w=ax1 - ax0, h=ay1 - ay0)
        whole, kept = a['w'] * a['h'], (ax1 - ax0) * (ay1 - ay0)
        if kept < whole and a.get('count'): out['count'] = max(1, round(a['count'] * kept / whole))
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

    def save(self):
        _write_json(self.p_ent, self.entities, 2)
        _write_json(self.p_ea, self.areas, 1)
