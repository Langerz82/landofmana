// Side-effect module: shared/js/gametypes.js, shared/js/itemtypes.js, and utils.js are real ES
// modules (export default Types/ItemTypes/Utils), but every other file in this codebase
// references Types/ItemTypes/Utils as bare globals (Types.X, ItemTypes.X, Utils.X), the same way
// jQuery ($), underscore (_), PIXI, pako, BISON, and localforage are referenced. This module
// imports the three real exports once and re-exposes them as window globals so every consumer
// can keep using the bare-identifier style without importing them individually.
//
// This must be imported for its side effect BEFORE anything that reads these bare globals at
// module-evaluation time (not just inside a method body called later) - e.g. data/items.js and
// data/mobdata.js call ItemTypes.* / iterate with $.each(...) callbacks that reference ItemTypes
// as soon as they're imported, not lazily. That's why home.js imports this module before
// main.js (whose import graph pulls in every data/*.js file) - same ordering requirement as
// js/globalstate.js.
import Types from '../shared/js/gametypes.js';
import ItemTypes from '../shared/js/itemtypes.js';
import Utils from './utils.js';

window.Types = Types;
window.ItemTypes = ItemTypes;
window.Utils = Utils;
