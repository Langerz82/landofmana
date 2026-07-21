// Mixin extracted from clientcallbacks.js: map transitions (onPlayerTeleportMap, onMapStatus).
// Applied onto ClientCallbacks.prototype via install*(...) call in clientcallbacks.js; not a standalone class.
import Pathfinder from '../pathfinder.js';
/* global log, game */

export function installClientCallbacksMap(proto) {
    proto.onPlayerTeleportMap = function (data) {
        const mapId = Number(data[0]),
            x = Number(data[2]),
            y = Number(data[3]),
            portalId = Number(data[4]);
        const status = (game.mapStatus = Number(data[1]));
        const p = game.player;

        log.info(
            'ON PLAYER TELEPORT MAP:' +
                mapId +
                'status: ' +
                status +
                ',x:' +
                x +
                ',y:' +
                y
        );

        if (status === -1) {
            game.mapIndex = 0;
            game.mapStatus = 2;
            p.forceStop();
            p.clearTarget();
            return;
        }

        if (status === 1) {
            log.info('spawnMap');

            p.forceStop();
            game.mapIndex = mapId;
            p.mapIndex = mapId;
            p.clearTarget();
            game.initPlayer();
            // FIX: this used to run *before* game.initPlayer(), but initPlayer()
            // -> player.respawn() -> forceStop() -> stop() (entitymoving.js)
            // unconditionally sets `freeze = false` as part of stopping the
            // player's movement/animation state -- so setting freeze=true first
            // just got silently undone one line later, leaving the player
            // unfrozen for the entire status 0->2 map-transition window.
            // onKeyMove/onStopPathing's checkTeleport() (game.js) is only gated
            // on `!p.freeze`, so any movement/stop event firing mid-transition
            // re-evaluated checkTeleport() while the player's x/y were still
            // sitting on the origin door tile (setPositionSpawn to the real
            // destination doesn't happen until status 2). For a cross-map
            // portal that stale position rarely lines up with a door on the
            // unrelated destination map, but a same-map portal's new
            // MapContainer has the identical door at the identical coordinates,
            // so getDoor(p) matched the same door again and re-triggered
            // teleportMaps() -> another full status 0->2 handshake, repeating
            // indefinitely. Setting freeze=true after initPlayer() (instead of
            // before) means it survives the internal forceStop() call here and
            // stays true until the legitimate final forceStop() at status 2
            // (below) actually completes the transition.
            p.freeze = true;
            if (
                portalId >= 0 &&
                portalId < game.prevMapContainer.doors.length
            ) {
                const portal = game.prevMapContainer.doors[portalId];
                const orientation = portal.orientation;
                p.orientation = orientation;
                p.suppressTeleportCheck = true;
            }

            game.renderer.clearEntities();

            delete game.entities;
            game.entities = {};
            delete game.camera.entities;
            game.camera.entities = {};
            delete game.camera.outEntities;
            game.camera.outEntities = {};
            delete game.items;
            game.items = {};

            log.info('Map loaded.');
            this.client.sendTeleportMap([mapId, 1, x, y, -1]);
            game.renderer.blankFrame = true;
        }

        if (status === 2) {
            log.info('spawnMap - Loaded');

            p.setPositionSpawn(x, y);

            const c = game.camera;

            game.initGrid();
            c.setRealCoords();

            game.pathfinder = new Pathfinder(0, 0);
            log.info('spawnMap - Cleared');

            const fnReady = function () {
                log.info('spawnPlayer - started');

                const p = game.player;

                game.addEntity(p);

                game.audioManager.updateMusic();

                game.mapStatus = 2;

                log.info('moveGrid');

                game.renderer.forceRedraw = true;
                log.info('spawnPlayer - finished');

                p.forceStop();

                // FIX: freeze was only ever cleared as a side effect of forceStop() ->
                // user.js's override -> this._forceStop() -> entitymoving.js's stop(),
                // which sets `this.freeze = false` internally. But that override
                // deliberately *skips* calling _forceStop() whenever
                // `fsm === "ATTACK"` (so a teleport landing mid-swing doesn't cut off
                // the attack animation) -- and with no explicit reset here, that left
                // freeze stuck `true` forever whenever the teleport completed while the
                // player's fsm hadn't yet settled back from "ATTACK", permanently
                // blocking movement (updater.js gates updateCharacterKeyMovement/
                // updatePlayerPathMovement/etc. on `!entity.freeze`). The teleport
                // transition is genuinely done at this point regardless of fsm state,
                // so clear it unconditionally here instead of relying on forceStop()'s
                // internal, conditional path to do it.
                p.freeze = false;

                // FIX: suppressTeleportCheck (game.js's checkTeleport) now stays true
                // for the whole transition instead of clearing itself after the first
                // read -- see checkTeleport's comment for why it can't be one-shot
                // (forceStop()'s internal stop() clears p.freeze as a side effect,
                // which meant relying on freeze alone let a second forceStop() call
                // slip a real re-entry through). This is the one place that's supposed
                // to explicitly clear it again, at the same genuine end-of-transition
                // point freeze itself gets cleared, so a real subsequent door trigger
                // (from the player's own later movement) isn't permanently suppressed.
                p.suppressTeleportCheck = false;

                game.app.releaseKeys();
            };

            game.mapContainer.allReady(function () {
                this.allready = true;
                fnReady();
            });
        }
    };

    proto.onMapStatus = function (mapId, status) {
        log.info('mapStatus=' + mapId + ',' + status);
        game.mapIndex = Number(mapId);
        game.mapStatus = Number(status);
    };
}
