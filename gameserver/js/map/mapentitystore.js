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
import { Types } from '../common.js';
import MobData from '../data/mobdata.js';
import NpcData from '../data/npcdata.js';
import Mob from '../entity/mob/mob.js';
import Node from '../entity/node.js';
import { G_TILESIZE, MAX_FIXED_ID } from '../constants.js';
import { GroupEntityFile, partHasPoint } from './mapgroup.js';

// ADMIN: entities placed in-game by an admin with the /spawn chat command
// (see packets/admincommands.js), and the NPCs/bosses the map tools write.
// Each map gets its own store, persisted to
//
//     gameserver/data/maps/<map>/entity.json
//
// -- one file for ALL the parts of a split map (data/maps/map1/entity.json
// for map1/map1_0_0 ... map1/map1_int), in full-map pixel coordinates. Each
// part spawns the records inside its own area of the full map, moved to its
// own coordinates, and saves through the one shared copy of the file
// (map/mapgroup.js GroupEntityFile), so re-splitting the map changes nothing
// here. Ids are unique in the whole file.
//
// as a plain JSON array of records:
//
//     { "type": "mob", "kind": 5, "x": 16333, "y": 16390,
//       "name": "Rat King", "level": 12, "orientation": "left" }
//     { "type": "npcstatic", "kind": 5, "x": 16333, "y": 16390,
//       "name": "Bob" }
//
// x/y are the full-map (pixel) centre of the tile the admin stood on when
// they ran /spawn; entities are always snapped to tile centres when spawned
// (mapentities.js), so hand-edited values off-centre get centred too.
// Everything after x/y is
// optional: `name`, `level`, `orientation` (up/down/left/right or u/d/l/r;
// default down), `spawnDelay` (seconds until it comes back after being
// killed / harvested / opened; default: the entity's own, e.g. a chest's 300),
// and for a mob `boss` (a boss multiplier above 1: its HP, respawn time and
// equipment drop rates are multiplied by it -- MobRespawn.createBoss; an
// explicit spawnDelay still wins over the boosted respawn time), and
// `aggro` (1: the mob attacks players on sight, whatever its kind's
// isAggressive in mobs.json says).
//     { "type": "mob", "kind": 8, "x": 1000, "y": 2000, "level": 20,
//       "boss": 3, "aggro": 1, "name": "Ogre Chief" }
//     { "type": "node", "kind": 99, "x": 96, "y": 848, "level": 8,
//       "spawnDelay": 960 } An NPC's quests aren't listed here: they're the quests
// whose ids name its map's base index and entity id (questid.js), added with the
// admin /addquest command. The file is safe to
// hand-edit while the server is stopped; it is re-read and every record
// respawned each time the map
// loads (MapManager calls load() last in each map's ready callback, after
// the procedural spawns, so it never shifts the ids those get).

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
// Largest boss multiplier a record may give a mob.
const MAX_BOSS = 100;
const MAX_LEVEL = 999;

class MapEntityStore {
    constructor(map) {
        this.map = map;
        // The map's shared entity.json (all the parts of a split map).
        this.file = GroupEntityFile.get(map.name);
        this.filePath = this.file.filePath;
        // This part's records (objects of this.file.records, in full-map
        // coordinates), in file order.
        this.records = [];
        // Live entity id -> its record, so /despawn can find and drop the
        // right line from entity.json.
        this.byEntityId = new Map();
    }

    static get typeNames() {
        return Object.keys(TYPE_ALIASES);
    }

