import Messages from '../message.js';

// Split out of itemactionhandler.js -- handleGold and handleStatAdd don't
// actually manipulate an item entity or an inventory slot the way
// handleItemSlot/handleLoot/handleAppearanceUnlock/handleLookUpdate do; gold
// is currency (player.items.gold, but conceptually a resource pool, not an
// item) and stat points are the player's own attributes (player.stats).
// Grouping them here as "packets that spend/allocate a player resource"
// instead of leaving them under "item actions" keeps that file's name
// honest. Same constructor(packetHandler) convention as the other
// split-out handlers.
class PlayerHandler {
    constructor(packetHandler) {
        this.ph = packetHandler;
        this.player = this.ph.player;
        this.world = this.ph.world;
    }

    handleGold(message) {
        const type = parseInt(message[0]),
            gold = parseInt(message[1]),
            type2 = parseInt(message[2]);

        // FIX: gold[]/modifyGold() live on PlayerItems (player.items), not
        // directly on Player -- every line below threw "not a function"
        // (or read undefined), so bank<->inventory gold transfers were
        // completely broken. Also added a bounds check on type/type2: the
        // two `if (type===X && type2===Y)` branches below only ever fire for
        // the two valid combinations, but nothing stopped an out-of-range
        // type from indexing player.items.gold[type] above with a garbage
        // index (gold only has 2 slots: 0 inventory, 1 bank).
        if (type !== 0 && type !== 1)
            return;

        if (gold < 0)
            return;

        if (gold > 9999999) {
            this.ph.sendPlayer(new Messages.Notify("GOLD","MAX_TRANSFER"));
            return;
        }

        if (gold > this.player.items.gold[type])
        {
            this.ph.sendPlayer(new Messages.Notify("GOLD","INSUFFICIENT_GOLD"));
            return;
        }

        // Transfer to bank.
        if (type===0 && type2===1)
        {
            if (this.player.items.modifyGold(-gold, 0))
                this.player.items.modifyGold(gold, 1);
        }

        // Withdraw from bank.
        if (type===1 && type2===0)
        {
            if (this.player.items.modifyGold(-gold, 1))
                this.player.items.modifyGold(gold, 0);
        }
    }

    handleStatAdd(message) {
        const self = this;
        const attribute = parseInt(message[0]),
            points = parseInt(message[1]);
        const p = this.player;

        if (points < 0 || points > p.stats.free)
            return;

        if (attribute <= 0 || attribute > 4)
            return;

        let alterBars = false;
        switch (attribute) {
        case 1:
            p.stats.attack += points;
            break;
        case 2:
            p.stats.defense += points;
            break;
        case 3:
            p.stats.health += points;
            alterBars = true;
            break;
        case 4:
            p.stats.luck += points;
            break;
        }
        p.stats.free -= points;

        if (alterBars) {
            p.setHpMax();
            p.setEpMax();
        }

        this.ph.sendPlayer(new Messages.StatInfo(p));
    }
}

export default PlayerHandler;
