// Converted from AMD (define) + Class.extend to a native ES6 module/class.
import config from './config.js';

export default class StoreHandler {
    constructor(game, app) {
        this.game = game;
        this.app = app;
        this.toggle = false;
        const self = this;
        $('#shopCloseButton').click(function (e) {
            $('#shopDialog').hide();
            self.toggle = false; // FIX: `this` inside the click handler is the DOM element, not the StoreHandler; use captured `self` instead
        });
        $('#shopDialog').hide();
    }

    show() {
        $('#shopDialog').show();
        $('#shopUsername').val(game.player.user.username);
    }
}
