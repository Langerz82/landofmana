// Mixin extracted from clientcallbacks.js: entity movement sync (onEntityMove, onEntityMovePath).
// Applied onto ClientCallbacks.prototype via install*(...) call in clientcallbacks.js; not a standalone class.
/* global Utils, log, game, G_ROUNDTRIP, G_LATENCY, G_UPDATE_INTERVAL */

export function installClientCallbacksMovement(proto) {
    proto.onEntityMove = function (data) {
        const time = Number(data[0]),
            map = Number(data[1]),
            id = Number(data[2]),
            orientation = Number(data[3]),
            state = Number(data[4]),
            moveSpeed = Number(data[5]),
            x = Number(data[6]),
            y = Number(data[7]);

        if (
            game.mapStatus < 2 ||
            game.mapIndex !== map ||
            map !== game.player.mapIndex
        )
            return;

        const entity = game.getEntityById(id);
        if (!entity) {
            log.info('UNKNOWN ENTITY');
            game.unknownEntities.push(id);
            // DEBUG-VERIFY (monster teleport bug): record the position this dropped MOVE
            // packet wanted to set, so spawnEntity() can later compare it against where the
            // entity actually gets spawned and reveal the gap that reads as a teleport.
            console.warn(
                '[teleport-debug] onEntityMove dropped id=' +
                    id +
                    ' wanted=(' +
                    x +
                    ',' +
                    y +
                    ') atTime=' +
                    time
            );
            game.unknownEntityDrops[id] = {
                x,
                y,
                time,
                source: 'move',
                droppedAt: Date.now()
            };
            return;
        }
        if (entity.isDying || entity.isDead) {
            log.info('ENTITY DYING OR DEAD CANT MOVE');
            return;
        }

        if (entity === game.player) {
            const p = entity;
            if (!p || p.isDying || p.isDead) return;

            if (!(p.x === x && p.y === y)) {
                console.warn('PLAYER NOT IN CORRECT POSITION.');
                // Dirty hack to avoid sending a incorrect packet in forcestop.
                p.resetPosition(x, y);
                p.setFreeze(G_ROUNDTRIP);
                game.client.sendSyncTime(Date.now());
                // FIX: was a bare property reference (no-op); this is clearly meant to force a
                // redraw after resetPosition() corrects a desynced player position
                game.renderer.forceRedraw = true;
            }
            return;
        }

        entity.setMoveRate(moveSpeed);
        if (state) entity.move(time, orientation, false, x, y);
        entity.move(time, orientation, state, x, y);
    };

    proto.onEntityMovePath = function (data) {
        const time = Number(data.shift()),
            map = Number(data.shift()),
            id = Number(data.shift()),
            orientation = Number(data.shift()),
            interrupted = !!data.shift(),
            moveSpeed = Number(data.shift());

        const path = data;

        if (
            game.mapStatus < 2 ||
            game.mapIndex !== map ||
            map !== game.player.mapIndex
        )
            return;

        let entity = game.getEntityById(id);

        if (id === game.player.id) return;

        if (!entity) {
            game.unknownEntities.push(id);
            // DEBUG-VERIFY (monster teleport bug): same recording as onEntityMove, but for
            // a dropped path packet - path[0] is where it would have first snapped to.
            console.warn(
                '[teleport-debug] onEntityMovePath dropped id=' +
                    id +
                    ' wanted=(' +
                    path[0][0] +
                    ',' +
                    path[0][1] +
                    ') atTime=' +
                    time
            );
            game.unknownEntityDrops[id] = {
                x: path[0][0],
                y: path[0][1],
                time,
                source: 'movePath',
                droppedAt: Date.now()
            };
            return;
        }

        if (entity.isDying || entity.isDead) return;

        if (entity === game.player) return;

        let lockStepTime =
            G_LATENCY - (Utils.getWorldTime() - time) + G_UPDATE_INTERVAL;
        lockStepTime = Utils.clamp(0, G_LATENCY, lockStepTime);

        entity.forceStop();
        entity.setPosition(path[0][0], path[0][1]);

        const movePathFunc = function () {
            if (entity.isDying || entity.isDead) {
                entity.forceStop();
                return;
            }

            if (path.length < 2) return;

            if (moveSpeed) {
                entity.setMoveRate(moveSpeed);
            }

            entity.movePath(path);
            entity = null;
        };

        if (lockStepTime === 0) movePathFunc();
        else setTimeout(movePathFunc, lockStepTime);
    };
}
