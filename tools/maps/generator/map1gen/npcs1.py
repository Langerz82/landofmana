"""map1 quest NPCs: one walking NPC per mob area, each with two quests and their own dialogue.

Run after splitting map1 (python ../split.py map1 ...), since a quest belongs to the NPC's map part (its map index)
and fixed entity id. For every NPC spot that gen1.py saved in tools/maps/data/map1_npcs.json, this script:

- adds an `npcmove` NPC to the map part it stands in: gameserver/data/maps/map1/<part>/entity.json
  (ids from FIRST_ID up; any other records in those files are kept);
- writes its two quests to shared/data/quests.json:
    01  kill ten of one of the section's mobs, at the section's mob levels
    02  get 3-5 of a random itemloot item from another of the section's mobs, at the section's mob levels
- writes their dialogue to shared/data/lang.json (QUESTS) and a line for the quest log (QUEST_SUMMARY),
  about the mobs of that section and the section itself (its area, where it lies, what it borders,
  the nearest town).

Running it again (after a re-split, say) first removes every quest, dialogue and NPC it wrote last time (listed
in tools/maps/data/map1_npcs_written.json), so nothing is left over. The rest of quests.json and lang.json is
left exactly as it is. Afterwards run godot-client/sync-assets-win.bat (or -linux.sh) for the Godot client.

    python npcs1.py              # seed 5
    python npcs1.py --seed 7     # other names, items and dialogue
"""
import os, sys, json, argparse, re
import random

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..', '..', '..'))
DATA = os.path.normpath(os.path.join(HERE, '..', '..', 'data'))
ap = argparse.ArgumentParser(description='Quest NPCs for map1 (run after splitting it)')
ap.add_argument('--map', default='map1', help='map name (default map1)')
ap.add_argument('--seed', type=int, default=5)
args = ap.parse_args()
PFX = args.map
rnd = random.Random(args.seed)
FIRST_ID = 101                     # entity ids used in each part's entity.json
KILL_COUNT = 10
ITEM_COUNT = (3, 5)
ITEM_CHANCE = 15

p_quests = os.path.join(ROOT, 'shared', 'data', 'quests.json')
p_lang = os.path.join(ROOT, 'shared', 'data', 'lang.json')
p_list = os.path.join(ROOT, 'gameserver', 'maps', 'maplist.json')
p_spots = os.path.join(DATA, PFX + '_npcs.json')
p_written = os.path.join(DATA, PFX + '_npcs_written.json')

spots = json.load(open(p_spots))
maplist = json.load(open(p_list))['maps']
# {"map1": ["map1/map1_0_0", ...]}: a file's map index is its map's number x 100 + its sub-index
# (gameserver map/mapmanager.js); the older flat list (index = position) still reads
if isinstance(maplist, dict):
    maplist = {int(g[3:]) * 100 + i: nm for g, files in maplist.items() if g[3:].isdigit() for i, nm in enumerate(files)}
else:
    maplist = dict(enumerate(maplist))
MOBS = json.load(open(os.path.join(ROOT, 'shared', 'data', 'mobs.json')))
MOB_KEY = {v['kind']: k for k, v in MOBS.items()}                      # kind -> mobs.json name ('DeathKnight')
LOOT = json.load(open(os.path.join(ROOT, 'shared', 'data', 'itemloot.json')))

# ---------------------------------------------------------------- the map parts
parts = []                                     # (name, map index, worldX, worldY, w, h)
for i, nm in sorted(maplist.items()):
    if not nm or not nm.startswith(PFX + '/') or nm.endswith('_int'): continue
    f = os.path.join(DATA, nm + '.json')
    if not os.path.exists(f): sys.exit(f'{f} is missing: split {PFX} first (python ../split.py {PFX} ...)')
    d = json.load(open(f)); pr = {q['name']: q['value'] for q in d.get('properties', [])}
    parts.append((nm, i, pr.get('worldX', 0), pr.get('worldY', 0), d['width'], d['height']))
if not parts: sys.exit(f'{PFX} is not in {p_list}: split it first (python ../split.py {PFX} --convert)')


