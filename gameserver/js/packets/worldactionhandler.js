import Messages from '../message.js';
import { Types } from '../common.js';
import Block from '../entity/block.js';
import Node from '../entity/node.js';
import Utils from '../utils.js';
import { G_TILESIZE } from '../constants.js';

// Split out of packethandler.js -- the remaining world-interaction packets
// that don't fit combat/movement/skills/items: chat, quest accept/reject,
// NPC dialogue, placeable blocks, and harvesting nodes. Same
// constructor(packetHandler) convention as the other split-out handlers.
class WorldActionHandler {
    constructor(packetHandler) {
        this.ph = packetHandler;
        this.player = this.ph.player;
        this.world = this.ph.world;
    }

    handleChat(message) {
        // FIX: unlike movement/attacks, chat had no rate limiting at all, so
        // a client could spam CW_CHAT as fast as the socket allowed and have
        // every message broadcast to the entire world. Reject (rather than
        // silently drop) so the client isn't left wondering why nothing sent.
        if (!this.player.chatCooldown.isOver()) {
            this.ph.send([Types.Messages.WC_NOTIFY, "CHAT", "CHATFLOOD"]);
            return;
        }

        let msg = Utils.sanitize(message[0]);
        console.info("Chat: " + this.player.name + ": " + msg);

        if ((new Date()).getTime() > this.player.chatBanEndTime) {
            this.ph.send([Types.Messages.WC_NOTIFY, "CHAT", "CHATMUTED"]);
            return;
        }

        if (msg) {
            msg = msg.substr(0, 256); //Will have to change the max length
            const command = msg.split(" ", 3)
            switch (command[0]) {
            case "/w":
                this.ph.send([Types.Messages.WC_NOTIFY, "CHAT", "CHATMUTED"]);
                break;
            default:
                // FIX: Messages.Chat's constructor is (player, group,
                // message) and serialize() sends [WC_CHAT, playerId, group,
                // message] -- but this call only passed 2 args, so `msg`
                // (the actual chat text) landed in the `group` field and
                // `message` was undefined. Every chat packet sent to clients
                // was malformed. This is a single world-wide channel here,
                // so pass "world" as the group and the real text as message.
                this.world.sendWorld(new Messages.Chat(this.player, "world", msg));
                break;

            }
        }
    }

    handleQuest(msg) {
        console.info("handleQuest");
        const npcId = parseInt(msg[0]);
        const questId = parseInt(msg[1]);
        const status = parseInt(msg[2]);

        const p = this.player;
        const npc = p.map.entities.getEntityById(npcId);
        // FIX: isInScreen(pos) expects an [x,y] array (see the correct call
        // in player.js's getExpBonus: isInScreen([player.x,player.y])), not a
        // raw entity. Passing `npc` meant npc[0]/npc[1] were always
        // undefined, so Math.abs(this.x - undefined) -> NaN -> ~~NaN -> 0,
        // and `0 <= threshold` is always true -- the proximity check was
        // completely defeated, letting players accept/reject quests from
        // anywhere on the map. Also added a null-check: if npcId doesn't
        // resolve to a real entity, `npc` is undefined and npc.x would throw.
        if (!npc || !p.isInScreen([npc.x, npc.y])) {
            console.info("player not close enough to NPC!");
            return;
        }

        if (status === 1)
            npc.entityQuests.acceptQuest(p, questId);
        else {
            npc.entityQuests.rejectQuest(p, questId);
        }
    }

    handleTalkToNPC(message) { // 30
        console.info("handleTalkToNPC");
        const type = parseInt(message[0]);
        const npcId = parseInt(message[1]);

        const p = this.player;
        const npc = p.map.entities.getEntityById(npcId);
        // FIX: same isInScreen(npc) -> isInScreen([npc.x,npc.y]) bug as
        // handleQuest above, plus a null-check on npc before using its
        // coordinates.
        if (!npc || !p.isInScreen([npc.x, npc.y])) {
            console.info("player not close enough to NPC!");
            return;
        }

        npc.talk(p);
    }

    handleBlock(msg) {
        let type = parseInt(msg[0]),
            id = parseInt(msg[1]),
            x = parseInt(msg[2]),
            y = parseInt(msg[3]);

        const p = this.player;

        const block = p.map.entities.getEntityById(id);
        if (!block || !(block instanceof Block))
            return;
        if (!p.isNextTooEntity(block))
            return;

        if (type === 0) // pickup
        {
            p.holdingBlock = block;
        }
        else if (type === 1) //place
        {
            x = Utils.roundTo(x, G_TILESIZE);
            y = Utils.roundTo(y, G_TILESIZE);

            if (p.map.isColliding(x, y))
                return;

            block.setPosition(x, y);
            block.update(this.player);
            p.holdingBlock = null;
        }
        // NOTE: `handleBlock`'s `msg` parameter is the raw [type,id,x,y]
        // packet array, fully consumed by the destructuring at the top of
        // this function. Rather than reuse/overwrite that binding for the
        // outgoing message, it gets its own name (sendMsg) so the incoming
        // packet param and the outgoing message being built are never the
        // same variable.
        const sendMsg = new Messages.BlockModify(block, p.id, type);
        p.map.entities.sendNeighbours(p, sendMsg, p);
    }

    handleHarvest(msg) {
        const x=parseInt(msg[0]), y=parseInt(msg[1]);
        this.player.harvest.onHarvest(x,y);
    }

    handleUseNode(msg) {
        const id=parseInt(msg[0]);
        const p = this.player;
        const entity = p.map.entities.getEntityById(id);
        // FIX: any entity id the client has seen was accepted here, not
        // just Node ids -- onHarvestEntity() (playerharvest.js) happened to
        // self-guard for non-Node entities today (entity.isDead/
        // entity.weaponType are simply undefined on them, routing cleanly
        // into the existing "wrong weapon type" abort), but that's an
        // accident of what onHarvestEntity() currently touches, not a real
        // guarantee -- a future change trusting entity.level/entity.setDrops
        // more directly there would turn this into a live crash the same
        // way the untyped target in skillactionhandler.js's handleSkill()
        // did. Checking the type here is cheap and makes the real invariant
        // explicit.
        if (entity && entity instanceof Node)
            this.player.harvest.onHarvestEntity(entity);
    }
}

export default WorldActionHandler;
