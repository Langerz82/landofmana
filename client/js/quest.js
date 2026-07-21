// Converted from AMD (define) + Class.extend to a native ES6 module/class.
/* global Types */
import NpcData from './data/npcdata.js';
import QuestData from './data/questdata.js';
import MobData from './data/mobdata.js';
import ItemLoot from './data/itemlootdata.js';

// FIX (conversion): 'QuestType' used to be a bare cross-script global; see clientcallbacks.js for
// the full explanation. Aliased from Types.QuestType now that gametypes.js is a real ES module.
const QuestType = Types.QuestType;

const getQuestObject = function (arr) {
    return {
        type: arr[0],
        kind: arr[1] || 0,
        count: arr[2] || 0
    };
};

export default class Quest {
    constructor(arr) {
        this.update(arr);
    }

    update(arr) {
        // FIX: parseInt() was an Array.prototype monkey-patch that has
        // been removed from utils.js; migrated to Utils.ArrayParseInt().
        // FIX (var cleanup): was `var arr = ...`, redeclaring the `arr` parameter with var -
        // let/const can't redeclare a parameter, so this is just a reassignment.
        arr = Utils.ArrayParseInt(arr);

        this.id = arr[0];
        this.type = arr[1];
        this.npcQuestId = arr[2];
        this.count = arr[3];
        this.status = arr[4];
        this.data1 = arr[5];
        this.data2 = arr[6];
        if (!isNaN(arr[7]))
            this.object = getQuestObject([arr[7], arr[8], arr[9]]);
        this.object2 = null;
        if (arr.length === 13 && !isNaN(arr[10]))
            this.object2 = getQuestObject([arr[10], arr[11], arr[12]]);
        this.setDesc();
    }

    setDesc(desc) {
        let questType;

        const questLang = lang.data['QUESTS'][parseInt(this.id).toString()];
        let summaryIndex;
        if (questLang) {
            desc = desc || questLang[this.status + 1];
        } else {
            switch (this.type) {
                case QuestType.HIDEANDSEEK:
                    questType = 'QUESTS_FIND';
                    summaryIndex = 'HIDEANDSEEK';
                    break;
                case QuestType.KILLMOBKIND:
                    questType = 'QUESTS_MOB';
                    summaryIndex = 'KILLMOBKIND';
                    break;
                case QuestType.GETITEMKIND:
                    questType = 'QUESTS_ITEM';
                    summaryIndex = 'GETITEMKIND';
                    break;
                case QuestType.USENODE:
                    questType = 'QUESTS_NODE';
                    summaryIndex = 'USENODE';
                    break;
            }
            const langData = lang.data[questType];
            desc = desc || langData[0][this.status];
        }
        if (!desc) {
            this.desc = '';
            return;
        }

        if (!Array.isArray(desc)) desc = [[0, desc]];

        let i = 0;
        for (let d of desc) {
            let txt = Array.isArray(d) ? d[1] : d;
            txt = this.setTextTemplate(txt);
            desc[i++] = [Array.isArray(d) ? d[0] : 0, txt];
        }
        this.desc = desc;

        const sum = lang.data['QUEST_SUMMARY'];
        const summary = sum.hasOwnProperty(this.id)
            ? sum[this.id]
            : sum[summaryIndex];
        this.summary = this.setTextTemplate(summary);
    }

    setTextTemplate(txt) {
        switch (this.type) {
            case QuestType.GETITEMKIND:
                if (this.object2) {
                    const itemLootData = ItemLoot[this.object2.kind];
                    txt = txt.replace(
                        /%name%/g,
                        itemLootData.name.capitalizeFirstLetter()
                    );
                    txt = txt.replace(/%count%/g, this.object2.count);
                }
                if (this.object) {
                    const mobData = MobData.Kinds[this.object.kind];
                    if (mobData)
                        txt = txt.replace(
                            /%name2%/g,
                            mobData.key.capitalizeFirstLetter()
                        );
                }
                break;
            case QuestType.KILLMOBKIND:
                if (this.object) {
                    const mobData = MobData.Kinds[this.object.kind];
                    txt = txt.replace(
                        /%name%/g,
                        mobData.key.capitalizeFirstLetter()
                    );
                    txt = txt.replace(/%count%/g, this.object.count);
                }
                break;
            case QuestType.HIDEANDSEEK:
                if (this.object) {
                    const npcData = NpcData.Kinds[this.object.kind];
                    txt = txt.replace('%name%', npcData.name);
                }
                break;
            case QuestType.USENODE:
                if (this.object) {
                    txt = txt.replace(/%count%/g, this.object.count);
                }
                break;
        }
        txt = txt.replace('%count2%', this.count);
        return txt;
    }
}
