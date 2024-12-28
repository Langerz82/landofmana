/* global databaseHandler, log */

var ItemRoom = require("./itemroom"),
    Messages = require("../message");

module.exports = Equipment = cls.Class.extend({
    init: function(owner, number, items){
        this.owner = owner;
        this.number = number;
        this.maxNumber = 5;
        this.weaponSlot = 4;
        this.rooms = {};
        console.info("number="+number);
        console.info("itemSlots="+JSON.stringify(items));

        if (items) {
          for(var i=0; i<items.length; i++){
            var index = items[i].slot;
            this.rooms[index] = items[i];
            /*if (items[i] && index == this.weaponSlot) {
              this.owner.setRange();
            }*/
          }
        }
    },

    /*hasItem: function(itemKind){
        return this.hasItems(itemKind, 1);
    },

    hasItems: function(itemKind, itemCount){
        var a = 0;
        for(var i in this.rooms){
            //console.info("hasItems - compare: " + this.rooms[i].itemKind + "=" + itemKind);
            if(this.rooms[i].itemKind === itemKind){
            	 a += this.rooms[i].itemNumber;
            	 if (a >= itemCount)
                	return true;
            }
        }
        return false;
    },*/

    makeEmptyItem: function(index) {
        this.rooms[index] = null;
        delete this.rooms[index];
        this.setItem(index, null);
    },

    /*getItemCount: function(itemKind){
    	for(var i in this.rooms){
            if(this.rooms[i].itemKind == itemKind){
                return this.rooms[i].itemNumber;
            }
        }
        return 0;
    },*/

    getItemIndex: function(itemKind){
        for(var i in this.rooms){
            if(this.rooms[i] && this.rooms[i].itemKind == itemKind){
                return i;
            }
        }
        return -1;
    },

    /*getEmptyIndex: function() {
        for(var index = 0; index < this.maxNumber; index++) {
            if(!this.rooms[index]) {

                return index;
            }
        }
        return -1;
    },*/

    /*putItem: function(item) {
        return this._putItem(item);
    },

    _putItem: function(item){
        for(var i=0; i < this.maxNumber; i++){
            var item = this.rooms[i];
            if(!item) {
                this.setItem(i, item);
                return i;
            }
        }
        if (this.owner instanceof Player)
        	this.owner.map.entities.pushToPlayer(this.owner, new Messages.Notify("EQUIPMENT", "EQUIPMENT_FULL"));
        return -1;
    },*/

    combineItem: function (item, item2) {
      return false;
    },

    checkItem: function (index, item) {
      if (!item)
        return true;

      var kind = item.itemKind;
      var data = ItemData.Kinds[kind];
      //var equip = this.rooms;
      //var isArmor = ItemTypes.isArmor(kind);

      if (!ItemTypes.isEquipment(kind))
        return false;

      if (index==0 && !(data.type === "helm" && this.canEquip(item, data.level)))
        return false;
      //if (slot==1 && (!isArmor || !this.canEquip(item, ItemTypes.getArmorLevel(kind))))
      if (index==1 && !(data.type === "chest" && this.canEquip(item, data.level)))
        return false;
      if (index==2 && !(data.type === "gloves" && this.canEquip(item, data.level)))
        return false;
      if (index==3 && !(data.type === "boots" && this.canEquip(item, data.level)))
        return false;
      //var isWeapon = ItemTypes.isWeapon(kind);
      if (index==4 && !(ItemTypes.isWeapon(kind) && this.canEquip(item, ItemTypes.getWeaponLevel(kind))))
        return false;

      return true;
    },

    setItem: function (index, item) {
      this._setItem(index, item);
    },

    getItemTypeIndex: function (item) {
      if (item) {
        var kind = item.itemKind;
        var data = ItemData.Kinds[kind];
        if (data.type === "helm")
          return 0;
        else if (data.type === "chest")
          return 1;
        else if (data.type === "gloves")
          return 2;
        else if (data.type === "boots")
          return 3;
        else if (ItemTypes.isWeapon(kind))
          return 4;
      }
      return -1;
    },

// TODO swapping equipment items to different boxes deletes item.
    _setItem: function (index, item)
    {


      if (item && this.rooms[index] == item)
        return false;

      var player = this.owner;

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
      player.map.entities.pushToPlayer(player, new Messages.ItemSlot(2, [item]));
      return true;
    },

    canEquip: function(item, level){
      var player = this.owner;
      var kind = item.itemKind;
      //var level = ItemTypes.getArmorLevel(kind);

      if(level > player.level.base){
          player.map.entities.pushToPlayer(player, new Messages.Notify("EQUIP", "EQUIPMENT_LEVEL", [level]));
          return false;
      }

      return true;
    },

    save: function ()
    {
        //databaseHandler.saveItems(this.owner, 2, this.rooms);
    },

    /*takeOutItems: function(index, number){
        var item = this.rooms[index];
        if((ItemTypes.isLootItem(item.itemKind) || ItemTypes.isConsumableItem(item.itemKind)) && item.itemNumber > number)
        {
            item.itemNumber -= number;
        }
        this.setItem(index, item);
    },*/

    degradeItem: function (slot, adjustment) {
	    var item = this.rooms[slot];
	    if (!item)
	    	return;
	    item.itemDurability -= adjustment;
	    item.itemDurability = Math.max(0,item.itemDurability);
	    if (item.itemDurability == 0 && item.itemDurabilityMax <= 30)
	    {
	    	this.makeEmptyEquipment(slot);
	    	return false;
	    }
      this.owner.map.entities.pushToPlayer(this.owner, new Messages.ItemSlot(2, [item]));
	    return true;
    },

    addExperience: function (slot, adjustment) {
	    var item = this.rooms[slot];
	    if (!item)
	    	return;

	    item.itemExperience += adjustment;
	    var oldItemNumber = item.itemNumber;
	    var newItemNumber = ItemTypes.getItemLevel(item.itemExperience);

	    if (oldItemNumber < newItemNumber)
	    {
	    	item.itemNumber++;
	    	this.owner.map.entities.pushToPlayer(this.owner, new Messages.ItemLevelUp(slot, item));
	    }

      //log.warn("addExperience - item:"+JSON.stringify(item));
      item.slot = slot;
      this.owner.map.entities.pushToPlayer(this.owner, new Messages.ItemSlot(2, [item]));
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
      var itemString = "[";
      var isItems = false;

      for(var i=0; i<this.maxNumber; i++){
          var item = this.rooms[i];
          if (!item) continue;
          itemString += "["+item.toArray().join(',')+"],"
          isItems = true;
      }
      itemString = itemString.slice(0, -1);
      itemString += "]";
      if (!isItems) return "[]";
      return itemString;
    },

    getWeapon: function () {
      return this.rooms[4];
    },

    getArmor: function () {
      return this.rooms[1];
    },

});
