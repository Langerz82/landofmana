define(function() {
    var Dialog = Class.extend({
        init: function(game, id) {
            //this.game = game;
            this.id = id;
            this.body = $(id);
            this.visible = false;
        },

        addClose: function (closeEvent) {
          this.closeButton = $(this.id+' .frame-close-button');
          this.closeEvent = closeEvent;
        },

        show: function() {
            var self = this;

            if(this.showHandler){
                this.showHandler(this);
            }

            this.body.show();
            this.visible = true;
            this.showing = true;

            if (game.gamepad)
              game.gamepad.dialogOpen(this.body);

            if (this.closeButton) {
              this.closeButton.click( function (e) {
                if (game.gamepad)
                  game.gamepad.dialogClose();
                if (self.closeEvent)
                  self.closeEvent(e);
              	self.hide();
              });
            }
        },

        hide: function() {
            this.visible = false;
            this.showing = false;
            this.body.hide();

            if(this.hideHandler){
                this.hideHandler(this);
            }
        },

        onShow: function(handler) {
            this.showHandler = handler;
        },

        onHide: function(handler) {
            this.hideHandler = handler;
        }
    });

    return Dialog;
});