def part_of(x, y):
    for p in parts:
        if p[2] <= x < p[2] + p[4] and p[3] <= y < p[3] + p[5]: return p
    return None


# ---------------------------------------------------------------- names
_prev = set(json.load(open(p_written))['quests']) if os.path.exists(p_written) else set()
used = set(json.load(open(os.path.join(ROOT, 'gameserver', 'data', 'npc_names.json'))))
for _k, q in json.load(open(p_quests)).items():
    if _k not in _prev: used.add(q.get('name', '').split(':')[0])
A = ['Bra', 'Cor', 'Del', 'Fen', 'Gar', 'Hal', 'Isa', 'Jor', 'Kel', 'Lor', 'Mar', 'Nor', 'Orr', 'Per', 'Quin', 'Ros',
     'Sel', 'Tor', 'Ul', 'Vor', 'Wen', 'Yar', 'Zel', 'Ash', 'Bel', 'Cal', 'Dor', 'Eld', 'Fal', 'Gwen', 'Hob', 'Mil',
     'Tam', 'Rhi', 'Sab', 'Thea', 'Bram', 'Odo', 'Pip', 'Wil']
B = ['an', 'en', 'ric', 'wyn', 'dor', 'ia', 'ella', 'os', 'ius', 'eth', 'ard', 'in', 'ara', 'ek', 'old', 'ira', 'ton',
     'ley', 'mund', 'isa', 'o', 'ette', 'ber', 'win']


def new_name():
    for _ in range(1000):
        n = rnd.choice(A) + rnd.choice(B)
        if n not in used and 4 <= len(n) <= 9: used.add(n); return n
    raise RuntimeError('ran out of names')


TOWN_NAMES = ['Millbrook', 'Ashby', 'Fernhollow', 'Saltmere', 'Oakhaven', 'Thornbury', 'Duskwater', 'Briarwick']
rnd.shuffle(TOWN_NAMES)
towns = [dict(t, name=TOWN_NAMES[i]) for i, t in enumerate(spots['towns'])]     # the first is the start town

# ---------------------------------------------------------------- words
MOB = {1: 'rat', 2: 'crab', 3: 'skeleton', 4: 'goblin', 5: 'snake', 6: 'bat', 7: 'armored skeleton', 8: 'ogre',
       9: 'floating eye', 10: 'wizard', 11: 'spectre', 12: 'death knight'}
NUM = {3: 'three', 4: 'four', 5: 'five', 10: 'ten'}


def item_words(n):
    w = re.sub(r'(?<=[a-z])(?=[A-Z])', ' ', n).lower().split()
    w = [x for x in w if x not in ('one', 'two', 'three', 'four')] or [n.lower()]
    return ' '.join(w)


def plural(w):
    if w.endswith(('s', 'sh', 'ch', 'x')): return w + 'es'
    if w.endswith('y') and w[-2:-1] not in 'aeiou': return w[:-1] + 'ies'
    if w.endswith('fe'): return w[:-2] + 'ves'
    if w.endswith('f') and not w.endswith('ff'): return w[:-1] + 'ves'
    return w + 's'


def compass(row, col, rows, cols):
    v = 'north' if row < rows * 0.36 else ('south' if row >= rows * 0.64 else '')
    h = 'west' if col < cols * 0.4 else ('east' if col >= cols * 0.6 else '')
    if v and h: return f'{v}-{h}ern'
    if v or h: return (v or h) + ('ern' if (v or h) in ('north', 'south', 'east', 'west') else '')
    return 'central'


NOUN = {'beach': ['shore', 'beach', 'coast'], 'lagoon': ['lagoon', 'lagoon shore'],
        'forest': ['woods', 'forest', 'woodland'], 'desert': ['dunes', 'desert', 'sands'],
        'volcano': ['lava fields', 'volcano', 'ash slopes'], 'village': ['town']}


def place(s, area):
    d = compass(s['row'], s['col'], spots['rows'], spots['cols'])
    if area == 'lagoon': return rnd.choice(['the lagoon', f'the {d} lagoon'])
    return f'the {d} {rnd.choice(NOUN[area])}'


def nearest_town(s):
    return min(towns, key=lambda t: (t['x'] - s['x']) ** 2 + (t['y'] - s['y']) ** 2)


