// Converted from AMD (define) + Class.extend to a native ES6 module/class.
import Entity from './entity/entity.js';

/* global Utils */

export default class Camera {
    constructor(game, renderer) {
        this.game = game;
        this.renderer = renderer;

        this.x = 0;
        this.y = 0;

        this.tilesize = this.renderer.tilesize;

        this.rescale();

        this.entities = {};
        this.outEntities = {};

        this.scrollX = true;
        this.scrollY = true;
    }

    rescale(gridW, gridH) {
        const gs = this.renderer.gameScale;
        const w = this.renderer.innerWidth;
        const h = this.renderer.innerHeight;
        log.debug("camera: w=" + w + ",h=" + h);
        const ts = G_TILESIZE;
        const tsgs = (ts * gs);
        this.gridW = Math.ceil(w / tsgs);
        this.gridH = Math.ceil(h / tsgs);
        this.gridW += this.gridW % 2 ? 1 : 0;
        this.gridH += this.gridH % 2 ? 1 : 0;

        this.gridWE = this.gridW + 2;
        this.gridHE = this.gridH + 2;

        this.screenW = w;
        this.screenH = h;
        //this.screenWE = ~~(this.gridWE*tsgs*zoom);
        //this.screenHE = ~~(this.gridHE*tsgs*zoom);

        log.debug("camera: this.screenW=" + this.screenW + ",this.screenH=" + this.screenH);
        //log.debug("camera: this.screenW2="+this.screenW2+",this.screenH2="+this.screenH2);

        this.screenX = ~~(this.screenW / gs);
        this.screenY = ~~(this.screenH / gs);
        const tScreenW = this.gridWE * tsgs;
        const tScreenH = this.gridHE * tsgs;

        this.wOffX = ~~((tScreenW - this.screenW) / (2 * gs));
        this.wOffY = ~~((tScreenH - this.screenH) / (2 * gs));
        log.debug("camera: this.wOffX=" + this.wOffX + ",this.wOffY=" + this.wOffY);
        //log.debug("camera: this.cOffX="+this.cOffX+",this.cOffY="+this.cOffY);
        //this.eOffX = this.wOffX-ts;
        //this.eOffY = this.wOffY-ts;

        log.debug("---------");
        log.debug("W:" + this.gridW + " H:" + this.gridH);

        const mc = game.mapContainer;
        if (mc) {
            mc._initGrids();
            mc.moveGrid(true);
        }

        if (game.client) {
          const arr = [
            ["screenWidth",this.gridWE],
            ["screenHeight",this.gridHE]
          ];
          game.client.sendConfig(arr);
        }
    }

    setRealCoords() {
        const mc = game.mapContainer;
        const fe = this.focusEntity;

        const hgw = ~~(this.screenX / 2);
        const hgh = ~~(this.screenY / 2);
        //log.info("camera: hgw="+hgw+",hgh="+hgh);

        if (!fe)
            return;

        const x = fe.x - hgw;
        const y = fe.y - hgh;

        this.x = Utils.clamp(mc.gcsx, mc.gcex, x);
        this.y = Utils.clamp(mc.gcsy, mc.gcey, y);

        this.rx = x;
        this.ry = y;

        const tMinX = this.wOffX,
            tMaxX = mc.gcex + this.wOffX,
            tMinY = this.wOffY,
            tMaxY = mc.gcey + this.wOffY;

        this.scrollX = (x > tMinX && x <= tMaxX);
        this.scrollY = (y > tMinY && y <= tMaxY);

        this.sx = Utils.clamp(tMinX, tMaxX, x);
        this.sy = Utils.clamp(tMinY, tMaxY, y);

        this.gx = this.x >> 4;
        this.gy = this.y >> 4;
    }

    forEachVisibleValidPosition(callback) {
        if (!this.gridWE || !this.gridHE)
            return;

        const h = this.gridHE;
        const w = this.gridWE;
        //var j=0, k=0;
        for (let y = 0; y < h; ++y) {
            for (let x = 0; x < w; ++x) {
                callback(x, y);
            }
        }
    }

    isVisible(entity, extra) {
        extra = extra || 0;
        //log.info("isVisible: " + entity.mapIndex + "!==" + this.game.map.index);
        // FIX: null-guard ran after dereferencing entity.mapIndex, so a null/undefined entity threw instead of
        // returning false; check !entity first.
        if (!entity) return false;
        if (entity.mapIndex !== game.mapIndex) return false;
        return this.isVisiblePosition(entity.x, entity.y, extra);
    }

    isVisiblePosition(x, y, extra) {
        extra = extra * this.tilesize || 0;
        const minX = Math.max(0, this.x - extra);
        const minY = Math.max(0, this.y - extra);
        const maxX = Math.min(game.mapContainer.widthX, this.x + this.screenX + extra);
        const maxY = Math.min(game.mapContainer.heightY, this.y + this.screenY + extra);

        return (y.between(minY, maxY) && x.between(minX, maxX));
    }

    forEachInScreenArray(entity) {
        //var self = this;
        const entities = [];
        // FIX (var cleanup): was `var entity = entity || ...`, redeclaring the `entity`
        // parameter with var - let/const can't redeclare a parameter name, so this is just a
        // reassignment.
        entity = entity || this.focusEntity;

        const tsh = G_TILESIZE >> 1;
        const x = (this.gridW - 1) * tsh;
        const y = (this.gridH - 1) * tsh;

        this.forEachInScreen(function(entity2) {
            if (entity2 === entity)
                return;
            if (Math.abs(entity.x - entity2.x) < x &&
                Math.abs(entity.y - entity2.y) < y)
                entities.push(entity2);
        });
        return entities;
    }

    forEachInScreen(callback) {
        for (let id in this.entities) {
            const entity = this.entities[id];
            if (entity && entity instanceof Entity) {
                callback(entity, id);
            }
        }
    }

    forEachInOuterScreen(callback) {
        for (let id in this.outEntities) {
            const entity = this.outEntities[id];
            if (entity && entity instanceof Entity) {
                callback(entity, id);
            }
        }
    }

    getEntitiesAround(x, y, dist, exclude = []) {
        const minx = x - dist;
        const miny = y - dist;
        const maxx = x + dist;
        const maxy = y + dist;

        const entities = [];
        for (let id in this.entities) {
            const entity = this.entities[id];
            if (entity && entity instanceof Entity) {
                const ex = entity.x;
                const ey = entity.y;
                if (exclude.indexOf(entity) >= 0)
                    continue;

                if (ex >= minx && ex <= maxx && ey >= miny && ey <= maxy)
                    entities.push(entity);
            }
        }
        return entities;
    }
}
