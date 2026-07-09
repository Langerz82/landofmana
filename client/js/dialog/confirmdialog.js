// Converted from AMD (define) + Class.extend to a native ES6 module/class.
import Dialog from './dialog.js';

export default class ConfirmDialog extends Dialog {
        constructor() {
            super(game, '#dialogModalConfirm'); // FIX (conversion): this._super(game, '#dialogModalConfirm') -> super(game, '#dialogModalConfirm')
            this.setScale();

            this.modalParent = $('#dialogModal');
            this.modal = $('#dialogModalConfirm');

            this.modalConfirmMessage = $('#dialogModalConfirmMessage');
            this.modalConfirmButton1 = $('#dialogModalConfirmButton1');
            this.modalConfirmButton2 = $('#dialogModalConfirmButton2');

            this.confirmCallback = null;
            this.scale=this.setScale();

            const self = this;

            this.modalConfirmButton1.click(function(event) {
                self.hide();

                if(self.confirmCallback) {
                    self.confirmCallback(true);
                }
            });
            this.modalConfirmButton2.click(function(event) {
                self.hide();

                if(self.confirmCallback) {
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
            this.modalParent.css('display', 'block');
            this.modal.css('display', 'block');
            super.show(); // FIX (conversion): this._super() -> super.show()
        }

        hide() {
            this.modalParent.css('display', 'none');
            this.modal.css('display', 'none');
            super.hide(); // FIX (conversion): this._super() -> super.hide()
        }

        confirm(message, callback) {
            this.confirmCallback = callback;

            this.modalConfirmMessage.text(message);
            this.show();
        }
}
