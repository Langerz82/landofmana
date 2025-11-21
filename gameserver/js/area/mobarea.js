var EntityArea = require('./entityarea'),
    _ = require('underscore'),
    Messages = require('../message');

module.exports = MobArea = EntityArea.extend({
    init: function(map, id, nb, minLevel, maxLevel, x, y, width, height, include, exclude, definite, elipse, excludeId, level) {
        this._super(map, id, x, y, width, height, elipse, excludeId);
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

    },

    addMobs: function (level) {
      this.mobs = [];
      if (Array.isArray(this.definite))
      {
        for (var i of this.definite)
        {
          this.mobs.push(MobData.Kinds[i]);
        }
        return;
      }

      if (level && this.level) {
        this.minLevel = level+this.minLevel;
        this.maxLevel = level+this.maxLevel;
      }

      levelMobs = MobData.getByLevelRange(this.minLevel, this.maxLevel);
      this.mobs = this.mobs.concat(levelMobs);

      if (Array.isArray(this.include)) {
        for (var i of this.include)
        {
          this.mobs.push(MobData.Kinds[i]);
        }
      }

      if (Array.isArray(this.exclude)) {
        var i = this.mobs.length;
        while (--i >= 0)
        {
          for (var j of this.exclude)
          {
            if (this.mobs[i].kind === j)
            {
                this.mobs.splice(i,1);
                break;
            }
          }
        }
      }

    },

    spawnMobs: function() {
        console.info("spawnMobs - nb: "+this.nb);
        for(var i = 0; i < this.nb; ++i) {
            this.addToArea(this._createRandomMobInsideArea(), this.exclude);
        }
    },

    _createMob: function(kind) {
	    var self = this;

      //console.info("_createMob:"+kind);
	    var	pos = self.map.entities.spaceEntityRandomApart(2,self._getRandomPositionInsideArea.bind(self,100));
      if (!pos) return null;

      //console.info("pos-x:"+pos.x+", pos-y:"+pos.y+", kind="+kind);
      var mob = self.map.entities.addMob(kind, pos.x, pos.y, this);

      //self.addToArea(mob);

      return mob;
    },

    _createRandomMobInsideArea: function() {
    	var randomMob = 0;
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
      var mobRatio = [];
      var mobRatioTotal = 0;
      var l = this.mobs.length;
      if (l === 0)
      {
        console.warn("mobs length === 0 aborting create.");
        return null;
      }

      for(var i = 0; i < l; ++i)
      {
        for(var j = 0; j < this.mobs[i].spawnChance; ++j)
        {
          mobRatio[ (i*l+j) ] = this.mobs[i].kind;
        }
        mobRatioTotal += this.mobs[i].spawnChance;
      }

      var kind = 0;
      var randNum = Utils.randomInt(mobRatioTotal-1);
      //console.info("randNum="+randNum);
      var r = randNum;
      var sc = 0;
      for (var i=0; i < this.mobs.length; ++i) {
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
    },

    respawnMob: function(mob, delay) {
        var self = this;
        delay = mob.spawnDelay || delay;
        var self_mob = mob;

        //this.removeFromArea(mob);

        setTimeout(function() {
          var	pos = self.map.entities.spaceEntityRandomApart(3, self._getRandomPositionInsideArea.bind(self,20));
          if (pos) {
            self_mob.spawnX = pos.x;
            self_mob.spawnY = pos.y;
            self_mob.setPosition(pos.x, pos.y);
          }
          if (self_mob.respawnCallback) {
              self_mob.respawnCallback();
          }
        }, delay);
    },

    isNextTooEntity: function (entity, dist) {
      dist = dist || G_TILESIZE;
      for (var en of this.entities)
      {
        if (Math.abs(entity.x - en.x) < G_TILESIZE &&  Math.abs(entity.y - en.y) < G_TILESIZE)
          return true;
      }
      return false;
    },

});
