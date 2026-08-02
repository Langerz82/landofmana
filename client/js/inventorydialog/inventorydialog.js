// Converted from AMD (define) + Class.extend to a native ES6 module/class.
// NOTE: `DragItem` is a cross-file shared "global" (also read/written by main.js,
// shortcuthandler.js, inventoryhandler.js, gamepad.js). It relies on js/globalstate.js
// having already run to seed `window.DragItem` under strict-mode ES modules - see the
// comment in globalstate.js for the full explanation.
/* global Types, ItemTypes, Utils, Class */
import Button2 from '../button2.js';
import Item from '../entity/item.js';
import ItemLoot from '../data/itemlootdata.js';

// FIX (conversion): 'InventoryMode' used to be a bare cross-script global; see game.js for the
// full explanation. Aliased from Types.InventoryMode now that gametypes.js is a real ES module.
const InventoryMode = Types.InventoryMode;

// InventoryDialog's own behavior is split across these mixin modules for readability
// (inventorydialog.js had grown to ~677 lines). Each install* call below merges plain-
// function methods onto InventoryDialog.prototype; they're not subclasses/separate
// instances, just InventoryDialog's own methods living in separate files.
import { installInventoryDialogSelection } from './inventorydialogselection.js';
import { installInventoryDialogEvents } from './inventorydialogevents.js';
import { installInventoryDialogDisplay } from './inventorydialogdisplay.js';
import { installInventoryDialogCooldown } from './inventorydialogcooldown.js';

export default class InventoryDialog {
    constructor() {
        this.maxInventoryNumber = 50;
        this.inventory = [];

        this.scale = game.renderer.getUiScaleFactor();
        this.xscale = game.renderer.getIconScaleFactor();

        this.inventorybutton = new Button2('#inventorybutton', {
            background: {
                left: 196 * this.scale,
                top: 314 * this.scale,
                width: 17 * this.scale
            },
            kinds: [0, 2],
            visible: false
        });

        this.coolTimeCallback = null;
        this.cooldowns = [];
        this.cooldownTime = 0;

        this.isShowAllInventory = false;

        this.selectedItem = -1;

        const self = this;

        this.jqActionButton = $('#invActionButton');

        this.jqCloseButton = $('#inventoryCloseButton');
        this.jqCloseButton.click(function (event) {
            game.inventoryMode = InventoryMode.MODE_NORMAL;
            self.deselectItem();
            self.hideInventory();
            self.refreshInventory();
            if (self.backPage) {
                self.backPage.show();
                self.backPage = null;
            }
        });

        const jqInventoryGearItems = $('#inventoryGearItems');
        jqInventoryGearItems.click(function (event) {
            self.pageIndex = 0;
            self.deselectItem();
            self.refreshInventoryAll();
        });

        this.jqAllInventoryWindow = $('#allinventorywindow');
        this.jqGemsFrame = $('#allinventorywindow .inventoryGemsFrame');
        this.jqInventoryGold = $('.inventoryGold');
        this.jqInventoryGems = $('.inventoryGems');
        this.jqInventorySellGoldFrame = $('.inventorySellGoldFrame');
        this.jqInventorySellGold = $('.inventorySellGold');
        this.jqAuctionSellCount = $('#auctionSellCount');

        // Equipment slot elements (#equipment{i} / #equipBackground{i}) belong to
        // EquipmentHandler, which isn't constructed yet at this point (see game.js -
        // `equipmentHandler` is created after `inventoryDialog`), so `game.equipment`
        // isn't available here. These are cached on first use instead, in
        // loadInventoryEvents() (inventorydialogevents.js), which itself only runs
        // once $(document).ready fires from main.js.
        this.jqEquipmentSlots = null;
        this.jqEquipmentBackgrounds = null;

        this.jqInventoryItemBackgrounds = [];
        this.jqInventoryItems = [];
        this.jqInventoryHighlights = [];
        this.jqSlots = [];

        const itemsPerRow = 5;
        const jqInventoryOffset = $('#inventoryoffset');
        for (let i = 0; i < this.maxInventoryNumber; ++i) {
            const data =
                '<div class="inventoryitembackground" id="inventoryitembackground{0}"><div class="inventoryitem" id="inventoryitem{0}" draggable="true"></div><div class="inventoryhighlight" id="inventoryHL{0}"></div></div>'.format(
                    i
                );
            jqInventoryOffset.append(data);
            const jqInventoryBackground = $('#inventoryitembackground' + i);
            const top = 60 * ~~(i / itemsPerRow);
            const left = 60 * (i % itemsPerRow);
            jqInventoryBackground.css({
                top: top + 'px',
                left: left + 'px'
            });
            this.jqInventoryItemBackgrounds[i] = jqInventoryBackground;
            this.jqInventoryItems[i] = $('#inventoryitem' + i);
            this.jqInventoryHighlights[i] = $('#inventoryHL' + i);
            // TODO: '#slot{i}' isn't created anywhere in this codebase (only
            // referenced from makeEmptyInventory in inventorydialogdisplay.js);
            // may be an orphaned leftover from an older UI. Cached here regardless
            // since caching an (empty) selection is behavior-equivalent to
            // re-querying it each time.
            this.jqSlots[i] = $('#slot' + i);
        }
    }

