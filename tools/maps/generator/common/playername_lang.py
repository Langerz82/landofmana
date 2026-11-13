"""Adds %player_name% to the quest dialogue already in shared/data/lang.json (playername.py has the
rules). Run once; re-running changes nothing. The map1 generators (map1gen/npcs1.py, npcs1_extra.py)
apply the same rules to the dialogue they write, so their quests keep it when they're regenerated.

Only the string values that change are rewritten, in place: the file's own layout, key order and line
endings are kept exactly.

    python playername_lang.py           # rewrite lang.json
    python playername_lang.py --dry     # just list what would change
"""
import os, sys, json
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from playername import add_player_name, completion, no_more_quests, NAME

ROOT = os.path.normpath(os.path.join(HERE, '..', '..', '..', '..'))
P_LANG = os.path.join(ROOT, 'shared', 'data', 'lang.json')


def value_spans(text):
    """{path: (start, end)} for string values, path = keys / indices from the root."""
    out = {}
    def walk(i, path):
        while text[i] in ' \t\r\n':
            i += 1
        c = text[i]
        if c == '{':
            i += 1
            while True:
                while text[i] in ' \t\r\n,':
                    i += 1
                if text[i] == '}':
                    return i + 1
                j = i + 1
                while text[j] != '"':
                    j += 2 if text[j] == '\\' else 1
                k = json.loads(text[i:j + 1])
                i = text.index(':', j + 1) + 1
                i = walk(i, path + (k,))
        if c == '[':
            i += 1; idx = 0
            while True:
                while text[i] in ' \t\r\n,':
                    i += 1
                if text[i] == ']':
                    return i + 1
                i = walk(i, path + (idx,)); idx += 1
        if c == '"':
            j = i + 1
            while text[j] != '"':
                j += 2 if text[j] == '\\' else 1
            out[path] = (i, j + 1)
            return j + 1
        j = i
        while text[j] not in ',]} \t\r\n':
            j += 1
        return j
    walk(0, ())
    return out


def lines_of(value, base):
    """[(path, text)] of a dialogue value's lines (for diffing old/new)."""
    out = []
    for si, st in enumerate(value):
        for li, l in enumerate(st if isinstance(st, list) else [st]):
            if isinstance(l, list) and len(l) >= 2:
                out.append((base + (si, li, 1), l[1]))
            elif isinstance(l, str):
                out.append((base + (si, li) if isinstance(st, list) else base + (si,), l))
    return out


def main():
    dry = '--dry' in sys.argv
    raw = open(P_LANG, encoding='utf-8', newline='').read()
    data = json.loads(raw)
    spans = value_spans(raw)
    edits = {}      # path -> new text

    for lang, d in data.items():
        for qid, stages in d.get('QUESTS', {}).items():
            base = (lang, 'QUESTS', qid)
            for (p, old), (_, new) in zip(lines_of(stages, base), lines_of(add_player_name(stages), base)):
                if old != new:
                    edits[p] = new
        for npc, by_quest in d.get('NO_MORE_QUESTS', {}).items():
            for n, lines in by_quest.items():
                for li, l in enumerate(lines):
                    if isinstance(l, list) and len(l) >= 2 and int(l[0]) == 0:
                        new = no_more_quests(l[1])
                        if new != l[1]:
                            edits[(lang, 'NO_MORE_QUESTS', npc, n, li, 1)] = new
        for li, l in enumerate(d.get('NO_MORE_QUESTS_DEFAULT', [])):
            if isinstance(l, list) and int(l[0]) == 0 and no_more_quests(l[1]) != l[1]:
                edits[(lang, 'NO_MORE_QUESTS_DEFAULT', li, 1)] = no_more_quests(l[1])
        for li, l in enumerate(d.get('QUESTS_REWARD', [])):
            if isinstance(l, list) and int(l[0]) == 0 and NAME not in l[1]:
                new = completion(l[1])
                if new != l[1]:
                    edits[(lang, 'QUESTS_REWARD', li, 1)] = new
        # generated item quests: [offer, in progress, completion] strings
        for qi, q in enumerate(d.get('QUESTS_ITEM', [])):
            if isinstance(q, list) and len(q) == 3 and isinstance(q[2], str) and completion(q[2]) != q[2]:
                edits[(lang, 'QUESTS_ITEM', qi, 2)] = completion(q[2])

    missing = [p for p in edits if p not in spans]
    if missing:
        sys.exit('no span for %s' % (missing[:3],))
    for p in sorted(edits, key=lambda p: spans[p][0]):
        old = json.loads(raw[spans[p][0]:spans[p][1]])
        print(' '.join(map(str, p[1:])), '|', old, '\n      =>', edits[p])
    print('%d line(s) %s' % (len(edits), 'would change' if dry else 'changed'))
    if dry or not edits:
        return
    out = raw
    for p in sorted(edits, key=lambda p: spans[p][0], reverse=True):
        a, b = spans[p]
        out = out[:a] + json.dumps(edits[p], ensure_ascii=False) + out[b:]
    json.loads(out)     # still valid
    with open(P_LANG, 'w', encoding='utf-8', newline='') as f:
        f.write(out)


if __name__ == '__main__':
    main()
