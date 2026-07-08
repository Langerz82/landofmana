import _ from 'underscore';
import AppearancesJson from "../../shared/data/appearance.json" with { type: 'json' };

const AppearanceData = {};
AppearanceData.Data = [];

const ItemGearTypes = {
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
	AppearanceData.Data.push({
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

AppearanceData.ItemGearTypes = ItemGearTypes;

AppearanceData.getSpriteByID = function (id) {
  return AppearanceData.Data[id].sprite;
}

export default AppearanceData;