# Lines use {place} (this section), {town} (the nearest town), {mob}/{mobs} (the quest's mob), {item}/{items}
# and {n} (the count in words). Speaker 0 is the NPC, 1 the player. Stage 0 (the offer) is shown before the
# quest starts, so counts there are in words; the later stages use the clients' %count% / %name% variables.
KILL = {
    2: [[(0, 'The crabs on {place} have started pinching anyone who walks the tideline.'),
         (0, 'Knock {n} of them back into the surf, would you?')],
        [(0, 'I came down to {place} to dig for clams.'), (1, 'Any luck?'),
         (0, 'The crabs dig faster and bite harder. Clear {n} of them off my patch.')],
        [(0, 'Every crab on {place} has decided my fishing boat is their new home.'),
         (0, "I can't push off with them clacking at my ankles. Get rid of {n}.")],
        [(0, 'The children of {town} used to play on {place}.'),
         (0, 'Now the crabs chase them off. Drive away {n} so they can come back.')]],
    1: [[(0, 'Rats have got into the grain store here in {town}.'),
         (0, "If they keep eating like this we'll go hungry by winter. Kill {n} of them.")],
        [(0, "Something's chewing through the floorboards of every house in {town}."), (1, 'Rats?'),
         (0, 'Rats. Big ones. Get rid of {n} for me.')],
        [(0, 'The baker in {town} found a rat in the dough this morning.'),
         (0, "Nobody's buying bread now. Clear out {n} of the pests.")]],
    5: [[(0, 'Snakes are nesting under the doorsteps of {town}.'),
         (0, 'My neighbour got bitten fetching water. Clear out {n} of them.')],
        [(0, 'The undergrowth of {place} is thick with snakes this year.'),
         (0, "I can't gather herbs without stepping on one. Kill {n} for me.")],
        [(0, 'A snake swallowed my pet frog whole, right here in {place}!'), (1, "That's awful."),
         (0, "It's worse than awful, there are dozens of them. Deal with {n}.")]],
    4: [[(0, 'Goblins have built a camp somewhere in {place}.'),
         (0, 'They raid the trail every night. Thin them out, {n} should send a message.')],
        [(0, 'A goblin stole my axe while I was resting under a tree.'), (1, 'Just one goblin?'),
         (0, 'One stole it, the rest laughed. Teach {n} of them a lesson.')],
        [(0, 'The goblins of {place} have been painting rude pictures on the trees.'),
         (0, 'The woodcutters of {town} refuse to work. Chase off {n} of them.')]],
    6: [[(0, 'Bats pour out of the caves around {place} every dusk.'),
         (0, "They've driven the songbirds from the trees. Kill {n} of them.")],
        [(0, "I'm trying to map the stars over {place}, but the bats keep blotting them out."),
         (0, 'Clear the sky a little. {N} should do it.')],
        [(0, 'The bats in {place} have a taste for travellers from {town}.'),
         (0, 'Three people bitten this week. Get rid of {n}.')]],
    3: [[(0, 'The sands of {place} are full of old bones.'), (0, "Lately they've started getting up again."),
         (0, 'Put {n} skeletons back in the ground.')],
        [(0, 'I dig for relics in {place}.'), (1, 'Found anything good?'),
         (0, 'Skeletons. Walking ones. Smash {n} of them so I can get back to work.')],
        [(0, 'A whole graveyard of skeletons rose out of {place} last full moon.'),
         (0, "They rattle all night and nobody can sleep. Break {n} of them.")]],
    8: [[(0, 'An ogre tribe has wandered into {place} looking for water.'),
         (0, "They've smashed every well between here and {town}. Drive off {n} of them.")],
        [(0, 'The ogres of {place} have taken to throwing boulders at caravans.'), (1, 'For fun?'),
         (0, 'For fun. Knock {n} of them flat and see how they like it.')],
        [(0, "I'm a trader, and the ogres in {place} keep \"taxing\" my wagons."),
         (0, 'By eating them. Wagons and all. Beat {n} of them.')]],
    7: [[(0, 'Long ago an army marched into {place} and never marched out.'),
         (0, 'Their armour still walks. Bring down {n} of those armored skeletons.')],
        [(0, 'Armored skeletons patrol {place} as if the old war never ended.'),
         (0, "They stop anyone who passes and demand a password nobody knows. Defeat {n} of them.")],
        [(0, "The armored skeletons in {place} wear my great-grandfather's regiment colours."),
         (0, 'Let them rest at last. Bring down {n}.')]],
    9: [[(0, 'Floating eyes drift over {place}, watching everything.'),
         (0, "I can't sleep with them staring. Destroy {n} of them.")],
        [(0, 'The eyes over {place} see in the dark and through smoke.'), (1, 'What are they looking for?'),
         (0, "Us, I think. Close {n} of them for good.")],
        [(0, 'Every time I sneak towards the lava, a floating eye spots me and the whole volcano wakes up.'),
         (0, 'Blind {n} of them, please.')]],
    12: [[(0, 'Death knights ride out of the smoke of {place}.'),
          (0, 'They guard something deep in the volcano. Cut down {n} of them and we may find out what.')],
         [(0, 'The death knights of {place} were the old king\'s guard.'), (1, 'What happened to them?'),
          (0, 'They swore to hold the volcano forever, and they meant it. Defeat {n}.')],
         [(0, 'A death knight challenged me to a duel in {place}.'),
          (0, 'I ran. Now they all want a duel. Fight {n} of them for me.')]],
    11: [[(0, 'Spectres wail over the ash of {place}.'),
          (0, 'They were miners once, caught by the last eruption. Free {n} of them.')],
         [(0, 'The spectres of {place} drift through walls and steal the warmth from your bones.'),
          (0, 'Banish {n} of them before the cold gets into everyone in {town}.')],
         [(0, 'My brother vanished in {place} last year.'), (1, "I'm sorry."),
          (0, "I hear his voice among the spectres. Lay {n} of them to rest, maybe he'll be one.")]],
}
ITEM = {
    'beach': [[(0, 'A wave knocked my satchel over and the {mobs} scuttled off with my {items}.'),
               (0, 'They hide them in their burrows along {place}. Bring me {n} back.')],
              [(0, 'The {mobs} of {place} collect shiny things.'), (1, 'Like what?'),
               (0, 'Like my {items}. Get {n} of them back for me.')]],
    'village': [[(0, 'The {mobs} have been dragging my {items} into the walls of {town}.'),
                 (0, 'I need {n} of them back before market day.')],
                [(0, 'I keep my {items} in the cellar.'), (0, 'Kept. The {mobs} got in. Get me {n} back, please.')]],
    'forest': [[(0, 'I dropped my {items} on the trail through {place}, and the {mobs} took them back to their nests.'),
                (0, 'Bring me {n}, please.')],
               [(0, 'The {mobs} of {place} raided my camp and carried off my {items}.'), (1, 'All of them?'),
                (0, 'Every last one. I only need {n} back to get by.')],
               [(0, "I'm taking {items} to {town}, but the {mobs} in {place} ambushed me."),
                (0, 'Get {n} back and the trip is saved.')]],
    'desert': [[(0, 'My caravan crossed {place} with a crate of {items}.'), (0, 'The {mobs} took the lot. Bring back {n}.')],
               [(0, 'The {mobs} of {place} bury what they steal in the sand.'),
                (0, 'My {items} are down there somewhere. Dig up {n} for me.')],
               [(0, "I'm lost in {place}, my water's gone, and the {mobs} took my {items} too."),
                (1, "I'll help."), (0, 'Bless you. {N} of them, and I can trade my way home to {town}.')]],
    'volcano': [[(0, 'I came to {place} to trade {items} with the fire priests.'),
                 (0, 'The {mobs} took them before I reached the temple. Get {n} back.')],
                [(0, 'The {mobs} of {place} guard a hoard of stolen goods.'), (1, 'Anything of yours?'),
                 (0, 'My {items}. They\'re no use in the heat, but they\'re mine. Bring back {n}.')]],
}
FLAVOUR = {   # an optional extra line about what the section borders
    'volcano': ['Ash keeps blowing in from the volcano, and it only makes them angrier.'],
    'beach': ['They come up from the shore when the tide is out.'],
    'lagoon': ['They come up from the lagoon when the water is low.'],
    'village': ["It's only a short walk from {town}, too."],
    'desert': ['The heat from the desert makes them restless.'],
}
KILL_WAIT = ["Come back when you've dealt with %count% of them.", 'Only %count% of them. You can do it.',
             'Off you go, %count% should be enough.']
