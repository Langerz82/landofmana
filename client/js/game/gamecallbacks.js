// Mixin extracted from game.js: Server-driven setup callbacks: version/world-ready handshake, player load, and the big addPlayerCallbacks() event wiring.
// Applied onto Game.prototype via install*(...) call in game.js; not a standalone class.
import config from '../config.js';
import GameClient from '../gameclient/gameclient.js';
import ClientCallbacks from '../clientcallback/clientcallbacks.js';
import NpcMove from '../entity/npcmove.js';
import NpcStatic from '../entity/npcstatic.js';
import Node from '../entity/node.js';
/* global lang, log */

export function installGameCallbacks(proto) {
    proto.onVersionGame = function (data) {
        this.versionChecked = true;
        const version = Number(data[0]);

        const local_version = Number(config.build.version);
        log.info('config.build.version=' + local_version);
        if (version !== local_version) {
            $('#container').addClass('error');
            let errmsg =
                'Please download the new version of Land Of Mana.<br/>';

            if (game.tablet || game.mobile) {
                errmsg +=
                    '<br/>For mobile see: <a href="' +
                    config.build.updatepage +
                    '" target="_self">UPDATE LINK</a> or search Google play for "Land of Mana".';
            } else {
                errmsg +=
                    '<br/>For most browsers press Ctrl+F5 to reload the game cache files.';
            }
            game.clienterror_callback(errmsg);
            if (game.tablet || game.mobile)
                window.location.replace(config.build.updatepage);
        }
    };

    proto.onWorldReady = function (data) {
        const username = data[0];
        const playername = data[1];
        const hash = data[2];
        const protocol = data[3];
        const host = data[4];
        const port = data[5];

        const url = protocol + '://' + host + ':' + port + '/';

        // Game Client takes over the processing of Messages.
        game.client = new GameClient();

        game.client.callbacks = new ClientCallbacks(game.client);
        game.client.setHandlers();

        game.client.connect(url, [playername, hash]);
    };

    proto.onPlayerLoad = function (player) {
        log.info('Received player ID from server : ' + player.id);

        // FIX: this setInterval's handle was never stored, so if onPlayerLoad() ever fires
        // more than once in a session (e.g. reconnect) each call added another interval that
        // was never cleared - a growing set of duplicate "who request" pings running forever.
        // Store the handle and clear any previous one before creating a new one.
        if (this.zoneCheckInterval) clearInterval(this.zoneCheckInterval);

        // Make zoning possible.
        this.zoneCheckInterval = setInterval(function () {
            if (
                game.mapStatus >= 2 &&
                !player.isMoving() &&
                player.canObserve(game.currentTime)
            ) {
                game.client.sendWhoRequest();

                player.observeTimer.lastTime = game.currentTime;
            }
        }, player.moveSpeed * 4);

        game.renderer.initPIXI();

        game.app.initPlayerBar();

        game.updateBars();
        game.updateExpBar();

        log.info('onWelcome');

        $('.validation-summary').text('Loading Map..');

        // TODO - Maybe this is better in main or app class as html.
        if ($('#player_window').is(':visible')) {
            $('#intro').hide();
            $('#container').fadeIn(1000);
        }

        game.teleportMaps(1);

        //Welcome message
        game.chathandler.show();

        game.gamestart_callback();

        if (game.hasNeverStarted) {
            game.start();
        }

        player.attackTime = game.currentTime;

        // START TUTORIAL SHOW CODE.
        if (player.level === 0) {
            const tutName = '[' + lang.data['TUTORIAL'] + ']';
            // FIX: `let j = 1` was declared inside the loop body, so each of the 5 closures got its own fresh
            // j=1 and always showed TUTORIAL_1. The original (pre-conversion) code relied on `var j` being a
            // single counter shared/incremented across all 5 timeout closures (firing in order) to walk through
            // TUTORIAL_1..TUTORIAL_5; hoisted here above the loop to restore that shared-counter behavior.
            let j = 1;
            for (let i = 1; i <= 5; ++i) {
                setTimeout(function () {
                    const tutData = lang.data['TUTORIAL_' + j++];
                    game.chathandler.addGameNotification(tutName, tutData);
                }, 12500 * i);
            }
        }
    };

    proto.addPlayerCallbacks = function (player) {
        const self = this;

        self.player = player;

        self.player.onStartPathing(function (path) {
            const i = path.length - 1,
                x = path[i][0],
                y = path[i][1];
        });

        self.player.onKeyMove(function (sentMove) {
            const p = self.player;
            if (!sentMove && !p.freeze) {
                checkTeleport(p, p.x, p.y);
            }

            p.sendMove(sentMove ? 1 : 0);
            //f (p.sentMoving !== sentMove) {
            //}
        });

        self.player.onBeforeMove(function () {});

        self.player.onBeforeStep(function () {});

        self.player.onStep(function () {});

        self.player.onMoveStop(function () {
            const p = self.player;
            log.info('player.onMoveStop');

            // FIX: this fires whenever movement.stop() runs, including when a manual
            // key-move step gets blocked (e.g. bumping into an adjacent entity). p.keyMove
            // is still true at this point (user.js's forceStop() override only clears it
            // *after* calling _forceStop(), which is what triggers this callback). Without
            // this check, turning toward a different adjacent entity via movement keys got
            // silently reverted every tick by snapping orientation back to the old target,
            // making it look like the player's facing was permanently locked onto it.
            if (p.keyMove) {
                log.info(
                    'onMoveStop - blocked key move, keeping player-chosen orientation.'
                );
                return;
            }

            if (p.hasTarget() && p.canReachTarget()) p.lookAtEntity(p.target);
            else {
                log.info('onMoveStop - NO TARGET!');
            }
        });

        self.player.onAbortPathing(function (path, x, y) {
            const p = self.player;
            self.client.sendMoveEntity(p, 2);
        });

        // FIX (var cleanup): callbacks registered earlier in this method (onKeyMove,
        // onStopPathing) reference checkTeleport before this declaration textually, but they
        // only actually run later in response to player events - by then this line has
        // already executed, so const is safe despite the forward reference.
        const checkTeleport = function (p, x, y) {
            // FIX: landing tile of a teleport can itself sit on (or inside) another
            // door's area -- either the same door you just left (same-map teleport
            // whose destination re-enters its own trigger area) or a genuinely
            // different one placed nearby by map design. p.forceStop() -- called
            // multiple times over the course of a teleport's status 0->2 handshake --
            // calls key_move_callback(0) (user.js's forceStop() override), which
            // re-enters this exact function via onKeyMove. That meant simply arriving
            // on a door tile via teleport could immediately re-trigger another
            // teleport before the player ever took a real movement action.
            //
            // This used to be a one-shot flag (checked and cleared right here), on
            // the assumption that only one spurious re-entry could happen. It can't
            // be one-shot: entitymoving.js's stop() (reached via forceStop() ->
            // _forceStop()) unconditionally clears p.freeze as part of what it does,
            // so even setting p.freeze = true right before teleporting only survives
            // the *first* of status===1's two forceStop() calls -- that call's own
            // stop() clears freeze again before the second call runs, so freeze can
            // never be relied on to stay true across multiple forceStop() calls
            // within a single transition. suppressTeleportCheck itself isn't touched
            // by forceStop()/stop() at all, so instead of clearing it after the first
            // read, leave it true here and let it block every spurious re-entry for
            // the whole transition -- it's only cleared explicitly once the
            // transition truly finishes (clientcallbacks.js's fnReady, alongside
            // p.freeze = false). A genuine subsequent player movement, which only
            // happens after that point, is unaffected.
            if (p.suppressTeleportCheck) {
                return;
            }

            const dest = self.mapContainer.getDoor(p);
            // FIX: was gated on !p.hasTarget(), so stopping on a door/portal tile while
            // targeting something (e.g. a mob) silently skipped the teleport. Door tile
            // position is what should matter here, not target state.
            if (dest) {
                // Door Level Requirements.
                let msg;
                let notification;
                if (dest.minLevel && self.player.level < dest.minLevel) {
                    msg =
                        'I must be Level ' +
                        dest.minLevel +
                        ' or more to proceed.';
                    notification =
                        'You must be Level ' +
                        dest.minLevel +
                        ' or more to proceed.';
                }

                if (msg) {
                    self.bubbleManager.create(self.player, msg);
                    self.chathandler.addGameNotification(
                        'Notification',
                        notification
                    );
                    return;
                }

                p.setOrientation(dest.orientation);

                p.buttonMoving = false;
                // suppressTeleportCheck (checked/cleared at the top of this function)
                // is the mechanism that actually prevents re-entry -- see the comment
                // up there for why it has to stay true across the whole transition
                // instead of being one-shot. freeze is set here too, but that's for
                // its own job of blocking real player movement input
                // (updater.js/onKeyMove) during the transition, not for gating
                // checkTeleport re-entry.
                p.freeze = true;

                // FIX: this was the missing piece -- suppressTeleportCheck was
                // checked at the top of this function and cleared in
                // clientcallbacks.js's fnReady, but nothing ever set it true, so
                // the guard never actually engaged. Every forceStop() call during
                // the status 0->2 handshake could re-enter checkTeleport via
                // onKeyMove, and landing on/near another door (a mirrored teleport
                // pair, or a door whose destination re-enters its own trigger area)
                // fired a second real teleport before the first one finished,
                // producing the infinite back-and-forth loop.
                p.suppressTeleportCheck = true;

                // FIX: if the player was still holding/turning a movement key at the
                // exact moment they stepped onto this door, user.js's move() can have
                // queued a direction into p.stopKeyMove (a number, not the plain
                // `true` a release sets) for forceStop() to resume once the in-flight
                // tile-step finishes aligning. forceStop() (called repeatedly over the
                // teleport's status 0->2 handshake) reads that queued orientation and
                // hands it to scheduleMoveRetry(), which arms a setTimeout that calls
                // move() again completely on its own, no further key press involved.
                // That timeout doesn't know a teleport happened -- it fires later,
                // after the player has already been relocated to the destination tile,
                // and blindly resumes walking in whatever direction was queued
                // *before* the teleport. If that direction happens to walk the player
                // onto another door (easy to hit by accident when two teleport tiles
                // are placed to mirror each other), checkTeleport fires again for real
                // with no suppression window active by then, teleporting again with no
                // player input -- exactly the automatic back-and-forth being reported.
                // Whatever movement was queued before the teleport has no meaning once
                // the player's position has been replaced by the teleport itself, so
                // cancel the pending retry and drop the queued direction here.
                clearTimeout(p.moveRetryTimeout);
                p.stopKeyMove = false;

                self.teleportMaps(dest.tmap, dest.tx, dest.ty, dest.id);

                if (dest.portal) {
                    self.audioManager.playSound('teleport');
                }
            }
        };

        self.player.onStopPathing(function (x, y) {
            const p = self.player;
            log.info('onStopPathing');

            if (p.isDead) return;

            log.info('onStopPathing - 1');

            // FIX: checkTeleport used to run only after this hasTarget() block, but that
            // block returns early when the player has a target - so stopping on a door
            // tile while targeting something (e.g. a mob) never triggered the teleport.
            // Run it first so doors/portals always fire on stop, regardless of target.
            checkTeleport(p, x, y);

            if (p.hasTarget()) {
                p.lookAtEntity(p.target);
                self.makePlayerInteractNextTo();
            }

            log.info('onStopPathing - 2');

            if (p.target instanceof NpcStatic || p.target instanceof NpcMove) {
                self.makeNpcTalk(p.target);
            } else if (
                p.target instanceof Node &&
                p.target.kind === Node.CHEST_KIND
            ) {
                // Chests are Nodes (Node.CHEST_KIND) opened the same way
                // ore/tree nodes are harvested -- reuse that flow instead
                // of the removed Chest-specific sendOpen().
                self.makePlayerHarvestEntity(p.target);
            }
        });

        self.player.onRequestPath(function (x, y) {
            const p = self.player;
            const ignored = [p]; // Always ignore self
            const included = [];

            if (p.hasTarget() && !p.target.isDead) {
                ignored.push(p.target);
            }

            const path = self.findPath(p, x, y, ignored);

            if (path && path.length > 0) {
                const orientation = p.getOrientationTo([
                    path[1][0],
                    path[1][1]
                ]);
                p.setOrientation(orientation);
                self.client.sendMovePath(p, path.length, path);
            }
            return path;
        });

        self.player.onDeath(function () {
            log.info(self.playerId + ' is dead');
            const p = self.player;

            p.skillHandler.clear();

            p.forceStop();
            p.setSprite(self.sprites['death']);

            p.animate('death', 150, 1, function () {
                log.info(self.playerId + ' was removed');

                p.isDead = true;
                self.updateCameraEntity(p.id, null);

                setTimeout(function () {
                    self.playerdeath_callback();
                }, 1000);
            });

            self.audioManager.fadeOutCurrentMusic();
            self.audioManager.playSound('death');
        });

        self.player.onHasMoved(function (player) {});
    };

    proto.connected = function (server) {
        const self = this;

        if (this.hasServerPlayer) {
            if (this.client.connectgame_callback) {
                this.client.connectgame_callback();
            }
            return;
        }

        this.client.connection.send('startgame,' + server);
        this.hasServerPlayer = true;
    };
}
