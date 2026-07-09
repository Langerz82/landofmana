// Converted from AMD (define) + Class.extend to a native ES6 module/class.
import Character from './character.js';
import QH from '../questhandler.js';
import NpcData from '../data/npcdata.js';

export default class NpcStatic extends Character {
    constructor(id, type, map, kind, name) {
        super(id, type, map, kind, 1);
        //this.itemKind = ItemTypes.getKindAsString(this.kind);
        this.talkIndex = 0;

        log.info("Npc.title: " + NpcData.Kinds[this.kind].title);
        log.info("Npc.name: " + NpcData.Kinds[this.kind].name);

        this.name = name || NpcData.Kinds[this.kind].title;
    }

    getSpriteName() {
        return NpcData.Kinds[this.kind].uid;
    }

    getAnimationByName(name) {
        return super.getAnimationByName(name); // FIX (carried over): was ignoring the name argument and always returning "idle_down"; forward the requested animation like other entity classes
    }
}