KILL_ASK = ['Have you defeated %count% %name%s yet?', 'How many %name%s so far? I need %count%.',
            'Still %name%s everywhere. Have you beaten %count%?']
ITEM_WAIT = ['Bring me all %count% of them.', '%count% of them, from the %name2%s.', 'Just %count%, that is all I ask.']
ITEM_ASK = ['Do you have the %count% %name%s yet?', 'Any luck finding my %count% %name%s?',
            'Have the %name2%s given up my %name%s yet?']
KILL_DONE = {
    2: ['The tideline is mine again. Thank you!', 'Not a pinch all morning. Wonderful.'],
    1: ['The grain is safe, and so are my toes. Thanks!', 'Quiet floorboards at last.'],
    5: ['I can walk without watching my feet again. Thank you.', 'Not a hiss to be heard.'],
    4: ['That will teach them. The trail is safe again!', 'The goblins have packed up and run. Well done.'],
    6: ['The sky is clear and the birds are singing again.', 'Not a single bat last night!'],
    3: ['The bones are quiet again. Thank you.', 'Back in the ground where they belong.'],
    8: ['The ogres have fled. The wells can be rebuilt.', 'You beat ogres? Remind me never to annoy you.'],
    7: ['The old army can rest at last.', 'Their march is over. Thank you.'],
    9: ['No more staring. I might finally sleep.', 'The volcano has stopped watching us.'],
    12: ['The knights fall back into the smoke. Brave work!', 'Their oath is broken, and so are they.'],
    11: ['The wailing has stopped. They are at peace.', 'The cold has lifted. Thank you, friend.'],
}
ITEM_DONE = ['My %name%s! I never thought I would see them again.', 'All %count%! You have my thanks.',
             'Wonderful, these are exactly the ones they took.']
