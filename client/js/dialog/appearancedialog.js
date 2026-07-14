// Converted from AMD (define) + Class.extend to a native ES6 module/class.
import Dialog from './dialog.js';
import TabBook from '../tabbook.js';
import TabPage from '../tabpage.js';
import AppearanceData from '../data/appearancedata.js';
import PageNavigator from '../pageNavigator.js';
import PlayerAnim from '../playeranim.js';
/* global Utils */
import Items from '../data/items.js';
import ConfirmDialog from './confirmdialog.js';

class StoreRack {
        constructor(parent, id, index) {
            this.parent = parent;
            this.id = id;
            this.index = index;
            this.body = $(id);
            //this.body.data.index = index;
            this.basketBackground = $(id + 'BasketBackground');
            this.basket = $(id + 'Basket');
            this.extra = $(id + 'Extra');
            this.price = $(id + 'Price');
            this.buyButton = $(id + 'BuyButton');
            this.item = null;

            this.rescale();

            this.buyButton.text('Unlock');
        }

        rescale() {
            const scale = this.parent.scale;
            const id = this.id;
            this.body.css({
             'position': 'absolute',
             'left': '0px',
             'top': '' + (this.index * (18 * scale)) + 'px',
            });
    	      if (this.item) {
    	     	     this.assign(this.item);
    	      }
        }

        getVisible() {
            return this.body.css('display') === 'block';
        }
        setVisible(value) {
            const self = this;

            this.body.css('display', value===true ? 'block' : 'none');
            this.buyButton.text('UNLOCK');

            this.buyButton.off().on('click', function(event) {
                log.info("buyButton");
                const dialog = game.appearanceDialog;
                if(game && game.ready && dialog.visible) {
                    dialog.update(self.parent.itemType, game.sprites[AppearanceData[self.item.index].sprite]);
                    $('#changeLookUnlock').data("item", self.item);
                    dialog.unlockMode(true);
                }
            });
        }

        assign(item) {
            this.item = item;
            item.itemKind = item.index;


            this.scale = this.parent.scale;
            Items.jqShowItem(this.basket, this.item, this.basket);
            this.basket.text('');
            this.extra.text(item.name);
            this.price.text(item.buyPrice);

            const self = this;
        }

        clear() {
            this.basket.css('background-image', 'none')
            this.basket.attr('title', '');
            this.extra.text('');
            this.price.text('');
            this.basket.text('');
        }
}

class AppearancePage extends TabPage {
        constructor(parent, id, itemType, scale, buttonIndex) {
            super(parent, id + 'Page', id + buttonIndex + 'Button'); // FIX (conversion): this._super(...) -> super(...)
            this.itemType = itemType;
            this.racks = [];
            this.items = [];
            this.scale = scale;
            this.rackSize = 5;
            this.pageIndex = 0;

            for(let index = 0; index < this.rackSize; index++) {
                this.racks.push(new StoreRack(this, id + index, index));
            }
        }

        rescale(scale) {
            this.scale = scale;
            for(let index = 0; index < this.rackSize; index++) {
                this.racks[index].rescale();
            }
        }

        getPageCount() {
            if (this.items)
            	    return Math.ceil(this.items.length / this.rackSize);
            return 0;
        }
        getPageIndex() {
            return this.pageIndex;
        }

        setPageIndex(value) {
            this.pageIndex = value;
            this.onData();
        }

        open() {
            this.setPageIndex(0);
        }

        onData() {
            this.items = [];
            let categoryType;
            if (!game || !game.player || !game.player.appearances)
              return;

            if (this.itemType===0)
                categoryType="armor";
            if (this.itemType===1)
                categoryType="weapon";

    		    if (game.player.isArcher())
    		    {
              if (this.itemType===0)
        			    categoryType="armorarcher";
        			if (this.itemType===1)
        			    categoryType="weaponarcher";
        		}

    		    for(let k=0; k < AppearanceData.length; ++k) {
        			const item = AppearanceData[k];
        			if (!item)
        			    continue;

        			if (item.type === categoryType && game.player.appearances[k] === 0 && item.buy > 0)
        			{
      				    this.items.push({
          					index: k,
          					name: item.name,
          					sprite: item.sprite,
          					buyPrice: item.buy});
        			}
    		    }

      	    this.reload();
      	    this.parent.updateNavigator();
            this.parent.parent.showStore(true);
            if (this.parent.getPageIndex() !== 0)
              this.parent.setPageIndex(0);
        }

        reload()
        {
            for(let index = this.pageIndex * this.rackSize; index < Math.min((this.pageIndex + 1) * this.rackSize, this.items.length); index++) {
                const rack = this.racks[index - (this.pageIndex * this.rackSize)];

                rack.assign(this.items[index]);
                rack.setVisible(true);
            }
            for(let index = this.items.length; index < (this.pageIndex + 1) * this.rackSize; index++) {
                const rack = this.racks[index - (this.pageIndex * this.rackSize)];

                rack.setVisible(false);
            }
        }
}

