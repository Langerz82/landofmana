import Entity from './entity.js';
//import Utils from '../utils.js';
import Messages from '../message.js';
import { Types } from '../common.js';
import Area from '../area/area.js';
import ItemData from '../data/itemdata.js';

class Node extends Entity {
    constructor(id, kind, x, y, map, level, type) {
        super(id, Types.EntityTypes.NODE, kind, x, y, map);

        type = type || 1;

        this.stats = {};
        this.level = level;

        this.setDrops();

        // Chests are just Nodes spawned with the reserved Node.CHEST_KIND
        // kind -- same spawn/despawn/respawn/harvest machinery as ore &
        // tree nodes (die(), handleRespawn(), setDrops(), the generic
        // EntityArea respawn cycle), only the sprite, weapon type, drop
        // table and open duration differ.
        if (kind === Node.CHEST_KIND) {
            this.isChest = true;
            this.weaponType = "any";
            this.spriteName = "chest";
            // NOTE: the client's Node.getAnimationByName() override looks up
            // the animation by `this.name`, not by the orientation-suffixed
            // name animate() would normally compute -- so `name` has to be
            // an actual key in the "chest" sprite's animations block
            // ("idle_down" is the only one defined). This name is never
            // shown to the player (renderer.drawEntityName() has no NODE
            // branch), so the odd-looking value is harmless.
            this.name = "idle_down";
            this.animName = "idle";
            this.spawnDelay = 300000;
            this.harvestDuration = 1000;
        }
        else {
            this.spawnDelay = 60000;
            this.spriteName = "nodeset"+kind;
            this.animName = "node"+type;
        }
    }

    getState() {
        const arr = this._getBaseState();
        return arr.concat([this.level, this.spriteName, this.animName, this.weaponType]);
    }

    onDeath(callback) {
        this.death_callback = callback;
    }

    die() {
        this.isDead = true;
        this.map.entities.sendNeighbours(this, new Messages.Despawn(this));

        this.handleRespawn();
        if (this.death_callback) {
            this.death_callback();
        }
    }

    setDrops(player) {
        this.drops = {};

        // FIX: the `else` previously only bound to the `level === 3` check
        // (each level was a separate `if`), so level-1 and level-2 nodes fell
        // through to the `else` too and got drops[304] added on top of their
        // own level-specific drop. Chaining with `else if` makes the four
        // levels mutually exclusive, as the drop IDs (301-304) imply they
        // were meant to be.
        if (this.kind === 2) {
            if (this.level === 1)
                this.drops[301] = 2000;
            else if (this.level === 2)
                this.drops[302] = 2000;
            else if (this.level === 3)
                this.drops[303] = 2000;
            else
                this.drops[304] = 2000;
        }
        // Merged in from the old standalone Chest entity: drop table scales
        // with level (rounded up to the nearest 10) and favors
        // equipment/craft items whose modifier sits near that level band.
        else if (this.kind === Node.CHEST_KIND) {
            const dropLevel = Math.ceil(this.level / 10) * 10;

            for (const itemId in ItemData.Kinds) {
                const item = ItemData.Kinds[itemId];
                if (!item)
                    continue;
                if (item.legacy === 1)
                    continue;

                if (item.typemod === "attack" || item.typemod === "defense") {
                    switch (dropLevel) {
                    case item.modifier+10:
                        this.drops[itemId] = 50;
                        break;
                    case item.modifier:
                        this.drops[itemId] = 20;
                        break;
                    case item.modifier-10:
                        this.drops[itemId] = 5;
                        break;
                    case item.modifier-20:
                        this.drops[itemId] = 1;
                        break;
                    }
                }
            }
        }
    }

    respawn() {
        this.isDead = false;
        // FIX: nothing previously reset `droppedItem` after the first
        // harvest, and respawn() reuses the same Node instance in place
        // (see EntityArea.respawn()) rather than creating a new one -- so
        // lootmanager.getDrop()'s `target.droppedItem === true` guard
        // stayed tripped forever, silently making every node (and now every
        // chest) drop once and then stay empty forever after its first
        // respawn.
        this.droppedItem = false;
        this.map.entities.sendNeighbours(this, new Messages.Spawn(this));
    }

    handleRespawn() {
        const self = this;

        if (this.area && this.area instanceof Area) {
            // Respawn inside the area if part of a MobArea
            this.area.respawn(this, this.spawnDelay);
        }
        else {
            setTimeout(function () {
                self.respawn();
                if (self.respawnCallback) {
                    self.respawnCallback();
                }
            }, this.spawnDelay);
        }
    }
}

// Reserved Node "kind" that identifies a chest. Must match the client's
// Node.CHEST_KIND (client/js/entity/node.js) since it's transmitted as-is
// over the wire (see Entity._getBaseState()'s `kind` field) and used
// client-side to tell chest-nodes apart from ore/tree nodes.
Node.CHEST_KIND = 99;

export default Node;
