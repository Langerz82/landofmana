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

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Messages from '../message.js';
import { Types } from '../common.js';
import MobData from '../data/mobdata.js';
import NpcData from '../data/npcdata.js';
import Mob from '../entity/mob/mob.js';
import Node from '../entity/node.js';
import QuestData from '../data/questdata.js';
import { G_TILESIZE } from '../constants.js';

// ADMIN: entities placed in-game by an admin with the /spawn chat command
// (see packets/admincommands.js). Each map gets its own store, persisted to
//
//     gameserver/data/maps/<map name>/entity.json
//
// as a plain JSON array of records:
//
//     { "type": "mob", "kind": 5, "x": 16333, "y": 16390,
//       "name": "Rat King", "level": 12, "orientation": "left" }
//     { "type": "npcstatic", "kind": 5, "x": 16333, "y": 16390,
//       "name": "Bob", "quests": "300000,300001" }
//
// x/y are the exact world (pixel) position of the admin's centre when they
// ran /spawn -- not snapped to the tile grid. Everything after x/y is
// optional: `name`, `level`, `orientation` (up/down/left/right or u/d/l/r;
// default down) and, for npcs, `quests` -- a comma-separated list of quest
// ids from shared/data/quests.json, the same format the map files' own NPC
// entries use (see MapEntities.createEntity()). The file is safe to
// hand-edit while the server is stopped; it is re-read and every record
// respawned each time the map
// loads (MapManager calls load() last in each map's ready callback, after
// the procedural spawns, so it never shifts the ids those get).
//
// Resolved off this module's own location (not process.cwd()) for the same
// reason as data/entityspawndata.js's SPAWN_DATA_PATH.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MAPS_DATA_DIR = path.join(__dirname, '../../data/maps');

// Chat-command type name -> Types.EntityTypes value. Aliases point at the
// same canonical name, which is what gets written to entity.json.
const TYPE_ALIASES = {
    mob: 'mob',
    monster: 'mob',
    npc: 'npcmove',
    npcmove: 'npcmove',
    npcstatic: 'npcstatic',
    node: 'node'
};

const TYPE_IDS = {
    mob: Types.EntityTypes.MOB,
    npcmove: Types.EntityTypes.NPCMOVE,
    npcstatic: Types.EntityTypes.NPCSTATIC,
    node: Types.EntityTypes.NODE
};

// Orientation spellings -> canonical name saved in entity.json, and the
// canonical name -> Types.Orientations value the entity actually uses.
const ORIENTATION_ALIASES = {
    u: 'up',
    up: 'up',
    d: 'down',
    down: 'down',
    l: 'left',
    left: 'left',
    r: 'right',
    right: 'right'
};
const ORIENTATION_IDS = {
    up: Types.Orientations.UP,
    down: Types.Orientations.DOWN,
    left: Types.Orientations.LEFT,
    right: Types.Orientations.RIGHT
};

const MAX_NAME_LENGTH = 32;
const MAX_LEVEL = 999;

class MapEntityStore {
    constructor(map) {
        this.map = map;
        this.filePath = path.join(MAPS_DATA_DIR, map.name, 'entity.json');
        // Persisted records, in file order.
        this.records = [];
        // Live entity id -> its record, so /despawn can find and drop the
        // right line from entity.json.
        this.byEntityId = new Map();
        // Serializes writes so two quick /spawn commands can't interleave
        // their file writes.
        this.writeChain = Promise.resolve();
    }

    static get typeNames() {
        return Object.keys(TYPE_ALIASES);
    }

    static normalizeType(name) {
        return TYPE_ALIASES[String(name || '').toLowerCase()] || null;
    }

    // "300000, 300001" / ["300000", 300001] -> { quests: "300000,300001" },
    // or { error } if empty, malformed or naming a quest that doesn't exist.
    static normalizeQuests(value) {
        const ids = (Array.isArray(value) ? value : String(value).split(','))
            .map((id) => String(id).trim())
            .filter((id) => id !== '');
        if (!ids.length) return { error: 'quests= needs at least one quest id' };
        const bad = ids.filter((id) => !/^\d+$/.test(id));
        if (bad.length)
            return { error: 'quest ids must be numbers, got: ' + bad.join(', ') };
        const missing = ids.filter((id) => !QuestData.Data[id]);
        if (missing.length)
            return { error: 'no quest with id ' + missing.join(', ') };
        return { quests: [...new Set(ids)].join(',') };
    }

    static normalizeOrientation(value) {
        return ORIENTATION_ALIASES[String(value || '').toLowerCase()] || null;
    }