    static normalizeType(name) {
        return TYPE_ALIASES[String(name || '').toLowerCase()] || null;
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
        // Walking NPCs (npcmove) don't use shared/data/npcs.json: their kind
        // only picks a name and look (entity/npcmove.js), so any whole
        // number works -- map1's ring NPCs use kinds 1-56.
        if (rec.type === 'npcstatic' && !NpcData.Kinds[rec.kind])
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
        if (
            rec.spawnDelay !== undefined &&
            (!Number.isFinite(rec.spawnDelay) || rec.spawnDelay <= 0)
        )
            return 'spawnDelay must be a number of seconds above 0';
        if (rec.boss !== undefined) {
            if (rec.type !== 'mob') return 'boss only applies to mobs';
            if (!Number.isFinite(rec.boss) || rec.boss <= 1 || rec.boss > MAX_BOSS)
                return 'boss must be a multiplier above 1 (up to ' + MAX_BOSS + ')';
        }
        if (rec.aggro !== undefined && rec.type !== 'mob')
            return 'aggro only applies to mobs';
        if (rec.name !== undefined) {
            if (typeof rec.name !== 'string' || !rec.name.length)
                return 'bad name';
            if (rec.name.length > MAX_NAME_LENGTH)
                return 'name is longer than ' + MAX_NAME_LENGTH + ' characters';
        }
        return null;
    }