SUMMARY_KILL = {2: 'Drive %count% %name%s off {place}', 1: 'Clear %count% %name%s out of {town}',
                5: 'Clear %count% %name%s out of {place}', 4: 'Teach %count% %name%s of {place} a lesson',
                6: 'Thin out %count% %name%s over {place}', 3: 'Put %count% %name%s of {place} to rest',
                8: 'Drive off %count% %name%s in {place}', 7: 'Bring down %count% %name%s of the old army',
                9: 'Close %count% %name%s over {place}', 12: 'Defeat %count% %name%s of {place}',
                11: 'Banish %count% %name%s from {place}'}
SUMMARY_ITEM = 'Recover %count% {items} from the %name2%s of {place}'


def cap(t):
    return t[:1].upper() + t[1:]


def fill(t, **kw):
    kw['N'] = cap(kw.get('n', ''))
    for k, v in kw.items(): t = t.replace('{' + k + '}', str(v))
    return cap(t)


def kill_dialogue(s, mob, plc, town):
    kw = dict(place=plc, town=town, mob=MOB[mob], mobs=plural(MOB[mob]), n=NUM[KILL_COUNT])
    offer = [[sp, fill(t, **kw)] for sp, t in rnd.choice(KILL[mob])]
    fl = [n_ for n_ in s['near'] if n_ in FLAVOUR and n_ != s['area']] if s['area'] != 'village' else []
    if fl and rnd.random() < 0.5: offer.append([0, fill(rnd.choice(FLAVOUR[rnd.choice(fl)]), **kw)])
    return [offer, [[0, rnd.choice(KILL_WAIT)]], [[0, rnd.choice(KILL_ASK)]], [[0, rnd.choice(KILL_DONE[mob])]]], \
        fill(SUMMARY_KILL[mob], **kw)


