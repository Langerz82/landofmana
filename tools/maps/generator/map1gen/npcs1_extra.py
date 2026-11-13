"""map1 extra quest NPCs: one more walking NPC in every outdoor mob area, each with two quests.

Companion to npcs1.py (which places one NPC per section). For every outdoor mob area in
gameserver/data/maps/map1/entityarea.json (the map's one file for all its parts, in full-map coordinates; the
interiors part, map1_int, is skipped), this script:

- adds an `npcmove` NPC with a new unique name at a random walkable spot inside that mob area, to
  gameserver/data/maps/map1/entity.json (the first free ids from 1 up, unique in the file; other records are kept);
- gives it two quests, in random order (quest 01 / 02):
    a kill quest  - kill 8-12 of one of the area's mobs, at the area's mob levels
    an item quest - get 3-5 of a random itemloot item from another of the area's mobs
- writes a short storyline for each (shared/data/lang.json QUESTS and QUEST_SUMMARY): two or three lines
  about the monsters and the area (town / forest / desert / volcano / beach), and its own thank-you line.
  Every storyline is used once per map, so no two quests share dialogue.

Running it again first removes everything it wrote last time (listed in tools/maps/data/map1_npcs_extra_written.json).
Run it after npcs1.py (npcs1.py keeps these records). Afterwards run godot-client/sync-assets-win.bat (or -linux.sh).

    python npcs1_extra.py              # seed 11
    python npcs1_extra.py --seed 3     # other spots, names, items and storylines
"""
import os, sys, json, argparse, re, random
from collections import deque

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'common'))
from playername import add_player_name
from mapdata import MapData
ROOT = os.path.normpath(os.path.join(HERE, '..', '..', '..', '..'))
DATA = os.path.normpath(os.path.join(HERE, '..', '..', 'data'))
ap = argparse.ArgumentParser(description='Extra quest NPCs for map1, one per mob area')
ap.add_argument('--map', default='map1')
ap.add_argument('--seed', type=int, default=11)
args = ap.parse_args()
PFX = args.map
rnd = random.Random(args.seed)
FIRST_ID = 1                # entity ids: the first free one from here (unique in the map's entity.json)
KILL_COUNTS = (8, 10, 12)
ITEM_COUNT = (3, 5)
ITEM_CHANCE = 15
MIN_NPC_GAP = 12            # tiles between NPCs, where the area allows it

p_quests = os.path.join(ROOT, 'shared', 'data', 'quests.json')
p_lang = os.path.join(ROOT, 'shared', 'data', 'lang.json')
p_list = os.path.join(ROOT, 'gameserver', 'maps', 'maplist.json')
p_spots = os.path.join(DATA, PFX + '_npcs.json')
p_written = os.path.join(DATA, PFX + '_npcs_extra_written.json')
p_main_written = os.path.join(DATA, PFX + '_npcs_written.json')

spots = json.load(open(p_spots))
maplist = json.load(open(p_list))['maps']
maplist = {int(g[3:]) * 100 + i: nm for g, files in maplist.items() if g[3:].isdigit() for i, nm in enumerate(files)}
MOBS = json.load(open(os.path.join(ROOT, 'shared', 'data', 'mobs.json')))
MOB_KEY = {v['kind']: k for k, v in MOBS.items()}
LOOT = json.load(open(os.path.join(ROOT, 'shared', 'data', 'itemloot.json')))
written = json.load(open(p_written)) if os.path.exists(p_written) else {'quests': [], 'entities': []}
# the ids this script gave its NPCs last time (a list; the older per-part {part: [ids]} is from before the
# map's files were merged, and its ids no longer mean anything)
prev_ids = set(written['entities']) if isinstance(written.get('entities'), list) else set()
md = MapData(ROOT, PFX)

# ---------------------------------------------------------------- names (unique against everything else)
used = set(json.load(open(os.path.join(ROOT, 'gameserver', 'data', 'npc_names.json'))))
_prev = set(written['quests'])
for _k, q in json.load(open(p_quests)).items():
    if _k not in _prev: used.add(q.get('name', '').split(':')[0])
A = ['Bra', 'Cor', 'Del', 'Fen', 'Gar', 'Hal', 'Isa', 'Jor', 'Kel', 'Lor', 'Mar', 'Nor', 'Orr', 'Per', 'Quin', 'Ros',
     'Sel', 'Tor', 'Ul', 'Vor', 'Wen', 'Yar', 'Zel', 'Ash', 'Bel', 'Cal', 'Dor', 'Eld', 'Fal', 'Gwen', 'Hob', 'Mil',
     'Tam', 'Rhi', 'Sab', 'Thea', 'Bram', 'Odo', 'Pip', 'Wil', 'Ani', 'Bri', 'Edd', 'Ivo', 'Lu', 'Nel', 'Ost', 'Sten']
B = ['an', 'en', 'ric', 'wyn', 'dor', 'ia', 'ella', 'os', 'ius', 'eth', 'ard', 'in', 'ara', 'ek', 'old', 'ira', 'ton',
     'ley', 'mund', 'isa', 'o', 'ette', 'ber', 'win', 'ach', 'elle', 'oric', 'una', 'vin', 'ald']


def new_name():
    for _ in range(5000):
        n = rnd.choice(A) + rnd.choice(B)
        if n not in used and 4 <= len(n) <= 9 and not re.search(r'([aeiou])\1|[aeiou]{3}|[^aeiou]{3}', n.lower()):
            used.add(n); return n
    raise RuntimeError('ran out of names')


# the same town names npcs1.py gives (its first use of Random(seed 5) is this shuffle)
TOWN_NAMES = ['Millbrook', 'Ashby', 'Fernhollow', 'Saltmere', 'Oakhaven', 'Thornbury', 'Duskwater', 'Briarwick']
random.Random(5).shuffle(TOWN_NAMES)
towns = [dict(t, name=TOWN_NAMES[i]) for i, t in enumerate(spots['towns'])]

# ---------------------------------------------------------------- words
MOB = {1: 'rat', 2: 'crab', 3: 'skeleton', 4: 'goblin', 5: 'snake', 6: 'bat', 7: 'armored skeleton', 8: 'ogre',
       9: 'floating eye', 10: 'wizard', 11: 'spectre', 12: 'death knight'}
