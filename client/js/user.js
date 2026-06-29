
function PlayerSummary(index, db_player) {
  this.index = index;
  this.name = db_player.name;
  //this.pClass = db_player.pClass;
  this.exp = db_player.exp || 0;
  this.colors = db_player.colors || [0,0];
  this.sprites = db_player.sprites || [0,0];
  return this;
}

PlayerSummary.prototype.toArray = function () {
  return [this.index,
    this.name,
    //this.pClass,
    this.exp,
    this.colors[0],
    this.colors[1],
    this.sprites[0],
    this.sprites[1]];
}

PlayerSummary.prototype.toString = function () {
    return this.toArray().join(",");
}

define(['userclient', 'entity/player', 'data/appearancedata', 'timer', 'lib/sha1'],

// TODO - Make a thin user client that process User related packets back and forth.
function(UserClient, Player, AppearanceData, Timer) {

  var User = Class.extend({
      init: function(userclient, username, password) {
        this.client = userclient;
        this.username = username.toLowerCase();
        this.password = password;

        this.playerSum = [];

        var hashObj = new jsSHA(this.username+this.password, "ASCII").getHash("SHA-1","HEX");
        this.regHash = hashObj;
        log.info("User init: hash="+hash);
        log.info("User init: hashChallenge="+app.hashChallenge);
        var hash = CryptoJS.AES.encrypt(JSON.stringify(hashObj), app.hashChallenge).toString();
        //log.info("hash="+hash.getHash("SHA-1","HEX"));
        //log.info("hashChallenge="+hashChallenge.getHash("SHA-1","HEX"));
        this.hash = this.hash || btoa(hash);

      },

      setPlayerSummary: function (data)
      {
        var count = parseInt(data.shift());
        for (var i=0; i < count; ++i)
        {
          j = (7 * i);

          var ps = new PlayerSummary(parseInt(data[j]), {
            name: data[j+1],
            //pClass: parseInt(data[j+2]),
            exp: parseInt(data[j+2]),
            colors: [data[j+3], data[j+4]],
            sprites: [data[j+5], data[j+6]]
          });
          this.playerSum.push(ps);
        }
      },

      createPlayer: function (ps)
      {
        this.playerSum[ps.index] = ps;
        var player = new Player(0, 1, 0, 0, ps.name);
        player.user = this;
        player.keyMove = false;

        player.setItems();

        player.forceStop = function () {
          if (this.fsm === "ATTACK")
            try { throw new Error(); } catch (e) { console.error(e.stack); }
          //console.error("player.forceStop - this.keyMove:"+this.keyMove);
          //console.error("player.forceStop - this.stopKeyMove:"+this.stopKeyMove);
          this.harvestOff();
          if (this.isMoving() && !this.isMovingPath())
          {
            if (this.key_move_callback)
              this.key_move_callback(0);
          }
          this._forceStop();

          this.moveOrientation = 0;
          this.keyMove = false;
          this.stopKeyMove = false;
        };

        player.canAttack = function(time) {
            if(this.isDead === false && this.attackCooldown.isOver(time)) {
                return true;
            }
            return false;
        };

        // Note - freeze might be needed disable for now.
        player.hit = function(orientation) {
          orientation = orientation || this.orientation;
          var self = this;

          //if (this.fsm === "ATTACK")
            //return;

          this.setOrientation(orientation || 0);

          this.forceStop();
          this.fsm = "ATTACK";
          this.animate("atk", this.atkSpeed, 1, function () {
            self.fsm = "IDLE";
            self.idle(self.orientation);

            if (self.moveOrientation) {
              self.move(self.moveOrientation, true);
              self.moveOrientation = 0;
              return;
            }
            self.forceStop();
            self = null;
          });
          return true;
        };

        player.canMove = function (orientation) {
          orientation = orientation || this.orientation;
          var pos = this.nextMove(this.x,this.y,orientation);
          if (orientation === 0)
            return true;
          return game.moveCharacter(this, pos[0], pos[1], false, true);
          //return game.moveCharacter(this, this.x, this.y, false, true);
        };

        player.sendMove = function (state) {
          if (state || this.sentMove !== state) {
            game.client.sendMoveEntity(this, state);
            this.sentMove = state;
          }
        };

        player.moveThrottle = function (delay) {
          if ((Date.now() - this.lastMoveThrottle) < delay)
            return true;

          this.lastMoveThrottle = Date.now();

          return false;
        };

        player.rejectMove = function () {
          if (this.fsm === "ATTACK") {
            return true;
          }

          if (this.moveThrottle(G_ROUNDTRIP)) {
            this.forceStop();
            return true;
          }

          // Allow pathing to interrupt keyMove if we're trying to click-move
          if (this.keyMove) {
            this.forceStop();   // ← clean up before allowing path
            return false;                // allow the path move
          }

          return false;
        }

        player.moveTo_ = function(x, y, callback) {
            this.resetMovementState();

            if (this.rejectMove()) {
                return;
            }

            this.moveOrientation = 0;
            clearTimeout(this.attackInterval);

            log.info("background - free delay =" + G_LATENCY);

            this.walk();  // start walking anim early

            return this._moveTo(x, y, callback);
        };

        player.move = function (orientation, state) {
            if (this.isDying || this.isDead) return;

            if (state && orientation !== Types.Orientations.NONE) {
                this.moveOrientation = orientation;

                if (this.rejectMove()) return;

                this.startKeyMovement(orientation);

            } else if (!state) {
                // KEY RELEASE
                if (this.fsm === "ATTACK") return;

                this.keyMove = false;
                this.stopKeyMove = true;
                this.moveOrientation = 0;
                this.pendingKeyOrientation = null;
            }

            clearTimeout(this.attackInterval);
        };

        player.resetMovementState = function() {
            this.keyMove = false;
            this.stopKeyMove = false;
            this.moveOrientation = 0;
            this.newDestination = null;
            this.path = null;
            this.step = 0;
            this.interrupted = false;
            if (this.movement) this.movement.stop();
        };

        // Observe used for zoning.
        player.canObserve = function () {
          if (typeof(this.observeTimer) === "undefined")
            this.observeTimer = new Timer(4096);
          return this.observeTimer.isOver();
        };

        game.addPlayerCallbacks(player);

        return player;
      },
  });

  return User;

});
