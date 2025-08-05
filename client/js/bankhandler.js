/* global Types, Class */

define([], function() {
    var BankHandler = Class.extend({
        init: function(game) {
            var self = this;

            this.game = game;
            this.maxNumber = 96;
            this.banks = {};
        },

        initBank: function(itemArray) {
          for(var i = 0; i < itemArray.length; ++i)
          {
            var item = itemArray[i];
            if (item)
              this.banks[item.slot] = item;
          }
        },

        setBank: function(itemArray) {
          for(var i = 0; i < itemArray.length; ++i)
          {
            var item = itemArray[i];
            if (item.itemKind === -1)
              this.banks[item.slot] = null;
            else
              this.banks[item.slot] = item;
          }
        },

        setGold: function(gold) {
            this.gold = parseInt(gold);
            $('.bankGold').text(this.gold);
        },

        isBankFull: function() {
          if (Object.keys(this.banks).length < this.maxNumber)
            return false;
        	for (var i=0; i < this.maxBankNumber; i++)
        	{
        		if (!this.banks[i])
        			return false;
        	}
        	return true;
        },
    });

    return BankHandler;
});
