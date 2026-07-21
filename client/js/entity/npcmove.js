// Converted from AMD (define) + Class.extend to a native ES6 module/class.
/* global Types */
import Character from './character/character.js';
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
        // FIX: was `game.spriteNames[this.sprites[0]]` - `game.spriteNames` is never assigned
        // anywhere (only a commented-out line in game.js), so this always threw, and
        // `this.sprites[0]` holds a Sprite object/null rather than a lookup key anyway.
        // Use the same uid formula clientcallbacks.js uses when spawning an NpcMove.
        return (
            'npc' + (1 + (~~(this.kind / 8) % 4)) + '_' + (1 + (this.kind % 8))
        );
    }
}
