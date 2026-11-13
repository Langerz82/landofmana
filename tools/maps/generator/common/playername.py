"""%player_name% in quest dialogue (shared/data/lang.json).

Both clients replace %player_name% with the local player's name when they show a
lang line (client/js/quest.js fillText, godot-client scripts/world/quest.gd
fill_text). This puts it where an NPC speaks to the player:

- the quest's completion line (its 4th and last stage): the NPC thanks the player by name,
  "My washing line is safe, %player_name%! I'll knit you something.";
- a request in the quest offer (its first stage) that asks "Can/Could/Will/Would
  you ...?": "Will you defeat twelve, %player_name%?";
- an existing form of address in any NPC line (", friend", ", traveller", ...).

Player lines, quest log summaries and the in-progress reminders are left alone.
Idempotent: a line that already has %player_name% is not changed again, and a
completion stage that already has it anywhere gets nothing more. Used by the map1
quest generators (map1gen/npcs1.py, npcs1_extra.py) on the dialogue they write,
and run once over the hand-written quests (playername_lang.py).
"""
import re

NAME = '%player_name%'

# ", friend." -> ", %player_name%." (the NPC already addresses the player)
_VOCATIVE = re.compile(r',(\s*)(?:my friend|friend|traveller|traveler|stranger|adventurer|young one|wanderer)\b(?=\s*[.!?,])', re.I)
# words that open a completion line as an exclamation: "Wonderful, ..." / "Splendid! ..."
_INTERJECTIONS = {'wonderful', 'splendid', 'excellent', 'brilliant', 'marvellous', 'marvelous', 'perfect',
                  'finally', 'ah', 'oh', 'yes', 'good', 'great', 'amazing', 'incredible', 'fantastic',
                  'superb', 'remarkable', 'magnificent', 'outstanding', 'well done', 'at last', 'hooray',
                  'hurrah', 'bravo', 'goodness', 'gracious', 'phew', 'whew', 'there'}
_ABBREV = re.compile(r'\b(?:Mr|Mrs|Ms|Dr|St|Mt)\.$')


def _sentence_end(text, start=0):
    """Index of the first sentence's closing punctuation run ('.', '!', '?', '...'), or -1."""
    i = start
    while i < len(text):
        c = text[i]
        if c in '.!?':
            j = i
            while j < len(text) and text[j] in '.!?':
                j += 1
            nxt = text[j] if j < len(text) else ' '
            if nxt in ' "\')' and not _ABBREV.search(text[:j]):
                return i
            i = j
            continue
        i += 1
    return -1


def _ends_with_address(clause):
    """'..., Sonny' / '..., Old Man' / 'Onwards, camel': the clause already ends by
    addressing someone (a name, or a single word after the last comma)."""
    return (re.search(r',\s*(?:[A-Z][\w\'-]*\s*){1,2}$', clause) is not None
            or re.search(r',\s*[\w\'-]+$', clause) is not None)


def vocative(text):
    if NAME in text:
        return text
    return _VOCATIVE.sub(lambda m: ',' + m.group(1) + NAME, text, count=1)


def completion(text):
    """Address the player by name in a completion line."""
    if NAME in text:
        return text
    m = re.match(r'^(Thank you|Thank-you|Thanks)([!.,])', text)
    if m:
        # "Thank you!" -> "Thank you, %player_name%!"
        word = 'Thank you' if m.group(1) == 'Thank-you' else m.group(1)
        return word + ', ' + NAME + m.group(2) + text[m.end():]
    # a later "Thank you!" / "Thanks." sentence: "The music's starting. Thank you, %player_name%!"
    m = re.search(r'(?<=[.!?] )(Thank you|Thanks)([!.])', text)
    if m:
        return text[:m.end(1)] + ', ' + NAME + text[m.end(1):]
    m = re.match(r"^((?:[A-Z][a-z']+)(?: [a-z]+)?)([!,])(\s)", text)
    if m and m.group(1).lower() in _INTERJECTIONS:   # "Wonderful, these ..." -> "Wonderful, %player_name%, these ..."
        return m.group(1) + ', ' + NAME + m.group(2) + text[m.end() - 1:]
    end = _sentence_end(text)
    if end < 0:
        return text
    clause = text[:end].rstrip()
    if _ends_with_address(clause):
        return text
    return clause + ', ' + NAME + text[end:]


def request(text):
    """'Will you defeat twelve?' -> 'Will you defeat twelve, %player_name%?' (first such question only)."""
    if NAME in text:
        return text
    for m in re.finditer(r'(?:^|(?<=[.!?]\s))(?:Can|Could|Will|Would) you\b', text):
        q = text.find('?', m.start())
        if q < 0:
            continue
        stop = _sentence_end(text, m.start())
        if stop != q:
            continue
        clause = text[:q].rstrip()
        if _ends_with_address(clause):
            continue
        return clause + ', ' + NAME + text[q:]
    return text


def _line(entry):
    """(speaker, text, rebuild) for a lang line: [sp, "text"] or a bare "text" (an NPC line)."""
    if isinstance(entry, (list, tuple)) and len(entry) >= 2:
        return int(entry[0]), str(entry[1]), (lambda t, e=entry: type(e)([e[0], t]) if isinstance(e, tuple) else [e[0], t])
    if isinstance(entry, str):
        return 0, entry, (lambda t: t)
    return None


def add_player_name(stages):
    """A quest's dialogue (stages of lang lines) with %player_name% added; a new list."""
    out = []
    last = len(stages) - 1
    for si, stage in enumerate(stages):
        new_stage = []
        has_name = any(NAME in (_line(e)[1] if _line(e) else '') for e in stage)
        done_completion = has_name
        for entry in stage:
            ln = _line(entry)
            if ln is None:
                new_stage.append(entry)
                continue
            sp, text, rebuild = ln
            if sp == 0:
                text = vocative(text)
                if si == 0:
                    text = request(text)
                # the completion line: the 4th stage (offer, accepted, in progress, done); the
                # oldest intro quests have only 3, ending on a reminder ("Kill %count% Crabs.")
                if si == last and si == 3 and not done_completion:
                    text = completion(text)
                    done_completion = True
            new_stage.append(rebuild(text))
        out.append(new_stage)
    return out


def no_more_quests(text):
    """'I have no more quests for you, head EAST ...' -> 'I have no more quests for you, %player_name%. Head EAST ...'"""
    if NAME in text:
        return text
    m = re.match(r'^(I have no more quests for you)(,\s*)(\w)(.*)$', text, re.S)
    if m:
        return m.group(1) + ', ' + NAME + '. ' + m.group(3).upper() + m.group(4)
    m = re.match(r'^(I have no more quests for you)([.!])(.*)$', text, re.S)
    if m:
        return m.group(1) + ', ' + NAME + m.group(2) + m.group(3)
    return text
