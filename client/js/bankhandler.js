// Converted from AMD (define) + Class.extend to a native ES6 module/class.
/* global Types, Class */

export default class BankHandler {
    constructor(game) {
        this.game = game;
        this.maxNumber = 96;
        this.banks = {};
    }

    initBank(itemArray) {
        for (const item of itemArray) {
            if (item) this.banks[item.slot] = item;
        }
    }

    setBank(itemArray) {
        for (const item of itemArray) {
            this.banks[item.slot] = item.itemKind === -1 ? null : item;
        }
    }

    setGold(gold) {
        this.gold = parseInt(gold);
        $('.bankGold').text(this.gold);
    }

    isBankFull() {
        if (Object.keys(this.banks).length < this.maxNumber) return false;
        // FIX: was `this.maxBankNumber`, a property that is never set anywhere (constructor only sets `this.maxNumber`);
        // the loop ran 0 iterations, so isBankFull() always returned true once slot count reached maxNumber, even if
        // some of those slots had since been cleared to null (still open)
        for (let i = 0; i < this.maxNumber; i++) {
            if (!this.banks[i]) return false;
        }
        return true;
    }
}
