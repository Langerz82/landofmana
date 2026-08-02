// Converted from AMD (define) + Class.extend to a native ES6 module/class.
import Dialog from './dialog.js';

export default class ConfirmDialog extends Dialog {
    constructor() {
        super(game, '#dialogModalConfirm'); // FIX (conversion): this._super(game, '#dialogModalConfirm') -> super(game, '#dialogModalConfirm')
        this.setScale();

        this.jqModalParent = $('#dialogModal');
        this.jqModal = $('#dialogModalConfirm');

        this.jqModalConfirmMessage = $('#dialogModalConfirmMessage');
        this.jqModalConfirmButton1 = $('#dialogModalConfirmButton1');
        this.jqModalConfirmButton2 = $('#dialogModalConfirmButton2');

        this.confirmCallback = null;

        const self = this;

        this.jqModalConfirmButton1.click(function (event) {
            self.hide();

            if (self.confirmCallback) {
                self.confirmCallback(true);
            }
        });
        this.jqModalConfirmButton2.click(function (event) {
            self.hide();

            if (self.confirmCallback) {
                self.confirmCallback(false);
            }
        });
    }

    setScale() {
        this.scale = game.renderer.getUiScaleFactor();
    }

    rescale() {
        this.setScale();
    }

    show() {
        this.rescale();
        this.jqModalParent.css('display', 'block');
        this.jqModal.css('display', 'block');
        super.show(); // FIX (conversion): this._super() -> super.show()
    }

    hide() {
        this.jqModalParent.css('display', 'none');
        this.jqModal.css('display', 'none');
        super.hide(); // FIX (conversion): this._super() -> super.hide()
    }

    confirm(message, callback) {
        this.confirmCallback = callback;

        this.jqModalConfirmMessage.text(message);
        this.show();
    }
}