    // Checks a record before it is spawned or saved. Returns an error string,
    // or null when the record is usable.
    static validate(rec) {
        if (!rec || !TYPE_IDS[rec.type]) return 'unknown entity type';
        if (!Number.isInteger(rec.kind) || rec.kind < 0)
            return 'kind id must be a whole number';
        if (!Number.isFinite(rec.x) || !Number.isFinite(rec.y))
            return 'bad position';
        if (rec.type === 'mob' && !MobData.Kinds[rec.kind])
            return 'no mob with kind id ' + rec.kind;
        if (
            (rec.type === 'npcmove' || rec.type === 'npcstatic') &&
            !NpcData.Kinds[rec.kind]
        )
            return 'no npc with kind id ' + rec.kind;
        if (
            rec.level !== undefined &&
            (!Number.isInteger(rec.level) ||
                rec.level < 1 ||
                rec.level > MAX_LEVEL)
        )
            return 'level must be 1-' + MAX_LEVEL;
        if (rec.orientation !== undefined && !ORIENTATION_IDS[rec.orientation])
            return 'orientation must be up, down, left or right';
        if (rec.quests !== undefined) {
            if (rec.type !== 'npcmove' && rec.type !== 'npcstatic')
                return 'quests only apply to npcs';
            const q = MapEntityStore.normalizeQuests(rec.quests);
            if (q.error) return q.error;
        }
        if (rec.name !== undefined) {
            if (typeof rec.name !== 'string' || !rec.name.length)
                return 'bad name';
            if (rec.name.length > MAX_NAME_LENGTH)
                return 'name is longer than ' + MAX_NAME_LENGTH + ' characters';
        }
        return null;
    }

    // Reads entity.json and spawns every record. Synchronous on purpose:
    // it runs once per map during startup, before any player can connect.
    load() {
        let raw;
        try {
            raw = fs.readFileSync(this.filePath, 'utf8');
        } catch (err) {
            if (err.code !== 'ENOENT')
                console.error(
                    'MapEntityStore: failed to read ' +
                        this.filePath +
                        ': ' +
                        err.message
                );
            return;
        }

        let list;
        try {
            list = JSON.parse(raw);
        } catch (err) {
            console.error(
                'MapEntityStore: failed to parse ' +
                    this.filePath +
                    ': ' +
                    err.message
            );
            return;
        }
        if (!Array.isArray(list)) {
            console.error(
                'MapEntityStore: ' + this.filePath + ' is not a JSON array.'
            );
            return;
        }

        let spawned = 0;
        for (const item of list) {
            const rec = this._normalizeRecord(item);
            const err = MapEntityStore.validate(rec);
            if (err) {
                // Keep the bad line in the file (so a typo isn't silently
                // deleted on the next save) but don't spawn it.
                console.warn(
                    'MapEntityStore: skipping ' +
                        JSON.stringify(item) +
                        ' in ' +
                        this.filePath +
                        ' -- ' +
                        err
                );
                this.records.push(item);
                continue;
            }
            this.records.push(rec);
            const entity = this._spawn(rec);
            if (entity) {
                this.byEntityId.set(entity.id, rec);
                spawned++;
            }
        }
        console.info(
            'MapEntityStore: ' +
                this.map.name +
                ' -- spawned ' +
                spawned +
                ' saved entit' +
                (spawned === 1 ? 'y' : 'ies') +
                ' from ' +
                this.filePath
        );
    }

    // Spawns a new record at runtime, shows it to nearby players and saves
    // entity.json. Returns { entity } on success or { error } on failure.
    add(rec) {
        rec = this._normalizeRecord(rec);
        const err = MapEntityStore.validate(rec);
        if (err) return { error: err };

        const entity = this._spawn(rec);
        if (!entity) return { error: 'could not create the entity' };

        this.records.push(rec);
        this.byEntityId.set(entity.id, rec);
        this._announce(entity);
        this.save();
        return { entity, record: rec };
    }

    // Removes an admin-placed entity from the map and from entity.json.
    // Returns the removed record, or null if `entity` isn't one of ours.
    remove(entity) {
        const rec = this.byEntityId.get(entity.id);
        if (!rec) return null;

        this.byEntityId.delete(entity.id);
        const idx = this.records.indexOf(rec);
        if (idx !== -1) this.records.splice(idx, 1);

        this._despawn(entity);
        this.save();
        return rec;
    }

    isSaved(entity) {
        return !!entity && this.byEntityId.has(entity.id);
    }

    // Nearest admin-placed, live entity within `maxTiles` of (x, y).
    findNearest(x, y, maxTiles) {
        const entities = this.map.entities;
        const maxDist = maxTiles * G_TILESIZE;
        let best = null;
        let bestDist = Infinity;
        for (const id of this.byEntityId.keys()) {
            const e = entities.getEntityById(id);
            if (!e) continue;
            const d = Math.max(Math.abs(e.x - x), Math.abs(e.y - y));
            if (d <= maxDist && d < bestDist) {
                best = e;
                bestDist = d;
            }
        }
        return best;
    }

    get count() {
        return this.byEntityId.size;
    }

