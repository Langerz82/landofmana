// Converted from AMD (define) + Class.extend to a native ES6 module/class.
import config from './config.js';

export default class StoreHandler {
    constructor(game, app) {
        this.game = game;
        this.app = app;
        this.toggle = false;
        const self = this;

        this.jqShopDialog = $('#shopDialog');
        this.jqShopUsername = $('#shopUsername');

        const jqShopCloseButton = $('#shopCloseButton');
        jqShopCloseButton.click(function (e) {
            self.jqShopDialog.hide();
            self.toggle = false; // FIX: `this` inside the click handler is the DOM element, not the StoreHandler; use captured `self` instead
        });
        this.jqShopDialog.hide();
    }

    show() {
        this.jqShopDialog.show();
        this.jqShopUsername.val(game.player.user.username);
    }
}