class AppearanceArmorPage extends AppearancePage {
        constructor(parent, scale) {
            super(parent, '#storeDialogStore', 0, scale, 0); // FIX (conversion): this._super(...) -> super(...)
        }
}

/*var AppearanceWeaponPage = AppearancePage.extend({
    init: function(parent, scale) {
        this._super(parent, '#storeDialogStore', 1, scale, 1);
    }
});*/

class StoreFrame extends TabBook {
        constructor(parent) {
            super('#storeDialogStore'); // FIX (conversion): this._super('#storeDialogStore') -> super('#storeDialogStore')

            this.parent = parent;
            this.scale = this.parent.scale;

            this.add(new AppearanceArmorPage(parent, this.scale));
            //this.add(new AppearanceWeaponPage(parent, this.scale));

            this.pageNavigator = new PageNavigator(parent, parent.scale);

            const self = this;

            this.pageNavigator.onChange(function(sender) {
                const activePage = self.getActivePage();
                if(activePage && game.appearanceDialog.visible) {
                     activePage.setPageIndex(sender.getIndex() - 1);
                }
            });
        }

        rescale() {
        	this.scale = this.parent.scale;
          for (let page of this.pages)
            page.rescale(this.scale);

        	this.pageNavigator.rescale(this.scale);
        }

        setPageIndex(value) {
            if (!this.parent.visible)
            	    return;

            super.setPageIndex(value); // FIX (conversion): this._super(value) -> super.setPageIndex(value)
            this.updateNavigator();
            const activePage = this.getActivePage();
            activePage.open();
        }

        updateNavigator() {
            const activePage = this.getActivePage();
            const pageNav = this.pageNavigator;
            //log.info("activePage.getPageCount()="+activePage.getPageCount());
            if(activePage) {
                if(activePage.getPageCount() > 0) {
                    pageNav.setCount(activePage.getPageCount());
                    pageNav.setIndex(activePage.getPageIndex() + 1);
                    pageNav.setVisible(true);
                } else {
                    pageNav.setVisible(false);
                }
                activePage.reload();
            }
        }

        open() {
            game.client.sendAppearanceList();
            this.setPageIndex(0);
            this.getActivePage().active();
        }
}

export default class AppearanceDialog extends Dialog {
        constructor(game) {
            super(game, '#storeDialog'); // FIX (conversion): this._super(game, '#storeDialog') -> super(game, '#storeDialog')

            this.storeFrame = new StoreFrame(this);

            this.closeButton = $('#storeDialogCloseButton');
            this.modal = $('#storeDialogModal');
            this.scale=this.setScale();

            let self = this;

            this.closeButton.click(function(event) {
                const activePage = self.storeFrame.getActivePage();
                if (activePage)
                    activePage.setVisible(false);
                self.hide();
            });

            const p = game.player;
            this.playerAnim = new PlayerAnim();

      			$('#changeLookPrev').bind("click", function(event) {
              self.changeLookArmor(--self.looksArmorIndex);
              $('#changeLookUnlock').hide();
      			});

      			$('#changeLookNext').bind("click", function(event) {
              self.changeLookArmor(++self.looksArmorIndex);
              $('#changeLookUnlock').hide();
      			});

            this.confirmDialog = new ConfirmDialog();
            $('#changeLookUnlock').on('click', function(event) {
                log.info("unlockButton");
                if(game && game.ready) {
                  const item = $(this).data("item");
                  const strPrice = lang.data['SHOP_UNLOCK_CONFIRM'].format(item.buyPrice);
                  self.confirmDialog.confirm(strPrice, function(result) {
                      if(result) {
                          game.client.sendAppearanceUnlock(item.index, item.buyPrice);
                          self.showStore(true);
                      }
                  });
                }
            });

            this.unlockLookMode = false;
        }

        changeLookArmor(index)
        {
          if (this.armorLooks && this.armorLooks.length > 0)
          {
            index = this.looksArmorIndex = (this.armorLooks.length + index) % this.armorLooks.length;
            const spriteId = this.armorLooks[index];
            if (spriteId===0 || game.player.appearances[spriteId] === 1) {

              game.player.setSpriteByIndex(0, Number(spriteId));

              game.client.sendLook(0,spriteId);
            }
            this.playerAnim.sprites[0] = game.sprites[AppearanceData[spriteId].sprite];
            this.updateLook();
            game.app.initPlayerBar();
          }
        }

        setScale() {
          this.scale = game.renderer.getUiScaleFactor();
        }

