// Converted from AMD (define) + Class.extend to a native ES6 module/class.
/* global Types */
import Character from './character.js';
import AppearanceData from '../data/appearancedata.js';
import Sprites from '../sprites.js';

export default class NpcMove extends Character {
    constructor(id, type, map, kind, name) {
        super(id, type, map, kind);
        this.mapIndex = map;
        this.talkIndex = 0;
        this.name = name;
        this.orientation = 2;
    }

    getSpriteName() {
        return game.spriteNames[this.sprites[0]];
    }
}
