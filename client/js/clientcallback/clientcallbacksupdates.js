// Mixin extracted from clientcallbacks.js: sprite/animation/block state updates
// (onSetSprite, onSetAnimation, onBlockModify).
// Applied onto ClientCallbacks.prototype via install*(...) call in clientcallbacks.js; not a standalone class.
import Player from '../entity/player/player.js';
import AppearanceData from '../data/appearancedata.js';
/* global game */

export function installClientCallbacksUpdates(proto) {
    proto.onSetSprite = function (data) {
        const entity = game.getEntityById(Number(data[0]));
        if (!entity) return;

        if (entity instanceof Player) {
            entity.setSpriteByIndex(0, Number(data[1]));
            entity.setSpriteByIndex(1, Number(data[2]));

            game.app.initPlayerBar();
        } else {
            const num = Number(data[1]);
            const sprite = game.sprites[AppearanceData[num].sprite];
            entity.setSprite(sprite);
        }
    };

    proto.onSetAnimation = function (data) {
        const entity = game.getEntityById(Number(data[0]));
        if (!entity) return;

        // TODO - Not yet implemented.
    };

    proto.onBlockModify = function (data) {
        const entityId = Number(data[0]);
        const type = Number(data[1]);
        const blockId = Number(data[2]);

        const entity = game.getEntityById(entityId);
        const block = game.getEntityById(blockId);
        if (!entity || !block) return;

        if (type === 0) {
            block.pickup(entity);
        } else if (type === 1) {
            block.place(entity);
            entity.holdingBlock = null;
        }
    };
}