    save() {
        const json = JSON.stringify(this.records, null, 2) + '\n';
        const file = this.filePath;
        const tmp = file + '.tmp';
        this.writeChain = this.writeChain
            .then(async () => {
                await fs.promises.mkdir(path.dirname(file), {
                    recursive: true
                });
                // Write-then-rename so a crash mid-write can't leave a
                // truncated entity.json behind.
                await fs.promises.writeFile(tmp, json, 'utf8');
                await fs.promises.rename(tmp, file);
            })
            .catch((err) => {
                console.error(
                    'MapEntityStore: failed to save ' + file + ': ' + err.message
                );
            });
        return this.writeChain;
    }

    _normalizeRecord(item) {
        if (!item || typeof item !== 'object') return null;
        const rec = {
            type: MapEntityStore.normalizeType(item.type),
            kind: Number(item.kind),
            x: Number(item.x),
            y: Number(item.y)
        };
        if (item.name !== undefined && item.name !== null && item.name !== '')
            rec.name = String(item.name);
        if (item.level !== undefined && item.level !== null && item.level !== '')
            rec.level = Number(item.level);
        if (
            item.orientation !== undefined &&
            item.orientation !== null &&
            item.orientation !== ''
        )
            rec.orientation =
                MapEntityStore.normalizeOrientation(item.orientation) ||
                String(item.orientation); // invalid -> caught by validate()
        if (item.quests !== undefined && item.quests !== null && item.quests !== '') {
            const q = MapEntityStore.normalizeQuests(item.quests);
            // Invalid lists are kept raw so validate() reports them.
            rec.quests = q.error ? item.quests : q.quests;
        }
        return rec;
    }

    _spawn(rec) {
        const entities = this.map.entities;
        let entity = null;
        try {
            switch (rec.type) {
                case 'mob':
                    // No MobArea: the mob stands guard at this exact spot
                    // and respawns back here (see Mob.fixedSpawn).
                    entity = entities.addMob(rec.kind, rec.x, rec.y, null);
                    entity.fixedSpawn = { x: rec.x, y: rec.y };
                    if (rec.level) entity.setLevel(rec.level);
                    break;
                case 'npcmove':
                    entity = entities.addNpcMove(rec.kind, rec.x, rec.y);
                    // addNpc*() snaps to the tile centre; put it back on
                    // the exact saved spot.
                    entity.setPosition(rec.x, rec.y);
                    break;
                case 'npcstatic':
                    entity = entities.addNpcStatic(rec.kind, rec.x, rec.y);
                    entity.setPosition(rec.x, rec.y);
                    break;
                case 'node':
                    entity = entities.addNode(rec.kind, rec.x, rec.y);
                    entity.level = rec.level || 1;
                    if (rec.kind !== Node.CHEST_KIND)
                        entity.animName = 'node' + entity.level;
                    // setDrops() ran in the constructor before the level
                    // was known; redo it now the level is set.
                    entity.setDrops();
                    break;
            }
        } catch (err) {
            console.error(
                'MapEntityStore: failed to spawn ' +
                    JSON.stringify(rec) +
                    ': ' +
                    err.stack
            );
            return null;
        }
        if (entity && rec.name) entity.name = rec.name;
        if (entity && rec.quests) entity.setQuests(rec.quests.split(','));
        if (entity) {
            // Face down unless the record says otherwise.
            entity.orientation = ORIENTATION_IDS[rec.orientation || 'down'];
            // Mobs turn back to this way when they respawn
            // (entity/mob/mobrespawn.js).
            if (entity.fixedSpawn)
                entity.fixedSpawn.orientation = entity.orientation;
        }
        return entity;
    }

    // Pushes a freshly spawned entity to every player who can currently see
    // that spot. processWho() also records it in each player's knownIds, so
    // it isn't sent a second time on their next move.
    _announce(entity) {
        const entities = this.map.entities;
        for (const player of entities.players.values()) {
            if (entities.isOffset(player, entity)) entities.processWho(player);
        }
    }

    _despawn(entity) {
        const entities = this.map.entities;
        entities.sendNeighbours(entity, new Messages.Despawn(entity));

        if (entity instanceof Mob) {
            // Don't route through Mob.destroy() -- it queues the mob for
            // respawn, which would bring it straight back.
            entity.endEffects();
            entity.forgetEveryone();
            entity.clearTarget();
            const queue = entity.mobAI && entity.mobAI.mobsToRespawn;
            if (queue) {
                const i = queue.indexOf(entity);
                if (i !== -1) queue.splice(i, 1);
            }
        }
        // A harvested node may already have a respawn scheduled; neuter it
        // so it can't re-announce a removed entity.
        entity.respawn = function () {};
        entity.respawnCallback = null;
        entity.isDead = true;

        entities.removeEntity(entity, false);
    }
}

export default MapEntityStore;
