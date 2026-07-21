// Converted from AMD (define) + Class.extend to a native ES6 module/class.
import Character from './character/character.js';
import QH from '../questhandler.js';
import NpcData from '../data/npcdata.js';

export default class NpcStatic extends Character {
    constructor(id, type, map, kind, name) {
        super(id, type, map, kind, 1);
        this.talkIndex = 0;
        this.name = name || NpcData.Kinds[this.kind].title;
    }

    getSpriteName() {
        return NpcData.Kinds[this.kind].uid;
    }
}
