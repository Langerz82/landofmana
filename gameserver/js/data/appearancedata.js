import _ from 'underscore';
import AppearancesJson from "../../shared/data/appearance.json" with { type: 'json' };

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

export { ItemGearTypes };
export const Data = AppearanceData;

export function getSpriteByID(id) {
  return AppearanceData[id].sprite;
}

export default { ItemGearTypes, Data, getSpriteByID };
