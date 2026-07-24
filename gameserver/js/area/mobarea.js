import EntityArea from './entityarea.js';
import _ from 'underscore';
import Messages from '../message.js';
import Utils from '../utils.js';
import MobData from '../data/mobdata.js';
import { G_TILESIZE } from '../constants.js';

class MobArea extends EntityArea {
    constructor(
        map,
        id,
        nb,
        minLevel,
        maxLevel,
        x,
        y,
        width,
        height,
        include,
        exclude,
        definite,
        elipse,
        excludeId,
        level,
        weight
    ) {
        super(map, id, x, y, width, height, elipse, excludeId);
        this.nb = nb;
        this.minLevel = minLevel;
        this.maxLevel = maxLevel;
        this.respawns = [];
        this.level = level;

        this.include = [];
        if (include) {
            if (typeof include === 'string' && include.indexOf(',') >= 0)
                this.include = include.split(',');
            else {
                this.include = [include];
            }
        }
        this.exclude = [];
        if (exclude) {
            if (typeof exclude === 'string' && exclude.indexOf(',') >= 0)
                this.exclude = exclude.split(',');
            else {
                this.exclude = [exclude];
            }
        }

        this.weight = [];
        if (include) {
            if (typeof include === 'string' && include.indexOf(',') >= 0)
                this.weight = include.split(',');
        }

        this.setNumberOfEntities(this.nb);

        //console.info(JSON.stringify(this.mobs));

        // Definite Mobs get pushed in.
        this.definite = null;
        if (definite)
            //this.definite = JSON.parse(definite);
            this.definite = definite;
        //console.info(JSON.stringify(this.definite));
    }

    addMobs(level) {
        this.mobs = [];
        if (Array.isArray(this.definite)) {
            for (const i of this.definite) {
                this.mobs.push(MobData.Kinds[i]);
            }
            return;
        }

        if (level && this.level) {
            this.minLevel = level + this.minLevel;
            this.maxLevel = level + this.maxLevel;
        }

        // NOTE: `levelMobs` was a bare (undeclared) assignment in the original
        // CommonJS source, which created an implicit global there; declared with
        // `var` here since ES modules are always strict mode and forbid implicit
        // globals.
        const levelMobs = MobData.getByLevelRange(this.minLevel, this.maxLevel);
        this.mobs = this.mobs.concat(levelMobs);

        if (Array.isArray(this.include)) {
            for (const i of this.include) {
                this.mobs.push(MobData.Kinds[i]);
            }
        }

        if (Array.isArray(this.exclude)) {
            let i = this.mobs.length;
            while (--i >= 0) {
                for (const j of this.exclude) {
                    if (this.mobs[i].kind === j) {
                        this.mobs.splice(i, 1);
                        break;
                    }
                }
            }
        }
    }

    spawnMobs() {
        //console.info("spawnMobs - nb: "+this.nb);
        for (let i = 0; i < this.nb; ++i) {
            this.addToArea(this._createRandomMobInsideArea(), this.exclude);
        }
    }

    _createMob(kind) {
        const self = this;

        //console.info("_createMob:"+kind);
        const pos = self.map.entities.spaceEntityRandomApart(
            2,
            self._getRandomPositionInsideArea.bind(self, 100)
        );
        if (!pos) {
            console.warn('mobarea, _createMob: no position');
            return null;
        }

        //console.info("pos-x:"+pos.x+", pos-y:"+pos.y+", kind="+kind);
        const mob = self.map.entities.addMob(kind, pos.x, pos.y, this);

        //self.addToArea(mob);

        return mob;
    }

    _createRandomMobInsideArea() {
        const randomMob = 0;
        //console.info("_createRandomMobInsideArea");

        //console.info(JSON.stringify(this.mobs));
        if (!this.mobs || this.mobs.length === 0) return null;

        if (this.mobs.length === 1) {
            //console.info("kind_first: "+this.mobs[0].kind);
            return this._createMob(this.mobs[0].kind);
        }
        // FIX/PERF: this used to also build a `mobRatio` array here (one
        // entry per unit of spawnChance, for every mob in this area) as an
        // alternate way to pick a weighted-random kind by direct index. That
        // approach was superseded by the cumulative-weight loop below (`for
        // (let i=0; i < this.mobs.length; ++i) { ... if (r < sc) ... }`,
        // see its own FIX comment a few lines down) -- mobRatio was left
        // populated but never read again (the one place that used it,
        // `kind = mobRatio[randNum];` below, has been commented out for a
        // while). Building it cost an O(sum of every mob's spawnChance)
        // loop -- with enough mob kinds/weights configured for an area,
        // potentially a lot of wasted array writes on every single mob
        // spawn -- purely to compute mobRatioTotal, which a plain sum does
        // just as well without the throwaway array.
        let mobRatioTotal = 0;
        const l = this.mobs.length;
        if (l === 0) {
            console.warn('mobs length === 0 aborting create.');
            return null;
        }

        for (let i = 0; i < l; ++i) {
            mobRatioTotal += this.mobs[i].spawnChance;
        }

        // NOTE: this used to be a second `var kind = 0;` -- harmless under
        // `var` (function-scoped, redeclaration is a no-op) but a
        // SyntaxError under `let`/`const` (block-scoped, redeclaration in
        // the same scope throws). The first declaration above was never
        // read before this point, so this is the only live one; converted
        // to `let` since `kind` is reassigned in the loop below.
        let kind = 0;
        const randNum = Utils.randomInt(mobRatioTotal - 1);
        //console.info("randNum="+randNum);
        let r = randNum;
        let sc = 0;
        // FIX: was `r <= sc` -- for cumulative-weight selection over
        // `r` in [0, total-1], the correct boundary is `r < sc`; `<=` let
        // each mob's slot "steal" one extra value from the next mob's
        // range, which both skewed the distribution toward earlier mobs in
        // the list and could make the last mob in the list unreachable
        // entirely (e.g. 3 equal-weight mobs, total=3, r in {0,1,2}: mob0
        // matched both r=0 and r=1, mob1 only matched r=2, mob2 never
        // matched anything).
        for (let i = 0; i < this.mobs.length; ++i) {
            sc = this.mobs[i].spawnChance;
            if (r < sc) {
                kind = this.mobs[i].kind;
                break;
            }
            r -= sc;
        }
        if (kind === 0) {
            console.info('this.mobs=' + JSON.stringify(this.mobs));
            console.warn('mob kind === 0 aborting create.');
            return null;
        }
        return this._createMob(kind);
    }

    isNextTooEntity(entity, dist) {
        dist = dist || G_TILESIZE;
        for (const en of this.entities) {
            if (
                Math.abs(entity.x - en.x) <= dist &&
                Math.abs(entity.y - en.y) <= dist
            )
                return true;
        }
        return false;
    }
}

export default MobArea;
