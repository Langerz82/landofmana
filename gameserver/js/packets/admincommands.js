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

import { levelString } from '../map/mapgroup.js';
import Messages from '../message.js';
import MapEntityStore from '../map/mapentitystore.js';
import Utils from '../utils.js';
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
//   /addarea mob <w> <h> count=N include=1,5 [options]  add a mob area / entity area at your tile (gx, gy), w x h
//   /delarea mob|entity [id]        remove a mob / entity area by id: its entities despawn and it
//                                   is taken out of entityarea.json. Without an id, lists the
//                                   areas you are standing in. Areas from the Tiled map (not
//                                   "admin") come back the next time the map is converted.
//   /addarea entity <w> <h> kind=N count=N [options]
//                                   tiles. It spawns at once and is saved to the map's
//                                   data/maps/<map>/entityarea.json marked "admin" (the map
//                                   converter keeps those). Options, all key=value:
//                                     both:   anchor=center|topleft (default center: the
//                                             area is centred on you; topleft: your tile
//                                             is its top-left corner), elipse=1 (an ellipse
//                                             instead of a rectangle)
//                                     mob:    count=N and include=1,5 (the mob kinds it
//                                             spawns) are required; level=N or level=N-N
//                                             (or min=N max=N; default 1),
//                                             kindweight=4,2,1 (one per include kind: how
//                                             often each spawns; default 1 each, not stored),
//                                             levelweight=3,2,1 (one per level; default 1 each, not stored),
//                                             bonus=N (drop multiplier), boss=N,
//                                             spawndelay=N (seconds a dead mob waits to
//                                             respawn; default its kind's own time, x boss)
//                                     entity: type=node|mob|npcmove|npcstatic|block (default
//                                             node), kind=N, count=N, level=N, name=,
//                                             anim= (animName), weapon= (weaponType),
//                                             sprite= (spriteName), apart=N (tiles kept
//                                             between entities), durability=N,
//                                             durabilityMax=N
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
//   boss=3                     (mob only) boss multiplier above 1: HP, respawn time
//                              and equipment drop rates x3 (MobRespawn.createBoss)
//   spawndelay=300             (mob and node) seconds until it comes back after dying
//                              or being used up; wins over boss='s longer respawn
// e.g.
//   /spawn mob 5 level=10 o=l
//   /spawn mob 8 level=20 boss=3 name="Ogre Chief"
//   /spawn mob 10 level=40 boss=10 spawndelay=4800
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
    '/addarea': 'handleAddArea',
    '/delarea': 'handleDelArea',
    '/setadmin': 'handleSetAdmin'
};