DESC = {   # how the NPCs describe each monster (plural)
    1: ['fat grey rats', 'bald-tailed rats', 'bold, sharp-toothed rats'],
    2: ['snapping red crabs', 'shield-sized crabs', 'sideways-scuttling crabs', 'barnacled old crabs'],
    3: ['rattling skeletons', 'sun-bleached skeletons', 'grinning skeletons', 'sand-choked skeletons'],
    4: ['cackling, knife-waving goblins', 'knee-high green goblins', 'sneaky, boot-stealing goblins',
        'mud-smeared goblins', 'tin-helmeted goblins'],
    5: ['hissing green snakes', 'fat brown snakes', 'wrist-thick snakes', 'yellow-eyed striped snakes',
        'quick little adders'],
    6: ['leather-winged bats', 'shrieking cave bats', 'red-eyed bats', 'crow-sized bats', 'squeaking fruit bats'],
    7: ['rust-mailed armored skeletons', 'tireless marching armored skeletons', 'notch-bladed armored skeletons'],
    8: ['lumbering ogres', 'tusked ogres', 'towering ogres', 'club-swinging ogres'],
    9: ['unblinking floating eyes', 'bloodshot floating eyes', 'smoke-trailing floating eyes'],
    11: ['wailing spectres', 'pale, ashen spectres', 'cold, drifting spectres'],
    12: ['black-plated death knights', 'burning-eyed death knights', 'silent death knights'],
}
NUM = {3: 'three', 4: 'four', 5: 'five', 8: 'eight', 10: 'ten', 12: 'twelve'}
BIOME_BY_MOBS = {'9,11,12': 'volcano', '3,7,8': 'desert', '4,5,6': 'forest', '1,5': 'village', '2': 'beach'}
LETTER = {'V': 'volcano', 'D': 'desert', 'f': 'forest', 'T': 'village', 'B': 'beach', 'L': 'lagoon'}
NOUN = {'beach': ['shore', 'beach', 'coast'], 'lagoon': ['lagoon', 'lagoon shore'],     # singular: lines say '{place} is'
        'forest': ['forest', 'woodland', 'wildwood'], 'desert': ['desert', 'wasteland', 'sand sea'],
        'volcano': ['volcano', 'lava field', 'ash slope']}
ITEM_PLURAL = {'dice': 'dice', 'cheese': 'cheeses', 'broken glass': 'shards of broken glass', 'bread': 'loaves of bread',
               'mort and pestle': 'mortars and pestles', 'clever': 'cleavers', 'squid': 'squid', 'gumnut': 'gumnuts'}

