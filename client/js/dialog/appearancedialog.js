define(['./dialog', '../tabbook', '../tabpage', 'data/appearancedata', '../pageNavigator', '../playeranim', 'data/items', 'dialog/confirmdialog'],
  function(Dialog, TabBook, TabPage, AppearanceData, PageNavigator, PlayerAnim, Items, ConfirmDialog) {
    var StoreRack = Class.extend({
        init: function(parent, id, index) {
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
        },

        rescale: function() {
            var scale = this.parent.scale;
            var id = this.id;
            this.body.css({
             'position': 'absolute',
             'left': '0px',
             'top': '' + (this.index * (18 * scale)) + 'px',
            });
    	      if (this.item) {
    	     	     this.assign(this.item);
    	      }
        },

        getVisible: function() {
            return this.body.css('display') === 'block';
        },
        setVisible: function(value) {
            var self = this;

            this.body.css('display', value===true ? 'block' : 'none');
            this.buyButton.text('UNLOCK');

            this.buyButton.off().on('click', function(event) {
                log.info("buyButton");
                var dialog = game.appearanceDialog;
                if(game && game.ready && dialog.visible) {
                    dialog.update(self.parent.itemType, game.sprites[AppearanceData[self.item.index].sprite]);
                    $('#changeLookUnlock').data("item", self.item);
                    dialog.unlockMode(true);
                }
            });
        },

        assign: function(item) {
            this.item = item;
            item.itemKind = item.index;


            this.scale = this.parent.scale;
            Items.jqShowItem(this.basket, this.item, this.basket);
            this.basket.text('');
            this.extra.text(item.name);
            this.price.text(item.buyPrice);

            var self = this;
        },

        clear: function() {
            this.basket.css('background-image', 'none')
            this.basket.attr('title', '');
            this.extra.text('');
            this.price.text('');
            this.basket.text('');
        }
    });

    var AppearancePage = TabPage.extend({
        init: function(parent, id, itemType, scale, buttonIndex) {
            this._super(parent, id + 'Page', id + buttonIndex + 'Button');
            this.itemType = itemType;
            this.racks = [];
            this.items = [];
            this.scale = scale;
            this.rackSize = 5;
            this.pageIndex = 0;

            for(var index = 0; index < this.rackSize; index++) {
                this.racks.push(new StoreRack(this, id + index, index));
            }
        },

        rescale: function (scale) {
            this.scale = scale;
            for(var index = 0; index < this.rackSize; index++) {
                this.racks[index].rescale();
            }
        },

        getPageCount: function() {
            if (this.items)
            	    return Math.ceil(this.items.length / this.rackSize);
            return 0;
        },
        getPageIndex: function() {
            return this.pageIndex;
        },

        setPageIndex: function(value) {
            this.pageIndex = value;
            this.onData();
        },

        open: function() {
            this.setPageIndex(0);
        },

        onData: function() {
            this.items = [];
            var categoryType;
            if (!game || !game.player || !game.player.appearances)
              return;

            if (this.itemType==0)
                categoryType="armor";
            if (this.itemType==1)
                categoryType="weapon";

    		    if (game.player.isArcher())
    		    {
              if (this.itemType==0)
        			    categoryType="armorarcher";
        			if (this.itemType==1)
        			    categoryType="weaponarcher";
        		}

    		    for(var k=0; k < AppearanceData.length; ++k) {
        			var item = AppearanceData[k];
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
        },

        reload: function()
        {
            for(var index = this.pageIndex * this.rackSize; index < Math.min((this.pageIndex + 1) * this.rackSize, this.items.length); index++) {
                var rack = this.racks[index - (this.pageIndex * this.rackSize)];

                rack.assign(this.items[index]);
                rack.setVisible(true);
            }
            for(var index = this.items.length; index < (this.pageIndex + 1) * this.rackSize; index++) {
                var rack = this.racks[index - (this.pageIndex * this.rackSize)];

                rack.setVisible(false);
            }
        },

    });

    var AppearanceArmorPage = AppearancePage.extend({
        init: function(parent, scale) {
            this._super(parent, '#storeDialogStore', 0, scale, 0);
        }
    });

    /*var AppearanceWeaponPage = AppearancePage.extend({
        init: function(parent, scale) {
            this._super(parent, '#storeDialogStore', 1, scale, 1);
        }
    });*/

    var StoreFrame = TabBook.extend({
        init: function(parent) {
            this._super('#storeDialogStore');

            this.parent = parent;
            this.scale = this.parent.scale;

            this.add(new AppearanceArmorPage(parent, this.scale));
            //this.add(new AppearanceWeaponPage(parent, this.scale));

            this.pageNavigator = new PageNavigator(parent, parent.scale);

            var self = this;

            this.pageNavigator.onChange(function(sender) {
                var activePage = self.getActivePage();
                if(activePage && game.appearanceDialog.visible) {
                     activePage.setPageIndex(sender.getIndex() - 1);
                }
            });
        },

        rescale: function() {
        	this.scale = this.parent.scale;
          for (var page of this.pages)
            page.rescale(this.scale);

        	this.pageNavigator.rescale(this.scale);
        },

        setPageIndex: function(value) {
            if (!this.parent.visible)
            	    return;

            this._super(value);
            this.updateNavigator();
            var activePage = this.getActivePage();
            activePage.open();
        },

        updateNavigator: function () {
            var activePage = this.getActivePage();
            var pageNav = this.pageNavigator;
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
        },

        open: function() {
            game.client.sendAppearanceList();
            this.setPageIndex(0);
            this.getActivePage().active();
        },


    });

    var AppearanceDialog = Dialog.extend({
        init: function(game) {
            this._super(game, '#storeDialog');

            this.storeFrame = new StoreFrame(this);

            this.closeButton = $('#storeDialogCloseButton');
            this.modal = $('#storeDialogModal');
            this.scale=this.setScale();

            var self = this;

            this.closeButton.click(function(event) {
                var activePage = self.storeFrame.getActivePage();
                if (activePage)
                    activePage.setVisible(false);
                self.hide();
            });

            var p = game.player;
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
                  var item = $(this).data("item");
                  var strPrice = lang.data['SHOP_UNLOCK_CONFIRM'].format(item.buyPrice);
                  self.confirmDialog.confirm(strPrice, function(result) {
                      if(result) {
                          game.client.sendAppearanceUnlock(item.index, item.buyPrice);
                          self.showStore(true);
                      }
                  });
                }
            });

            this.unlockLookMode = false;
        },

        changeLookArmor: function (index)
        {
          if (this.armorLooks && this.armorLooks.length > 0)
          {
            index = this.looksArmorIndex = (this.armorLooks.length + index) % this.armorLooks.length;
            var spriteId = this.armorLooks[index];
            if (spriteId==0 || game.player.appearances[spriteId] === 1) {
              //var index = p.isArcher() ? 2 : 0;
              game.player.sprites[0] = spriteId;
              game.player.setArmorSprite();
              game.client.sendLook(0,spriteId);
            }
            this.playerAnim.sprites[0] = game.sprites[AppearanceData[spriteId].sprite];
            this.updateLook();
            game.app.initPlayerBar();
          }
        },

        setScale: function() {
          this.scale = game.renderer.getUiScaleFactor();
        },

        rescale: function() {
        	this.setScale();
		      this.storeFrame.rescale();
        },

        hide: function() {
            $('#storeDialogInventory').show();
            $('#looksDialogPlayer').hide();
            $('#appearanceDialog').hide();
            this._super();
        },

        assign: function(datas) {
            if (datas) {
        		  game.player.appearances = Utils.Base64ToBinArray(datas.shift(), AppearanceData.length);

              for(var i=0; i < AppearanceData.length; i++)
              {
                AppearanceData[i].buy = parseInt(datas.shift());
              }
            }

            for (var page of this.storeFrame.pages) {
              page.onData();
            }

            var categoryTypeArmor = "armor", categoryTypeWeapon = "weapon";
    		    if (game.player.isArcher()) {
              categoryTypeArmor="armorarcher";
      		    categoryTypeWeapon="weaponarcher";
            }

      	    this.armorLooks = [];
      	    this.weaponLooks = [];
            this.looksArmorIndex = 0;
            this.looksWeaponIndex = 0;

	          for(var i=0; i < AppearanceData.length; i++)
            {
              if (game.player.appearances[i] === 0)
                continue;

            	if (AppearanceData[i].type === categoryTypeArmor)
            		this.armorLooks.push(i);
            	else if (AppearanceData[i].type === categoryTypeWeapon)
            		this.weaponLooks.push(i);
            }
            this.looksArmorIndex = this.armorLooks.indexOf(game.player.sprite[0]);
            this.looksWeaponIndex = this.weaponLooks.indexOf(game.player.sprite[0]);

            this.scale = game.renderer.getUiScaleFactor();

            this.updateLook();
        },

        update: function (itemType, sprite) {
          //this.playerAnim.sprites[itemType] = sprite;
          this.updateLook(sprite);
        },

        updateLook: function(spriteArmor) {
            var self = this;
            var anim = this.playerAnim;
            var player = game.player;

            spriteArmor = spriteArmor || player.getArmorSprite();

            anim.sprites = [];
            anim.addSprite(spriteArmor);
            anim.addSprite(player.getWeaponSprite());

            anim.setHTML(['#characterLookArmor','#characterLookWeapon']);

            var armor = anim.sprites[0];
            var weapon = anim.sprites[1];

            var inc = 0, inc_fn = 0;
            if (this.paInterval)
              clearInterval(this.paInterval);
            //var pa = anim;
            var fn = [anim.walk,
              anim.hit];
            this.paInterval = setInterval(function () {
              if (!anim.isLoaded)
                return;

              var o = (inc % 3)+1;
              fn[(inc_fn % fn.length)].bind(anim)(o);
              if (++inc_fn % fn.length === 0)
                inc++;
            }, 1500);

            anim.showHTML('#characterLook', this.scale, 3);
        },

        unlockMode: function (flag) {
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
        },

        showStore: function (flag) {
          if (flag) {
            $('#appearanceDialog').hide();
            $('#storeDialogStore').show();
          }
          else {
            $('#appearanceDialog').show();
            $('#storeDialogStore').hide();
          }
        },

        show: function() {
            var self = this;

            this.rescale();

            $('#storeDialog .frameheadingtext').text('LOOKS');

            $('#storeDialogStore0Button').text("ARMOR");
            $('#storeDialogStore1Button').hide();
            $('#storeDialogStore2Button').hide();

            jq3Button = $("#storeDialogStore3Button");
            jq3Button.text("LOOKS");
            jq3Button.show();

            jq3Button.off().on('click', function (event) {
                self.unlockMode(false);
                if (!self.unlockLookMode)
                  self.changeLookArmor(self.looksArmorIndex);
            });

            $('#appearanceCloseButton').off().on('click', function (event) {
                self.showStore(true);
            });

            $('#looksDialogPlayer').css("display", "block");

            $('#storeDialogStore div.inventoryGoldFrame').hide();
            $('#storeDialogStore div.inventoryGemsFrame').show();

            this._super();

            this.storeFrame.open();
        },
    });

    return AppearanceDialog;
});
