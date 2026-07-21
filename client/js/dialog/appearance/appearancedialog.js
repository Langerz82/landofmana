// Converted from AMD (define) + Class.extend to a native ES6 module/class.
// AppearanceDialog's supporting classes (StoreRack, AppearancePage/AppearanceArmorPage,
// StoreFrame) are split across appearancerack.js/appearancepage.js/appearanceframe.js for
// readability (appearancedialog.js had grown to ~500 lines across 5 classes).
import Dialog from '../dialog.js';
import AppearanceData from '../../data/appearancedata.js';
import PlayerAnim from '../../playeranim.js';
/* global Utils */
import ConfirmDialog from '../confirmdialog.js';
import StoreFrame from './appearanceframe.js';

export default class AppearanceDialog extends Dialog {
        constructor(game) {
            super(game, '#storeDialog'); // FIX (conversion): this._super(game, '#storeDialog') -> super(game, '#storeDialog')

            this.storeFrame = new StoreFrame(this);

            this.closeButton = $('#storeDialogCloseButton');
            this.modal = $('#storeDialogModal');
            this.setScale();

            let self = this;

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
          // FIX: was `this.showStore(flag)`. showStore(true) shows the store rack list and
          // hides the looks/character-preview panel (#appearanceDialog) - the opposite of what
          // unlockMode(true) needs. unlockMode only toggles which buttons sit on the preview
          // panel (Unlock vs prev/next); the panel itself must stay visible either way.
          this.showStore(false);
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

            // FIX: #storeDialogCloseButton is the same shared DOM node StoreDialog binds via
            // Dialog.addClose()/Dialog.show() (both dialogs reuse the '#storeDialog' frame).
            // Dialog.show() does `this.closeButton.off('click').click(...)` every time the shop
            // is opened, which wiped out this handler when it was only bound once in the
            // constructor - after opening the Shop once, the Looks dialog's close (X) button
            // stopped doing anything. Rebind on every show() instead, like #appearanceCloseButton
            // below, so this dialog always reclaims the button when it opens.
            this.closeButton.off('click').on('click', function(event) {
                const activePage = self.storeFrame.getActivePage();
                if (activePage)
                    activePage.setVisible(false);
                self.hide();
            });

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
