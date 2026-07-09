import EntityArea from './entityarea.js';
import _ from 'underscore';
import Messages from '../message.js';
import Utils from '../utils.js';
import MobData from '../data/mobdata.js';
import { G_TILESIZE } from '../main.js';

class MobArea extends EntityArea {
    constructor(map, id, nb, minLevel, maxLevel, x, y, width, height, include, exclude, definite, elipse, excludeId, level) {
        super(map, id, x, y, width, height, elipse, excludeId);
        this.nb = nb;
        this.minLevel = minLevel;
        this.maxLevel = maxLevel;
        this.respawns = [];
        this.level = level;

        this.include = null;
        if (include) {
            if (typeof(include) === "string" && include.indexOf(",") >= 0)
                this.include = include.split(",");
            else {
                this.include = [include];
            }
        }
        this.exclude = null;
        if (exclude) {
            if (typeof(exclude) === "string" && exclude.indexOf(",") >= 0)
                this.exclude = exclude.split(",");
            else {
                this.exclude = [exclude];
            }
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
        if (Array.isArray(this.definite))
        {
            for (const i of this.definite)
            {
                this.mobs.push(MobData.Kinds[i]);
            }
            return;
        }

        if (level && this.level) {
            this.minLevel = level+this.minLevel;
            this.maxLevel = level+this.maxLevel;
        }

        // NOTE: `levelMobs` was a bare (undeclared) assignment in the original
        // CommonJS source, which created an implicit global there; declared with
        // `var` here since ES modules are always strict mode and forbid implicit
        // globals.
        const levelMobs = MobData.getByLevelRange(this.minLevel, this.maxLevel);
        this.mobs = this.mobs.concat(levelMobs);

        if (Array.isArray(this.include)) {
            for (const i of this.include)
            {
                this.mobs.push(MobData.Kinds[i]);
            }
        }

        if (Array.isArray(this.exclude)) {
            let i = this.mobs.length;
            while (--i >= 0)
            {
                for (const j of this.exclude)
                {
                    if (this.mobs[i].kind === j)
                    {
                        this.mobs.splice(i,1);
                        break;
                    }
                }
            }
        }

    }

    spawnMobs() {
        //console.info("spawnMobs - nb: "+this.nb);
        for(let i = 0; i < this.nb; ++i) {
            this.addToArea(this._createRandomMobInsideArea(), this.exclude);
        }
    }

    _createMob(kind) {
        const self = this;

        //console.info("_createMob:"+kind);
        const	pos = self.map.entities.spaceEntityRandomApart(2,self._getRandomPositionInsideArea.bind(self,100));
        if (!pos) {
            console.warn("mobarea, _createMob: no position");
            return null;
        }

        //console.info("pos-x:"+pos.x+", pos-y:"+pos.y+", kind="+kind);
        const mob = self.map.entities.addMob(kind, pos.x, pos.y, this);

        //self.addToArea(mob);

        return mob;
    }

    _createRandomMobInsideArea() {
        const randomMob = 0;
        var kind = 0;
        //console.info("_createRandomMobInsideArea");

        //console.info(JSON.stringify(this.mobs));
        if (!this.mobs || this.mobs.length === 0) return null;


        if (this.mobs.length === 1)
        {
            //console.info("kind_first: "+this.mobs[0].kind);
            return this._createMob(this.mobs[0].kind);
        }
// TODO
        // Add ratio total and array containing kind.
        const mobRatio = [];
        let mobRatioTotal = 0;
        const l = this.mobs.length;
        if (l === 0)
        {
            console.warn("mobs length === 0 aborting create.");
            return null;
        }

        for(let i = 0; i < l; ++i)
        {
            for(let j = 0; j < this.mobs[i].spawnChance; ++j)
            {
                mobRatio[ (i*l+j) ] = this.mobs[i].kind;
            }
            mobRatioTotal += this.mobs[i].spawnChance;
        }

        var kind = 0;
        const randNum = Utils.randomInt(mobRatioTotal-1);
        //console.info("randNum="+randNum);
        let r = randNum;
        let sc = 0;
        for (let i=0; i < this.mobs.length; ++i) {
            sc = this.mobs[i].spawnChance;
            if (r <= sc) {
                kind = this.mobs[i].kind;
                break;
            }
            r -= sc;
        }
        if (kind === 0) {
            console.info("this.mobs="+JSON.stringify(this.mobs));
            console.warn("mob kind === 0 aborting create.");
            return null;
        }
        //if ()
        //kind = mobRatio[randNum];
        //kind = this.mobs[Utils.random(this.mobs.length-1)].kind;

        //}
        //console.info("kind_ratio: "+kind);
        return this._createMob(kind);
    }

    isNextTooEntity(entity, dist) {
        dist = dist || G_TILESIZE;
        for (const en of this.entities)
        {
            if (Math.abs(entity.x - en.x) <= dist &&  Math.abs(entity.y - en.y) <= dist)
                return true;
        }
        return false;
    }
}

export default MobArea;
