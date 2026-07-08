import _ from 'underscore';

import GameTypes from "../shared/js/gametypes.js";
import ItemTypes from "../shared/js/itemtypes.js";

const Types = GameTypes;

import Utils from './utils.js';

import AppearanceData from './data/appearancedata.js';

// Export everything that was globally assigned
export {
  _,
  GameTypes,
  ItemTypes,
  Types,
  Utils,
  AppearanceData
};

// For backward compatibility (if other files still use global-like access)
export default {
  _,
  GameTypes,
  ItemTypes,
  Types,
  Utils,
  AppearanceData
};

global._ = _;
global.GameTypes = GameTypes;
global.ItemTypes = ItemTypes;
global.Types = Types;
global.Utils = Utils;
global.AppearanceData = AppearanceData;