        rescale() {
        	this.setScale();
		      this.storeFrame.rescale();
        }

        hide() {
            $('#storeDialogInventory').show();
            $('#looksDialogPlayer').hide();
            $('#appearanceDialog').hide();
            super.hide(); // FIX (conversion): this._super() -> super.hide()
        }

        assign(datas) {
            const p = game.player;
            if (datas) {
        		  p.appearances = Utils.Base64ToBinArray(datas.shift(), AppearanceData.length);

              for(let i=0; i < AppearanceData.length; i++)
              {
                AppearanceData[i].buy = parseInt(datas.shift());
              }
            }

            for (let page of this.storeFrame.pages) {
              page.onData();
            }

            let categoryTypeArmor = "armor", categoryTypeWeapon = "weapon";
    		    if (game.player.isArcher()) {
              categoryTypeArmor="armorarcher";
      		    categoryTypeWeapon="weaponarcher";
            }

      	    this.armorLooks = [];
      	    this.weaponLooks = [];

	          for(let i=0; i < AppearanceData.length; i++)
            {
              if (p.appearances[i] === 0)
                continue;

            	if (AppearanceData[i].type === categoryTypeArmor)
            		this.armorLooks.push(i);
            	else if (AppearanceData[i].type === categoryTypeWeapon)
            		this.weaponLooks.push(i);
            }
            const currentArmorSprite = p.getSprite(0);
            const currentWeaponSprite = p.getSprite(1);
            this.looksArmorIndex = this.armorLooks.findIndex(spriteId => game.sprites[AppearanceData[spriteId].sprite] === currentArmorSprite);
            this.looksWeaponIndex = this.weaponLooks.findIndex(spriteId => game.sprites[AppearanceData[spriteId].sprite] === currentWeaponSprite);

            this.scale = game.renderer.getUiScaleFactor();

            this.updateLook();
        }

        update(itemType, sprite) {
          //this.playerAnim.sprites[itemType] = sprite;
          this.updateLook(sprite);
        }

        updateLook(spriteArmor) {
            const self = this;
            const anim = this.playerAnim;
            const p = game.player;

            spriteArmor = spriteArmor || p.getArmorSprite();

            anim.sprites = [];
            anim.addSprite(spriteArmor);
            anim.addSprite(p.getWeaponSprite());

            anim.setHTML(['#characterLookArmor','#characterLookWeapon']);

            const armor = anim.sprites[0];
            const weapon = anim.sprites[1];

            let inc = 0, inc_fn = 0;
            if (this.paInterval)
              clearInterval(this.paInterval);
            //var pa = anim;
            const fn = [anim.walk,
              anim.hit];
            this.paInterval = setInterval(function () {
              if (!anim.isLoaded)
                return;

              const o = (inc % 3)+1;
              fn[(inc_fn % fn.length)].bind(anim)(o);
              if (++inc_fn % fn.length === 0)
                inc++;
            }, 1500);

            anim.showHTML('#characterLook', this.scale, 3);
        }

        unlockMode(flag) {
          this.showStore(flag);
          if (flag) {
            $('#changeLookPrev').hide();
            $('#changeLookNext').hide();
            $('#changeLookUnlock').show();
          } else {
            $('#changeLookPrev').show();
            $('#changeLookNext').show();
            $('#changeLookUnlock').hide();
          }
          this.unlockLookMode = flag;
        }

        showStore(flag) {
          if (flag) {
            $('#appearanceDialog').hide();
            $('#storeDialog').show();
          }
          else {
            $('#appearanceDialog').show();
            $('#storeDialog').hide();
          }
        }

        show() {
            const self = this;

            this.rescale();

            $('#storeDialog .frameheadingtext').text('LOOKS');

            $('#storeDialogStore0Button').text("ARMOR");
            $('#storeDialogStore1Button').hide();
            $('#storeDialogStore2Button').hide();

            const jq3Button = $("#storeDialogStore3Button"); // FIX: was a bare global assignment (no var), which throws ReferenceError under ES module strict mode
            jq3Button.text("LOOKS");
            jq3Button.show();

            jq3Button.off().on('click', function (event) {
                self.unlockMode(false);
                if (!self.unlockLookMode) {
                  self.changeLookArmor(self.looksArmorIndex >= 0 ? self.looksArmorIndex : 0);
                }
            });

            $('#appearanceCloseButton').off().on('click', function (event) {
                self.showStore(true);
            });

            $('#looksDialogPlayer').css("display", "block");

            $('#storeDialogStore div.inventoryGoldFrame').hide();
            $('#storeDialogStore div.inventoryGemsFrame').show();

            super.show(); // FIX (conversion): this._super() -> super.show()

            this.storeFrame.open();
        }
}