# ---------------------------------------------------------------- storylines
# (offer lines, thank-you line). Speaker 0 is the NPC, 1 the player. {dmobs} is a description of the quest's
# monsters, {mobs} their plain name, {place} the area, {town} the nearest town, {n}/{N} the count in words,
# {items} the item. Each storyline is used at most once.
KILL = {
 'forest': [
  ([(0, "I'm the forester of {place}, and the {dmobs} have chased my apprentices home."), (0, 'Clear out {n} of them so we can get back to work.')], 'My apprentices will be back by morning. Thank you.'),
  ([(0, 'I planted a hundred saplings in {place} this spring.'), (0, 'The {dmobs} trampled every one. Deal with {n} for me.')], 'Next spring the saplings will have a chance.'),
  ([(0, 'My wedding is in the glade at {place} next week.'), (1, 'Congratulations!'), (0, 'Not if the {dmobs} crash it. Get rid of {n}.')], "The glade is ready. You're invited, of course!"),
  ([(0, 'A minstrel from {town} lost his voice screaming at the {dmobs} in {place}.'), (0, 'Silence {n} of them before he loses his lute too.')], "He's singing again. Badly, but singing."),
  ([(0, 'I gather moss from the old oaks of {place} for the healers of {town}.'), (0, 'The {dmobs} make every trip a gamble. Thin out {n}.')], 'The healers will have their moss. Well done.'),
  ([(0, 'The {dmobs} of {place} wrecked the hives I keep there.'), (1, 'All of them?'), (0, 'Every single one. Kill {n} of them for me.')], 'My bees can rest easy now.'),
  ([(0, 'My mule bolted the moment it saw the {dmobs} on the trail through {place}.'), (0, "I'll never get him back while they're about. Drive off {n}.")], 'There he is! Come here, you silly mule.'),
  ([(0, "I've been charting the paths of {place} for the map-makers of {town}."), (0, 'Every path I draw, the {dmobs} block it. Clear {n} of them.')], "My map is finished. I'll put your name in the corner."),
  ([(0, 'The shrine in {place} has gone unvisited since the {dmobs} moved in.'), (0, 'Clear {n} of them so the pilgrims can return.')], 'The first pilgrims arrived this morning. Bless you.'),
  ([(0, 'Mushroom season in {place} only lasts a fortnight.'), (0, 'And the {dmobs} have claimed the best patches. Get rid of {n}.')], "Baskets full! You'll have mushroom soup tonight."),
  ([(0, "I'm writing a book about the {dmobs} of {place}."), (1, 'Sounds interesting.'), (0, 'It was, until they ruined my notes. End {n} of them. For science.')], "I'll call the last chapter 'The Hero Arrives'."),
  ([(0, "The old hermit of {place} hasn't been seen since the {dmobs} surrounded his hut."), (0, 'Break through them. {N} should do it.')], "The hermit's fine. Grumpy, but fine."),
  ([(0, 'I race my cart through {place} every week with letters for {town}.'), (0, 'The {dmobs} keep leaping at the wheels. Get rid of {n}.')], 'Letters are moving again. Thank you!'),
  ([(0, 'My grandmother says the {dmobs} of {place} only grow bolder when nobody fights back.'), (0, 'Prove her right. Kill {n}.')], "Grandmother says you'll do. High praise."),
  ([(0, 'Last night the {dmobs} of {place} kept the whole camp awake.'), (0, "I'm too tired to fight. Please, deal with {n} of them.")], 'Finally, I can sleep. Thank you.'),
  ([(0, "I'm a lumberjack, and I've had enough."), (0, 'The {dmobs} of {place} swarm every log I fell. Put an end to {n}.')], 'Timber! And no pests underfoot.'),
  ([(0, 'The children of {town} dared each other to walk through {place}.'), (0, 'Not one came back without a scare from the {dmobs}. Get rid of {n} before someone gets hurt.')], "The children are safe, and they'll want to hear all about it."),
  ([(0, "My father's old axe is stuck in a stump in {place}."), (0, 'The {dmobs} nest right around it. Clear {n} so I can pull it free.')], 'It came free on the first tug. Thank you.'),
  ([(0, 'The stream through {place} is the only clean water nearby.'), (0, 'The {dmobs} gather at its banks every evening. Drive off {n}.')], 'We can fill our buckets without fear.'),
  ([(0, "I'm a painter, and nowhere is lovelier than {place}."), (1, "So what's wrong?"), (0, 'The {dmobs} keep wandering into my paintings. Remove {n} of them.')], 'My canvas is peaceful at last.'),
  ([(0, 'The tax collector from {town} refuses to come through {place}.'), (1, "Isn't that good news?"), (0, 'Not when he docks my pay for it. Kill {n} of the {mobs}.')], "Ah, he's back. Lucky me. Thank you anyway."),
  ([(0, 'Our hunting party went into {place} and came back with nothing but bites.'), (0, 'The {dmobs} have scared off all the deer. Clear out {n}.')], 'The deer are back. We eat tonight!'),
  ([(0, 'I keep a lantern lit in {place} for lost travellers.'), (0, 'The {dmobs} keep knocking it over. Deal with {n} of them.')], 'My lantern burns bright again.'),
  ([(0, 'My sister went foraging in {place} at dawn.'), (0, 'She came back running from the {dmobs}. Make {n} of them pay.')], 'My sister says thank you, and so do I.'),
  ([(0, 'The elves who once lived in {place} warned us about the {dmobs}.'), (0, "Nobody listened. Now it's up to you. Defeat {n}.")], 'The elves would be proud of you.'),
  ([(0, 'I sell firewood in {town}, but {place} is crawling with {dmobs}.'), (0, 'No firewood means cold houses. Thin them out by {n}.')], 'Hearths will be warm this winter.'),
  ([(0, 'Every year we hold a harvest dance in {place}.'), (0, 'This year the {dmobs} got there first. Clear {n} of them.')], "The music's starting. Thank you!"),
  ([(0, 'A wandering knight promised to deal with the {dmobs} of {place}.'), (1, 'What happened?'), (0, 'He saw them and remembered urgent business. Will you defeat {n}?')], 'A true hero. Unlike some knights I could name.'),
  ([(0, 'I set rabbit traps in {place}, but the {dmobs} find them first.'), (0, 'Get rid of {n} so I catch something besides trouble.')], 'A rabbit in every trap. Many thanks.'),
  ([(0, 'The old bridge in {place} creaks under all the {dmobs} that gather there.'), (0, 'Drive off {n} before it collapses.')], 'The bridge holds. And so do my nerves.'),
  ([(0, 'The woodcarvers of {town} need the white birch from {place}.'), (0, 'But the {dmobs} have settled in the birch grove. Clear {n}.')], 'The carvers will make you something special.'),
  ([(0, "I'm the beekeeper's apprentice. I was meant to guard her hives in {place}."), (0, 'I hid from the {dmobs} instead. Please, deal with {n} before she finds out.')], "She'll never know. Our secret."),
  ([(0, 'Someone in {town} said the {dmobs} of {place} are harmless.'), (1, 'Are they?'), (0, 'Ask my left ankle. Kill {n} of them.')], 'My ankle and I thank you.'),
  ([(0, "I've lived in {place} for forty years and never seen so many {dmobs}."), (0, 'Something has stirred them up. Cut their numbers by {n}.')], 'Back to how it was when I was young.'),
  ([(0, 'The scouts of {town} train in {place}.'), (0, 'The {dmobs} keep ambushing the recruits. Show them how it is done: defeat {n}.')], 'The recruits all want to be you now.'),
  ([(0, "I'm searching {place} for a rare blue flower."), (0, "I'd have found it by now if the {dmobs} left me alone. Get rid of {n}.")], 'Found it! It was by my feet all along.'),
  ([(0, "My goats wandered into {place} and won't come out."), (0, "They're too scared of the {dmobs}. Clear {n} and they'll find their way home.")], 'All goats accounted for. Thank you!'),
  ([(0, 'The well-diggers of {town} want to sink a new well in {place}.'), (0, 'The {dmobs} keep chasing them out. Drive off {n}.')], 'Fresh water at last.'),
  ([(0, 'I lost a bet in {town}, and now I have to camp a night in {place}.'), (1, 'Scared?'), (0, 'Of the {dmobs}? Terrified. Get rid of {n} first.')], "I'll win the bet after all."),
  ([(0, 'The {dmobs} of {place} have stripped the berry bushes we meant for market.'), (0, "Cut down {n} of them before there's nothing left.")], 'Berries for everyone. Thank you!'),
  ([(0, 'A storm blew down half of {place}, and the {dmobs} poured out of the fallen trees.'), (0, 'Help us clean up. Start with {n} of them.')], 'One storm at a time. Thank you.'),
  ([(0, "I promised my son I'd show him the great oak of {place}."), (0, 'Not while the {dmobs} lurk around it. Deal with {n}.')], "We'll go at dawn. He'll be so excited."),
  ([(0, 'The druid of {place} asked me to find someone brave.'), (1, 'Here I am.'), (0, 'Good. The {dmobs} are upsetting the balance. Remove {n}.')], 'The forest breathes easier. The druid thanks you.'),
  ([(0, 'The charcoal burners of {place} have let their kilns go cold.'), (0, 'The {dmobs} come out of the smoke at them. Clear {n}.')], 'The kilns are glowing again.'),
  ([(0, 'I teach the children of {town} the names of every tree in {place}.'), (0, 'Lessons stopped when the {dmobs} came. Get rid of {n}.')], 'Class is back in session. Thank you.'),
 ],
 'desert': [
  ([(0, 'Our caravan has crossed {place} for twenty years.'), (0, 'This year the {dmobs} blocked the oasis. Clear {n} of them.')], 'The camels can drink again.'),
  ([(0, 'I dig wells in {place}.'), (0, 'And every well I dig, the {dmobs} fill with sand. Stop {n} of them.')], 'Water at last. Thank you.'),
  ([(0, 'The sun in {place} is cruel enough.'), (0, 'With the {dmobs} on top of it, nobody crosses. Defeat {n}.')], 'The road across the sands is open.'),
  ([(0, 'My brother went to sell spices beyond {place}.'), (1, 'Has he returned?'), (0, 'The {dmobs} turned him back. Clear {n} so he can try again.')], "He'll make it this time."),
  ([(0, "The old fort in {place} was my family's."), (0, 'Now the {dmobs} hold it. Take down {n}.')], 'Home again, after all these years.'),
  ([(0, 'I map the dunes of {place}, but they move every night.'), (0, "The {dmobs} don't help. Get rid of {n}.")], "At least the dunes don't bite."),
  ([(0, 'The salt traders of {town} pay well for a safe road through {place}.'), (0, 'The {dmobs} make sure there is none. Defeat {n}.')], 'The salt flows again.'),
  ([(0, 'A sandstorm uncovered an ancient tomb in {place}.'), (0, 'The {dmobs} came pouring out. Put {n} down.')], 'The tomb is quiet now.'),
  ([(0, "I'm a scholar studying the ruins of {place}."), (0, 'The {dmobs} object to my studies. Overrule {n} of them.')], 'My research can continue.'),
  ([(0, 'Nomads used to camp in {place} every winter.'), (0, 'The {dmobs} drove them away. Clear {n} so they come back.')], "The nomads' fires burn again."),
  ([(0, 'My camel refuses to walk past the {dmobs} of {place}.'), (1, 'Smart camel.'), (0, 'Smart, but stubborn. Remove {n}.')], 'Onwards, camel!'),
  ([(0, "I've tended a cactus garden in {place} for years."), (0, 'The {dmobs} keep trampling it. Stop {n}.')], 'My cactuses will flower again.'),
  ([(0, 'The prospectors of {town} found gold in {place}.'), (0, 'Then the {dmobs} found the prospectors. Defeat {n}.')], 'Back to digging! Thank you.'),
  ([(0, "I'm guiding pilgrims to the sun temple across {place}."), (0, 'The {dmobs} wait along the route. Clear {n}.')], 'The pilgrims sing your praises.'),
  ([(0, 'The {dmobs} of {place} have learned to lie hidden under the sand.'), (0, 'I stepped on one yesterday. Dig out {n} of them.')], "I'll watch my step either way."),
  ([(0, 'My shade tent in {place} is the only shelter for miles.'), (0, 'The {dmobs} keep tearing it down. Deal with {n}.')], 'Shade for everyone. Thank you.'),
  ([(0, 'The glassblowers of {town} need the fine sand of {place}.'), (0, 'The {dmobs} guard the best dunes. Clear {n}.')], 'Beautiful glass, thanks to you.'),
  ([(0, 'Last night I saw the {dmobs} of {place} marching by moonlight.'), (1, 'Where to?'), (0, 'Toward the road. Stop {n} before they get there.')], 'The road is safe tonight.'),
  ([(0, 'I sell water to travellers crossing {place}.'), (0, 'No travellers come while the {dmobs} roam. Defeat {n}.')], 'Water for sale! Thanks to you.'),
  ([(0, 'My father fell to the {dmobs} of {place}.'), (0, "I'm not strong enough to avenge him. Will you defeat {n}?")], 'Father can rest. Thank you.'),
  ([(0, 'The guard of {town} sent me to scout {place}.'), (0, 'I counted far too many {dmobs}. Bring that down by {n}.')], 'My report will mention you.'),
  ([(0, 'A bard wrote a song about the {dmobs} of {place}.'), (0, "It's a terrifying song. Let's change the ending. Defeat {n}.")], "I'll write the new verse myself."),
  ([(0, "I'm hunting a rare sand lizard in {place}."), (0, 'The {dmobs} keep scaring it off. Clear {n}.')], 'There it is! Shh.'),
  ([(0, 'The oasis of {place} grows the sweetest dates.'), (0, 'The {dmobs} lurk beneath the palms. Drive off {n} of them.')], "Have a date. You've earned it."),
  ([(0, 'The midday heat makes the {dmobs} of {place} restless.'), (0, 'Restless means dangerous. Bring down {n}.')], "The heat's still here, but they aren't."),
  ([(0, 'I was robbed by bandits, then chased by the {dmobs} of {place}.'), (0, "I can't fix the bandits. Fix {n} of those.")], 'One problem solved.'),
  ([(0, 'The stargazers of {town} climb the dunes of {place} at night.'), (0, 'The {dmobs} climb them too. Clear {n}.')], 'Clear skies and clear dunes.'),
  ([(0, 'Our tribe buries its chiefs in {place}.'), (0, 'The {dmobs} desecrate the cairns. Defeat {n}.')], 'Our ancestors sleep in peace again.'),
 ],
 'volcano': [
  ([(0, 'The fire priests of {place} have been driven from their temple.'), (0, 'The {dmobs} hold it now. Defeat {n}.')], 'The priests return. The flame is pure again.'),
  ([(0, 'I mine obsidian on {place}.'), (0, 'The {dmobs} keep chasing me down the slopes. Stop {n} of them.')], 'Obsidian for everyone!'),
  ([(0, 'The lava of {place} glows brighter whenever the {dmobs} gather.'), (0, 'If it erupts, {town} is next. Cut down {n}.')], "The glow is fading. We're safe."),
  ([(0, 'I came to {place} to prove my courage.'), (1, "How's it going?"), (0, 'The {dmobs} proved I have none. Defeat {n} for me.')], "I'll tell everyone I helped."),
  ([(0, 'The ash of {place} buries my hut a little more each day.'), (0, 'Digging out is hard with the {dmobs} watching. Get rid of {n}.')], 'I can dig in peace now.'),
 ],
 'village': [
  ([(0, 'The {dmobs} have got into the grain store here in {town}.'), (0, "We'll go hungry by winter. Kill {n}.")], 'The grain is safe. Thanks!'),
  ([(0, 'The baker of {town} found {dmobs} in the dough this morning.'), (1, 'Disgusting.'), (0, "Nobody's buying bread. Clear out {n}.")], 'Fresh bread tomorrow, on me.'),
  ([(0, 'The {dmobs} of {town} have taken over the old well.'), (0, 'Clear {n} of them so we can draw water.')], 'Clean water, thank you.'),
  ([(0, 'The mayor of {town} offered a reward for {mobs}.'), (0, "I'd claim it, but I'm scared of them. Get {n} and we'll share.")], 'Half the reward is yours.'),
  ([(0, 'My cat ran away from the {dmobs} under my house in {town}.'), (0, 'Now I have {mobs} and no cat. Get rid of {n}.')], 'The cat came back!'),
  ([(0, 'The schoolhouse of {town} is closed because of {dmobs}.'), (0, 'The children are delighted. The parents are not. Clear {n}.')], 'Back to lessons. The children forgive you, eventually.'),
 ],
 'beach': [
  ([(0, 'The {dmobs} of {place} pinch anyone who walks the tideline.'), (0, 'Knock {n} of them back into the surf.')], 'The tideline is mine again.'),
  ([(0, 'I dig for clams on {place}.'), (1, 'Any luck?'), (0, 'The {dmobs} dig faster and pinch harder. Clear {n}.')], 'Clams for dinner!'),
  ([(0, 'My fishing boat is beached on {place}, and the {dmobs} have moved in.'), (0, 'Get rid of {n} so I can push off.')], 'Back to the sea!'),
  ([(0, 'The children of {town} love building sandcastles on {place}.'), (0, 'The {dmobs} knock them all down. Chase off {n}.')], 'The castles stand tall.'),
  ([(0, "I'm the lifeguard on {place}."), (1, 'Busy?'), (0, 'Saving people from {dmobs}, mostly. Help me out, defeat {n}.')], 'A quiet shift at last.'),
  ([(0, 'Turtles lay their eggs on {place} every summer.'), (0, 'The {dmobs} dig them up. Protect the nests and defeat {n}.')], 'The hatchlings will make it.'),
 ],
}
ITEM = {
 'forest': [
  ([(0, 'I was carrying {items} to {town} when the {dmobs} of {place} ambushed me.'), (0, 'Win back {n} of them for me.')], 'Now I can finish my trip.'),
  ([(0, 'The {dmobs} of {place} drag shiny things into their dens.'), (1, 'Like what?'), (0, 'Like my {items}. Bring me {n}.')], 'Exactly the ones they took!'),
  ([(0, 'My cart tipped over in {place} and my {items} went everywhere.'), (0, 'The {dmobs} grabbed them before I could. Fetch {n}.')], 'Back in the cart where they belong.'),
  ([(0, 'I trade {items} with the folk of {town}.'), (0, 'The {dmobs} in {place} keep raiding my stock. Get {n} back.')], 'Business is open again!'),
  ([(0, 'My late husband collected {items}.'), (0, 'The {dmobs} of {place} stole them from his old cabin. Recover {n}, please.')], 'He can rest now. Thank you.'),
  ([(0, 'The healer in {town} needs {items} for a cure.'), (0, 'The {dmobs} of {place} carry plenty. Bring back {n}.')], 'The healer will save lives with these.'),
  ([(0, 'I hid my {items} in a hollow log in {place}.'), (1, 'Smart.'), (0, 'Not really. The {dmobs} live in it now. Get me {n}.')], "Next time I'll pick a better log."),
  ([(0, 'A tinker in {town} pays well for {items}.'), (0, "The {dmobs} of {place} hoard them. Bring me {n} and we'll split the gold.")], 'Pleasure doing business.'),
  ([(0, 'My little brother traded our {items} to the {dmobs} of {place} for a pebble.'), (0, "Don't ask. Just get {n} back before mother notices.")], 'Mother will never know.'),
  ([(0, 'Our camp in {place} was raided overnight.'), (0, 'The {dmobs} made off with our {items}. Recover {n} of them.')], "Camp's back in order."),
  ([(0, "I'm a collector of curiosities, and {items} are my weakness."), (0, 'The {dmobs} of {place} have a fine supply. Bring me {n}.')], 'Splendid additions to my collection.'),
  ([(0, 'Every year the {dmobs} of {place} raid the festival stalls for {items}.'), (0, "This year, let's steal them back. {N} will do.")], 'The festival is saved!'),
  ([(0, 'I need {items} to pay off a debt in {town}.'), (0, 'The {dmobs} of {place} took mine. Bring {n} before the debt collector comes.')], 'Debt paid. I can breathe again.'),
  ([(0, 'The scholars of {town} want to study {items} found in the wild.'), (0, 'The {dmobs} of {place} seem to collect them. Gather {n}.')], 'The scholars will be thrilled.'),
  ([(0, 'I sleepwalked into {place} last night.'), (1, 'And?'), (0, 'I woke up without my {items}. The {dmobs} must have them. Find {n}.')], 'No more sleepwalking for me.'),
  ([(0, "My shop's sign says 'finest {items} in {town}'."), (0, 'Thanks to the {dmobs} of {place}, I have none. Restock me with {n}.')], 'The sign tells the truth again.'),
  ([(0, 'The woodcutters of {place} dropped their {items} fleeing the {dmobs}.'), (0, "Gather {n} and I'll return them.")], 'The woodcutters will buy you a drink.'),
  ([(0, 'A crow showed me where the {dmobs} of {place} stash their loot.'), (0, "It's full of my {items}. Get {n} back.")], 'Remind me to thank that crow.'),
  ([(0, "I'm getting married, and my dowry was {items}."), (0, 'The {dmobs} of {place} stole it on the road. Recover {n}.')], 'The wedding is back on!'),
  ([(0, 'The {dmobs} of {place} snatched my {items} right out of my hands.'), (0, "I didn't even see them coming. Bring me {n}.")], "I'll hold on tighter this time."),
  ([(0, 'Old Mother Bryn in {town} reads fortunes with {items}.'), (0, 'The {dmobs} of {place} stole hers. Bring {n}.')], 'She says your future looks bright.'),
  ([(0, 'The {dmobs} of {place} must be the best thieves in the land.'), (1, 'Why?'), (0, 'They took my {items} while I watched. Get {n} back.')], 'Better thieves than me, at least.'),
  ([(0, 'My pack burst on the muddy trail through {place}.'), (0, 'The {dmobs} carried off my {items}. Fetch {n}.')], 'Mended pack, full pack.'),
  ([(0, 'The leader of the {dmobs} in {place} wears my {items} like a crown.'), (0, 'Bring me {n} of them and humble it.')], 'It must look silly now.'),
  ([(0, 'I lend {items} to travellers passing through {place}.'), (0, 'The {dmobs} took everything. Return {n} so I can help again.')], 'Travellers will thank you too.'),
  ([(0, "I'm a cook in {town}, and my secret recipe needs {items}."), (1, 'Really?'), (0, "It's a secret. The {dmobs} of {place} have them. Fetch {n}.")], "Dinner's going to be wonderful."),
  ([(0, 'The merchants\' caravan was attacked in {place}.'), (0, 'The {dmobs} took the {items}. Recover {n} and the guild will be grateful.')], 'The guild thanks you.'),
  ([(0, 'My {items} were a gift from the king himself.'), (0, 'The {dmobs} of {place} have no respect for royalty. Get {n} back.')], 'The king need never know.'),
  ([(0, "I'm teaching my daughter to forage in {place}."), (0, 'The {dmobs} keep stealing our {items}. Bring back {n}.')], 'Lesson learned: bring a hero.'),
  ([(0, 'The {dmobs} of {place} build their nests from whatever they can steal.'), (0, 'My {items} are in there somewhere. Pull out {n}.')], "A bit sticky, but they're mine."),
  ([(0, 'I left my {items} by the campfire in {place}.'), (0, 'When I came back, the {dmobs} were dancing around them. Get {n} back.')], 'No more dancing for them.'),
  ([(0, 'The children of {town} lost their {items} playing in {place}.'), (0, 'The {dmobs} grabbed them. Bring {n} back, please.')], 'Their smiles are your reward.'),
  ([(0, 'My master sent me to {place} for {items}.'), (0, "The {dmobs} found them first. Bring {n}, or I'm in trouble.")], 'My master will be pleased.'),
  ([(0, 'Rumour in {town} says the {dmobs} of {place} carry {items}.'), (1, 'Is it true?'), (0, 'Find out, and bring me {n}.')], 'Rumours are sometimes true!'),
  ([(0, 'A storm scattered my {items} across {place}.'), (0, 'The {dmobs} have claimed them. Collect {n}.')], "Storm's over, and so is my bad luck."),
  ([(0, 'The temple in {town} lost its {items} to the {dmobs} of {place}.'), (0, 'The priest asks for {n} returned.')], 'The priest offers his blessing.'),
  ([(0, "I'm an inventor, and my next gadget needs {items}."), (0, 'The {dmobs} of {place} took my supply. Fetch {n}.')], "Now to see if it explodes."),
  ([(0, 'My dog chased the {dmobs} of {place} and came back without the {items} I tied to his collar.'), (0, "Get {n} back. The dog's in disgrace.")], 'The dog is forgiven.'),
  ([(0, 'The {dmobs} of {place} took my {items} as a toll for passing.'), (0, "I'd like them back. {N} will do.")], 'Nobody tolls me.'),
  ([(0, 'I promised the inn at {town} a delivery of {items}.'), (0, 'The {dmobs} of {place} ruined that plan. Collect {n}.')], 'The innkeeper will pour you a free one.'),
  ([(0, 'The {dmobs} of {place} pass stolen goods around among themselves.'), (1, 'Really?'), (0, 'My {items} have been through them all. Get {n} back.')], 'Trade is over. Thank you.'),
  ([(0, 'My grandfather buried {items} in {place} long ago.'), (0, 'The {dmobs} dug them up. Bring me {n}.')], "Grandfather's treasure, home at last."),
  ([(0, "I'm leaving {town} for good, but not without my {items}."), (0, "The {dmobs} of {place} took them. Bring {n} and I'll go.")], 'Farewell, and thank you.'),
  ([(0, 'The ranger of {place} keeps spare {items} in a tree stash.'), (0, 'The {dmobs} found the stash. Return {n} before he does his rounds.')], 'The ranger will never know.'),
  ([(0, 'I carve toys for the children of {town}, and I paint them with {items}.'), (0, 'The {dmobs} of {place} took my supply. Bring {n}.')], 'Toys for everyone this year.'),
 ],
 'desert': [
  ([(0, 'My caravan crossed {place} with a crate of {items}.'), (0, 'The {dmobs} took the lot. Bring back {n}.')], 'My caravan is whole again.'),
  ([(0, 'The {dmobs} of {place} bury what they steal in the sand.'), (0, 'My {items} are down there. Dig up {n}.')], 'Sandy, but safe.'),
  ([(0, "I'm lost in {place}, and the {dmobs} took my {items}."), (1, "I'll help."), (0, 'Bless you. {N}, and I can trade my way home to {town}.')], 'Home I go. Thank you, friend.'),
  ([(0, 'The sun temple in {place} lost its offering of {items}.'), (0, 'The {dmobs} carried them off. Return {n}.')], 'The sun smiles on you.'),
  ([(0, 'I swapped water for {items} with a nomad in {place}.'), (0, 'Then the {dmobs} swapped them for nothing. Get {n} back.')], 'Fair trade restored.'),
  ([(0, "The merchants of {town} won't buy {items} with sand in them."), (0, 'But the {dmobs} of {place} have the only ones left. Fetch {n}.')], "I'll dust them off."),
  ([(0, 'My {items} fell off my camel in {place}.'), (0, 'By the time I turned around, the {dmobs} had them. Recover {n}.')], 'Tied down properly this time.'),
  ([(0, 'A mirage led me straight into the {dmobs} of {place}.'), (1, 'A mirage?'), (0, 'Of a shop selling {items}. Now they have mine. Bring back {n}.')], 'Real ones. Even better.'),
  ([(0, 'The {dmobs} of {place} decorate their camp with {items}.'), (0, "Those were for my daughter's birthday. Bring back {n}.")], "She'll love them."),
  ([(0, "I'm an archaeologist. The {items} of {place} belong in a museum."), (0, 'The {dmobs} disagree. Recover {n}.')], 'The museum in {town} thanks you.'),
  ([(0, 'Every caravan pays the {dmobs} of {place} a toll in {items}.'), (0, 'I want ours back. Bring me {n}.')], 'No more tolls.'),
  ([(0, 'The water-seller in {town} takes {items} instead of coin.'), (0, "The {dmobs} of {place} stole mine, and I'm thirsty. Get {n}.")], 'Water, at last!'),
  ([(0, 'A sandstorm buried my tent and my {items} in {place}.'), (0, 'The {dmobs} dug them up first. Recover {n}.')], 'Better than a sandstorm.'),
  ([(0, "My rival bet I'd never cross {place} with my {items}."), (0, 'The {dmobs} made him right. Fetch {n} so I win anyway.')], 'I win the bet!'),
  ([(0, 'I carry {items} between {town} and the far oasis.'), (0, 'The {dmobs} of {place} made off with this load. Return {n}.')], 'Back on the road tomorrow.'),
  ([(0, 'The {dmobs} of {place} took my {items} as I slept by the fire.'), (0, "Bring back {n}, and I'll sleep with one eye open from now on.")], 'Thank you. One eye open.'),
  ([(0, 'The desert monks of {place} need {items} for their ritual.'), (0, 'The {dmobs} stole their supply. Return {n}.')], 'The ritual can begin.'),
  ([(0, 'I found a map of buried {items} in {place}.'), (1, 'And?'), (0, 'The {dmobs} found the {items}. Bring me {n}.')], 'The map was right after all.'),
  ([(0, 'My {items} were the last thing my mother gave me.'), (0, 'The {dmobs} of {place} have them. Please, bring back {n}.')], 'Thank you. Truly.'),
  ([(0, 'The governor of {town} wants {items} for his collection.'), (0, "The {dmobs} of {place} have plenty. Fetch {n} and he'll pay you.")], 'The governor will be pleased.'),
  ([(0, 'I was crossing {place} to sell {items} when the {dmobs} struck.'), (0, "Get {n} back so the journey isn't wasted.")], "The journey's saved."),
  ([(0, 'The {dmobs} of {place} wear {items} as lucky charms.'), (0, "Bring me {n} and we'll see how lucky they are.")], 'They seem less lucky already.'),
  ([(0, 'My guide abandoned me in {place}, and the {dmobs} took my {items}.'), (0, "I'll pay you instead. Recover {n}.")], "You're a better guide than he was."),
  ([(0, 'The scorpion-catchers of {town} use {items} as bait.'), (0, 'The {dmobs} of {place} took ours. Bring {n}.')], "The scorpions won't know what hit them."),
  ([(0, 'I dropped my {items} into a ravine in {place}.'), (0, 'The {dmobs} lurk at the bottom. Fetch {n}.')], "You're braver than me."),
  ([(0, 'The {dmobs} of {place} raided the oasis market.'), (0, 'My stall of {items} is empty. Bring back {n}.')], 'Open for business!'),
  ([(0, 'The dancers of {town} perform with {items}.'), (0, 'The {dmobs} of {place} stole them on the way to the show. Fetch {n}.')], 'The show goes on!'),
  ([(0, 'I traded my last coin for {items} at the edge of {place}.'), (0, 'An hour later the {dmobs} had them. Recover {n}.')], 'Worth every coin now.'),
 ],
 'volcano': [
  ([(0, 'I came to {place} to trade {items} with the fire priests.'), (0, 'The {dmobs} took them before I reached the temple. Get {n} back.')], 'Now I can finish my trade.'),
  ([(0, 'The {dmobs} of {place} guard a hoard of stolen {items}.'), (0, 'Some of them are mine. Bring back {n}.')], 'My own, back from the fire.'),
  ([(0, 'I fled {place} when the ground shook and left my {items} behind.'), (0, 'The {dmobs} claimed them. Recover {n}.')], 'Singed, but mine.'),
  ([(0, 'The smith of {town} forges with {items} from the volcano.'), (0, 'The {dmobs} of {place} took her supply. Fetch {n}.')], 'The forge burns again.'),
  ([(0, 'My expedition to {place} lost everything but me.'), (0, 'The {dmobs} took our {items}. Bring back {n} so it was worth it.')], 'The expedition was a success after all.'),
 ],
 'village': [
  ([(0, 'The {dmobs} have been dragging my {items} into the walls of {town}.'), (0, 'I need {n} back before market day.')], 'Just in time for market day.'),
  ([(0, 'I keep my {items} in the cellar.'), (0, 'Kept. The {dmobs} got in. Get me {n} back.')], "I'll get a cat."),
  ([(0, 'The town hall of {town} lost its {items} to the {dmobs}.'), (0, 'The council meets tomorrow. Bring {n}.')], 'The council thanks you.'),
  ([(0, 'The {dmobs} of {town} nest in the old chapel with my {items}.'), (0, 'Bring back {n}, and mind the pews.')], 'Bless you!'),
  ([(0, 'The innkeeper of {town} hid {items} in the stable.'), (0, 'The {dmobs} found them. Fetch {n}.')], 'Drinks are on the house.'),
  ([(0, 'My stall in the {town} market sells {items}.'), (0, 'Sold, until the {dmobs} got under the counter. Get {n} back.')], 'Open for business again.'),
 ],
 'beach': [
  ([(0, 'A wave knocked my satchel over and the {dmobs} scuttled off with my {items}.'), (0, 'They hide them in burrows along {place}. Bring {n} back.')], 'Wet, but mine.'),
  ([(0, 'The {dmobs} of {place} collect shiny things.'), (1, 'Like what?'), (0, 'Like my {items}. Get {n} back.')], 'Shiny and home.'),
  ([(0, 'A shipwreck washed {items} onto {place}.'), (0, 'The {dmobs} got to them first. Collect {n}.')], 'Salvage rights are mine now.'),
  ([(0, 'I left my {items} in a tide pool on {place}.'), (0, 'The {dmobs} took them for their own. Fetch {n}.')], "I'll keep them dry next time."),
  ([(0, 'The sailors of {town} trade in {items}.'), (0, 'The {dmobs} of {place} raided the jetty. Return {n}.')], 'The sailors salute you.'),
  ([(0, 'My picnic on {place} ended with the {dmobs} running off with my {items}.'), (0, 'Get {n} back and you can join the next one.')], "Next picnic's on me."),
 ],
}
KILL_WAIT = ["Come back when you've dealt with %count% of them.", 'Only %count% of them. You can do it.',
             'Off you go, %count% should be enough.', 'Be careful out there. %count%, remember.',
             "I'll be right here. Good luck with those %count%."]
