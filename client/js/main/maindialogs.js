// Extracted from main.js: click handlers for the drop-item / auction-sell modal dialogs'
// accept/cancel buttons, and the name-input focus/tooltip wiring.
// Called once from main.js's initGame(); reads/writes the same bare `game`/`app` globals
// every other file in this codebase uses (see globalstate.js), not passed as parameters.

export function installMainDialogs() {
    // FIX: jqDropAccept/jqDropCancel were only ever declared as local consts inside
    // installMainInput() (maininput.js) - that scope never reached this function, so these were
    // undeclared bare identifiers here (ReferenceError: jqDropAccept is not defined). jQuery
    // selector re-declaration across split files is safe (idempotent DOM lookups, see
    // appearancerack.js/appearanceframe.js etc. for the same pattern), so just re-query them here.
    const jqDropAccept = $('#dropAccept');
    const jqDropCancel = $('#dropCancel');
    const jqDropCount = $('#dropCount');
    const jqAuctionSellAccept = $('#auctionSellAccept');
    const jqAuctionSellCancel = $('#auctionSellCancel');
    const jqAuctionSellCount = $('#auctionSellCount');
    const jqNameInput = $('#nameinput');
    const jqNameTooltip = $('#name-tooltip');

    jqDropAccept.click(function (event) {
        let count = parseInt(jqDropCount.val());
        if (count > 0) {
            if (app.dropAction === 'bankgold') // Send to bank.
            {
                const gold = game.player.gold[0];
                if (count > gold) count = gold;
                game.client.sendGold(0, count, 1);
            } else if (app.dropAction === 'inventorygold') // Send to inventory.
            {
                const bgold = game.player.gold[1];
                if (count > bgold) count = bgold;
                game.client.sendGold(1, count, 0);
            } else if (app.dropAction === 'splititems') // Split Items.
            {
                game.inventory.sendSplitItem(game.app.SplitItem, count);
                game.app.SplitItem = null;
            } else if (app.dropAction === 'dropItems') // Drop Items
            {
                game.inventory.sendDropItem(game.app.DropItem, count);
                game.app.DropItem = null;
            }
        }

        setTimeout(function () {
            app.hideDropDialog();
        }, 100);
    });

    jqDropCancel.click(function (event) {
        setTimeout(function () {
            app.hideDropDialog();
        }, 100);
    });

    jqAuctionSellAccept.click(function (event) {
        try {
            const count = parseInt(jqAuctionSellCount.val());
            if (count > 0) {
                game.client.sendAuctionSell(app.inventoryNumber, count);
                // FIX (dead code): removed `game.inventoryDialog.inventory[app.inventoryNumber]
                // = null;` - InventoryDialog.inventory is initialized in its constructor but
                // never read anywhere in the codebase (confirmed via repo-wide search); real
                // inventory state lives in game.inventory.rooms (InventoryHandler). Vestigial
                // from before the inventory/handler split.
            }
        } catch (e) {}

        setTimeout(function () {
            app.hideAuctionSellDialog();
        }, 100);
    });

    jqAuctionSellCancel.click(function (event) {
        setTimeout(function () {
            app.hideAuctionSellDialog();
        }, 100);
    });

    jqNameInput.focusin(function () {
        jqNameTooltip.addClass('visible');
    });

    jqNameInput.focusout(function () {
        jqNameTooltip.removeClass('visible');
    });

    jqNameInput.keypress(function (event) {
        jqNameTooltip.removeClass('visible');
    });
}