const LEVEL_TYPES = new Set(['mob', 'node']);
const SPAWN_USAGE =
    'Usage: /spawn <type> <kindId> [name="..."] [level=N] [o=u|d|l|r] [boss=N (mob only)] [spawndelay=N (seconds, mob and node)]';
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
    dir: 'orientation',
    boss: 'boss',
    spawndelay: 'spawnDelay'
};
// Letters (any language), digits, spaces and a little punctuation.
const NAME_PATTERN = /^[\p{L}\p{N} _'.-]+$/u;
const DESPAWN_RANGE_TILES = 3;
const SELECT_RANGE_TILES = 5;
const ADDAREA_USAGE =
    'Usage: /addarea mob <w> <h> count=N include=1,5 [level=N or N-N kindweight= levelweight= bonus=N boss=N spawndelay=N] | ' +
    '/addarea entity <w> <h> kind=N count=N [type=node level=N name= anim= weapon= sprite= apart=N] -- both: anchor=center|topleft elipse=1';
const DELAREA_USAGE = 'Usage: /delarea mob|entity [id] -- no id lists the areas you are standing in';
const MAX_AREA_TILES = 512;
const MAX_AREA_COUNT = 500;
const AREA_ENTITY_TYPES = {
    node: 'NODE',
    mob: 'MOB',
    npcmove: 'NPCMOVE',
    npc: 'NPCMOVE',
    npcstatic: 'NPCSTATIC',
    block: 'BLOCK'
};
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
        this.reply(ADDAREA_USAGE + ' -- adds a mob/entity area at your tile');
        this.reply(DELAREA_USAGE);
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
                        '". Options: name=, level=, o= (u/d/l/r), boss= (mob only), spawndelay= (seconds, mob and node)'
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
            } else if (key === 'boss') {
                if (value === '') continue;
                if (type !== 'mob') {
                    this.reply('boss= only applies to mob.');
                    return;
                }
                const multi = Number(value);
                if (!/^\d+(\.\d+)?$/.test(value) || !(multi > 1)) {
                    this.reply('boss must be a multiplier above 1, e.g. boss=3, got "' + value + '".');
                    return;
                }
                rec.boss = multi;
            } else if (key === 'spawnDelay') {
                // seconds until it comes back after dying / being used up, saved as
                // entity.json "spawnDelay" (map/mapentitystore.js; wins over boss=)
                if (value === '') continue;
                if (!LEVEL_TYPES.has(type)) {
                    this.reply('spawndelay= only applies to mob and node.');
                    return;
                }
                if (!/^\d+$/.test(value) || !(parseInt(value, 10) >= 1)) {
                    this.reply('spawndelay must be a whole number of seconds above 0, e.g. spawndelay=300, got "' + value + '".');
                    return;
                }
                rec.spawnDelay = parseInt(value, 10);
            }
        }

        const p = this.player;
        const store = this.store();
        if (!store) {
            this.reply('You are not on a map that supports spawning.');
            return;
        }

        // The centre of the tile the admin is standing on (an entity's x/y
        // is its centre point), so placed entities line up with the grid.
        const tc = Utils.fixGridPosition(G_TILESIZE, p.x, p.y);
        rec.x = tc.x;
        rec.y = tc.y;

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
                (rec.boss ? ' boss x' + rec.boss : '') +
                (rec.spawnDelay ? ' respawn ' + rec.spawnDelay + 's' : '') +
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
        const quests = QuestData.questsForNpc(entity.questMapIndex, entity.id);
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

        // Quest id: 1 + the map's base index + entity id + the NPC's next quest number.
        const prefix = questIdPrefix(QUEST_STATIC, npc.questMapIndex, npc.id);
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
        const questId = String(makeQuestId(QUEST_STATIC, npc.questMapIndex, npc.id, number));

        // The quest belongs to the NPC through its id (base index + entity
        // id), so nothing on the NPC's entity.json record changes.
        addQuest(questId, data);
        npc.setQuests(QuestData.questsForNpc(npc.questMapIndex, npc.id));
        this.reply(
            'Added quest ' + questId + ' (' + data.name + ') to "' + npc.name + '". Saved to quests.json.'
        );
    }

    handleAddArea(args) {
        const p = this.player;
        const map = p.map;
        if (!map || !map.entities) {
            this.reply('You are not on a map.');
            return;
        }
        const parsed = parseArgs(args);
        if (parsed.error) return this.reply(parsed.error);
        const pos = parsed.positional;
        const opts = {};
        for (const [k, v] of parsed.options) opts[k.toLowerCase()] = v;
        const int = (v) => (/^\d+$/.test(String(v)) ? parseInt(v, 10) : NaN);
        const csv = (v) => /^\d+(,\d+)*$/.test(String(v));

        const kind = String(pos[0] || '').toLowerCase();
        if (kind !== 'mob' && kind !== 'entity') return this.reply(ADDAREA_USAGE);
        const w = int(pos[1]);
        const h = int(pos[2]);
        if (!(w >= 1 && w <= MAX_AREA_TILES && h >= 1 && h <= MAX_AREA_TILES))
            return this.reply('Width and height are in tiles, 1-' + MAX_AREA_TILES + '. ' + ADDAREA_USAGE);
        const anchor = String(opts.anchor || 'center').toLowerCase().replace(/[-_ ]/g, '');
        if (anchor !== 'center' && anchor !== 'topleft')
            return this.reply('anchor must be center or topleft.');
        const elipse = ['1', 'true', 'yes', 'on'].includes(String(opts.elipse || opts.ellipse || '').toLowerCase());

        // The player's tile, then the area's top-left tile.
        const gx = Math.floor(p.x / G_TILESIZE);
        const gy = Math.floor(p.y / G_TILESIZE);
        const left = anchor === 'center' ? gx - Math.floor(w / 2) : gx;
        const top = anchor === 'center' ? gy - Math.floor(h / 2) : gy;
        if (left < 0 || top < 0 || left + w > map.width || top + h > map.height)
            return this.reply(
                'That area (tiles ' + left + ',' + top + ' to ' + (left + w - 1) + ',' + (top + h - 1) +
                    ') goes off the map (' + map.width + 'x' + map.height + ').'
            );
        // Saved in pixels, like the converter writes them: an ellipse's x/y is
        // its centre (area/area.js), a rectangle's its top-left.
        const pw = w * G_TILESIZE;
        const ph = h * G_TILESIZE;
        const area = {
            x: elipse ? left * G_TILESIZE + pw / 2 : left * G_TILESIZE,
            y: elipse ? top * G_TILESIZE + ph / 2 : top * G_TILESIZE,
            w: pw,
            h: ph
        };
        if (elipse) area.elipse = 1;

        let what;
        if (kind === 'mob') {
            if (opts.count === undefined || opts.include === undefined || opts.include === '')
                return this.reply('count=N and include= (mob kind ids, e.g. include=1,5) are required. ' + ADDAREA_USAGE);
            const count = int(opts.count);
            // level=10 or level=10-12 (like a map's mob area "level"), or the older min= / max=
            let min = opts.min !== undefined ? int(opts.min) : 1;
            let max = opts.max !== undefined ? int(opts.max) : min;
            if (opts.level !== undefined && opts.level !== '') {
                const m = /^(\d+)(?:-(\d+))?$/.exec(String(opts.level).trim());
                if (!m) return this.reply('level= must be a level or a range, e.g. level=10 or level=10-12.');
                min = int(m[1]); max = m[2] !== undefined ? int(m[2]) : min;
                if (max < min) [min, max] = [max, min];
            }
            if (!(count >= 1 && count <= MAX_AREA_COUNT)) return this.reply('count must be 1-' + MAX_AREA_COUNT + '.');
            if (!(min >= 1 && max >= min && max <= 999)) return this.reply('min/max must be levels 1-999, min <= max.');
            // a mob area spawns its include kinds (or, without one, the mobs of its levels)
            if (opts.exclude !== undefined || opts.definite !== undefined)
                return this.reply('exclude= and definite= are gone: list the kinds to spawn with include=. ' + ADDAREA_USAGE);
            for (const k of ['include']) {
                if (opts[k] !== undefined && opts[k] !== '' && !csv(opts[k]))
                    return this.reply(k + '= must be mob kind ids, e.g. ' + k + '=1,5');
                if (opts[k]) {
                    const bad = opts[k].split(',').filter((id) => !MobData.Kinds[id]);
                    if (bad.length) return this.reply('No mob with kind id ' + bad.join(', ') + ' (' + k + '=).');
                }
            }
            if (opts.weight !== undefined)
                return this.reply('weight= is now levelweight= (one per level), e.g. levelweight=4,2,1. ' + ADDAREA_USAGE);
            // kindweight: one per include kind; levelweight: one per level -- 1 each by default, like the
            // map converter (tools/maps/converter/_processmap.js)
            const kinds = opts.include.split(',').length, levels = max - min + 1;
            for (const [k, n, what] of [['kindweight', kinds, 'include kind (' + opts.include + ')'], ['levelweight', levels, 'level ' + min + '-' + max]]) {
                if (opts[k] === undefined || opts[k] === '') continue;
                if (!csv(opts[k])) return this.reply(k + '= must be numbers, e.g. ' + k + '=2,1');
                if (opts[k].split(',').length !== n) return this.reply(k + '= needs one number per ' + what + ': ' + n + '.');
            }
            const bonus = opts.bonus !== undefined ? Number(opts.bonus) : 1;
            if (!(bonus > 0 && bonus <= 100)) return this.reply('bonus (drop multiplier) must be above 0 and at most 100.');
            const boss = opts.boss !== undefined ? int(opts.boss) : 0;
            if (opts.boss !== undefined && !(boss >= 2 && boss <= 100)) return this.reply('boss must be 2-100.');
            // seconds, as "spawnDelay" in entityarea.json / entity.json (map.js initMobAreas)
            const spawnDelay = opts.spawndelay !== undefined ? int(opts.spawndelay) : 0;
            if (opts.spawndelay !== undefined && !(spawnDelay >= 1))
                return this.reply('spawndelay must be a whole number of seconds above 0, e.g. spawndelay=300.');
            // as entityarea.json keeps them: the levels as "level" ("35" or "35-36"), and nothing that
            // is empty or the server's default (no include, bonusDrop 1)
            Object.assign(area, { count, level: levelString(min, max) });
            if (opts.include) area.include = opts.include;
            if (bonus !== 1) area.bonusDrop = bonus;
            // only when given: the server gives every level and include kind 1 by default (area/mobarea.js)
            if (opts.levelweight) area.levelWeight = opts.levelweight;
            if (opts.kindweight) area.kindWeight = opts.kindweight;
            if (boss) area.boss = boss;
            if (spawnDelay) area.spawnDelay = spawnDelay;
            what = count + ' mobs, level ' + (min === max ? min : min + '-' + max) +
                (area.include ? ', kinds ' + area.include : '') +
                (spawnDelay ? ', respawn ' + spawnDelay + 's' : '');
        } else {
            const typeName = AREA_ENTITY_TYPES[String(opts.type || 'node').toLowerCase()];
            if (!typeName) return this.reply('type must be one of ' + Object.keys(AREA_ENTITY_TYPES).join(', ') + '.');
            const ekind = int(opts.kind);
            const count = int(opts.count);
            if (!(ekind >= 0)) return this.reply('kind=N (the entity kind id) is required. ' + ADDAREA_USAGE);
            if (!(count >= 1 && count <= MAX_AREA_COUNT)) return this.reply('count=N (1-' + MAX_AREA_COUNT + ') is required.');
            if (typeName === 'MOB' && !MobData.Kinds[ekind]) return this.reply('No mob with kind id ' + ekind + '.');
            area.type = Types.EntityTypes[typeName];
            area.kind = ekind;
            area.count = count;
            if (opts.level !== undefined) {
                const level = int(opts.level);
                if (!(level >= 1 && level <= 999)) return this.reply('level must be 1-999.');
                area.level = level;
            }
            if (opts.name) area.name = String(opts.name).slice(0, 32);
            if (opts.anim) area.animName = String(opts.anim);
            if (opts.weapon) area.weaponType = String(opts.weapon);
            if (opts.sprite) area.spriteName = String(opts.sprite);
            for (const [o, f] of [['durability', 'durability'], ['durabilitymax', 'durabilityMax']]) {
                if (opts[o] === undefined) continue;
                const v = int(opts[o]);
                if (!(v >= 1)) return this.reply(o + ' must be a whole number above 0.');
                area[f] = v;
            }
            const apart = opts.apart !== undefined ? int(opts.apart) : 0;
            if (!(apart >= 0 && apart <= 50)) return this.reply('apart must be 0-50 tiles.');
            area.distanceApart = apart;
            what = count + ' ' + typeName.toLowerCase() + ' kind ' + ekind + (area.level ? ' level ' + area.level : '');
        }

        const saved = map.addAdminArea(kind, area);
        this.reply(
            'Added ' + kind + ' area id ' + saved.id + ' (' + what + ') -- ' + w + 'x' + h + ' tiles' +
                (elipse ? ' ellipse' : '') + ' from ' + left + ',' + top + ' to ' + (left + w - 1) + ',' + (top + h - 1) +
                ' (you are at ' + gx + ',' + gy + ', ' + anchor + '). Saved to entityarea.json.'
        );
        this.reply(describeArea(kind, saved));
    }

    // "/delarea mob|entity <id>": despawns the area's entities and removes it
    // from the map and from entityarea.json (map.removeArea). With no id,
    // lists the areas of that kind you are standing in.
    handleDelArea(args) {
        const p = this.player;
        const map = p.map;
        if (!map || !map.entities) return this.reply('You are not on a map.');
        const store = this.store();
        const parts = String(args || '').trim().split(/\s+/).filter(Boolean);
        const kind = String(parts[0] || '').toLowerCase();
        if ((kind !== 'mob' && kind !== 'entity') || parts.length > 2) return this.reply(DELAREA_USAGE);
        const live = kind === 'mob' ? map.mobAreas : map.entityAreas;

        if (parts.length === 1) {
            const here = live.filter((a) => a.contains(p.x, p.y));
            if (!here.length) return this.reply('You are not standing in any ' + kind + ' area. ' + DELAREA_USAGE);
            for (const a of here)
                this.reply(
                    kind + ' area id ' + a.id + ': tiles ' +
                        Math.floor((a.elipse ? a.x - a.width / 2 : a.x) / G_TILESIZE) + ',' +
                        Math.floor((a.elipse ? a.y - a.height / 2 : a.y) / G_TILESIZE) +
                        ' ' + Math.round(a.width / G_TILESIZE) + 'x' + Math.round(a.height / G_TILESIZE) +
                        (a.elipse ? ' ellipse' : '') + ', ' + a.entities.length + ' entities'
                );
            return;
        }

        if (!/^\d+$/.test(parts[1])) return this.reply(DELAREA_USAGE);
        const id = parseInt(parts[1], 10);
        const res = map.removeArea(kind, id);
        if (!res) return this.reply('No ' + kind + ' area with id ' + id + ' on this map.');
        for (const e of res.entities) store._despawn(e);
        this.reply(
            'Removed ' + kind + ' area id ' + id + ': ' + res.entities.length + ' entities despawned' +
                (res.saved ? ', removed from entityarea.json.' : ' (it was not in entityarea.json).') +
                (res.saved && !res.saved.admin ? ' It came from the Tiled map, so it comes back the next time the map is converted.' : '')
        );
        if (res.saved) this.reply(describeArea(kind, res.saved));
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
                    (rec.boss ? ' boss x' + rec.boss : '') +
                    (rec.spawnDelay ? ' respawn ' + rec.spawnDelay + 's' : '') +
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

// One chat line with an area's id and every field it was saved with, the
// position also in tiles: "mob area id 3: tiles 45,37 10x6 | count=10 ...".
function describeArea(kind, a) {
    const t = (v) => Math.floor(v / G_TILESIZE);
    const tw = Math.round(a.w / G_TILESIZE);
    const th = Math.round(a.h / G_TILESIZE);
    const left = a.elipse ? t(a.x - a.w / 2) : t(a.x);
    const top = a.elipse ? t(a.y - a.h / 2) : t(a.y);
    const typeName =
        kind === 'entity'
            ? Object.keys(Types.EntityTypes).find((k) => Types.EntityTypes[k] === a.type)
            : null;
    const fields = [];
    for (const [k, v] of Object.entries(a)) {
        if (['id', 'admin', 'x', 'y', 'w', 'h', 'elipse'].includes(k)) continue;
        if (v === '' || v === null || v === undefined) continue;
        fields.push(k + '=' + (k === 'type' && typeName ? typeName.toLowerCase() : v));
    }
    return (
        kind + ' area id ' + a.id + ': tiles ' + left + ',' + top + ' to ' + (left + tw - 1) + ',' + (top + th - 1) +
        ' (' + tw + 'x' + th + (a.elipse ? ' ellipse' : '') + '), px x=' + a.x + ' y=' + a.y + ' w=' + a.w + ' h=' + a.h +
        (fields.length ? ' | ' + fields.join(' ') : '') + (a.admin ? ' [admin]' : ' [Tiled map]')
    );
}

function commandName(text) {
    const trimmed = String(text).trim();
    const i = trimmed.search(/\s/);
    return (i === -1 ? trimmed : trimmed.substring(0, i)).toLowerCase();
}

export default AdminCommands;
