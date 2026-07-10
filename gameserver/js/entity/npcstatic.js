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
            console.info("THIS IS FOR COLLECTING ITEMS NPC.")
            if (player.questStatus) {
                for (let [key, questStatus] of Object.entries(player.questStatus))
                {
                    console.info("questStatus"+JSON.stringify(questStatus));
                    if (questStatus.type==1 && questStatus.count <= questStatus.objectCount)
                    {
                        player.questAboutItem(questStatus, null);
                    }
                }
            }
            return;
        }

        //var npcIsBusy = false;
        //if (player.questStatus) {
        for (const quest in player.quests)
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
