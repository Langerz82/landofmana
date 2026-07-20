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
        for (let j=0; j < height; ++j) {
            for (let i=0; i < width; ++i) {
                id = startID+(width*j+i);
                blockName = "block"+kind+"-"+j+"_"+i;
                const block = new Block(id, kind,
                    this.x+(i*G_TILESIZE), this.y+(j*G_TILESIZE),
                    this.map, this, blockName, i, j);
                this.map.entities.addBlock(block);
                this.blocks.push(block);
            }
        }
        this.map.entities.entityCount += (width*height);
    }

    randomizeBlocks(distApart) {
        const self = this;
        for (const i in this.blocks) {
            const block = this.blocks[i];
            const	pos = this.map.entities.spaceEntityRandomApart(distApart, self._getRandomPositionInsideArea.bind(self,30));
            if (pos) {
                block.setPosition(~~(Utils.floorTo(pos.x, G_TILESIZE)), ~~(Utils.floorTo(pos.y, G_TILESIZE)));
            }
            else {
                console.error("BlockArea - randomizeBlocks: failed.");
            }
        }
    }

    // FIX: the `this.numX` read below was always `undefined` before
    // initArea() started setting it (see the FIX comment there) -- that's
    // fixed now, so the row-wrap branch (`x === 0`) actually runs. Left as
    // "TODO" was: whether the `||` in both branches below is intentional.
    // As written, a row-start pair passes if EITHER it dropped exactly one
    // tile in y OR has the same x, and a same-row pair passes if EITHER
    // it's exactly one tile apart in x OR has the same y -- i.e. either
    // half of "properly adjacent" is independently sufficient, not both
    // required together. That may be deliberately lenient (e.g. to tolerate
    // sub-tile rounding on one axis), but it also means a block that's
    // right on x/y-axis with its neighbor but wildly off on the other axis
    // would still pass. Not changing this without being able to verify
    // against real puzzle-solve gameplay -- flagging it for whoever touches
    // this next.
    isCompleted() {
        let b1 = this.blocks[0], b2 = null;
        let b3 = b1;
        let x = 0;

        for(const i in this.blocks) {
            b1 = this.blocks[i];
            x = (i % this.numX);
            if (b2) {
                if (x === 0) {
                    if (!((b1.y - b3.y) === G_TILESIZE || (b1.x - b3.x) === 0))
                        return false;
                    b3 = b1;
                }
                else {
                    if (!((b2.x - b1.x) === G_TILESIZE || (b2.y - b1.y) === 0))
                        return false;
                }
            }
            b2 = b1;
        }
        return true;
    }

    Completed() {
        console.warn("BLOCKAREA - COMPLETED.");
        for (const i in this.blocks) {
            const block = this.blocks[i];
            if (!block.playerName)
                continue;

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
        if (this.isCompleted())
        {
            this.Completed();
            if (this.complete_callback && Object.keys(this.players).length > 0)
                this.complete_callback(this);
            for (const i in this.blocks) {
                const block = this.blocks[i];
                this.map.entities.removeEntity(block);
                this.map.entities.sendBroadcast(block.despawn());
            }
            delete this;
        }
    }
}

export default BlockArea;
