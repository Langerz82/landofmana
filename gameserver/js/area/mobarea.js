var EntityArea = require('./entityarea'),
    _ = require('underscore'),
    Messages = require('../message');

module.exports = MobArea = EntityArea.extend({
    init: function(id, nb, minLevel, maxLevel, x, y, width, height, include, exclude, definite, map, elipse, excludeId, sMinLevel, sMaxLevel) {
        this._super(id, x, y, width, height, map, elipse, excludeId);
        this.nb = nb;
        this.minLevel = minLevel;
        this.maxLevel = maxLevel;
        this.respawns = [];
        this.map = map;
        this.sMinLevel = sMinLevel;
        this.sMaxLevel = sMaxLevel;

        this.include = null;
        if (typeof(include) === "string")
        	this.include = include.split(",");
        this.exclude = null;
        if (typeof(exclude) === "string")
        	this.exclude = exclude.split(",");

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
      if (this.definite)
      {
        for (var index in this.definite)
        {
          this.mobs.push(MobData.Kinds[this.definite[index]]);
        }
        return;
      }

      if (level) {
        this.minLevel = (this.sMinLevel) ? level+this.sMinLevel : this.minLevel;
        this.maxLevel = (this.sMaxLevel) ? level+this.sMaxLevel : this.maxLevel;
      }

      levelMobs = MobData.getByLevelRange(this.minLevel, this.maxLevel);
      this.mobs = this.mobs.concat(levelMobs);

      for (var index in this.include)
      {
        this.mobs.push(MobData.Kinds[this.include[index]]);
      }

      var i = this.mobs.length;
      while (--i >= 0)
      {
        for (var j in this.exclude)
        {
          if (this.mobs[i].kind == this.exclude[j])
          {
              this.mobs.splice(i,1);
              break;
          }
        }
      }

    },

    spawnMobs: function() {
      //console.info("spawnMobs - nb: "+this.nb);
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

      self.addToArea(mob);

      return mob;
    },

    _createRandomMobInsideArea: function() {
    	var randomMob = 0;
    	var kind = 0;
      //console.info("_createRandomMobInsideArea");

      //console.info(JSON.stringify(this.mobs));
    	if (!this.mobs || this.mobs.length == 0) return null;


    	if (this.mobs.length == 1)
      {
          //console.info("kind_first: "+this.mobs[0].kind);
	        return this._createMob(this.mobs[0].kind);
      }
// TODO
      // Add ratio total and array containing kind.
      var mobRatio = [];
      var mobRatioTotal = 0;
      var l = this.mobs.length;
      if (l == 0)
      {
        console.warn("mobs length == 0 aborting create.");
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
      if (kind == 0) {
        console.info("this.mobs="+JSON.stringify(this.mobs));
        console.warn("mob kind == 0 aborting create.");
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

        this.removeFromArea(mob);

        setTimeout(function() {
          var	pos = self.map.entities.spaceEntityRandomApart(1, self._getRandomPositionInsideArea.bind(self,20));

          var x=pos.x, y=pos.y;
          mob.spawnX = mob.x = x;
          mob.spawnY = mob.y = y;
          mob.respawnMob();
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
