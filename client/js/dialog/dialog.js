// Converted from AMD (define) + Class.extend to a native ES6 module/class.
export default class Dialog {
    constructor(game, id) {
            //this.game = game;
            this.id = id;
            this.body = $(id);
            this.visible = false;
    }

    addClose(closeEvent) {
          this.closeButton = $(this.id+' .frame-close-button');
          this.closeEvent = closeEvent;
    }

    show() {
            const self = this;

            if(this.showHandler){
                this.showHandler(this);
            }

            this.body.show();
            this.visible = true;
            this.showing = true;

            if (game.gamepad)
              game.gamepad.dialogOpen(this.body);

            if (this.closeButton) {
              // FIX: unbind previous handler before rebinding, otherwise repeated show() calls stack duplicate click handlers
              this.closeButton.off('click').click( function (e) {
                if (game.gamepad)
                  game.gamepad.dialogClose();
                if (self.closeEvent)
                  self.closeEvent(e);
              	self.hide();
              });
            }
    }

    hide() {
            this.visible = false;
            this.showing = false;
            this.body.hide();

            if(this.hideHandler){
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
