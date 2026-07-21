// Converted from AMD (define) + Class.extend to a native ES6 module/class.
// NOTE: 'lib/sha1.js' (jsSHA v1.x) sets `window.jsSHA = function(...) {...}` directly with no
// `this`/CommonJS/AMD checks, so importing it purely for its side effect works safely here -
// same reasoning as lib/localforage.js in app.js. It was previously loaded as a classic <script>
// but never actually imported anywhere, leaving the bare `jsSHA` call below broken under ES
// modules (ReferenceError: jsSHA is not defined). CryptoJS comes from a separate vendor bundle
// outside js/ (javascripts/crypto/index.min.js) and is expected to still be loaded via its own
// classic <script> tag.
import './lib/sha1.js';
import UserClient from './userclient/userclient.js';
import Player from './entity/player/player.js';
import AppearanceData from './data/appearancedata.js';
// FIX (maintainability): createPlayer() used to inline ~14 monkey-patched override methods
// (forceStop/idle/canAttack/hit/canMove/sendMove/moveThrottle/scheduleMoveRetry/rejectMove/
// moveTo_/move/resetMovementState/canObserve/startKeyMovement) directly onto the new Player
// instance, making the file ~500 lines and the overrides impossible to find/diff in isolation.
// Moved to entity/playerlocalmovement.js as an instance-installer (same pattern as
// gamepad/gamepadbuttons.js's installGamepadButtonsX(self) functions); createPlayer() now just
// builds the player and delegates the override wiring to installLocalPlayerOverrides(player).
import { installLocalPlayerOverrides } from './entity/player/playerlocalmovement.js';

/* global CryptoJS */

export function PlayerSummary(index, db_player) {
  this.index = index;
  this.name = db_player.name;
  this.exp = db_player.exp || 0;
  this.colors = db_player.colors || [0,0];
  this.sprites = db_player.sprites || [0,0];
  return this;
}

PlayerSummary.prototype.toArray = function () {
  return [this.index,
    this.name,
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

        installLocalPlayerOverrides(player);

        game.addPlayerCallbacks(player);

        return player;
      }
}
