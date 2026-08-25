import Messages from '../message.js';
import { Types } from '../common.js';
import Block from '../entity/block.js';
import Node from '../entity/node.js';
import Utils from '../utils.js';
import { G_TILESIZE, G_DEBUG } from '../constants.js';

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
            this.ph.send([Types.Messages.WC_NOTIFY, 'CHAT', 'CHATFLOOD']);
            return;
        }

        let msg = Utils.sanitize(message[0]);

        if (new Date().getTime() > this.player.chatBanEndTime) {
            this.ph.send([Types.Messages.WC_NOTIFY, 'CHAT', 'CHATMUTED']);
            return;
        }

        if (msg) {
            msg = msg.substr(0, 256); //Will have to change the max length
            // FIX: this log used to run before the mute-check above and
            // before the 256-char truncation below -- so a muted player's
            // rejected message still got logged, and an unbounded-length
            // message was logged in full before being capped. Moved after
            // both so it reflects what actually gets processed.
            console.info('Chat: ' + this.player.name + ': ' + msg);

            // FIX: was `msg.split(' ', 3)` -- split()'s limit argument only
            // caps how many pieces come back, it does not rejoin whatever's
            // left, so "/w Bob hello there" produced ['/w','Bob','hello'],
            // silently truncating the message at the 3rd word. Only the
            // command name was ever read from this (command[0]) -- pull just
            // that to route the switch below; handleWhisper() gets the whole
            // raw `msg` and does its own parsing of the rest so multi-word
            // whispers survive intact.
            const spaceIdx = msg.indexOf(' ');
            const cmdName = spaceIdx === -1 ? msg : msg.substring(0, spaceIdx);
            switch (cmdName) {
                case '/w':
                case '/whisper':
                    this.handleWhisper(msg);
                    break;
                default:
                    // FIX: Messages.Chat's constructor is (player, group,
                    // message) and serialize() sends [WC_CHAT, playerId, group,
                    // message] -- but this call only passed 2 args, so `msg`
                    // (the actual chat text) landed in the `group` field and
                    // `message` was undefined. Every chat packet sent to clients
                    // was malformed. This is a single world-wide channel here,
                    // so pass "world" as the group and the real text as message.
                    this.world.sendWorld(
                        new Messages.Chat(this.player, 'world', msg)
                    );
                    break;
            }
        }
    }

    // "/w <name> <message>" -- private message to a single online player.
    // Previously this branch just sent back a CHATMUTED notify no matter
    // what, i.e. /w was wired up to look like a command but never actually
    // did anything. `msg` is the whole raw chat string as handleChat()
    // received it (e.g. "/w Bob hello there") -- all parsing (stripping the
    // "/w", pulling the target name, and whatever's left as the message
    // body) happens here rather than in handleChat(). Resolves the target
    // the same way partyhandler.js's getPlayer() does (World.getPlayerByName(),
    // which lowercases internally), then sends the chat message only to the
    // two participants via sendToPlayer/sendPlayer -- NOT world.sendWorld(),
    // so nobody else on the map receives the packet. The sender gets their
    // own copy echoed back the same way a world-chat broadcast already
    // includes the sender (sendBroadcast() with no ignoredPlayer).
    handleWhisper(msg) {
        // Strip the "/w" command word itself.
        const cmdEnd = msg.indexOf(' ');
        const rest = cmdEnd === -1 ? '' : msg.substring(cmdEnd + 1).trim();

        // Split what's left into the target name (first word) and the
        // message body (everything after it).
        const spaceIdx = rest.indexOf(' ');
        const targetName = spaceIdx === -1 ? rest : rest.substring(0, spaceIdx);
        const body = spaceIdx === -1 ? '' : rest.substring(spaceIdx + 1).trim();

        if (!targetName || !body) {
            this.ph.send([Types.Messages.WC_NOTIFY, 'CHAT', 'WHISPER_USAGE']);
            return;
        }

        const target = this.world.getPlayerByName(targetName);
        if (!target) {
            this.ph.send([
                Types.Messages.WC_NOTIFY,
                'CHAT',
                'NO_PLAYER_EXIST',
                targetName
            ]);
            return;
        }

        // Also guards against sending the echoed copy twice below (target
        // === this.player would hit both sendToPlayer and sendPlayer).
        if (target === this.player) {
            this.ph.send([Types.Messages.WC_NOTIFY, 'CHAT', 'WHISPER_SELF']);
            return;
        }

        // NOTE: the client's chat display (client/js/clientcallback/
        // clientcallbackssocial.js's onChatMessage) doesn't currently look at
        // the `group` field at all -- it just renders "<sender>: <text>" the
        // same for every group. Tagging the body text itself is what makes a
        // whisper actually read as private instead of looking identical to
        // world chat; the two copies get different tags since one reads from
        // the sender's side and one from the target's.
        this.player.sendToPlayer(
            target,
            new Messages.Chat(this.player, 'whisper', '(whisper) ' + body)
        );
        this.player.sendPlayer(
            new Messages.Chat(
                this.player,
                'whisper',
                '(whisper to ' + target.name + ') ' + body
            )
        );
    }

    handleQuest(msg) {
        // PERF: handleQuest/handleTalkToNPC/handleHarvest below are all
        // client-triggerable at whatever rate the connection allows (a
        // client can send CW_QUEST/CW_TALK/CW_HARVEST repeatedly without
        // moving) -- these console.info calls used to fire unconditionally,
        // the same log-spam vector already gated behind G_DEBUG in
        // combathandler.js's reject path. Gated the same way.
        if (G_DEBUG) console.info('handleQuest');
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
            if (G_DEBUG) console.info('player not close enough to NPC!');
            return;
        }

        if (status === 1) npc.entityQuests.acceptQuest(p, questId);
        else {
            npc.entityQuests.rejectQuest(p, questId);
        }
    }

    handleTalkToNPC(message) {
        // 30
        if (G_DEBUG) console.info('handleTalkToNPC');
        const type = parseInt(message[0]);
        const npcId = parseInt(message[1]);

        const p = this.player;
        const npc = p.map.entities.getEntityById(npcId);
        // FIX: same isInScreen(npc) -> isInScreen([npc.x,npc.y]) bug as
        // handleQuest above, plus a null-check on npc before using its
        // coordinates.
        if (!npc || !p.isNextTooEntity(npc)) {
            if (G_DEBUG) console.info('player not close enough to NPC!');
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
        if (!block || !(block instanceof Block)) return;
        if (!p.isNextTooEntity(block)) return;

        if (type === 0) // pickup
        {
            p.holdingBlock = block;
        } else if (type === 1) //place
        {
            // FIX: this branch repositioned `block` as soon as the player
            // was merely standing next to it (the isNextTooEntity() check
            // above), with no check that the player was the one who
            // actually picked it up first. Only the pickup branch (type===0)
            // set `p.holdingBlock`; place never verified `p.holdingBlock
            // === block` before acting. Any player standing next to any
            // Block -- unclaimed, or currently held by a different player
            // -- could reposition it without ever sending a pickup packet,
            // breaking block-puzzle content and letting a player yank a
            // block another player is mid-solving out from under them
            // (whose own `p.holdingBlock` reference is left stale, pointing
            // at a block someone else just moved).
            if (p.holdingBlock !== block) return;

            x = Utils.roundTo(x, G_TILESIZE);
            y = Utils.roundTo(y, G_TILESIZE);

            if (p.map.isColliding(x, y)) return;

            block.setPosition(x, y);
            block.update(this.player);
            p.holdingBlock = null;
        } else {
            // FIX: previously the BlockModify broadcast below ran
            // unconditionally, even when `type` matched neither the
            // pickup (0) nor place (1) branch above -- so a client sending
            // any other `type` value caused a phantom "block modified"
            // notification to be broadcast to nearby players with no
            // actual state change. Bail out here instead.
            return;
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

    // FIX: handleHarvest/handleUseNode used to validate and act immediately, every time -
    // including while the player was still mid-click-to-move toward the tile/node they were
    // aiming for. The client only ever sends CW_HARVEST/CW_USE_NODE once, right when its own
    // *local* path simulation believes it has arrived (see game.js's onStopPathing ->
    // makePlayerInteractNextTo chain, client-side) - but the server runs its own
    // independently-timed path simulation for the same movement (movePath()/nextStep(),
    // driven by updater.js's per-tick updatePlayerPathMovement(), not applied instantly), and
    // that simulation typically hasn't reached the final tile yet by the time the packet
    // arrives, since it can only start once the earlier CW_MOVEPATH packet has made its own
    // network trip. So p.isNextTooTile()/_checkHarvest()'s isNextTooPosition() checked the
    // player's *not-yet-arrived* server position and rejected a perfectly valid interaction
    // with HARVEST_INVALID ("You cannot use this at this time"), even though the player was
    // genuinely standing next to the tile/node a moment later.
    //
    // Mirrors the identical fix already in place for attacks (combathandler.js's
    // attackQueue/processAttack()): while the player is still moving, queue the raw packet
    // instead of validating it against a position that's about to change anyway; playercallback.js's
    // stopPathing() (fired once the player's *server-side* path simulation actually
    // completes/stops - clean arrival or interrupted redirect alike) calls processHarvest()
    // right alongside the existing attack queue drain, which re-runs the exact same
    // validation these handlers always ran, just against the player's by-then-settled
    // position. A genuinely invalid attempt (too far, node gone, wrong tool) still gets
    // rejected correctly at that point - this only removes the race, not the check.
    handleHarvest(msg) {
        const p = this.player;

        // FIX: queue-and-replay instead of validating against a position that's about to
        // change. By the time processHarvest() below re-invokes this same method with the
        // same `msg`, _stopPath() (entitymovingpath.js) has already cleared `p.path` and
        // stopped `p.movement` *before* firing the stop_pathing_callback that leads here (see
        // its body), so isMoving()/isMovingPath() are guaranteed false on that second call -
        // it falls straight through to the real check/action below, just against the
        // player's by-then-settled position. No separate "process" method needed: this
        // handler already *is* that method, just called a second time.
        if (p.isMoving() || p.isMovingPath()) {
            p.harvestQueue = { kind: 'tile', msg };
            return;
        }

        const x = parseInt(msg[0], 10),
            y = parseInt(msg[1], 10);

        if (!p.isNextTooTile(x, y)) {
            if (G_DEBUG) console.info('player is not nextTooTile.');
            return;
        }

        p.harvest.onHarvest(x, y);
    }

    handleUseNode(msg) {
        const p = this.player;

        // FIX: see handleHarvest()'s FIX comment just above - same queue-and-replay pattern.
        if (p.isMoving() || p.isMovingPath()) {
            p.harvestQueue = { kind: 'entity', msg };
            return;
        }

        const id = parseInt(msg[0]);
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
            p.harvest.onHarvestEntity(entity);
    }

    // Companion to processAttack() (combathandler.js) - drains whichever harvest packet
    // (tile or node) got queued by handleHarvest()/handleUseNode() while the player was
    // still moving, by just calling that same handler again with the msg it was given the
    // first time. See the FIX comment on handleHarvest() above for why that second call is
    // guaranteed to fall through to the real check/action instead of re-queuing itself.
    processHarvest() {
        const p = this.player;

        if (!p.harvestQueue) return;

        const { kind, msg } = p.harvestQueue;
        p.harvestQueue = null;

        if (kind === 'tile') this.handleHarvest(msg);
        else this.handleUseNode(msg);
    }
}

export default WorldActionHandler;