KILL_ASK = ['Have you defeated %count% %name%s yet?', 'How many %name%s so far? I need %count%.',
            'Still %name%s everywhere. Have you beaten %count%?', 'Back already? Is it %count% %name%s yet?',
            'Any luck with the %name%s?']
ITEM_WAIT = ['Bring me all %count% of them.', '%count% of them, from the %name2%s.', 'Just %count%, that is all I ask.',
             'The %name2%s have them. %count% will do.', "Hurry, before the %name2%s lose them."]
ITEM_ASK = ['Do you have the %count% %name%s yet?', 'Any luck finding my %count% %name%s?',
            'Have the %name2%s given up my %name%s yet?', 'Did you bring my %name%s?',
            'How many %name%s have you found?']
SUMMARY_KILL = ['Defeat %count% %name%s in {place}', 'Drive %count% %name%s out of {place}',
                'Thin out %count% %name%s around {place}', 'Clear %count% %name%s from {place}']
SUMMARY_ITEM = ['Recover %count% {items} from the %name2%s of {place}', 'Win back %count% {items} from the %name2%s of {place}',
                'Fetch %count% {items} from the %name2%s around {place}']


def item_words(n):
    w = re.sub(r'(?<=[a-z])(?=[A-Z])', ' ', n).lower().split()
    w = [x for x in w if x not in ('one', 'two', 'three', 'four')] or [n.lower()]
    return ' '.join(w)