    // Reads entity.json (once for all the parts of a map) and spawns every
    // record inside this part. Synchronous on purpose: it runs once per map
    // during startup, before any player can connect.
    load() {
        const all = this.file.read();
        const map = this.map;
        const entities = map.entities;

        // Fixed ids: every record has its own "id", unique in the whole file,
        // and the entity is spawned with exactly that entity id -- so removing
        // one record (/despawn) never renumbers the others, and an NPC's
        // quests (questid.js: the map's base index + this id) and its
        // lang.json NO_MORE_QUESTS[<base index>][<id>] line stay put. This
        // runs before anything else spawns on the map (mapmanager.js), so the
        // ids are free; afterwards the map's id counter carries on above the
        // highest id in the file, so nothing spawned later on any part shares
        // an id with a record. A record without a usable id (missing, a
        // duplicate in the file, or out of range) gets the next free id, and
        // the file is saved with it.
        const firstFreeAfterLoad = entities.entityCount;
        let maxId = Math.max(0, firstFreeAfterLoad, this.file.maxId());
        const seen = new Set();
        let assigned = 0;
        for (const item of all) {
            if (!item || typeof item !== 'object') continue;
            const id = Number(item.id);
            if (
                !Number.isInteger(id) ||
                id < 1 ||
                id > MAX_FIXED_ID ||
                seen.has(id) ||
                id <= firstFreeAfterLoad
            ) {
                item.id = ++maxId;
                assigned++;
            }
            seen.add(item.id);
        }

        let spawned = 0;
        for (let i = 0; i < all.length; i++) {
            const item = all[i];
            if (!item || typeof item !== 'object') continue;
            const x = Number(item.x);
            const y = Number(item.y);
            // another part's record (a record with a bad position goes to the
            // part at 0,0, which reports it below)
            if (Number.isFinite(x) && Number.isFinite(y)) {
                if (!partHasPoint(map, x, y)) continue;
            } else if (map.offsetX !== 0 || map.offsetY !== 0) continue;

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
                continue;
            }
            // the shared file keeps the normalized record
            all[i] = rec;
            this.records.push(rec);
            // the next entity created gets ++entityCount, i.e. exactly rec.id
            entities.entityCount = rec.id - 1;
            const entity = this._spawn(this._local(rec));
            if (entity) {
                this.byEntityId.set(entity.id, rec);
                spawned++;
            }
        }
        entities.entityCount = maxId;
        if (assigned > 0) {
            console.info(
                'MapEntityStore: gave ' +
                    assigned +
                    ' record(s) in ' +
                    this.filePath +
                    ' a new fixed id; saving.'
            );
            this.save();
        }
        console.info(
            'MapEntityStore: ' +
                map.name +
                ' -- spawned ' +
                spawned +
                ' saved entit' +
                (spawned === 1 ? 'y' : 'ies') +
                ' from ' +
                this.filePath
        );
    }

    // A record (full-map coordinates) -> a copy in this part's coordinates.
    _local(rec) {
        return Object.assign({}, rec, {
            x: rec.x - this.map.offsetX,
            y: rec.y - this.map.offsetY
        });
    }

    // Spawns a new record at runtime, shows it to nearby players and saves
    // entity.json. Returns { entity } on success or { error } on failure.
    add(rec) {
        // `rec` is in this part's coordinates
        // placed with /spawn: captioned as such, unless the record says otherwise
        if (rec && !rec.caption)
            rec = Object.assign({}, rec, {
                caption: 'admin_' + (MapEntityStore.normalizeType(rec.type) || 'entity')
            });
        rec = this._normalizeRecord(rec);
        const err = MapEntityStore.validate(rec);
        if (err) return { error: err };

        // Its fixed id must be unique in the map's whole entity.json (all
        // its parts), and is the entity id it is spawned with, so it comes
        // back with the same id after a restart (see load()).
        const entities = this.map.entities;
        const id = Math.max(entities.entityCount, this.file.maxId()) + 1;
        if (id > MAX_FIXED_ID) return { error: 'no free entity id left' };
        entities.entityCount = id - 1;
        const entity = this._spawn(rec);
        if (!entity) return { error: 'could not create the entity' };

        const saved = Object.assign({ id: entity.id }, rec, {
            id: entity.id,
            x: rec.x + this.map.offsetX,
            y: rec.y + this.map.offsetY
        });
        this.file.read().push(saved);
        this.records.push(saved);
        this.byEntityId.set(entity.id, saved);
        this._announce(entity);
        this.save();
        return { entity, record: saved };
    }

    // Removes an admin-placed entity from the map and from entity.json.
    // Returns the removed record, or null if `entity` isn't one of ours.
    remove(entity) {
        const rec = this.byEntityId.get(entity.id);
        if (!rec) return null;

        this.byEntityId.delete(entity.id);
        const idx = this.records.indexOf(rec);
        if (idx !== -1) this.records.splice(idx, 1);
        const all = this.file.read();
        const fi = all.indexOf(rec);
        if (fi !== -1) all.splice(fi, 1);

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

    // Saves the map's whole entity.json (every part's records).
    save() {
        return this.file.save();
    }

    _normalizeRecord(item) {
        if (!item || typeof item !== 'object') return null;
        const rec = { id: Number(item.id) };
        // "caption": a short note on what the record is ("quest_npc_mainarea",
        // "dungeon_boss", ...), only there to make the file easier to read --
        // the game doesn't use it, but keeps it (right after the id).
        if (item.caption !== undefined && item.caption !== null && item.caption !== '')
            rec.caption = String(item.caption);
        Object.assign(rec, {
            type: MapEntityStore.normalizeType(item.type),
            kind: Number(item.kind),
            x: Number(item.x),
            y: Number(item.y)
        });
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
        if (
            item.spawnDelay !== undefined &&
            item.spawnDelay !== null &&
            item.spawnDelay !== ''
        )
            rec.spawnDelay = Number(item.spawnDelay);
        if (item.boss !== undefined && item.boss !== null && item.boss !== '')
            rec.boss = Number(item.boss);
        if (item.aggro) rec.aggro = 1;
        // (an old "quests" list is dropped: an NPC's quests come from their
        // ids now -- questid.js)
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
                    entity.fixedSpawn = { x: entity.x, y: entity.y };
                    if (rec.level) entity.setLevel(rec.level);
                    // After the level, so the boss HP is built on the
                    // final level (getHpMax() keeps creatureMulti).
                    if (rec.boss > 1) entity.createBoss(rec.boss);
                    if (rec.aggro) entity.isAggressive = true;
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
        // spawnDelay is in seconds in entity.json; entities keep milliseconds
        // (mobai.js for mobs, Node.handleRespawn for nodes and chests).
        if (entity && rec.spawnDelay) entity.spawnDelay = rec.spawnDelay * 1000;
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
