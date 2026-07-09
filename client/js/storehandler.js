define(['config'], function(config) {
  var StoreHandler = Class.extend({
    init: function(game,app) {
    	this.game = game;
    	this.app = app;
    	this.toggle = false;
    	var self = this;
    	$('#shopCloseButton').click(function(e){
          $('#shopDialog').hide();
          self.toggle = false; // FIX: `this` inside the click handler is the DOM element, not the StoreHandler; use captured `self` instead
    	});
      $('#shopDialog').hide();
    },

    show: function() {
      $('#shopDialog').show();
      $('#shopUsername').val(game.player.user.username);

    }

  });
  return StoreHandler;
});
