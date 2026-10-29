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
import { logChat } from '../chatlog.js';

// ADMIN: chat commands for players whose account has the Redis admin flag
// (u:<username> admin=1 -- set with the userserver console command
// `setadmin <username>`). Typed into the normal chat box; the server
// swallows them, so they are never broadcast as chat.
//
//   /admin                          list these commands
//   /spawn <type> <kindId> [options] place an entity on your tile
//   /despawn [entityId]             remove an admin-placed entity
//   /spawnlist                      admin-placed entities near you
//   /pos                            your map + coordinates
//
// <type> is one of: mob, npc (alias npcmove), npcstatic, node.
// Options are key=value, in any order, all optional:
//   name=Bob  name="Old Bob"   (blank / omitted = the default name)
//   level=10                   (mob and node only; omitted = random/1)
//   o=u|d|l|r                  facing up/down/left/right
// e.g.
//   /spawn mob 5 level=10 o=l
//   /spawn npcstatic 5 name="Bob"
//
// Spawned entities are saved to gameserver/data/maps/<map>/entity.json and
// respawned on every server start -- see map/mapentitystore.js.

const COMMANDS = {
    '/admin': 'handleHelp',
    '/adminhelp': 'handleHelp',
    '/spawn': 'handleSpawn',
    '/despawn': 'handleDespawn',
    '/spawnlist': 'handleSpawnList',
    '/pos': 'handlePos'
};

const LEVEL_TYPES = new Set(['mob', 'node']);
const SPAWN_USAGE =
    'Usage: /spawn <type> <kindId> [name="..."] [level=N] [o=u|d|l|r]';
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
        if (!p.isAdmin) {
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
