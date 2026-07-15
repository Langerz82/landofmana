import Entity from './entity.js';
import Player from './player.js';
//import Utils from '../utils.js';
import Messages from '../message.js';
import { Types } from '../common.js';

class NpcStatic extends Entity {
    constructor(id, kind, x, y, map) {
        super(id, Types.EntityTypes.NPCSTATIC, kind, x, y, map);

        this.map = map;
    }

    talk(player)
    {
        console.info("talk");
        console.info("kind: "+this.kind);
        if (this.kind === 44)
        {
            // FIX: this "collecting items" NPC branch was dead code that
            // would throw if it ever ran. `player.questStatus` is never set
            // anywhere in the codebase (the real quest list lives at
            // `player.quests.quests`, as used below), so the `if` guard
            // always evaluated false. Even if it had fired,
            // `player.questAboutItem(...)` doesn't exist -- that method is
            // `player.quests.questAboutItem(quest)`, and it takes a single
            // quest object rather than the two-argument
            // `(questStatus, null)` shape used here. The `type`/`count`/
            // `objectCount` field names referenced also don't match the
            // current quest schema (`quest.type`/`quest.object.count`), and
            // no NPC in data/npcdata.js is currently defined with kind 44,
            // so this path is unreachable today either way. Left disabled
            // rather than rewritten, since doing this NPC's "collect items"
            // flow correctly (deciding what quest(s) it should progress and
            // how) needs game-design input, not a mechanical fix.
            return;
        }

        //var npcIsBusy = false;
        //if (player.questStatus) {
        // FIX: player.quests is the PlayerQuests component instance, not an
        // array -- `for...in` over it enumerated its own property names
        // ("player", "quests", "completeQuests" as strings), so
        // quest.npcKind was always undefined and this guard never fired.
        // The actual quest list lives at player.quests.quests.
        for (const quest of player.quests.quests)
        {
            if (quest.npcKind === this.kind)
            {
                //npcIsBusy = true;
                return;
            }
        }
        //}

    }
}

export default NpcStatic;
