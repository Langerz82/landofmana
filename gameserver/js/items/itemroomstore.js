/* global databaseHandler, log */

var cls = require("../lib/class"),
    ItemRoom = require("./itemroom"),
    Messages = require("../message");

module.exports = ItemStore = cls.Class.extend({
    init: function(owner, number, items){
        this.owner = owner;
        this.number = number;

        this.typeIndex = 0;
        this.maxNumber = 50;
        this.maxStack = 100;
        this.fullMessage = new Messages.Notify("ITEMSTORE", "ITEMSTORE_FULL");

        this.rooms = {};
        console.info("number="+number);
        //console.info("itemSlots="+JSON.stringify(itemSlots));

        if (items) {
          for(var i=0; i<items.length; i++){
              this.rooms[ items[i].slot] = items[i];
          }
        }
    },

    hasItem: function(itemKind){
        return this.hasItems(itemKind, 1);
    },

    hasItems: function(itemKind, itemCount){
        var a = 0;
        for(var i in this.rooms){
            //console.info("hasItems - compare: " + this.rooms[i].itemKind + "=" + itemKind);
            if(this.rooms[i] && this.rooms[i].itemKind === itemKind){
            	 a += this.rooms[i].itemNumber;
            	 if (a >= itemCount)
                	return true;
            }
        }
        return false;
    },

    hasItemCount: function(itemKind){
        var a = 0;
        for(var i in this.rooms){
            if(this.rooms[i] && this.rooms[i].itemKind === itemKind){
            	 a += this.rooms[i].itemNumber;
            }
        }
        return a;
    },

    hasRoomCount: function(start, end) {
        start = start || 0;
        end = end || this.maxNumber;
        return this.maxNumber - Object.keys(this.rooms).length;
    },

    hasRoom: function(start, end) {
        start = start || 0;
        end = end || this.maxNumber;
        return Object.keys(this.rooms).length < this.maxNumber;
    },

    makeEmptyItem: function(index) {
        this.rooms[index] = null;
        delete this.rooms[index];
        this.setItem(index, null);
    },

    getItemCount: function(itemKind){
    	for(var i in this.rooms){
            if(this.rooms[i] && this.rooms[i].itemKind === itemKind){
                return this.rooms[i].itemNumber;
            }
        }
        return 0;
    },

    getItemIndex: function(itemKind){
        for(var i in this.rooms){
            if(this.rooms[i] && this.rooms[i].itemKind === itemKind){
                return i;
            }
        }
        return -1;
    },

    getEmptyIndex: function(start, end) {
        start = start || 0;
        end = end || this.maxNumber;
        for(var index = start; index < end; index++) {
            if(!this.rooms[index]) {
                return index;
            }
        }
        return -1;
    },

    putItem: function(item) {
      var kind = item.itemKind;
      var consume = ItemTypes.isConsumableItem(kind);
      var loot = ItemTypes.isLootItem(kind);
      var craft = ItemTypes.isCraftItem(kind);

      if (consume || loot || craft)
      {
        for(var i in this.rooms){
          if (this.combineItem(item, this.rooms[i]))
            return i;
        }
      }
      return this._putItem(item);
    },

    combineItem: function (item, item2) {
      console.info(JSON.stringify(item));
      console.info(JSON.stringify(item2));

      if(!item || !item2)
        return false;

      if(item.itemKind !== item2.itemKind)
        return false;

      if (ItemTypes.isEquippable(item.itemKind) ||
          ItemTypes.isEquippable(item2.itemKind)) {
        return false;
      }

      if (item.itemNumber === this.maxStack)
        return false;
      if (item2.itemNumber === this.maxStack)
        return false;

      var res = false;
      var slot = item.slot;
      var slot2 = item2.slot;

      var maxStack = this.maxStack;
      if (item2.itemNumber < maxStack) {
        item2.itemNumber += item.itemNumber;
        if (item2.itemNumber > maxStack) {
          item.itemNumber = item2.itemNumber - maxStack;
          item2.itemNumber = Math.min(item2.itemNumber, maxStack);
          //this.setItem(slot, null); //  NOT NEEDED.
          if (item.slot === -1)
            slot = this.getEmptyIndex();
        } else {
          item = null;
        }
        res = true;
      }

      if(item2.itemNumber <= 0) {
        item2 = null;
      }

      this.setItem(slot, item);
      this.setItem(slot2, item2);
      return res;
    },

    _putItem: function(item){
      i = this.getEmptyIndex();
      if (i < 0)
      {
        if (this.owner instanceof Player)
        	this.owner.sendPlayer(this.fullMessage);
        return -1;
      }
      else {
        this.setItem(i, item);
        return i;
      }
    },

    checkItem: function (index, item) {
      return (item);
    },

    setItem: function (index, item)
    {
      if (!item) {
        this.rooms[index] = null;
        item = {slot: index, itemKind: -1};
      }
      else {
        if (!this.checkItem(index, item))
          return false;

        this.rooms[index] = item;
        item.slot = index;
      }
      this.owner.sendPlayer(new Messages.ItemSlot(this.typeIndex, [item]));
      return true;
    },

    save: function ()
    {
    },

    removeItemKind: function (kind, number)
    {
      var j=number;
      for(var i in this.rooms){
        var r = this.rooms[i];
        if (!r)
          continue;
        if(r.itemKind === kind) {
          if (r.itemNumber > j) {
            r.itemNumber -= j;
            this.setItem(i, r);
            return true;
          } else {
            j -= r.itemNumber;
            r = null;
          }
          this.setItem(i, r);
        }
      }
      return false;
    },

    takeOutItems: function(index, number){
        var item = this.rooms[index];
        if (!item)
          return null;

        if (number > item.itemNumber)
          return null;

        if (ItemTypes.isEquippable(item.itemKind)) {
          this.setItem(index, null);
          return item;
        }

        item.itemNumber -= number;

        if (item.itemNumber === 0)
          item = null;

        this.setItem(index, item);
        return item;
    },

    getRandomItemNumber: function() {
    	var item = null;
      var itemNums = [];
      for (var i in this.rooms)
      {
        item = this.rooms[i];
        if (item && item.itemKind > 0) itemNums.push(id);
      }
      var rand = Utils.randomRange(0,itemNums.length-1);
      return (itemNums.length > 0) ?
        itemNums[rand] : -1;
    },

    toString: function(){
      var i=0;
      var itemString = "" + this.maxNumber + ",";

      for(var i in this.rooms){
          var item = this.rooms[i];
          if (!item) continue;
          itemString += item.toArray().join(',');
      }
      return itemString;
    },

    toStringJSON: function () {
      var item = null;
      var items = [];
      for(var i in this.rooms){
          item = this.rooms[i];
          if (!item) continue;
          items.push(item.toArray());
      }
      return JSON.stringify(items);
    },

});
