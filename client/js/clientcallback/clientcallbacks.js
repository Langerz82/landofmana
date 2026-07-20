// Converted from AMD (define) + Class.extend to a native ES6 module/class.
import HoveringInfo from '../hoveringinfo.js';
import GameClient from '../gameclient.js';
import AudioManager from '../audio.js';
import Pathfinder from '../pathfinder.js';
import Entity from '../entity/entity.js';
import EntityMoving from '../entity/entitymoving.js';
import Item, { ItemRoom } from '../entity/item.js';
import Items from '../data/items.js';
import ItemLoot from '../data/itemlootdata.js';
import Mob from '../entity/mob.js';
import NpcStatic from '../entity/npcstatic.js';
import NpcMove from '../entity/npcmove.js';
import NpcData from '../data/npcdata.js';
import Player from '../entity/player.js';
import Character from '../entity/character.js';
import Block from '../entity/block.js';
import MobData from '../data/mobdata.js';
import MobSpeech from '../data/mobspeech.js';
import AppearanceData from '../data/appearancedata.js';
import Quest from '../quest.js';
import Achievement from '../achievement.js';
import SkillHandler from '../skillhandler.js';
import SkillData from '../data/skilldata.js';
import LangData from '../data/langdata.js';
import GamePad from '../gamepad/gamepad.js';

/* global Types, ItemTypes, Utils */

// FIX (conversion): 'QuestType'/'QuestStatus' used to be bare cross-script globals (gametypes.js's
// top-level consts were visible to sibling classic <script> tags). Now that gametypes.js is a real
// ES module, they're aliased from Types.QuestType/Types.QuestStatus instead.
const QuestType = Types.QuestType;
const QuestStatus = Types.QuestStatus;


// ClientCallbacks' own behavior is split across these mixin modules for readability
// (clientcallbacks.js had grown to ~1400 lines across 40+ server-event handlers). Each
// install* call below merges plain-function methods onto ClientCallbacks.prototype; they're
// not subclasses/separate instances, just ClientCallbacks' own methods living in separate files.
import { installClientCallbacksLifecycle } from './clientcallbackslifecycle.js';
import { installClientCallbacksCombat } from './clientcallbackscombat.js';
import { installClientCallbacksQuest } from './clientcallbacksquest.js';
import { installClientCallbacksInventory } from './clientcallbacksinventory.js';
import { installClientCallbacksSkills } from './clientcallbacksskills.js';
import { installClientCallbacksSocial } from './clientcallbackssocial.js';

export default class ClientCallbacks {
      constructor(client) {
        this.client = client;

        // FIX (maintainability): this constructor used to contain the full body of every
        // message handler inline as an anonymous closure (37 handlers spread across ~1300
        // lines, plus a few shared inner helper functions - spawnEntity, questSpeech,
        // onPlayerChangeHealth, showDamageInfo - only reachable from inside specific handlers).
        // That made individual handlers impossible to find by name, diff in isolation, or unit
        // test. Split each handler out into its own named method below (same name as the
        // registration, e.g. onPlayerTeleportMap); the constructor now just wires each server
        // message to its handler method. The four inner helpers moved to methods too (see
        // spawnEntity(), questSpeech(), applyPlayerHealthChange(), showDamageInfo() below) - all
        // handler bodies are otherwise unchanged from before this refactor.
        client.onPlayerTeleportMap(this.onPlayerTeleportMap.bind(this));
        client.onLogin(this.onLogin.bind(this));
        client.onSpawnItem(this.onSpawnItem.bind(this));
        client.onSpawnCharacter(this.onSpawnCharacter.bind(this));
        client.onDespawnEntity(this.onDespawnEntity.bind(this));
        client.onEntityMove(this.onEntityMove.bind(this));
        client.onEntityMovePath(this.onEntityMovePath.bind(this));
        client.onEntityDestroy(this.onEntityDestroy.bind(this));
        client.onCharacterDamage(this.onCharacterDamage.bind(this));
        client.onPlayerStat(this.onPlayerStat.bind(this));
        client.onPlayerLevelUp(this.onPlayerLevelUp.bind(this));
        client.onPlayerItemLevelUp(this.onPlayerItemLevelUp.bind(this));
        client.onGold(this.onGold.bind(this));
        client.onChatMessage(this.onChatMessage.bind(this));
        client.onDisconnected(this.onDisconnected.bind(this));
        client.onQuest(this.onQuest.bind(this));
        client.onAchievement(this.onAchievement.bind(this));
        client.onItemSlot(this.onItemSlot.bind(this));
        client.onDialogue(this.onDialogue.bind(this));
        client.onNotify(this.onNotify.bind(this));
        client.onStatInfo(this.onStatInfo.bind(this));
        client.onAuction(this.onAuction.bind(this));
        client.onSkillLoad(this.onSkillLoad.bind(this));
        client.onSkillXP(this.onSkillXP.bind(this));
        client.onSkillEffects(this.onSkillEffects.bind(this));
        client.onSpeech(this.onSpeech.bind(this));
        client.onMapStatus(this.onMapStatus.bind(this));
        client.onSetSprite(this.onSetSprite.bind(this));
        client.onSetAnimation(this.onSetAnimation.bind(this));
        client.onProducts(this.onProducts.bind(this));
        client.onAppearance(this.onAppearance.bind(this));
        client.onBlockModify(this.onBlockModify.bind(this));
        client.onCharacterChangePoints(this.onCharacterChangePoints.bind(this));
        client.onParty(this.onParty.bind(this));
        client.onHarvest(this.onHarvest.bind(this));
        client.onPlayerInfo(this.onPlayerInfo.bind(this));
        client.onPlayer(this.onPlayer.bind(this));
      }

}

installClientCallbacksLifecycle(ClientCallbacks.prototype);
installClientCallbacksCombat(ClientCallbacks.prototype);
installClientCallbacksQuest(ClientCallbacks.prototype);
installClientCallbacksInventory(ClientCallbacks.prototype);
installClientCallbacksSkills(ClientCallbacks.prototype);
installClientCallbacksSocial(ClientCallbacks.prototype);
