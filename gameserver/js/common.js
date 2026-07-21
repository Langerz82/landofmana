import _ from 'underscore';
import GameTypes from '../shared/js/gametypes.js';
import ItemTypes from '../shared/js/itemtypes.js';
import Utils from './utils.js';

const Types = GameTypes;

// Export everything that was globally assigned
export { _, GameTypes, ItemTypes, Types, Utils };

// For backward compatibility (if other files still use global-like access)
export default {
    _,
    GameTypes,
    ItemTypes,
    Types,
    Utils
};

global._ = _;
global.GameTypes = GameTypes;
global.ItemTypes = ItemTypes;
global.Types = Types;
global.Utils = Utils;
