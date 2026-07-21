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

        this.closeButton = $('#inventoryCloseButton');
        this.closeButton.click(function (event) {
            game.inventoryMode = InventoryMode.MODE_NORMAL;
            self.deselectItem();
            self.hideInventory();
            self.refreshInventory();
            if (self.backPage) {
                self.backPage.show();
                self.backPage = null;
            }
        });

        $('#inventoryGearItems').click(function (event) {
            self.pageIndex = 0;
            self.deselectItem();
            self.refreshInventoryAll();
        });

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
        $('.inventoryGold').text(Utils.getNumShortHand(gold, 2));
        $('.inventoryGems').text(gems);
    }

    toggleInventory(open) {
        this.isShowAllInventory = open || !this.isShowAllInventory;
        if (!$('#allinventorywindow').is(':visible')) {
            this.showInventory();
            game.gamepad.dialogOpen($('#allinventorywindow'));
        } else {
            this.hideInventory();
        }
    }

    showInventory() {
        this.pageIndex = 0;
        $('.inventorySellGoldFrame').hide();
        const jqGemsFrame = $('#allinventorywindow .inventoryGemsFrame');
        const jqActionButton = $('#invActionButton');
        jqGemsFrame.hide();
        if (game.inventoryMode === InventoryMode.MODE_AUCTION) {
            jqActionButton.text('LIST');
            jqActionButton.show();
        } else if (game.inventoryMode === InventoryMode.MODE_SELL) {
            jqActionButton.text('SELL');
            //jqActionButton.show();
        } else if (game.inventoryMode === InventoryMode.MODE_ENCHANT) {
            jqActionButton.text('ENCHANT');
            //jqActionButton.show();
        } else if (game.inventoryMode === InventoryMode.MODE_REPAIR) {
            jqActionButton.text('REPAIR');
            //jqActionButton.show();
        } else if (game.inventoryMode === InventoryMode.MODE_BANK) {
            jqActionButton.text('BANK');
            //jqActionButton.show();
        } else if (game.inventoryMode === InventoryMode.MODE_NORMAL) {
            jqActionButton.text('DROP');
            //jqActionButton.show();
            jqGemsFrame.show();
        } else {
            jqActionButton.hide();
        }
        this.refreshInventoryAll();
        $('#allinventorywindow').css('display', 'block');
    }

    hideInventory() {
        $('#allinventorywindow').css('display', 'none');
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
