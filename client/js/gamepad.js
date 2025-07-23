
// TODO - Add Menu Option Navigation. (Assign Skill, Add stat points, Change Settings, View Leaderboard etc).

define([], function() {
  var Navigate = {
    NONE: 0,
    LEFT: 1,
    RIGHT: 2,
    UP: 3,
    DOWN: 4
  };

var jqInventoryWindow = $("#allinventorywindow");
var jqMenuWindow = $("#menucontainer");
var jqAttackWindow = $("#attackContainer");
var jqSkillWindow = $("#skillsDialog");
var jqStatWindow = $("#statsDialog");
var jqPlayerPopupWindow = $("#playerPopupMenuContainer");
var jqInviteWindow = $("#partyconfirm");
var jqQuestWindow = $("#questlog");
var jqSocialWindow = $("#socialwindow");
var jqSettingsWindow = $("#settings");
var jqLeaderWindow = $("#leaderboard");
var jqDropWindow = $("#dropDialog");
var jqInputWindow = $("#inputDialog");
var jqConfirmWindow = $("#dialogModalConfirm");
var jqNotifyWindow = $("#dialogModalNotify");
var jqDiedWindow = $("#diedwindow");
var jqAuctionSellWindow = $("#auctionSellDialog");
var jqAchievementWindow = $("#achievementlog");
var jqShopWindow = $("#shopDialog");
var jqBankWindow = $("#bankDialog");
var jqLooksWindow = $('#appearanceDialog');

var selectFirstItem = {
  allinventorywindow: "#inventorybackground0",
  menucontainer: "#inventorybutton",
  statsDialog: "#charAddAttack",
  skillsDialog: "#skill0 div.skillbody",
  playerPopupMenuContainer: "#playerPopupMenuPartyInvite",
  questlog: "#questCloseButton",
  socialwindow: "#socialclose",
  settings: "#settingchat",
  leaderboard: "#lbselect",
  dropDialog: "#dropAccept",
  dialogModalConfirm: "#dialogModalConfirmButton1",
  dialogModalNotify: "#dialogModalNotifyButton1",
  combatContainer: "#shortcut0",
  auctionSellDialog: "#auctionSellAccept",
  bankDialog: "#bankDialogBank0Background",
  appearanceDialog: "#storeDialogStore1Button",
  craftDialog: "#craftDialogStore0Button",
  shopDialog: "#shopSKU",
  storeDialog: "#storeDialogStore0Button",
  socialconfirm: "#socialconfirmyes",
  diedwindow: "#respawn",
  attackContainer: "#shortcut0"
};

  var Gamepad = Class.extend({
    init: function(game) {
      var self = this;

  self.shopPageIndex = 0;
  self.craftPageIndex = 0;
  self.invPageIndex = 0;
	self.storeDialogSide = ['#storeDialogStore0Button', '#storeDialogStore1Button', '#storeDialogStore2Button', '#storeDialogStore3Button'];
  self.looksDialogSide = ['#storeDialogStore1Button', '#storeDialogStore3Button'];
  self.craftDialogButtons = "#craftDialogStore{0}Button";
	self.storeDialogBuyButton = "#storeDialogStore{0}BuyButton";

  self.bankPages = ["#bankDialog0Button", "#bankDialog1Button", "#bankDialog2Button", "#bankDialog3Button", "#bankDialogStoreButton", "#bankGoldFrame"];
  self.bankPageIndex = 0;


  self.playerInventory = "#inventorybackground{0}";
  self.playerInventoryButtons = ["#inventoryGearItems", "#inventoryGear2Items"];
  self.playerBank = "#bankDialogBank{0}Background";
  self.playerEquipment = ["#equipBackground0","#equipBackground1","#equipBackground2","#equipBackground3","#equipBackground4"];
  self.playerShortcut = ["#shortcut0", "#shortcut1", "#shortcut2", "#shortcut3", "#shortcut4", "#shortcut5", "#shortcut6", "#shortcut7"];

  self.playerDialogSkill = "#skill{0}  div.skillbody";
  self.playerDialogStat = ["#charAddAttack","#charAddDefense","#charAddHealth","#charAddEnergy","#charAddLuck"];
  self.playerSettings = ["#buttonchat","#buttonsound","#buttonjoystick","#buttonmenucolor","#buttonbuttoncolor"];
  self.leaderboardselect = ["#lbselect","#lbindex"];

  self.mainButtonsActive = false;
  self.mainButtons = [
    "#charactermenu",
    "#chatbutton",
    "#shortcutbutton"
  ];

	self.menuButtons = [
    "#inventorybutton",
    "#characterbutton",
    "#skillbutton",
    "#helpbutton",
    "#achievementbutton",
    "#socialbutton",
    "#warpbutton",
    "#settingsbutton",
    "#storebutton"
  ];

  self.navMouse = false;

  self.navigate = Navigate.NONE;
  self.navNone = false;

  self.movePad = false;

  self.shortcutAssign = 0;
  self.selectedItem = null;
  self.dpadX = 0;
  self.dpadY = 0;

  self.resetNavInterval = function (speed) {
    clearInterval(self.navInterval);
    self.navInterval = setInterval(function () {
      self.funcNavigation();
    }, speed);
  }
  self.resetNavInterval(180);

  self.funcNavigation = function () {
    if (self.navNone) {
      return;
    }
    if (!self.isActive())
    {
      return;
    }

    //var navigate = self.navigate[0];
    //var navigate = self.navigate[1];
    var navigate = self.navigate;

    if (game.storeDialog.visible ||
         game.auctionDialog.visible ||
         game.appearanceDialog.visible ||
         game.craftDialog.visible)
    {
       if (navigate == Navigate.UP)
       {
         self.joystickY = (self.joystickY-1).clamp(0,5);
         if (self.joystickY == 0)
         {
           var index = self.storeDialogSide[self.joystickX];
           this.setSelectedItem($(index));
           if (self.joystickX == 3)
           {
             self.joystickX = 0;
             self.joystickY = 0;
           }
           $(index).trigger("click");
         }
         else {
           var index = self.storeDialogBuyButton.format(self.joystickY-1);
           this.setSelectedItem($(index));
         }
       }
       if (navigate == Navigate.DOWN)
       {
         self.joystickY = (self.joystickY+1).clamp(0,5);
         if (self.joystickY >= 1) {
           var index = self.storeDialogBuyButton.format(self.joystickY-1);
           this.setSelectedItem($(index));
         }
       }
       if (navigate == Navigate.LEFT)
       {
         if (self.joystickY == 0) {
           self.joystickX = (self.joystickX-1).clamp(0,3);
           var index = self.storeDialogSide[self.joystickX];
           this.setSelectedItem($(index));
           $(index).trigger("click");
         }
         else {
           $('#storePageNavPrev').trigger("click");
         }
       }
       if (navigate == Navigate.RIGHT)
       {
         if (self.joystickY == 0) {
           self.joystickX = (self.joystickX+1).clamp(0,3);
           var index = self.storeDialogSide[self.joystickX];
           if (self.joystickX == 3)
           {
             self.joystickX = 0;
             self.joystickY = 0;
           }
           this.setSelectedItem($(index));
           $(index).trigger("click");
         }
         else {
           $('#storePageNavNext').trigger("click");
         }
       }
    }
    else if (jqLooksWindow.is(':visible')) {
      if (navigate == Navigate.LEFT)
      {
        $("#changeLookArmorPrev").trigger("click");
      }
      if (navigate == Navigate.RIGHT)
      {
        $("#changeLookArmorNext").trigger("click");
      }
    }
    else if (jqBankWindow.is(':visible'))
    {
      var modx = 0, mody = 0;
      if (navigate == Navigate.UP)
      {
        mody = -1;
      }
      if (navigate == Navigate.DOWN)
      {
        mody = 1;
      }
      if (navigate == Navigate.LEFT)
      {
        modx = -1;
      }
      if (navigate == Navigate.RIGHT)
      {
        modx = 1;
      }

      if (navigate != 0) {
        self.joystickX = ((self.joystickX+6+modx)%6);
        self.joystickY = ((self.joystickY+4+mody)%4);
        var index =(self.joystickY)*6+(self.joystickX);
        var jqi = self.playerBank.format(index);
        this.setSelectedItem($(jqi));
      }
      //return;
    }
    else if (jqInventoryWindow.is(':visible'))
    {
      var equipment = false;
      var modx = 0, mody = 0;
      if (navigate == Navigate.UP)
      {
        mody = -1;
      }
      if (navigate == Navigate.DOWN)
      {
        mody = 1;
      }
      if (navigate == Navigate.LEFT)
      {
        modx = -1;
      }
      if (navigate == Navigate.RIGHT)
      {
        modx = 1;
      }

      if (navigate != 0) {
  			self.joystickX = ((self.joystickX+7+modx)%7);
  			if (self.joystickX == 6)
  			{
  				equipment = true;
  				self.joystickY = ((self.joystickY+5+mody)%5);
  			} else {
  				self.joystickY = ((self.joystickY+4+mody)%4);
  			}

        var index = self.playerInventory.format((self.joystickY)*6+(self.joystickX));
        if (equipment) {
          index = self.playerEquipment[self.joystickY];
        }
        this.setSelectedItem($(index));
      }
      //return;
    }
    else if (jqMenuWindow.is(':visible'))
    {
      var len = self.menuButtons.length;
      if (navigate == Navigate.UP)
      {
        self.joystickY = ((self.joystickY-1+len)%len).clamp(0,9);
        var index = self.menuButtons[self.joystickY];
        this.setSelectedItem($(index));
      }
      if (navigate == Navigate.DOWN)
      {
        self.joystickY = ((self.joystickY+1+len)%len).clamp(0,9);
        var index = self.menuButtons[self.joystickY];
        this.setSelectedItem($(index));
      }
    }
    else if (self.mainButtonsActive)
    {
      var l = self.mainButtons.length;

      if (navigate == Navigate.UP)
      {
        self.joystickX = (l+self.joystickX-2) % l;
      }
      else if (navigate == Navigate.DOWN)
      {
        self.joystickX = (l+self.joystickX+2) % l;
      }
      else if (navigate == Navigate.LEFT && self.joystickX > 0)
      {
        self.joystickX = (l+self.joystickX-1) % l;
      }
      else if (navigate == Navigate.RIGHT && self.joystickX > 0)
      {
        self.joystickX = (l+self.joystickX+1) % l;
      }
      if (navigate != Navigate.NONE)
      {
        var index = self.mainButtons[self.joystickX];
        this.setSelectedItem($(index));
        return;
      }
    }
    else if (self.shortcutActive && jqAttackWindow.is(':visible'))
    {
      if (navigate == Navigate.UP)
      {
        self.joystickY = (self.joystickY-1).clamp(0,3);
      }
      if (navigate == Navigate.DOWN)
      {
        self.joystickY = (self.joystickY+1).clamp(0,3);
      }
      if (navigate == Navigate.LEFT)
      {
        self.joystickX = (self.joystickX-1).clamp(0,1);
      }
      if (navigate == Navigate.RIGHT)
      {
        self.joystickX = (self.joystickX+1).clamp(0,1);
      }
      if (navigate != 0) {
        var index = self.playerShortcut[(self.joystickY)*2+(self.joystickX)];
        this.setSelectedItem($(index));
      }
    }
    else if (jqSkillWindow.is(':visible'))
    {
      var modx = 0;
      var mody = 0;
      if (navigate == Navigate.UP)
      {
        mody = -1;
      }
      if (navigate == Navigate.DOWN)
      {
        mody = 1;
      }
      if (navigate == Navigate.LEFT)
      {
        modx = -1;
      }
      if (navigate == Navigate.RIGHT)
      {
        modx = 1;
      }
      if (navigate != 0) {
        self.joystickX = (self.joystickX+(4 + modx)) % 4;
        self.joystickY = (self.joystickY+(2 + mody)) % 2;
        var index = self.playerDialogSkill.format((self.joystickY)*4+(self.joystickX));
        this.setSelectedItem($(index));
      }
    }
    else if (jqStatWindow.is(':visible'))
    {
      if (navigate == Navigate.UP)
      {
        self.joystickY = (self.joystickY-1).clamp(0,4);
        var index = self.playerDialogStat[self.joystickY];
        this.setSelectedItem($(index));
      }
      if (navigate == Navigate.DOWN)
      {
        self.joystickY = (self.joystickY+1).clamp(0,4);
        var index = self.playerDialogStat[self.joystickY];
        this.setSelectedItem($(index));
      }
    }
    else if (jqSettingsWindow.is(':visible'))
    {
      if (navigate == Navigate.UP)
      {
        self.joystickY = (self.joystickY-1).clamp(0,5);
        var index = self.playerSettings[self.joystickY];
        this.setSelectedItem($(index));
      }
      if (navigate == Navigate.DOWN)
      {
        self.joystickY = (self.joystickY+1).clamp(0,5);
        var index = self.playerSettings[self.joystickY];
        this.setSelectedItem($(index));
      }
    }
    else if (jqLeaderWindow.is(':visible'))
    {
      if (navigate == Navigate.LEFT)
      {
        var index = self.leaderboardselect[0];
        this.setSelectedItem($(index));
      }
      if (navigate == Navigate.RIGHT)
      {
        var index = self.leaderboardselect[1];
        this.setSelectedItem($(index));
      }
    }
  };

  self.setSelectedItem = function (val) {
    //if (self.selectedItem != val)
    //{
      var defHighlight = "2px solid rgb(0, 0, 255)";
      if (self.selectedItem && self.selectedItem.css('border') == defHighlight)
        self.selectedItem.css('border', self.selectedItemBorder);

      if (val)
      {
        self.selectedItemBorder = val.css('border');
        val.css({'border': defHighlight});
        self.selectedItem = val;
      }
    //}
  };

  //setInterval(self.funcNavigation, 1000);


	self.pxgamepad = new PxGamepad();

	self.pxgamepad.start();

  self.joystickSide = 0;
  self.joystickIndex = 0;
  self.joystickX = 0;
  self.joystickY = 0;
  self.dpadActive = false;
	/*if (self.pxgamepad.getGamepad())
	{
		self.enableSelectItem();
	}*/

  self.pxgamepad.buttonOn('select', function() {
    log.info("buttonOn = select");
    if (self.mainButtonsActive) {
      self.mainButtonsActive = false;
      self.setSelectedItem(null);
      return;
    }

    self.mainButtonsActive = true;
    self.setSelectedItem($("#charactermenu"));
    //self.resetNavInterval(192);
  });

  self.pressShortcut = function (index) {
    jqAttackWindow.show();
    self.setSelectedItem($(self.playerShortcut[index]));
    self.selectedItem.trigger("click");
  };

  /*self.pressSkill = function (index) {
    jqAttackWindow.show();
    self.setSelectedItem($(self.playerShortcut[index]));
    self.selectedItem.trigger("click");
  };*/

  self.pxgamepad.buttonOn('x', function() {
    if (self.leftTopPressed) {
      self.pressShortcut(2);
      return;
    }
    if (self.rightTopPressed) {
      self.pressShortcut(6);
      return;
    }

    if (jqInventoryWindow.is(':visible')) {
      $('#allinventorywindow .inventoryGoldFrame').trigger('click');
      return;
    }
    if (jqBankWindow.is(':visible')) {
      $('#bankGoldFrame').trigger('click');
      return;
    }

    log.info("buttonOn = x");
    game.playerTargetClosestEntity(1);
	});

  self.pxgamepad.buttonOff('x', function() {
    log.info("buttonOff = x");
    //self.navMouse = false;
	});

  self.pxgamepad.buttonOn('y', function() {
    if (self.leftTopPressed) {
      self.pressShortcut(3);
      return;
    }
    if (self.rightTopPressed) {
      self.pressShortcut(7);
      return;
    }

    if (jqInventoryWindow.is(':visible')) {
      $('#invActionButton').trigger('click');
    }
    if (jqBankWindow.is(':visible')) {
      $('#bankDialogStoreButton').trigger('click');
    }

    log.info("buttonOn = y");
    self.navMouse = !self.navMouse;
	});

  self.pxgamepad.buttonOff('y', function() {
    log.info("buttonOff = y");
	});

	self.pxgamepad.buttonOn('a', function() {
      log.info("buttonOn = a");
      if (self.leftTopPressed) {
        self.pressShortcut(0);
        return;
      }
      if (self.rightTopPressed) {
        self.pressShortcut(4);
        return;
      }

	    if(self.isDialogOpen())
	    {
        if (game.storeDialog.visible ||
            game.auctionDialog.visible ||
            game.appearanceDialog.visible ||
            game.craftDialog.visible)
    		{
    		    if (self.selectedItem)
            {
                self.selectedItem.trigger("click");
            }
    		}
        if (jqAuctionSellWindow.is(':visible'))
        {
          $("#auctionSellAccept").trigger("click");
          return;
        }
    	  if (jqDiedWindow.is(':visible'))
    	  {
    	    $("#respawn").trigger('click');
          return;
    	  }
        if (jqConfirmWindow.is(':visible'))
        {
          $("#dialogModalConfirmButton1").trigger("click");
          return;
        }
        if (jqNotifyWindow.is(':visible'))
        {
          $("#dialogModalNotifyButton1").trigger("click");
          return;
        }
    	  if ($("#socialconfirm").is(':visible'))
    		{
    	    $('#socialconfirmyes').trigger("click");
    		}
      	else if (jqPlayerPopupWindow.is(':visible'))
    		{
    		    $(self.playerMode).trigger("click");
    		}
    		else if (jqDropWindow.is(':visible'))
    		{
    		    $("#dropAccept").trigger("click");
            return;
    		}
        else if (jqSkillWindow.is(':visible'))
    		{
          if (game.selectedSkill) {
            $(self.playerShortcut.format(self.shortcutAssign)).trigger("click");
            self.shortcutAssign = (self.shortcutAssign+1) % 8;
          }
          else if (self.selectedItem) {
            self.selectedItem.trigger("click");
          }
    		}
        else if (jqStatWindow.is(':visible'))
    		{
          if (self.selectedItem) {
            self.selectedItem.trigger("click");
          }
    		}
        else if (jqBankWindow.is(':visible'))
      	{
          if (self.selectedItem)
            self.selectedItem.trigger("click");
          return;
        }
      	else if (jqInventoryWindow.is(':visible'))
      	{
          if (self.selectedItem)
            self.selectedItem.trigger("click");
          return;
        }
    		else if (jqMenuWindow.is(':visible'))
    		{
          if (self.selectedItem)
            self.selectedItem.trigger("click");
    		}
        else if (jqSettingsWindow.is(':visible'))
        {
          if (self.selectedItem)
          {
              self.selectedItem.trigger("click");
          }
        }
        else if (jqLooksWindow.is(':visible'))
        {
          $("#changeLookArmorNext").trigger("click");
        }
        else if (self.mainButtonsActive)
        {
          log.info("self.mainButtonsActive");
          if (self.selectedItem)
          {
              self.selectedItem.trigger("click");

              /*if (self.selectedItem.attr('id') === 'charactermenu')
              {
                //self.setSelectedItem(null);
                self.setSelectedItem($("#inventorybutton"));
              }*/
              //self.setSelectedItem(null);
              if (self.selectedItem[0].id === 'shortcutbutton')
              {
                self.shortcutActive = true;
              }
              self.dialogOpen();
          }
          self.mainButtonsActive = false;
        }
        self.joystickX = 0;
        self.joystickY = 0;
     }
     else
     {
         //self.shortcutActive = !self.shortcutActive;
        if (self.navMouse)
          game.click();
        else
          game.makePlayerInteractNextTo();
     }
	});

	self.pxgamepad.buttonOn('b', function() {
    log.info("buttonOn = b");
    if (self.leftTopPressed) {
      self.pressShortcut(1);
      return;
    }
    if (self.rightTopPressed) {
      self.pressShortcut(5);
      return;
    }

    if(self.isDialogOpen())
    {
        if (jqConfirmWindow.is(':visible'))
        {
          $("#dialogModalConfirmButton2").trigger("click");
          return;
        }
        if (jqNotifyWindow.is(':visible'))
        {
          $("#dialogModalNotifyButton1").trigger("click");
          return;
        }
        if (jqDiedWindow.is(':visible'))
    	  {
    	    $("#respawn").trigger('click');
          return;
    	  }
        if (jqAuctionSellWindow.is(':visible'))
        {
          $("#auctionSellCancel").trigger("click");
          return;
        }
	    	if ($("#socialconfirm").is(':visible'))
    		{
      	    $('#socialconfirmno').trigger("click");
    		    $('#socialconfirm').css('display', 'none');
    		}
    		else if (jqPlayerPopupWindow.is(':visible'))
    		{
    		    game.playerPopupMenu.close();
    		}
	    	else if ($("#chatbox").is(':visible'))
	    	{
	    	    $("#chatbox").hide();
	    	}
        else if (jqSkillWindow.is(':visible'))
        {
          $("#skillsCloseButton").trigger("click");
        }
        else if (jqStatWindow.is(':visible'))
        {
          $("#statsCloseButton").trigger("click");
        }
	    	else if (jqInventoryWindow.is(':visible'))
	    	{
            var inv = game.inventoryHandler;
            if (inv.selectedItem >= 0) {
              inv.deselectItem();
              return;
            } else {
	    	      $("#inventoryCloseButton").trigger("click");
            }
	    	}
	    	else if (jqQuestWindow.is(':visible'))
	    	{
	    	    //self.disableSelectItem();
	    	    $("#questCloseButton").trigger("click");
	    	}
        else if (jqAchievementWindow.is(':visible'))
        {
            $("#achievementCloseButton").trigger("click");
        }
	    	else if (jqSocialWindow.is(':visible'))
	    	{
	    	    //self.disableSelectItem();
	    	    $("#socialclose").trigger("click");
	    	}
	    	else if (jqSettingsWindow.is(':visible'))
	    	{
	    	    //self.disableSelectItem();
	    	    $("#settingsclose").trigger("click");
	    	}
	    	else if (jqLeaderWindow.is(':visible'))
	    	{
	    	    //self.disableSelectItem();
	    	    $("#leaderboardclose").trigger("click");
	    	}
        else if (jqShopWindow.is(':visible'))
	    	{
	    	    $("#shopCloseButton").trigger("click");
	    	}
    		else if (jqMenuWindow.is(':visible'))
    		{
    	      //self.disableSelectItem();
    		    jqMenuWindow.trigger("click");
            self.mainButtonsActive = false;
    		}
    		else if (jqDropWindow.is(':visible'))
    		{
    	      //self.disableSelectItem();
    		    $("#dropCancel").trigger("click");
            return;
    		}
    		else if (game.storeDialog.visible ||
            game.auctionDialog.visible ||
            game.appearanceDialog.visible)
    		{
            $("#storeDialogCloseButton").trigger("click");
    		    //self.disableSelectItem();
    		}
        else if (game.craftDialog.visible)
    		{
    		    $("#craftDialogCloseButton").trigger("click");
    		}
    		else if (game.bankDialog.visible)
    		{
    		    $("#bankDialogCloseButton").trigger("click");
    		}
        else if (jqLooksWindow.is(':visible'))
        {
          $("#appearanceCloseButton").trigger("click");
        }
        else if (jqAttackWindow.is(':visible'))
        {
          if (self.shortcutActive)
            self.shortcutActive = false;
        }
        else if (self.mainButtonsActive)
        {
          self.mainButtonsActive = false;
          self.setSelectedItem(null);
        }
        if (!self.isDialogOpen())
        {
      		self.joystickIndex = 0;
          //self.resetNavInterval(16);
          self.setSelectedItem(null);
          self.joystickX = -1;
          self.joystickY = -1;
        }
	    }
	    else
	    {
        if (jqAttackWindow.is(':visible'))
        {
          $("#attackContainerClose").trigger("click");
        } else {
          $("#shortcutbutton").trigger("click");
        }
        /*self.shortcutActive = true;
        if (!$("#attackContainer").is(':visible'))
        {
          self.setSelectedItem($(self.playerShortcut[0]));
          $("#attackContainer").show();
        }*/
	    }
	});

    	self.pxgamepad.buttonOff('b', function() {
        log.info("buttonOff = b");

        /*if ($("#attackContainer").is(':visible') && self.selectedItem && self.shortcutActive)
            self.selectedItem.trigger("click");
        self.shortcutActive = false;*/
        //game.click();



      });

      var switchInventoryDialogPage = function (mod) {
        var l = self.playerInventoryButtons.length;
        var i = (l+self.invPageIndex+mod) % l;
        self.invPageIndex = i;
        var jq = $(self.playerInventoryButtons[i]);

        self.setSelectedItem(jq);
      }

      var switchBankDialogPage = function (mod) {
        var l = self.bankPages.length;
        var i = (l+self.bankPageIndex+mod) % l;
        self.bankPageIndex = i;
        var jq = $(self.bankPages[i]);

        self.setSelectedItem(jq);
      }

      var switchShopDialogPage = function (mod) {
        var l = self.storeDialogSide.length;
        var i = (l+self.shopPageIndex+mod) % l;
        self.shopPageIndex = i;
        var jq = $(self.storeDialogSide[i]);

        self.setSelectedItem(jq);
      }

      var switchLooksDialogPage = function (mod) {
        var l = self.looksDialogSide.length;
        var i = (l+self.shopPageIndex+mod) % l;
        self.shopPageIndex = i;
        var jq = $(self.looksDialogSide[i]);

        self.setSelectedItem(jq);
      }

      var switchCraftDialogPage = function (mod) {
        var l = 3;
        var i = (l+self.craftPageIndex+mod) % l;
        self.craftPageIndex = i;
        var jq = $(self.craftDialogButtons.format(i));

        self.setSelectedItem(jq);
      }

      self.pxgamepad.buttonOn('leftTop', function() {
        if (jqInventoryWindow.is(':visible'))
        {
          switchInventoryDialogPage(-1);
          return;
        }
        if (jqBankWindow.is(':visible')) {
          switchBankDialogPage(-1);
          return;
        }
        if (game.appearanceDialog.visible) {
          switchLooksDialogPage(-1);
          return;
        }
        if ($("#storeDialogStore").is(':visible')) {
          switchShopDialogPage(-1);
          return;
        }
        if ($("#craftDialog").is(':visible')) {
          switchCraftDialogPage(-1);
          return;
        }

        jqAttackWindow.show();
        self.leftTopPressed = true;
      });
      self.pxgamepad.buttonOff('leftTop', function() {
        self.leftTopPressed = false;
      });

      self.pxgamepad.buttonOn('rightTop', function() {
        if (jqInventoryWindow.is(':visible'))
        {
          switchInventoryDialogPage(1);
          return;
        }
        if (jqBankWindow.is(':visible')) {
          switchBankDialogPage(1);
          return;
        }
        if (game.appearanceDialog.visible) {
          switchLooksDialogPage(1);
          return;
        }
        if ($("#storeDialogStore").is(':visible')) {
          switchShopDialogPage(1);
          return;
        }
        if ($("#craftDialog").is(':visible')) {
          switchCraftDialogPage(1);
          return;
        }

        jqAttackWindow.show();
        self.rightTopPressed = true;
      });

      self.pxgamepad.buttonOff('rightTop', function() {
        self.rightTopPressed = false;
      });



      // Default.
	    //selectJoystickSide();

	    self.joystickSide = 0;
	    self.joystickIndex = 0;

      self.pxgamepad.buttonOn('dpadUp', function() {
        self.dpadY = -1;
        self.dpadX = 0;
    	});

      self.pxgamepad.buttonOn('dpadDown', function() {
        self.dpadY = 1;
        self.dpadX = 0;
    	});

      self.pxgamepad.buttonOn('dpadLeft', function() {
        self.dpadX = -1;
        self.dpadY = 0;
    	});

      self.pxgamepad.buttonOn('dpadRight', function() {
        self.dpadX = 1;
        self.dpadY = 0;
    	});

      self.pxgamepad.buttonOff('dpadUp', function() {
        self.dpadX = 0;
        self.dpadY = 0;
    	});

      self.pxgamepad.buttonOff('dpadDown', function() {
        self.dpadX = 0;
        self.dpadY = 0;
    	});

      self.pxgamepad.buttonOff('dpadLeft', function() {
        self.dpadX = 0;
        self.dpadY = 0;
    	});

      self.pxgamepad.buttonOff('dpadRight', function() {
        self.dpadX = 0;
        self.dpadY = 0;
    	});

    },

    interval: function () {
      if (this.pxgamepad.getGamepad() === null)
        return;

	    var self = this;

      self.pxgamepad.update();

      var fnDeadZone = function (stick, deadzone) {
        var dzx = Math.abs(stick.x);
        if (dzx < deadzone)
          stick.x = 0;
        dzy = Math.abs(stick.y);
        if (dzy < deadzone)
          stick.y = 0;
      };

      fnDeadZone(self.pxgamepad.leftStick, 0.10);
      fnDeadZone(self.pxgamepad.rightStick, 0.10);

      self.navigate = Navigate.NONE;

			var p = game.player;
      if (!p || !game.started || !game.ready)
        return;

			var o = p.orientation;
			if (game.joystick && game.usejoystick)
			{
				if (!game.joystick.isActive())
				{
          self.navigate = Navigate.NONE;
				}
				if (game.joystick.right())
				{
          self.navigate = Navigate.RIGHT;
				}
				if (game.joystick.left())
				{
          self.navigate = Navigate.LEFT;
				}
				if (game.joystick.up())
				{
          self.navigate = Navigate.UP;
				}
				if (game.joystick.down())
				{
          self.navigate = Navigate.DOWN;
				}
			}
			if (game.joystick && game.joystick.isActive())
			{
				clearInterval(game.autotalk);
			}

       var ignorezone = 0.25;
       var modx = self.dpadX || self.pxgamepad.leftStick.x,
           mody = self.dpadY || self.pxgamepad.leftStick.y;

       var modxa = Math.abs(modx), modya = Math.abs(mody);
       var mod = Math.max(modxa, modya);
       if (mod > ignorezone)
       {
    	   if (modxa > modya)
    	   {
           self.navigate = (modx > 0) ? Navigate.RIGHT : Navigate.LEFT;
    	   }
         else
    	   {
           self.navigate = (mody > 0) ? Navigate.DOWN : Navigate.UP;
    	   }
      }

      var mouse = game.mouse,
        width = game.renderer.renderer.screen.width,
        height = game.renderer.renderer.screen.height,
        ts = G_TILESIZE,
        speed = (ts >> 3) * game.renderer.scale;

      var modx2 = self.navMouse ? (self.dpadX || self.pxgamepad.leftStick.x) : self.pxgamepad.rightStick.x,
          mody2 = self.navMouse ? (self.dpadY || self.pxgamepad.leftStick.y) : self.pxgamepad.rightStick.y;
      var modxa2 = Math.abs(modx2),
          modya2 = Math.abs(mody2),
          mod2 = Math.max(modxa2, modya2);

      if (mod2 > ignorezone)
      {
        mouse.x += modx2 * speed;
        mouse.y += mody2 * speed;
     }

     game.mouse.x = ~~(mouse.x.clamp(0,width-1));
     game.mouse.y = ~~(mouse.y.clamp(0,height-1));

      var navigate = self.navigate;
      ///var navigate = self.navigate[1];

      if (!self.isDialogOpen() && !self.navMouse)
      {
        if (!game.player.keyMove) {
          if (navigate == Navigate.LEFT)
          {
              //log.info("moveLeft = true");
              p.move(3, true);
              this.movePad = 3;
          }
          if (navigate == Navigate.RIGHT)
          {
              //log.info("moveRight = true");
              p.move(4, true);
              this.movePad = 4;
          }
          if (navigate == Navigate.UP)
          {
              //log.info("moveUp = true");
              p.move(1, true);
              this.movePad = 1;
          }
          if (navigate == Navigate.DOWN)
          {
              //log.info("moveDown = true");
              p.move(2, true);
              this.movePad = 2;
          }
        }
        if (navigate == Navigate.NONE && navigate == Navigate.NONE && p.keyMove & this.movePad > 0)
        {
          p.move(this.movePad, false);
          this.movePad = 0;
        }
      }

	    game.movecursor();
	    game.updateCursorLogic();

      if (!self.isDialogOpen()) {
        self.funcNavigation();
      }
    },

    isDialogOpen: function () {
      //return jqInventoryWindow.is(':visible');
    	return game.storeDialog.visible ||
    		game.bankDialog.visible ||
    		game.auctionDialog.visible ||
        game.appearanceDialog.visible ||
        game.craftDialog.visible ||
    		jqMenuWindow.is(':visible') ||
    		jqInventoryWindow.is(':visible') ||
    		jqSkillWindow.is(':visible') ||
        jqStatWindow.is(':visible') ||
    		jqPlayerPopupWindow.is(':visible') ||
    		jqInviteWindow.is(':visible') ||
    		jqQuestWindow.is(':visible') ||
        jqAchievementWindow.is(':visible') ||
    		jqSocialWindow.is(':visible') ||
    		jqSettingsWindow.is(':visible') ||
    		jqLeaderWindow.is(':visible') ||
    		jqDropWindow.is(':visible') ||
        jqInputWindow.is(':visible') ||
        jqConfirmWindow.is(':visible') ||
        jqNotifyWindow.is(':visible') ||
        jqAuctionSellWindow.is(':visible') ||
        jqDiedWindow.is(':visible') ||
        jqShopWindow.is(':visible') ||
        jqLooksWindow.is(':visible') ||
        this.mainButtonsActive ||
        this.shortcutActive;
        //this.navMouse;
    },

    isActive: function () {
    	return (this.pxgamepad.getGamepad() !== null);
    },

    navActive: function () {
    	if (this.pxgamepad.getGamepad() === null)
        return true;
      return !(this.navigate === 0);
    },

    dialogNavigate: function (direction) {
     this.joystickSide = 0;
     this.joystickIndex = 0;
     this.joystickX = 0;
     this.joystickY = 0;
     //this.resetNavInterval(192);
    },

    dialogOpen: function () {
      for (var k in selectFirstItem) {
          if ($('#'+k).is(':visible') && self.selectedItem == null)
          {
            if (selectFirstItem[k])
              this.setSelectedItem($(selectFirstItem[k]));
            else {
              this.setSelectedItem(null);
            }
            //self.joystickX = 0;
            //self.joystickY = 0;
            break;
          }
      }

      this.dialogNavigate();
    },

    dialogClose: function () {
      //this.resetNavInterval(16);
    }

  });
  return Gamepad;
});
