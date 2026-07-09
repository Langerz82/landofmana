// Converted from AMD (define) + Class.extend to a native ES6 module/class.
/* global Types, Class */

export default class BankHandler {
    constructor(game) {
        const self = this;

        this.game = game;
        this.maxNumber = 96;
        this.banks = {};
    }

    initBank(itemArray) {
      for(let i = 0; i < itemArray.length; ++i)
      {
        const item = itemArray[i];
        if (item)
          this.banks[item.slot] = item;
      }
    }

    setBank(itemArray) {
      for(let i = 0; i < itemArray.length; ++i)
      {
        const item = itemArray[i];
        if (item.itemKind === -1)
          this.banks[item.slot] = null;
        else
          this.banks[item.slot] = item;
      }
    }

    setGold(gold) {
        this.gold = parseInt(gold);
        $('.bankGold').text(this.gold);
    }

    isBankFull() {
      if (Object.keys(this.banks).length < this.maxNumber)
        return false;
    	for (let i=0; i < this.maxBankNumber; i++)
    	{
    		if (!this.banks[i])
    			return false;
    	}
    	return true;
    }
}
