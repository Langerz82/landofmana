var _ = require('underscore'),
    AppearancesJson = require("../../shared/data/appearance.json");

var AppearanceData = [];

var ItemGearTypes = {
  "weapon": [],
  "weaponarcher": [],
  "armor": [],
  "armorarcher": [],
};

/*AppearanceData.push({
  name: "blank",
  type: "",
  sprite: "",
  buy: 0
});*/

_.each( AppearancesJson, function( value, key) {
	AppearanceData.push({
		name: value.name,
		type: value.type,
		sprite: value.sprite,
		buy: value.buy
	});
  if (ItemGearTypes[value.type])
  {
    ItemGearTypes[value.type].push({key: key, val: value});
  }
});

//console.log(JSON.stringify(ItemGearTypes));


module.exports.ItemGearTypes = ItemGearTypes;

module.exports.Data = AppearanceData;

module.exports.getSpriteByID = function (id) {
  return AppearanceData[id].sprite;
}
