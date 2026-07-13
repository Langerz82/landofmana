// Converted from AMD (define) + Class.extend to a native ES6 module/class.
// NOTE: 'lib/sha1.js' (jsSHA v1.x) sets `window.jsSHA = function(...) {...}` directly with no
// `this`/CommonJS/AMD checks, so importing it purely for its side effect works safely here -
// same reasoning as lib/localforage.js in app.js. It was previously loaded as a classic <script>
// but never actually imported anywhere, leaving the bare `jsSHA` call below broken under ES
// modules (ReferenceError: jsSHA is not defined). CryptoJS comes from a separate vendor bundle
// outside js/ (javascripts/crypto/index.min.js) and is expected to still be loaded via its own
// classic <script> tag.
import './lib/sha1.js';
import UserClient from './userclient.js';
import Player from './entity/player.js';
import AppearanceData from './data/appearancedata.js';
import Timer from './timer.js';

/* global Types, CryptoJS */

export function PlayerSummary(index, db_player) {
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

// TODO - Make a thin user client that process User related packets back and forth.
export default class User {
      constructor(userclient, username, password) {
        this.client = userclient;
        this.username = username.toLowerCase();
        this.password = password;

        this.playerSum = [];

        const hashObj = new jsSHA(this.username+this.password, "ASCII").getHash("SHA-1","HEX");
        this.regHash = hashObj;
        // FIX: `hash` was read before its declaration/assignment below (hoisting bug), always logging "undefined"; moved assignment before the log
        const hash = CryptoJS.AES.encrypt(JSON.stringify(hashObj), app.hashChallenge).toString();
        log.info("User init: hash="+hash);
        log.info("User init: hashChallenge="+app.hashChallenge);
        //log.info("hash="+hash.getHash("SHA-1","HEX"));
        //log.info("hashChallenge="+hashChallenge.getHash("SHA-1","HEX"));
        this.hash = this.hash || btoa(hash);

      }

      setPlayerSummary(data)
      {
        const count = parseInt(data.shift());
        for (let i=0; i < count; ++i)
        {
          const j = (7 * i); // FIX: missing var, was an implicit global

          const ps = new PlayerSummary(parseInt(data[j]), {
            name: data[j+1],
            //pClass: parseInt(data[j+2]),
            exp: parseInt(data[j+2]),
            colors: [data[j+3], data[j+4]],
            sprites: [data[j+5], data[j+6]]
          });
          this.playerSum.push(ps);
        }
      }

      createPlayer(ps)
      {
        this.playerSum[ps.index] = ps;
        const player = new Player(0, 1, 0, 0, ps.name);
        player.user = this;
        player.keyMove = false;

        player.items.setItems(game.equipmentHandler, game.inventory);

        player.forceStop = function () {
          //console.error("player.forceStop - this.keyMove:"+this.keyMove);
          //console.error("player.forceStop - this.stopKeyMove:"+this.stopKeyMove);
          this.harvestOff();
          if (this.isMoving() && !this.isMovingPath())
          {
            if (this.key_move_callback)
              this.key_move_callback(0);
          }

          // FIX: this used to call this._forceStop() unconditionally, regardless of fsm.
          // _forceStop() -> stop() (entitymoving.js) always finishes by calling idle(), which
          // swaps currentAnimation away from whatever was playing. forceStop() gets called from
          // lots of unrelated places (server sync, movement updater, teleports, etc.) - if one
          // of those fired while the player's "atk" animation was still mid-swing, it silently
          // cut the attack animation off. Character.forceStop() (used by every other entity)
          // already guards against this with `!this.hasAnimation('atk')`; this local-player
          // override never had that guard, it just logged a stack trace and did it anyway
          // (see the try/throw that used to be here). Mirror the same guard: while genuinely
          // still attacking and alive, leave the attack animation alone - it's already stopped
          // any movement (hit() calls forceStop() BEFORE setting fsm = "ATTACK"), so there's
          // nothing left here that needs stopping. entity.js's setAnimation() also now resyncs
          // fsm back to "IDLE" if an attack animation ever does get abandoned some other way,
          // so movement can never stay permanently blocked either way.
          if (!(this.fsm === "ATTACK" && !this.isDying && !this.isDead)) {
            this._forceStop();
          }

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
          let self = this;

          if (this.fsm === "ATTACK")
            return;

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
          const pos = this.nextMove(this.x,this.y,orientation);
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

                // FIX: this used to leave this.orientation completely untouched while
                // fsm === "ATTACK", relying on moveOrientation (set above) as the source of
                // truth for "which way is the player actually trying to face" until the attack
                // finished. But moveOrientation gets reset to 0 on key release (see the `!state`
                // branch below) - a quick tap-and-release of a direction key mid-swing (a
                // perfectly normal way to just turn) left BOTH fields wrong by the time
                // anything (e.g. tryInteractFacedEntity() in game.js) checked them afterward:
                // moveOrientation back to 0, and this.orientation never caught up. Game logic
                // (isNextTooEntity/isInReach/nextTile/targeting) all read this.orientation
                // directly, so it needs to always be live and correct. It's safe to update it
                // unconditionally here: setOrientation() alone doesn't touch the currently-
                // playing "atk_<direction>" animation - that direction was already baked into
                // the animation's name once, when hit() started it - only calling idle()/
                // animate() again would visually interrupt the swing, so that part (along with
                // actual movement) still stays deferred until the attack completes.
                this.setOrientation(orientation);

                if (this.fsm !== "ATTACK") {
                  this.idle(orientation);
                  clearTimeout(this.attackInterval);
                  if (this.rejectMove()) {
                    return;
                  }

                  this.startKeyMovement(orientation);
                }

            } else if (!state) {
                // KEY RELEASE
                // FIX: this used to bail out entirely while attacking, which meant releasing
                // a movement key mid-attack never cleared keyMove/moveOrientation/
                // pendingKeyOrientation. The player.hit() completion callback checks
                // self.moveOrientation to decide whether to resume movement after the attack
                // animation finishes, so a swallowed release caused the player to keep moving
                // on its own (or refuse further input) even though the key was already up -
                // part of the "player gets jammed" symptom. Always clear key state on release;
                // the attack animation itself still runs to completion regardless.
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
      }
}
