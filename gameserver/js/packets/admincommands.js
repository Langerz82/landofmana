// This file is part of Land of Mana (https://github.com/Langerz82/landofmana).
// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2023-2026 Joshua Langley and contributors
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, version 3 of the License.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program. See the LICENSE file in the project root,
// or <https://www.gnu.org/licenses/>.

import Messages from '../message.js';
import MapEntityStore from '../map/mapentitystore.js';
import { G_TILESIZE } from '../constants.js';
import { Types } from '../common.js';
import MobData from '../data/mobdata.js';
import ItemLootData from '../data/itemlootdata.js';
import QuestData, { addQuest } from '../data/questdata.js';
import {
    QUEST_STATIC,
    MAX_QUESTS_PER_NPC,
    questIdPrefix,
    makeQuestId
} from '../questid.js';
import { logChat } from '../chatlog.js';

// ADMIN: chat commands for players whose account has the Redis admin flag
// (u:<username> admin=1 -- set with the userserver console command
// `setadmin <username>`). Typed into the normal chat box; the server
// swallows them, so they are never broadcast as chat.
//
//   /admin                          list these commands
//   /setadmin on|off [player]       switch admin mode on or off for this session only (not saved) --
//                                   your own, or an online player's. Your own works while it's off, for
//                                   any account with admin rights; a player given it this way loses it
//                                   when they log out.
//   /spawn <type> <kindId> [options] place an entity where you stand
//   /despawn [entityId]             remove an admin-placed entity
//   /spawnlist                      admin-placed entities near you
//   /pos                            your map + coordinates
//   /select [entityId]              select any entity on this map by id (the clients send
//                                   it when an admin clicks one), or the nearest
//                                   entity.json NPC if no id is given; shows what it is,
//                                   and an NPC's quests
//   /addquest kill <mobKind> <count> [options]
//   /addquest get <mobKind> <lootKind> <count> [chance=N] [options]
//   /addquest use <nodeKind> <count> [options]
//                                   add a quest to the selected NPC (or the nearest one):
//                                   kill <count> mobs, get <count> loot items dropped by
//                                   mobs (chance = drop chance, default 20), or use
//                                   <count> nodes. Options: name="...", gold=N, exp=N
//                                   (XP multiplier). Its id is generated
//                                   (1 + map + entity id + the NPC's next quest number,
//                                   questid.js) -- which is also how it's tied to the NPC --
//                                   it's saved to shared/data/quests.json and works at once.
//                                   Its text is the game's standard text for the type.
//
// <type> is one of: mob, npc (alias npcmove), npcstatic, node.
// Options are key=value, in any order, all optional:
//   name=Bob  name="Old Bob"   (blank / omitted = the default name)
//   level=10                   (mob and node only; omitted = random/1)
//   o=u|d|l|r                  facing up/down/left/right (default down)
// e.g.
//   /spawn mob 5 level=10 o=l
//   /spawn npcstatic 5 name="Bob"   (then /select it and /addquest to give it quests)
//
// Spawned entities are saved to gameserver/data/maps/<map>/entity.json and
// respawned on every server start -- see map/mapentitystore.js.

const COMMANDS = {
    '/admin': 'handleHelp',
    '/adminhelp': 'handleHelp',
    '/spawn': 'handleSpawn',
    '/despawn': 'handleDespawn',
    '/spawnlist': 'handleSpawnList',
    '/pos': 'handlePos',
    '/select': 'handleSelect',
    '/addquest': 'handleAddQuest',
    '/setadmin': 'handleSetAdmin'
};

const LEVEL_TYPES = new Set(['mob', 'node']);
const SPAWN_USAGE =
    'Usage: /spawn <type> <kindId> [name="..."] [level=N] [o=u|d|l|r]';