def item_plural(w):
    if w in ITEM_PLURAL: return ITEM_PLURAL[w]
    if w.endswith('s') and not w.endswith('ss'): return w          # already plural: scrolls, cards, bones
    return plural(w)


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
    if v or h: return (v or h) + 'ern'
    return 'central'


def cap(t):
    return t[:1].upper() + t[1:]


def fill(t, **kw):
    kw['N'] = cap(kw.get('n', ''))
    for k, v in kw.items(): t = t.replace('{' + k + '}', str(v))
    return cap(t)


class Deck:
    """Hands out each entry once, in random order; reshuffles only if it runs out."""
    def __init__(self, items): self.items, self.left = list(items), []
    def draw(self):
        if not self.left: self.left = self.items[:]; rnd.shuffle(self.left)
        return self.left.pop()


# ---------------------------------------------------------------- map parts, collision, spots
parts = []
for i, nm in sorted(maplist.items()):
    if not nm.startswith(PFX + '/') or nm.endswith('_int'): continue
    d = json.load(open(os.path.join(ROOT, 'gameserver', 'maps', nm + '.json')))
    parts.append(dict(name=nm, index=i, wx=d['worldX'], wy=d['worldY'], w=d['width'], h=d['height'],
                      col=d['collision'], doors=d.get('doors', [])))


