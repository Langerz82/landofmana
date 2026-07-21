import MobData from './mobdata.js';
//setTimeout(function () {
import SkillData from './skilldata.js';
//}, 10000);
import ItemData from './itemdata.js';
import AppearanceData from './appearancedata.js';
import MobSpeechData from './mobspeechdata.js';
import ItemLootData from './itemlootdata.js';
import NpcData from './npcdata.js';
import LangData from './langdata.js';
import QuestData from './questdata.js';
import NotifyData from './notificationdata.js';
import EntitySpawnData from './entityspawndata.js';

// NOTE: the original file just `require()`d each data module for its
// side effects and relied on every one of these (MobData, SkillData,
// ItemData, ...) leaking into the shared global scope so other files could
// reference them bare. ES modules don't leak globals, so this file now
// re-exports each of them by name -- anything that used to reach them as a
// bare global should `import` them from here (or directly from their own
// module) instead.
export {
    MobData,
    SkillData,
    ItemData,
    AppearanceData,
    MobSpeechData,
    ItemLootData,
    NpcData,
    LangData,
    QuestData,
    NotifyData,
    EntitySpawnData
};