const QUEST_TYPES = new Set(['npcmove', 'npcstatic']);
// key= spellings accepted on the command line -> canonical option.
const OPTION_ALIASES = {
    name: 'name',
    n: 'name',
    level: 'level',
    lvl: 'level',
    lv: 'level',
    o: 'orientation',
    orientation: 'orientation',
    dir: 'orientation'
};
// Letters (any language), digits, spaces and a little punctuation.
const NAME_PATTERN = /^[\p{L}\p{N} _'.-]+$/u;
const DESPAWN_RANGE_TILES = 3;
const SELECT_RANGE_TILES = 5;
const ADDQUEST_USAGE =
    'Usage: /addquest kill <mobKind> <count> | get <mobKind> <lootKind> <count> [chance=N] | use <nodeKind> <count> -- options name="...", gold=N, exp=N';
const SPAWNLIST_RANGE_TILES = 32;
const SPAWNLIST_MAX = 10;

class AdminCommands {
    constructor(packetHandler) {
        this.ph = packetHandler;
        this.player = packetHandler.player;
    }

    static isCommand(text) {
        return typeof text === 'string' && COMMANDS[commandName(text)] !== undefined;
    }

    // Returns true when `text` was an admin command (handled or refused),
    // so the caller must not broadcast it as chat.
    handle(text) {
        text = String(text || '').trim();
        const cmd = commandName(text);
        const method = COMMANDS[cmd];
        if (!method) return false;

        const p = this.player;
        // "/setadmin" stays open to an admin account whose admin mode is switched off, so it can switch it
        // back on
        if (!p.isAdmin && !(cmd === '/setadmin' && p.isAdminAccount)) {
            this.ph.send(new Messages.Notify('CHAT', 'ADMIN_DENIED').serialize());
            return true;
        }

        console.info('ADMIN ' + p.name + ': ' + text);
        // Audit trail in chat.log alongside normal chat.
        logChat(p, 'admin', text);
        const args = text.substring(cmd.length).trim();
        try {
            this[method](args);
        } catch (err) {
            console.error('AdminCommands ' + cmd + ' failed: ' + err.stack);
            this.reply('Command failed: ' + err.message);
        }
        return true;
    }

    reply(text) {
        this.ph.send(
            new Messages.Notify('CHAT', 'ADMIN_MESSAGE', [text]).serialize()
        );
    }

    store() {
        const map = this.player.map;
        if (!map || !map.entities) return null;
        if (!map.entityStore) map.entityStore = new MapEntityStore(map);
        return map.entityStore;
    }

    // "/setadmin on|off [player]": switches admin mode (isAdmin: admin commands, mobs ignoring you, no
    // attacking) for this session only -- the caller's own, or an online player's. Nothing is saved: the
    // account's admin flag isn't touched, so an admin account is an admin again at its next login, and a
    // player given admin mode this way loses it when they log out. An admin account whose own mode is off
    // can still run this (to switch it back on); switching someone else needs admin mode on.
    handleSetAdmin(args) {
        const p = this.player;
        const words = String(args || '').split(/\s+/).filter(Boolean);
        const usage = 'Usage: /setadmin on|off [player], e.g. /setadmin off or /setadmin on Bob';
        const mode = (words[0] || '').toLowerCase();
        let flag;
        if (['on', '1', 'yes', 'true'].includes(mode)) flag = true;
        else if (['off', '0', 'no', 'false'].includes(mode)) flag = false;
        if (flag === undefined || words.length > 2) {
            this.reply(usage);
            return;
        }
        let target = p;
        if (words[1]) {
            target = p.world ? p.world.getPlayerByName(words[1]) : null;
            if (!target) {
                this.reply(words[1] + ' is not online.');
                return;
            }
        }
        const self = target === p;
        if (!self && !p.isAdmin) {
            this.reply('Switch your own admin mode on first ("/setadmin on").');
            return;
        }
        if (target.isAdmin === flag) {
            this.reply((self ? 'Your admin mode is' : target.name + '\'s admin mode is') + ' already ' + (flag ? 'on.' : 'off.'));
            return;
        }
        target.isAdmin = flag;
        target.sendAdminMode();
        if (self) {
            this.reply(flag
                ? 'Admin mode on.'
                : 'Admin mode off for this session (not saved). "/setadmin on" switches it back on.');
            return;
        }
        target.sendPlayer(new Messages.Notify('CHAT', 'ADMIN_MESSAGE', [flag
            ? p.name + ' switched your admin mode on for this session.'
            : p.name + ' switched your admin mode off for this session.']));
        this.reply(target.name + '\'s admin mode is ' + (flag ? 'on' : 'off') + ' for this session (not saved).');
    }

    handleHelp() {
        this.reply(SPAWN_USAGE);
        this.reply(
            'types: ' +
                MapEntityStore.typeNames.join(', ') +
                ' -- e.g. /spawn mob 5 level=10 o=l, /spawn npcstatic 5 name="Bob"'
        );
        this.reply('/despawn [entityId] -- removes the nearest (or given) placed entity');
        this.reply('/spawnlist -- placed entities near you');
        this.reply('/pos -- your map and coordinates');
        this.reply('/select [entityId] -- select the nearest (or given) entity.json NPC and list its quests');
        this.reply(ADDQUEST_USAGE + ' -- adds a quest to the selected NPC');
        this.reply('/setadmin on|off [player] -- switch your own, or an online player\'s, admin mode for this session (not saved)');
    }

    handleSpawn(args) {
        const parsed = parseArgs(args);
        if (parsed.error) {
            this.reply(parsed.error);
            return;
        }
        const words = parsed.positional;
        if (words.length < 2) {
            this.reply(SPAWN_USAGE);
            return;
        }
        if (words.length > 2) {
            this.reply(
                'Unexpected "' +
                    words.slice(2).join(' ') +
                    '". Optional values go as key=value, e.g. name="Bob" level=10 o=d'
            );
            return;
        }

        const type = MapEntityStore.normalizeType(words[0]);
        if (!type) {
            this.reply(
                'Unknown type "' +
                    words[0] +
                    '". Use one of: ' +
                    MapEntityStore.typeNames.join(', ')
            );
            return;
        }

        if (!/^\d+$/.test(words[1])) {
            this.reply(
                'kindId must be a number, got "' + words[1] + '". ' + SPAWN_USAGE
            );
            return;
        }
        const kind = parseInt(words[1], 10);

        const rec = { type, kind };
        for (const [rawKey, value] of parsed.options) {
            const key = OPTION_ALIASES[rawKey.toLowerCase()];
            if (!key) {
                this.reply(
                    'Unknown option "' +
                        rawKey +
                        '". Options: name=, level=, o= (u/d/l/r)'
                );
                return;
            }
            if (key === 'name') {
                // Blank (name="" or name=) means "use the default name".
                if (value === '') continue;
                if (!NAME_PATTERN.test(value)) {
                    this.reply(
                        'Name may only use letters, numbers, spaces and _ \' . -'
                    );
                    return;
                }
                rec.name = value;
            } else if (key === 'level') {
                if (value === '') continue;
                if (!LEVEL_TYPES.has(type)) {
                    this.reply('level= only applies to mob and node.');
                    return;
                }
                if (!/^\d+$/.test(value)) {
                    this.reply('level must be a number, got "' + value + '".');
                    return;
                }
                rec.level = parseInt(value, 10);
            } else if (key === 'orientation') {
                if (value === '') continue;
                const o = MapEntityStore.normalizeOrientation(value);
                if (!o) {
                    this.reply('o must be u, d, l or r (up/down/left/right).');
                    return;
                }
                rec.orientation = o;
            }
        }

        const p = this.player;
        const store = this.store();
        if (!store) {
            this.reply('You are not on a map that supports spawning.');
            return;
        }

        // Exactly where the admin's centre is (an entity's x/y is its
        // centre point) -- no snapping to the tile grid.
        rec.x = p.x;
        rec.y = p.y;

        const res = store.add(rec);
        if (res.error) {
            this.reply('Spawn failed: ' + res.error);
            return;
        }

        const e = res.entity;
        this.reply(
            'Spawned ' +
                type +
                ' kind ' +
                kind +
                (e.name ? ' "' + e.name + '"' : '') +
                (LEVEL_TYPES.has(type) ? ' level ' + e.level : '') +
                (rec.orientation ? ' facing ' + rec.orientation : '') +
                ' (entity id ' +
                e.id +
                ') at ' +
                rec.x +
                ',' +
                rec.y +
                ' on ' +
                p.map.name +
                '. Saved.'
        );
    }

    handleDespawn(args) {
        const p = this.player;
        const store = this.store();
        if (!store) {
            this.reply('You are not on a map that supports spawning.');
            return;
        }

        let entity;
        const idArg = args.split(/\s+/)[0];
        if (idArg) {
            if (!/^\d+$/.test(idArg)) {
                this.reply('Usage: /despawn [entityId]');
                return;
            }
            entity = p.map.entities.getEntityById(parseInt(idArg, 10));
            if (!entity || !store.isSaved(entity)) {
                this.reply(
                    'Entity ' + idArg + ' is not an admin-placed entity on this map.'
                );
                return;
            }
        } else {
            entity = store.findNearest(p.x, p.y, DESPAWN_RANGE_TILES);
            if (!entity) {
                this.reply(
                    'No admin-placed entity within ' +
                        DESPAWN_RANGE_TILES +
                        ' tiles. Use /spawnlist to find ids.'
                );
                return;
            }
        }

        const id = entity.id;
        const rec = store.remove(entity);
        this.reply(
            'Removed ' +
                rec.type +
                ' kind ' +
                rec.kind +
                (rec.name ? ' "' + rec.name + '"' : '') +
                ' (entity id ' +
                id +
                '). Saved.'
        );
    }

    // The NPC /addquest works on: the one picked with /select (if it's still
    // there), else the nearest NPC from entity.json. Only entity.json NPCs:
    // their entity id is fixed, and quest ids are built from it.
    // Returns { npc } or { error } -- if something else is selected (a mob, a
    // map-file NPC...), says so rather than quietly using another NPC.
    selectedNpc() {
        const p = this.player;
        const store = this.store();
        if (!store) return { error: 'You are not on a map with placed entities.' };
        if (p.adminSelection && p.adminSelection.map === p.map) {
            const e = p.map.entities.getEntityById(p.adminSelection.id);
            if (e) {
                if (this.isQuestNpc(store, e)) return { npc: e };
                return {
                    error:
                        'The selected entity (' + this.describeEntity(store, e) +
                        ') is not an NPC from this map\'s entity.json, so it can\'t have quests.'
                };
            }
        }
        const npc = this.nearestQuestNpc(store);
        if (npc) return { npc };
        return {
            error:
                'Select an NPC first with /select (or click one), or stand within ' +
                SELECT_RANGE_TILES +
                ' tiles of one from entity.json.'
        };
    }

    // "mob kind 5 "Rat" (entity id 812, level 20)" -- for any entity.
    describeEntity(store, entity) {
        const rec = store && store.byEntityId.get(entity.id);
        const typeName = rec ? rec.type : entityTypeName(entity.type);
        return (
            typeName +
            ' kind ' +
            entity.kind +
            (entity.name ? ' "' + entity.name + '"' : '') +
            ' (entity id ' +
            entity.id +
            (entity.level ? ', level ' + entity.level : '') +
            (rec ? ', in entity.json' : '') +
            ')'
        );
    }

    isQuestNpc(store, entity) {
        const rec = store.byEntityId.get(entity.id);
        return !!rec && QUEST_TYPES.has(rec.type);
    }

    nearestQuestNpc(store) {
        const p = this.player;
        const max = SELECT_RANGE_TILES * G_TILESIZE;
        let best = null;
        let bestDist = Infinity;
        for (const [id, rec] of store.byEntityId) {
            if (!QUEST_TYPES.has(rec.type)) continue;
            const e = p.map.entities.getEntityById(id);
            if (!e) continue;
            const d = Math.max(Math.abs(e.x - p.x), Math.abs(e.y - p.y));
            if (d <= max && d < bestDist) {
                best = e;
                bestDist = d;
            }
        }
        return best;
    }

    describeNpc(store, entity) {
        const rec = store.byEntityId.get(entity.id);
        const quests = QuestData.questsForNpc(entity.mapIndex, entity.id);
        return (
            rec.type +
            ' "' +
            entity.name +
            '" (entity id ' +
            entity.id +
            ') -- ' +
            (quests.length
                ? quests.length + ' quest(s): ' + quests.join(', ')
                : 'no quests')
        );
    }

    handleSelect(args) {
        const p = this.player;
        const store = this.store();
        if (!store) {
            this.reply('You are not on a map with placed entities.');
            return;
        }
        let entity;
        const idArg = args.split(/\s+/)[0];
        if (idArg) {
            if (!/^\d+$/.test(idArg)) {
                this.reply('Usage: /select [entityId]');
                return;
            }
            entity = p.map.entities.getEntityById(parseInt(idArg, 10));
            if (!entity) {
                this.reply('No entity ' + idArg + ' on this map.');
                return;
            }
        } else {
            entity = this.nearestQuestNpc(store);
            if (!entity) {
                this.reply(
                    'No entity.json NPC within ' +
                        SELECT_RANGE_TILES +
                        ' tiles. Use /spawnlist to find ids.'
                );
                return;
            }
        }
        p.adminSelection = { map: p.map, id: entity.id };
        this.reply(
            'Selected ' +
                (this.isQuestNpc(store, entity)
                    ? this.describeNpc(store, entity)
                    : this.describeEntity(store, entity)) +
                '.'
        );
    }

    handleAddQuest(args) {
        const p = this.player;
        const sel = this.selectedNpc();
        if (sel.error) {
            this.reply(sel.error);
            return;
        }
        const npc = sel.npc;

        const parsed = parseArgs(args);
        if (parsed.error) {
            this.reply(parsed.error);
            return;
        }
        const pos = parsed.positional;
        const opts = {};
        for (const [k, v] of parsed.options) opts[k.toLowerCase()] = v;
        const int = (v) => (/^\d+$/.test(String(v)) ? parseInt(v, 10) : NaN);
        const kind = String(pos[0] || '').toLowerCase();

        const data = { type: 0, level: 0 };
        let what;
        if (kind === 'kill') {
            const mobKind = int(pos[1]);
            const count = int(pos[2]);
            if (!MobData.Kinds[mobKind]) return this.reply('No mob with kind id ' + pos[1] + '. ' + ADDQUEST_USAGE);
            if (!(count >= 1 && count <= 999)) return this.reply('count must be 1-999. ' + ADDQUEST_USAGE);
            data.type = Types.QuestType.KILLMOBKIND;
            data.object = { type: Types.EntityTypes.MOB, kind: mobKind, count };
            what = 'kill ' + count + ' ' + MobData.Kinds[mobKind].key;
        } else if (kind === 'get') {
            const mobKind = int(pos[1]);
            const lootKind = int(pos[2]);
            const count = int(pos[3]);
            const chance = opts.chance !== undefined ? int(opts.chance) : 20;
            if (!MobData.Kinds[mobKind]) return this.reply('No mob with kind id ' + pos[1] + '. ' + ADDQUEST_USAGE);
            if (!ItemLootData.ItemLoot[lootKind]) return this.reply('No loot item with kind id ' + pos[2] + '. ' + ADDQUEST_USAGE);
            if (!(count >= 1 && count <= 99)) return this.reply('count must be 1-99. ' + ADDQUEST_USAGE);
            if (!(chance >= 1 && chance <= 100)) return this.reply('chance must be 1-100.');
            data.type = Types.QuestType.GETITEMKIND;
            data.object = { type: Types.EntityTypes.MOB, kind: mobKind };
            data.object2 = { type: Types.EntityTypes.ITEMLOOT, kind: lootKind, count, chance };
            what = 'get ' + count + ' ' + ItemLootData.ItemLoot[lootKind].name + ' from ' + MobData.Kinds[mobKind].key;
        } else if (kind === 'use') {
            const nodeKind = int(pos[1]);
            const count = int(pos[2]);
            if (!(nodeKind >= 0)) return this.reply('nodeKind must be a whole number. ' + ADDQUEST_USAGE);
            if (!(count >= 1 && count <= 999)) return this.reply('count must be 1-999. ' + ADDQUEST_USAGE);
            data.type = Types.QuestType.USENODE;
            data.object = { type: Types.EntityTypes.NODE, kind: nodeKind, count };
            what = 'use ' + count + ' of node kind ' + nodeKind;
        } else {
            this.reply(ADDQUEST_USAGE);
            return;
        }
        if (opts.gold !== undefined) {
            const gold = int(opts.gold);
            if (!(gold >= 0)) return this.reply('gold must be a whole number.');
            data.gold = gold;
        }
        if (opts.exp !== undefined) {
            const exp = Number(opts.exp);
            if (!(exp > 0 && exp <= 100)) return this.reply('exp (XP multiplier) must be above 0 and at most 100.');
            data.expMultiplier = exp;
        }
        data.name = opts.name ? String(opts.name).slice(0, 40) : what;

        // Quest id: 1 + map index + entity id + the NPC's next quest number.
        const prefix = questIdPrefix(QUEST_STATIC, p.map.index, npc.id);
        let number = 0;
        for (const id in QuestData.Data) {
            if (id.length === prefix.length + 2 && id.startsWith(prefix))
                number = Math.max(number, parseInt(id.slice(prefix.length), 10));
        }
        number++;
        if (number > MAX_QUESTS_PER_NPC) {
            this.reply('This NPC already has ' + MAX_QUESTS_PER_NPC + ' quests.');
            return;
        }
        const questId = String(makeQuestId(QUEST_STATIC, p.map.index, npc.id, number));

        // The quest belongs to the NPC through its id (map index + entity
        // id), so nothing on the NPC's entity.json record changes.
        addQuest(questId, data);
        npc.setQuests(QuestData.questsForNpc(p.map.index, npc.id));
        this.reply(
            'Added quest ' + questId + ' (' + data.name + ') to "' + npc.name + '". Saved to quests.json.'
        );
    }

    handleSpawnList() {
        const p = this.player;
        const store = this.store();
        if (!store || store.count === 0) {
            this.reply('No admin-placed entities on this map.');
            return;
        }

        const range = SPAWNLIST_RANGE_TILES * G_TILESIZE;
        const near = [];
        for (const [id, rec] of store.byEntityId) {
            const e = p.map.entities.getEntityById(id);
            if (!e) continue;
            const d = Math.max(Math.abs(e.x - p.x), Math.abs(e.y - p.y));
            if (d <= range) near.push({ id, rec, d });
        }
        near.sort((a, b) => a.d - b.d);

        this.reply(
            store.count +
                ' placed on ' +
                p.map.name +
                ', ' +
                near.length +
                ' within ' +
                SPAWNLIST_RANGE_TILES +
                ' tiles:'
        );
        for (const { id, rec } of near.slice(0, SPAWNLIST_MAX)) {
            this.reply(
                '#' +
                    id +
                    ' ' +
                    rec.type +
                    ' kind ' +
                    rec.kind +
                    (rec.name ? ' "' + rec.name + '"' : '') +
                    (rec.level ? ' lv ' + rec.level : '') +
                    (rec.orientation ? ' ' + rec.orientation : '') +
                    ' @ ' +
                    rec.x +
                    ',' +
                    rec.y
            );
        }
    }

    handlePos() {
        const p = this.player;
        this.reply(
            (p.map ? p.map.name : '?') +
                ' tile ' +
                Math.floor(p.x / G_TILESIZE) +
                ',' +
                Math.floor(p.y / G_TILESIZE) +
                ' (x ' +
                p.x +
                ', y ' +
                p.y +
                ')'
        );
    }
}

// Splits "mob 5 name=\"Old Bob\" level=10 o=l" into positional words
// (["mob", "5"]) and key=value options ([["name","Old Bob"], ...]).
// Values may be wrapped in "double" or 'single' quotes to include spaces;
// key="" (or key=) gives an empty value.
// Types.EntityTypes id -> its name in lower case ("mob", "npcstatic", ...).
function entityTypeName(type) {
    for (const name in Types.EntityTypes) {
        if (Types.EntityTypes[name] === type) return name.toLowerCase();
    }
    return 'entity';
}

function parseArgs(text) {
    const positional = [];
    const options = [];
    const re = /(\S+?)=(?:"([^"]*)"|'([^']*)'|(\S*))|"([^"]*)"|(\S+)/g;
    let m;
    while ((m = re.exec(text)) !== null) {
        if (m[1] !== undefined) {
            const value =
                m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4];
            if (/^["']/.test(value))
                return { error: 'Unclosed quote in ' + m[0] };
            options.push([m[1], value.trim()]);
        } else {
            const word = m[5] !== undefined ? m[5] : m[6];
            if (/["']/.test(word.charAt(0)) && m[5] === undefined)
                return { error: 'Unclosed quote in ' + word };
            positional.push(word);
        }
    }
    return { positional, options };
}

function commandName(text) {
    const trimmed = String(text).trim();
    const i = trimmed.search(/\s/);
    return (i === -1 ? trimmed : trimmed.substring(0, i)).toLowerCase();
}

export default AdminCommands;
