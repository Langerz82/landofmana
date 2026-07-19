// Converted from AMD (define) + Class.extend to a native ES6 module/class.
import Dialog from './dialog.js';

export default class NotifyDialog extends Dialog {
        constructor() {
            super(game, '#dialogModalNotify'); // FIX (conversion): this._super(game, '#dialogModalNotify') -> super(game, '#dialogModalNotify')
            this.setScale();

            this.modalParent = $('#dialogModal');
            this.modal = $('#dialogModalNotify');

            this.modalNotifyMessage = $('#dialogModalNotifyMessage');
            this.modalNotifyButton1 = $('#dialogModalNotifyButton1');

            this.notifyCallback = null;

            const self = this;

            this.modalNotifyButton1.click(function(event) {
                self.hide();

                if(self.notifyCallback) {
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
            this.modalParent.css('display', 'block');
            this.modal.css('display', 'block');
            super.show(); // FIX (conversion): this._super() -> super.show()
        }

        hide() {
            this.modalParent.css('display', 'none');
            this.modal.css('display', 'none');
            super.hide(); // FIX (conversion): this._super() -> super.hide()
        }

        notify(message, callback) {
            this.notifyCallback = callback;

            this.modalNotifyMessage.text(message);
            this.show();
        }
}
