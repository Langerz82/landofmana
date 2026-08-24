import EntityArea from './entityarea.js';
import Block from '../entity/block.js';
import Utils from '../utils.js';
import { G_TILESIZE } from '../constants.js';

class BlockArea extends EntityArea {
    constructor(map, id, x, y, width, height, elipse) {
        super(map, id, x, y, width, height, elipse);
        this.blocks = [];
        this.players = {};
    }

    initArea(kind, width, height) {
        const startID = this.map.entities.entityCount;

        // FIX: `width` (the row length blocks are laid out with, right
        // below) was never stored anywhere on `this` -- isCompleted() below
        // reads `this.numX` to figure out where each row wraps, which was
        // always `undefined`. `i % undefined` is `NaN` for every `i`, so
        // isCompleted()'s `x === 0` "start of a new row" branch could never
        // fire; every consecutive block pair, including the ones spanning a
        // row boundary, fell through to the "same row" check instead.
        this.numX = width;

        let id = 0;
        let blockName;
        for (let j = 0; j < height; ++j) {
            for (let i = 0; i < width; ++i) {
                id = startID + (width * j + i);
                blockName = 'block' + kind + '-' + j + '_' + i;

                let block = this.map.entities.addBlock(kind, x, y, this, blockName);
                this.blocks.push(block);
            }
        }
        this.map.entities.entityCount += width * height;
    }

    randomizeBlocks(distApart) {
        const self = this;
        // PERF: see the PERF comment on Area#getNearbyEntities() (area.js)
        // -- narrows spaceEntityRandomApart()'s overlap-check scope down to
        // entities actually near this block area instead of the full
        // map-entities default. Computed once for the whole area rather
        // than per block: the objects inside it are live references (not
        // copies), so a block repositioned earlier in this same loop is
        // still seen at its new position by later iterations' overlap
        // checks, same as re-querying the live map would have been.
        const nearby = self.getNearbyEntities(distApart);
        for (const i in this.blocks) {
            const block = this.blocks[i];
            const pos = this.map.entities.spaceEntityRandomApart(
                distApart,
                self._getRandomPositionInsideArea.bind(self, 30),
                nearby
            );
            if (pos) {
                block.setPosition(
                    ~~Utils.floorTo(pos.x, G_TILESIZE),
                    ~~Utils.floorTo(pos.y, G_TILESIZE)
                );
            } else {
                console.error('BlockArea - randomizeBlocks: failed.');
            }
        }
    }

    // FIX: the `this.numX` read below was always `undefined` before
    // initArea() started setting it (see the FIX comment there) -- that's
    // fixed now, so the row-wrap branch (`x === 0`) actually runs.
    //
    // FIX: both branches below used `||` between the x-check and y-check,
    // so either half alone was accepted as "adjacent" instead of requiring
    // both. Two separate bugs came out of that:
    //  - Row-start branch: a block starting a new row only needs to satisfy
    //    "one tile below the previous row's start" OR "same x as it", not
    //    both -- so a block that lined up in x but was several rows off
    //    (or was one row down but in the wrong column) still passed.
    //  - Same-row branch: the x half of the check, `b2.x - b1.x ===
    //    G_TILESIZE`, has the comparison backwards. b1 is the later block
    //    in row order (index i) and b2 is the earlier one (index i-1), so a
    //    correctly solved row needs b1 to sit one tile to the *right* of
    //    b2 (`b1.x - b2.x === G_TILESIZE`), not the reverse. As written the
    //    x half could never be true for a correctly solved row, so the
    //    `||` silently fell back to "b2.y - b1.y === 0" alone -- meaning
    //    any x arrangement within a row passed as long as the y's matched,
    //    not just the correctly-ordered one.
    // Fixed the x-direction and switched both branches to `&&` so a block
    // must be truly adjacent (right axis-step and aligned on the other
    // axis) to count as placed correctly.
    isCompleted() {
        let b1 = this.blocks[0],
            b2 = null;
        let b3 = b1;
        let x = 0;

        for (const i in this.blocks) {
            b1 = this.blocks[i];
            x = i % this.numX;
            if (b2) {
                if (x === 0) {
                    if (!(b1.y - b3.y === G_TILESIZE && b1.x - b3.x === 0))
                        return false;
                    b3 = b1;
                } else {
                    if (!(b1.x - b2.x === G_TILESIZE && b1.y - b2.y === 0))
                        return false;
                }
            }
            b2 = b1;
        }
        return true;
    }

    Completed() {
        console.warn('BLOCKAREA - COMPLETED.');
        for (const i in this.blocks) {
            const block = this.blocks[i];
            if (!block.playerName) continue;

            if (this.players.hasOwnProperty(block.playerName))
                this.players[block.playerName]++;
            else {
                this.players[block.playerName] = 1;
            }
        }
    }

    onComplete(callback) {
        this.complete_callback = callback;
    }

    update() {
        if (this.isCompleted()) {
            this.Completed();
            if (this.complete_callback && Object.keys(this.players).length > 0)
                this.complete_callback(this);
            for (const i in this.blocks) {
                const block = this.blocks[i];
                this.map.entities.removeEntity(block);
                this.map.entities.sendBroadcast(block.despawn());
            }
            // NOTE: `delete this;` used to sit here -- `delete` only removes
            // object properties; applied to `this` itself it's a silent
            // no-op (doesn't deregister this BlockArea from whatever list
            // holds it, doesn't free anything). Removed as dead code rather
            // than "fixed", since there's nothing in this codebase today
            // that instantiates BlockArea to know what real cleanup (if any)
            // should replace it.
        }
    }
}

export default BlockArea;
