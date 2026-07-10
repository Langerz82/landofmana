import Messages from '../message.js';
import AppearanceData from '../data/appearancedata.js';

class Looks {
    constructor() {
        this.prices = [];
        this.reset();
    }

    reset()
    {
        console.info("LOOKS INIT");

        const length = AppearanceData.Data.length;
        for (let i = 0; i < length; i++) {
            this.prices.push(500);
        }
        this.prices[0] = 0; // Sword1
        this.prices[50] = 0; // WoodenBow
        this.prices[77] = 0; // Cloth armor
        this.prices[151] = 0; // Cloth armor
    }

    load(data)
    {
        const self = this;
        //console.info("LOOKS LOAD: "+JSON.stringify(data));

        // FIX: missing return/else -- when `data` was falsy (e.g. first-ever
        // world load with no saved looks data), this called this.reset() and
        // then fell straight through to `data.parseInt()` anyway, throwing
        // on the exact case it was trying to handle.
        if (!data) {
            this.reset();
            return;
        }

        this.prices = data.parseInt();
    }

    // NOTE: `data` was a bare (undeclared) assignment in the original CommonJS
    // source, which created an implicit global there; declared with `var` here
    // since ES modules are always strict mode and forbid implicit globals.
    save(world)
    {
        console.info("LOOKS SAVED");

        if (!this.prices)
            return true;

        const data = this.prices.join(",");
        if (world.userHandler) {
            world.userHandler.sendLooksData(data);
            return true;
        }
        return false;
    }

    modPrice(index, modPrice) {
        this.prices[index] += modPrice;
    }

    pricesToString() {
        return this.prices.join(',');
    }

    sendLooks(player) {
        player.sendPlayer(new Messages.AppearanceList(player.user, this));
    }
}

export default Looks;
