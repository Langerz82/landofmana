// Converted from AMD (define) + Class.extend to a native ES6 module/class.
export default class Dialog {
    constructor(game, id) {
        this.id = id;
        this.jqBody = $(id);
        this.visible = false;
    }

    addClose(closeEvent) {
        this.jqCloseButton = $(this.id + ' .frame-close-button');
        this.closeEvent = closeEvent;
    }

    show() {
        const self = this;

        if (this.showHandler) {
            this.showHandler(this);
        }

        this.jqBody.show();
        this.visible = true;
        this.showing = true;

        if (game.gamepad) game.gamepad.dialogOpen(this.jqBody);

        if (this.jqCloseButton) {
            // FIX: unbind previous handler before rebinding, otherwise repeated show() calls stack duplicate click handlers
            this.jqCloseButton.off('click').click(function (e) {
                if (game.gamepad) game.gamepad.dialogClose();
                if (self.closeEvent) self.closeEvent(e);
                self.hide();
            });
        }
    }

    hide() {
        this.visible = false;
        this.showing = false;
        this.jqBody.hide();

        if (this.hideHandler) {
            this.hideHandler(this);
        }
    }

    onShow(handler) {
        this.showHandler = handler;
    }

    onHide(handler) {
        this.hideHandler = handler;
    }
}