def components(p):
    """Tile -> size of the walkable region it belongs to."""
    w, h, col = p['w'], p['h'], p['col']
    comp = [0] * (w * h); sizes = [0]
    for s in range(w * h):
        if col[s] or comp[s]: continue
        cid = len(sizes); comp[s] = cid; q = deque([s]); n = 0
        while q:
            c = q.popleft(); n += 1; x, y = c % w, c // w
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if 0 <= nx < w and 0 <= ny < h:
                    k = ny * w + nx
                    if not col[k] and not comp[k]: comp[k] = cid; q.append(k)
        sizes.append(n)
    return [sizes[c] if c else 0 for c in comp]


def pick_spot(p, area, size, taken):
    w, col = p['w'], p['col']
    tx0, ty0 = area['x'] // 16 + 2, area['y'] // 16 + 2
    tx1, ty1 = (area['x'] + area['w']) // 16 - 2, (area['y'] + area['h']) // 16 - 2
    doors = [(d['x'] // 16, d['y'] // 16) for d in p['doors']]
    cands = []
    for ty in range(ty0, ty1):
        for tx in range(tx0, tx1):
            if size[ty * w + tx] < 400: continue
            if any(col[(ty + dy) * w + tx + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1)): continue
            if any(abs(tx - a) < 4 and abs(ty - b) < 4 for a, b in doors): continue
            cands.append((tx, ty))
    if not cands: return None
    for gap in (MIN_NPC_GAP, 8, 4, 0):
        ok = [c for c in cands if all((c[0] - a) ** 2 + (c[1] - b) ** 2 >= gap * gap for a, b in taken)]
        if ok: return rnd.choice(ok)
    return rnd.choice(cands)


# ---------------------------------------------------------------- build
kill_decks = {b: Deck(v) for b, v in KILL.items()}
item_decks = {b: Deck(v) for b, v in ITEM.items()}
desc_decks = {k: Deck(v) for k, v in DESC.items()}
wait_k, ask_k, wait_i, ask_i = Deck(KILL_WAIT), Deck(KILL_ASK), Deck(ITEM_WAIT), Deck(ITEM_ASK)
sum_k, sum_i = Deck(SUMMARY_KILL), Deck(SUMMARY_ITEM)
mob_rot = {}
_mobnames = {k.lower() for k in MOBS} | set(MOB.values())
_old_items = {q['object2']['kind'] for k, q in json.load(open(p_quests)).items()
              if k.startswith(md.quest_base(0)[:5]) and k not in _prev and 'object2' in q}
loot_all = [i for i, it in enumerate(LOOT) if it['name'].lower() not in _mobnames]
loot_fresh = [i for i in loot_all if i not in _old_items]; rnd.shuffle(loot_fresh)
loot_rest = [i for i in loot_all if i in _old_items]; rnd.shuffle(loot_rest)
loot_order = loot_fresh + loot_rest

new_quests, new_dialogue, new_summary, entities, report = {}, {}, {}, {}, []
rows, cols = spots['rows'], spots['cols']
main_w, main_h = max(p['wx'] + p['w'] for p in parts), max(p['wy'] + p['h'] for p in parts)

for p in parts:
    nm = p['name']
    ea = md.areas_of(nm)                     # this part's areas and entities, in its own pixels
    old = md.entities_of(nm)
    taken = [(e['x'] // 16, e['y'] // 16) for e in old if e.get('id') not in prev_ids]
    size = components(p)
    ent = entities.setdefault(nm, [])
    for area in ea['mobAreas']:
        mobs = sorted(int(k) for k in str(area['include']).split(',') if k.strip())
        biome = BIOME_BY_MOBS.get(','.join(map(str, mobs)))
        cx = p['wx'] + (area['x'] + area['w'] / 2) / 16; cy = p['wy'] + (area['y'] + area['h'] / 2) / 16
        row, col = min(rows - 1, int(cy * rows / main_h)), min(cols - 1, int(cx * cols / main_w))
        letter = LETTER.get(spots['grid'][row][col], 'forest')
        if biome is None: biome = 'beach' if letter == 'lagoon' else letter
        spot = pick_spot(p, area, size, taken)
        if spot is None: print(f'  {nm} mob area {area["id"]}: no walkable spot, skipped'); continue
        taken.append(spot)
        town = min(towns, key=lambda t: (t['x'] - cx) ** 2 + (t['y'] - cy) ** 2)['name']
        if biome == 'village': plc = town
        elif letter == 'lagoon' and biome == 'beach': plc = rnd.choice(['the lagoon', f'the {compass(row, col, rows, cols)} lagoon'])
        else: plc = f'the {compass(row, col, rows, cols)} {rnd.choice(NOUN[biome])}'
        # which mob for which quest: rotate through the area's mobs so each gets its share
        r = mob_rot.get(biome, rnd.randrange(len(mobs))); mob_rot[biome] = r + 1
        kill_mob = mobs[r % len(mobs)]
        item_mob = mobs[(r + 1 + rnd.randrange(max(1, len(mobs) - 1))) % len(mobs)] if len(mobs) > 1 else mobs[0]
        # the first free id from FIRST_ID in the map's entity.json (this script's own from last time are
        # replaced, so their ids are free again)
        _used = (md.ids() - prev_ids) | {e['id'] for v in entities.values() for e in v}
        eid = FIRST_ID
        while eid in _used: eid += 1
        name = new_name()
        ent.append({'id': eid, 'caption': 'quest_npc_mobarea', 'type': 'npcmove', 'kind': rnd.randint(1, 56), 'x': spot[0] * 16 + 8, 'y': spot[1] * 16 + 8,
                    'name': name})
        lv = [area['minLevel'], area['maxLevel']]
        base = md.quest_base(eid)
        qk, qi = (base + '01', base + '02') if rnd.random() < 0.5 else (base + '02', base + '01')
        # kill quest
        cnt_k = rnd.choice(KILL_COUNTS)
        kw = dict(place=plc, town=town, mobs=plural(MOB[kill_mob]), dmobs=desc_decks[kill_mob].draw(), n=NUM[cnt_k])
        offer, done = kill_decks[biome].draw()
        new_quests[qk] = {'name': f'{name}: kill {MOB_KEY[kill_mob]}', 'type': 1, 'level': 0,
                          'object': {'type': 2, 'kind': kill_mob, 'count': cnt_k, 'level': lv}}
        new_dialogue[qk] = [[[sp, fill(t, **kw)] for sp, t in offer], [[0, wait_k.draw()]], [[0, ask_k.draw()]],
                            [[0, fill(done, **kw)]]]
        new_summary[qk] = fill(sum_k.draw(), **kw)
        # item quest
        item = loot_order[len(report) % len(loot_order)]
        cnt_i = rnd.randint(*ITEM_COUNT)
        iw = item_words(LOOT[item]['name'])
        kw = dict(place=plc, town=town, mobs=plural(MOB[item_mob]), dmobs=desc_decks[item_mob].draw(),
                  items=item_plural(iw), n=NUM[cnt_i])
        offer, done = item_decks[biome].draw()
        new_quests[qi] = {'name': f'{name}: get {LOOT[item]["name"]}', 'type': 2, 'level': 0,
                          'object': {'type': 2, 'kind': item_mob, 'level': lv},
                          'object2': {'type': 4, 'kind': item, 'count': cnt_i, 'chance': ITEM_CHANCE}}
        new_dialogue[qi] = [[[sp, fill(t, **kw)] for sp, t in offer], [[0, wait_i.draw()]], [[0, ask_i.draw()]],
                            [[0, fill(done, **kw)]]]
        new_summary[qi] = fill(sum_i.draw(), **kw)
        report.append((nm, area['id'], eid, name, 'lagoon' if 'lagoon' in plc else biome, f'{lv[0]}-{lv[1]}',
                       f'{cnt_k} {MOB_KEY[kill_mob]}', f'{cnt_i} {LOOT[item]["name"]} from {MOB_KEY[item_mob]}',
                       'kill first' if qk < qi else 'item first'))

offers = [json.dumps(d[0]) for d in new_dialogue.values()]
assert len(set(offers)) == len(offers), 'two quests ended up with the same dialogue'


# ---------------------------------------------------------------- write, keeping the rest of each file as it is
def members(text, start):
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
    mem, close = members(text, start)
    out = [text[:start + 1] + (text[start + 1:mem[0][1]] if mem else eol + indent)]
    first = True
    for n, (k, a, b) in enumerate(mem):
        if k in drop: continue
        if not first: out.append(text[mem[n - 1][2]:a])
        out.append(text[a:b]); first = False
    for k, v in add.items():
        if not first: out.append(',' + eol + indent)
        out.append(f'"{k}": {v}'); first = False
    out.append(text[mem[-1][2]:close + 1] if mem else eol + '}')
    return ''.join(out) + text[close + 1:]


def fmt_quest(q):
    return '{\n' + ',\n'.join(f'\t\t"{k}": ' + json.dumps(v) for k, v in q.items()) + '\n\t}'


def fmt_dialogue(stages):
    out = ['[']
    for si, st in enumerate(stages):
        out.append('        [')
        out.append(',\n'.join(f'          [{sp}, {json.dumps(t, ensure_ascii=False)}]' for sp, t in st))
        out.append('        ]' + (',' if si < len(stages) - 1 else ''))
    out.append('      ]')
    return '\n'.join(out)


drop = set(written.get('quests', []))
qt = open(p_quests, encoding='utf-8').read(); eol_q = '\r\n' if '\r\n' in qt else '\n'
qt = rewrite(qt, qt.index('{'), drop, {k: fmt_quest(v).replace('\n', eol_q) for k, v in sorted(new_quests.items())},
             '\t', eol_q)
json.loads(qt)
lt = open(p_lang, encoding='utf-8').read(); eol_l = '\r\n' if '\r\n' in lt else '\n'
# %player_name% where the NPC speaks to the player (common/playername.py)
for key, add in (('QUESTS', {k: fmt_dialogue(add_player_name(new_dialogue[k])).replace('\n', eol_l) for k in sorted(new_dialogue)}),
                 ('QUEST_SUMMARY', {k: json.dumps(new_summary[k], ensure_ascii=False) for k in sorted(new_summary)})):
    root, _ = members(lt, lt.index('{'))
    en = [m for m in root if m[0] == 'EN'][0]
    mem, _ = members(lt, lt.index('{', en[1] + 4))
    k_, a_, b_ = [m for m in mem if m[0] == key][0]
    lt = rewrite(lt, lt.index('{', a_ + len(key) + 2), drop, add, '      ', eol_l)
json.loads(lt)
# the map's entity.json: this script's records from last time replaced, in full-map pixels
ours = [dict(e, x=e['x'] + md.part[nm]['wx'] * 16, y=e['y'] + md.part[nm]['wy'] * 16)
        for nm, v in entities.items() for e in v]
ids = {e['id'] for e in ours}
md.entities = [e for e in md.entities if e.get('id') not in prev_ids and e.get('id') not in ids] + ours
md.save()
open(p_quests, 'w', encoding='utf-8', newline='').write(qt)
open(p_lang, 'w', encoding='utf-8', newline='').write(lt)
json.dump({'quests': sorted(new_quests), 'entities': sorted(e['id'] for v in entities.values() for e in v)},
          open(p_written, 'w'), indent=1)

print(f'{len(report)} extra quest NPCs, {len(new_quests)} quests (removed {len(drop)} from the last run)')
for r in report:
    print('  {:14s} area {:2d} id {:3d} {:9s} {:8s} lv {:6s} kill {:20s} get {:34s} {}'.format(*r))
print('Now run godot-client/sync-assets-win.bat (or -linux.sh) so the Godot client gets the new quests and dialogue.')
