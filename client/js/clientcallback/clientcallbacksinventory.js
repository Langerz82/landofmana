// Mixin extracted from clientcallbacks.js: Gold, item slots, auctions, store products/appearance shop, harvest results.
// Applied onto ClientCallbacks.prototype via install*(...) call in clientcallbacks.js; not a standalone class.
import { ItemRoom } from '../entity/item.js';
/* global game */

export function installClientCallbacksInventory(proto) {

      proto.onGold = function(data) {
          const gold = Number(data[0]);
          const bankgold = Number(data[1]);
          const gems = Number(data[2]);

          game.player.gold[0] = gold;
          game.player.gold[1] = bankgold;
          game.player.gems = gems;

          game.inventoryDialog.setCurrency(gold, gems);
          game.bankHandler.setGold(bankgold);
      };


      proto.onItemSlot = function(data){
          const type = Number(data.shift());
          const count = Number(data.shift());
          const items = [];
          let t = 0;
          for (let i=0; i < count; ++i)
          {
            const slot = Number(data[t]);
            const kind = Number(data[t+1]);
            if (kind === -1) {
              items.push({slot:slot,itemKind:-1});
              t += 2;
              continue;
            }
            const itemRoom = new ItemRoom(
              Number(slot),
              Number(kind),
              Number(data[t+2]),
              Number(data[t+3]),
              Number(data[t+4]),
              Number(data[t+5]),
            );
            t += 6;
            items.push(itemRoom);
          }
          if (type === 0) {
            game.inventory.setInventory(items);
            game.shortcuts.refresh();
          }
          else if (type === 1) {
            game.bankHandler.setBank(items);
            if (game.bankDialog.visible)
              game.bankDialog.bankFrame.open(game.bankDialog.bankFrame.page);
          }
          if (type === 2) {
            game.equipmentHandler.setEquipment(items);
          }
      };


      proto.onAuction = function(data){
            const type = Number(data.shift());
            const itemCount = Number(data.shift());

            const itemData = [];
            for (let i = 0; i < itemCount; ++i)
            {
                const j = (i*9);
                itemData.push({
                    index: Number(data[j]),
                    player: data[j+1],
                    buy: Number(data[j+2]),
                    item: new ItemRoom (
                      Number(data[j+3]),
                      Number(data[j+4]),
                      Number(data[j+5]),
                      Number(data[j+6]),
                      Number(data[j+7]),
                      Number(data[j+8]))
                });
            }

            // FIX: missing var - was an implicit global
            const curPage = game.auctionDialog.storeFrame.getActivePage();
            const page = game.auctionDialog.storeFrame.pages[type];
            if (curPage !== page) {
              game.auctionDialog.storeFrame.setPageIndex(type);
            }
            page.setPageIndex(0);
            page.setItems(itemData);
            page.reload();
      };


      proto.onProducts = function(data) {
          game.products = data;
      };


      proto.onAppearance = function(data) {
          game.appearanceDialog.assign(data);
      };


      proto.onHarvest = function(data) {
          const id = Number(data.shift());
          const p = game.getEntityById(id);
          if (!p)
            return;

          const action = Number(data.shift());

          const x=Number(data.shift()),
              y=Number(data.shift());

          if (action === 1)
          {
            if (p.fsm !== "HARVEST") {
              p.lookAtTile(x, y);
              p.harvestOn();
            }
            if (p === game.player)
              p.harvestDuration = Number(data.shift());

          }
          if (action === 2) {
            p.forceStop();
          }

      };

}
