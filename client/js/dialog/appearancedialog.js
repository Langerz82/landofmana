define(['./dialog', '../tabbook', '../tabpage', 'data/appearancedata', '../pageNavigator', '../playeranim', 'data/items'],
  function(Dialog, TabBook, TabPage, AppearanceData, PageNavigator, PlayerAnim, Items) {
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
                    game.client.sendAppearanceUnlock(self.item.index, self.item.buyPrice);
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
            this.body.off().on('click', function(event) {
                var dialog = game.appearanceDialog;
                if(game && game.ready && dialog.visible) {
                	dialog.update(self.parent.itemType, game.sprites[AppearanceData[self.item.index].sprite]);
                	$('#appearanceDialog').show();
                }
            });
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
            if (!game || !game.player)
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

        			if (item.type == categoryType && game.player.appearances[k] == 0 && item.buy > 0)
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
            this._super(parent, '#storeDialogStore', 0, scale, 1);
        }
    });

    var AppearanceWeaponPage = AppearancePage.extend({
        init: function(parent, scale) {
            this._super(parent, '#storeDialogStore', 1, scale, 2);
        }
    });

    var StoreFrame = TabBook.extend({
        init: function(parent) {
            this._super('#storeDialogStore');

            this.parent = parent;
            this.scale = this.parent.scale;

            this.add(new AppearanceArmorPage(parent, this.scale));
            this.add(new AppearanceWeaponPage(parent, this.scale));

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

            var changeLookArmor = function (index)
            {
              if (self.armorLooks && self.armorLooks.length > 0)
      				{
                index = self.looksArmorIndex = (self.armorLooks.length + index) % self.armorLooks.length;
                var spriteId = self.armorLooks[index];
                if (spriteId==0 || game.player.appearances[spriteId] == 1) {
                  //var index = p.isArcher() ? 2 : 0;
                  game.player.sprites[0] = spriteId;
                  game.player.setArmorSprite();
                  game.client.sendLook(0,spriteId);
                }
                self.playerAnim.sprites[0] = game.sprites[AppearanceData[spriteId].sprite];
      					self.updateLook();
      					game.app.initPlayerBar();
      				}
            };

      			$('#changeLookArmorPrev').bind("click", function(event) {
              changeLookArmor(--self.looksArmorIndex);
      			});

      			$('#changeLookArmorNext').bind("click", function(event) {
              changeLookArmor(++self.looksArmorIndex);
      			});

        },

        setScale: function() {
          this.scale = game.renderer.getUiScaleFactor();
        },

        rescale: function() {
        	this.setScale();
		      this.storeFrame.rescale();
        },

        hide: function() {
            $('#storeDialogInventory').css("display","block");
            $('#looksDialogPlayer').css("display","none");

            $('#appearanceDialog').css("display","none");
            this._super();
        },

        assign: function(datas) {
            var weapon, armor,
                width1, height1, width2, height2, width3, height3;

        		game.player.appearances = Utils.Base64ToBinArray(datas.shift(), AppearanceData.length);

            for(var i=0; i < AppearanceData.length; i++)
            {
              AppearanceData[i].buy = parseInt(datas.shift());
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
              if (game.player.appearances[i] == 0)
                continue;

            	if (AppearanceData[i].type == categoryTypeArmor)
            		this.armorLooks.push(i);
            	else if (AppearanceData[i].type == categoryTypeWeapon)
            		this.weaponLooks.push(i);
            }
            this.looksArmorIndex = this.armorLooks.indexOf(game.player.sprite[0]);
            this.looksWeaponIndex = this.weaponLooks.indexOf(game.player.sprite[0]);

            this.scale = game.renderer.getUiScaleFactor();

            this.updateLook();
        },

        update: function (itemType, sprite) {
          this.playerAnim.sprites[itemType] = sprite;
          this.updateLook();
        },

        updateLook: function() {
            var self = this;
            var anim = this.playerAnim;

            var player = game.player;

            if (anim.sprites.length == 0) {
              anim.addSprite(player.getArmorSprite());
              anim.addSprite(player.getWeaponSprite());
              anim.setHTML(['#characterLookArmor','#characterLookWeapon']);
            }

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
              if (++inc_fn % fn.length == 0)
                inc++;
            }, 1500);


            var zoom = 1.5;
            var scale = 2;

      			width1 = weapon ? weapon.width * scale * zoom : 0;
      			height1 = weapon ? weapon.height * scale * zoom : 0;

      			width2 = armor ? armor.width * scale * zoom : 0;
      			height2 = armor ? armor.height * scale * zoom : 0;

            width3 = Math.max(width1, width2);
            height3 = Math.max(height1, height2);

            var jqCharLook = $('#characterLook');
            jqCharLook.css({
              'left': ((90 * this.scale) - parseInt(width3 / 2)) + 'px',
              'top': (40 * this.scale) + 'px',
              'width': width3 + 'px',
              'height': height3 + 'px'
            });

            $('#characterLookArmor').css('left', '' + parseInt((width3 - width2) / 2 /*+ armor.offsetX*/) + 'px');
            $('#characterLookArmor').css('top', '' + parseInt((height3 - height2) / 2 /*+ armor.offsetY*/) + 'px');
            $('#characterLookWeapon').css('left', '' + parseInt((width3 - width1) / 2 /*- (weapon.offsetX - armor.offsetX)*/) + 'px');
            $('#characterLookWeapon').css('top', '' + parseInt((height3 - height1) / 2 /*- (weapon.offsetY - armor.offsetY)*/) + 'px');

        },

        show: function() {
            this.rescale();

            this.storeFrame.open();
            game.client.sendAppearanceList();

            $('#storeDialog .frameheadingtext').text('LOOKS');

            $('#storeDialogStore0Button').hide();
            $('#storeDialogStore2Button').hide();

            jq3Button = $("#storeDialogStore3Button");
            jq3Button.text("LOOKS");
            jq3Button.show();

            jq3Button.off().on('click', function (event) {
                  $('#appearanceDialog').show();
                  $('#storeDialogStore').hide();
            });

            $('#appearanceCloseButton').off().on('click', function (event) {
                  $('#appearanceDialog').hide();
                  $('#storeDialogStore').show();
            });

            $('#looksDialogPlayer').css("display","block");

            $('#storeDialogStore div.inventoryGoldFrame').hide();
            $('#storeDialogStore div.inventoryGemsFrame').show();

            this._super();
        },
    });

    return AppearanceDialog;
});