def item_dialogue(s, area, mob, item, cnt, plc, town):
    kw = dict(place=plc, town=town, mob=MOB[mob], mobs=plural(MOB[mob]), item=item, items=plural(item), n=NUM[cnt])
    offer = [[sp, fill(t, **kw)] for sp, t in rnd.choice(ITEM['beach' if area == 'lagoon' else area])]
    return [offer, [[0, rnd.choice(ITEM_WAIT)]], [[0, rnd.choice(ITEM_ASK)]], [[0, rnd.choice(ITEM_DONE)]]], \
        fill(SUMMARY_ITEM, **kw)


# ---------------------------------------------------------------- build
written = json.load(open(p_written)) if os.path.exists(p_written) else {'quests': [], 'entities': {}}
new_quests, new_dialogue, new_summary, entities = {}, {}, {}, {}
_mobnames = {k.lower() for k in MOBS} | set(MOB.values())
loot_pool = [i for i, it in enumerate(LOOT) if it['name'].lower() not in _mobnames]
rnd.shuffle(loot_pool)
by_area = {}
report = []
for s in spots['npcs']:
    p = part_of(s['x'], s['y'])
    if p is None: print('  no map part holds the NPC at', s['x'], s['y']); continue
    nm_part, mi, wx, wy = p[0], p[1], p[2], p[3]
    area = 'lagoon' if s.get('lagoon') else s['area']
    i_ = by_area.get(s['area'], 0); by_area[s['area']] = i_ + 1
    mobs = s['mobs']
    kill_mob = mobs[i_ % len(mobs)]
    item_mob = mobs[(i_ + 1) % len(mobs)]
    ent = entities.setdefault(nm_part, [])
    eid = FIRST_ID + len(ent)
    name = new_name()
    ent.append({'id': eid, 'type': 'npcmove', 'kind': rnd.randint(1, 56),
                'x': (s['x'] - wx) * 16 + 8, 'y': (s['y'] - wy) * 16 + 8, 'name': name})
    town = nearest_town(s)['name']
    plc = town if s['area'] == 'village' else place(s, area)
    lv = [s['minLevel'], s['maxLevel']]
    base = f'1{mi:04d}{eid:06d}'
    q1, q2 = base + '01', base + '02'
    new_quests[q1] = {'name': f'{name}: kill {MOB_KEY[kill_mob]}', 'type': 1, 'level': 0,
                      'object': {'type': 2, 'kind': kill_mob, 'count': KILL_COUNT, 'level': lv}}
    new_dialogue[q1], new_summary[q1] = kill_dialogue(s, kill_mob, plc, town)
    item = loot_pool[len(new_quests) // 2 % len(loot_pool)]
    cnt = rnd.randint(*ITEM_COUNT)
    new_quests[q2] = {'name': f'{name}: get {LOOT[item]["name"]}', 'type': 2, 'level': 0,
                      'object': {'type': 2, 'kind': item_mob, 'level': lv},
                      'object2': {'type': 4, 'kind': item, 'count': cnt, 'chance': ITEM_CHANCE}}
    new_dialogue[q2], new_summary[q2] = item_dialogue(s, area, item_mob, item_words(LOOT[item]['name']), cnt, plc, town)
    report.append((nm_part, eid, name, s['area'], f'{lv[0]}-{lv[1]}', MOB_KEY[kill_mob],
                   f'{cnt} {LOOT[item]["name"]} from {MOB_KEY[item_mob]}'))


# ---------------------------------------------------------------- write, keeping the rest of each file as it is
def members(text, start):
    """(key, key_start, value_end) of every member of the JSON object whose '{' is at text[start]."""
    dec = json.JSONDecoder(); out = []; i = start + 1
    ws = re.compile(r'[\s,]*')
    while True:
        i = ws.match(text, i).end()
        if text[i] == '}': return out, i
        k, j = dec.raw_decode(text, i)
        j = re.compile(r'\s*:\s*').match(text, j).end()
        _, e = dec.raw_decode(text, j)
        out.append((k, i, e)); i = e


def rewrite(text, start, drop, add, indent, eol):
    """The object at text[start] without the keys in `drop`, with `add` ({key: formatted value}) appended after its
    last member. Everything else, the whitespace between the members included, stays exactly as it was."""
    mem, close = members(text, start)
    out = [text[:start + 1] + (text[start + 1:mem[0][1]] if mem else eol + indent)]
    first = True
    for n, (k, a, b) in enumerate(mem):
        if k in drop: continue
        if not first: out.append(text[mem[n - 1][2]:a])          # the separator that came before this member
        out.append(text[a:b]); first = False
    for k, v in add.items():
        if not first: out.append(',' + eol + indent)
        out.append(f'"{k}": {v}'); first = False
    out.append(text[mem[-1][2]:close + 1] if mem else eol + '}')
    new = ''.join(out)
    return new + text[close + 1:], None


def fmt_quest(q):
    lines = []
    for k, v in q.items():
        lines.append(f'\t\t"{k}": ' + json.dumps(v).replace(', "', ', "'))
    return '{\n' + ',\n'.join(lines) + '\n\t}'


def fmt_dialogue(stages):
    out = ['[']
    for si, st in enumerate(stages):
        out.append('        [')
        out.append(',\n'.join(f'          [{sp}, {json.dumps(t, ensure_ascii=False)}]' for sp, t in st))
        out.append('        ]' + (',' if si < len(stages) - 1 else ''))
    out.append('      ]')
    return '\n'.join(out)


drop = set(written.get('quests', []))
# quests.json (tab-indented)
qt = open(p_quests, encoding='utf-8').read(); eol_q = '\r\n' if '\r\n' in qt else '\n'
add_q = {k: fmt_quest(v).replace('\n', eol_q) for k, v in new_quests.items()}
qt, _ = rewrite(qt, qt.index('{'), drop, add_q, '\t', eol_q)
json.loads(qt)
# lang.json: EN.QUESTS and EN.QUEST_SUMMARY
lt = open(p_lang, encoding='utf-8').read(); eol_l = '\r\n' if '\r\n' in lt else '\n'
for key, add in (('QUESTS', {k: fmt_dialogue(v).replace('\n', eol_l) for k, v in new_dialogue.items()}),
                 ('QUEST_SUMMARY', {k: json.dumps(v, ensure_ascii=False) for k, v in new_summary.items()})):
    root, _ = members(lt, lt.index('{'))
    en = [m for m in root if m[0] == 'EN'][0]
    en_start = lt.index('{', en[1] + 4)
    mem, _ = members(lt, en_start)
    k_, a_, b_ = [m for m in mem if m[0] == key][0]
    obj = lt.index('{', a_ + len(key) + 2)
    lt, _ = rewrite(lt, obj, drop, add, '      ', eol_l)
json.loads(lt)
# entity.json per map part (other records kept; this script's records from last time removed)
for nm_part in sorted(set(list(entities) + list(written.get('entities', {})))):
    p_ent = os.path.join(ROOT, 'gameserver', 'data', 'maps', nm_part, 'entity.json')
    old = json.load(open(p_ent)) if os.path.exists(p_ent) else []
    mine = set(written.get('entities', {}).get(nm_part, []))
    ours = entities.get(nm_part, [])
    ids = {e['id'] for e in ours}
    keep = [e for e in old if e.get('id') not in mine and e.get('id') not in ids]
    if not keep and not ours:
        if os.path.exists(p_ent): json.dump([], open(p_ent, 'w'))
        continue
    os.makedirs(os.path.dirname(p_ent), exist_ok=True)
    json.dump(keep + ours, open(p_ent, 'w'), indent=2)
open(p_quests, 'w', encoding='utf-8', newline='').write(qt)
open(p_lang, 'w', encoding='utf-8', newline='').write(lt)
json.dump({'quests': sorted(new_quests), 'entities': {k: [e['id'] for e in v] for k, v in entities.items()}},
          open(p_written, 'w'), indent=1)

print(f'{len(report)} quest NPCs, {len(new_quests)} quests (removed {len(drop)} from the last run)')
print(f'  towns: ' + ', '.join(f"{t['name']}{' (start)' if i == 0 else ''}" for i, t in enumerate(towns)))
for r in report:
    print('  {:14s} id {:3d} {:10s} {:8s} lv {:6s} kill {:12s} get {}'.format(*r))
print('Now run godot-client/sync-assets-win.bat (or -linux.sh) so the Godot client gets the new quests and dialogue.')