    showInventoryButton() {
        const scale = this.scale;
        this.inventorybutton.setBackground({
            left: 196 * scale,
            top: 314 * scale,
            width: 17 * scale
        });
    }

    setCurrency(gold, gems) {
        this.jqInventoryGold.text(Utils.getNumShortHand(gold, 2));
        this.jqInventoryGems.text(gems);
    }

    toggleInventory(open) {
        this.isShowAllInventory = open || !this.isShowAllInventory;
        if (!this.jqAllInventoryWindow.is(':visible')) {
            this.showInventory();
            game.gamepad.dialogOpen(this.jqAllInventoryWindow);
        } else {
            this.hideInventory();
        }
    }

    showInventory() {
        this.pageIndex = 0;
        this.jqInventorySellGoldFrame.hide();
        this.jqGemsFrame.hide();
        if (game.inventoryMode === InventoryMode.MODE_AUCTION) {
            this.jqActionButton.text('LIST');
            this.jqActionButton.show();
        } else if (game.inventoryMode === InventoryMode.MODE_SELL) {
            this.jqActionButton.text('SELL');
            //this.jqActionButton.show();
        } else if (game.inventoryMode === InventoryMode.MODE_ENCHANT) {
            this.jqActionButton.text('ENCHANT');
            //this.jqActionButton.show();
        } else if (game.inventoryMode === InventoryMode.MODE_REPAIR) {
            this.jqActionButton.text('REPAIR');
            //this.jqActionButton.show();
        } else if (game.inventoryMode === InventoryMode.MODE_BANK) {
            this.jqActionButton.text('BANK');
            //this.jqActionButton.show();
        } else if (game.inventoryMode === InventoryMode.MODE_NORMAL) {
            this.jqActionButton.text('DROP');
            //this.jqActionButton.show();
            this.jqGemsFrame.show();
        } else {
            this.jqActionButton.hide();
        }
        this.refreshInventoryAll();
        this.jqAllInventoryWindow.css('display', 'block');
    }

    hideInventory() {
        this.jqAllInventoryWindow.css('display', 'none');
        game.inventoryMode = 0;
    }

    getItems(type, cond) {
        const items = [];
        for (let i = 0; i < this.maxInventoryNumber; ++i) {
            const item = this.getItem(type, i);
            if (item && (!cond || (cond && cond(item)))) items.push(item);
        }
        return items;
    }

    getItem(type, slot) {
        if (slot < 0) return null;
        if (type === 0) {
            return game.inventory.rooms[slot];
        } else if (type === 2) return game.equipment.rooms[slot];
        return null;
    }
}

installInventoryDialogSelection(InventoryDialog.prototype);
installInventoryDialogEvents(InventoryDialog.prototype);
installInventoryDialogDisplay(InventoryDialog.prototype);
installInventoryDialogCooldown(InventoryDialog.prototype);
