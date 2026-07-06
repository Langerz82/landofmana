
define([], function() {

    var PlayerItems = Class.extend({
        init: function(entity) {
            this.entity = entity;

            this.equipment = {};
            this.inventory = {};
        },

        setItems: function (equipment, inventory) {
          this.equipment = equipment;
          this.inventory = inventory;
        },

        hasWeaponType: function (type) {
          var entity = this.entity;

          type = type || "any";
          if (type === "any")
              return true;

          var weapon = this.equipment.getWeapon();
          if (!weapon)
            return false;

          if (type) {
            return this.getWeaponType() === type;
          }
          return ItemTypes.isHarvestWeapon(weapon.itemKind);
        },

        getWeapon: function () {
          return this.equipment.getWeapon();
        },

        hasWeapon: function() {
          return this.getWeapon() !== null;
        },

        getWeaponLevel: function () {
          var entity = this.entity;

          var weapon = this.getWeapon();
          if (!weapon)
            return 0;
          var weaponData = ItemTypes.KindData[weapon.itemKind];
          return Types.getWeaponLevel(entity.stats.exp[weaponData.type]);
        },

        getWeaponType : function () {
          var weapon = this.getWeapon();
          if (!weapon)
            return null;
          return ItemTypes.getType(weapon.itemKind);
        },

        hasHarvestWeapon: function (type) {
          if (type && type === "any")
              return true;

          var weapon = this.getWeapon();
          if (!weapon)
            return false;

          var weaponData = ItemTypes.KindData[weapon.itemKind];
          if (type) {
            return weaponData.type === type;
          }
          return ItemTypes.isHarvestWeapon(weapon.itemKind);
        },

    });

    return PlayerItems;
});
