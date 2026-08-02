// Converted from AMD (define) + Class.extend to a native ES6 module/class.
import Dialog from './dialog.js';

export default class NotifyDialog extends Dialog {
    constructor() {
        super(game, '#dialogModalNotify'); // FIX (conversion): this._super(game, '#dialogModalNotify') -> super(game, '#dialogModalNotify')
        this.setScale();

        this.jqModalParent = $('#dialogModal');
        this.jqModal = $('#dialogModalNotify');

        this.jqModalNotifyMessage = $('#dialogModalNotifyMessage');
        this.jqModalNotifyButton1 = $('#dialogModalNotifyButton1');

        this.notifyCallback = null;

        const self = this;

        this.jqModalNotifyButton1.click(function (event) {
            self.hide();

            if (self.notifyCallback) {
                self.notifyCallback();
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

    notify(message, callback) {
        this.notifyCallback = callback;

        this.jqModalNotifyMessage.text(message);
        this.show();
    }
}
