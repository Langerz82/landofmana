// Converted from AMD (define) + Class.extend to a native ES6 module/class.
// TODO - Add Menu Option Navigation. (Assign Skill, Add stat points, Change Settings, View Leaderboard etc).
/* global Utils, game, log, DragItem, ShortcutData, ShortcutStyle, PxGamepad */

const Navigate = {
  NONE: 0,
  LEFT: 1,
  RIGHT: 2,
  UP: 3,
  DOWN: 4
};

let GamePadShortcut = null; // FIX: was a bare global assignment (no var), which throws ReferenceError under ES module strict mode

// PERF: previously declared as a closure inside interval(), which runs once per game tick
// whenever a gamepad is connected - that allocated a new function object every ~1 tick for no
// reason, since it doesn't capture any per-instance state (`stick`/`deadzone` are just
// parameters). Hoisted to a module-level function so it's created once.
function applyDeadZone(stick, deadzone) {
  const dzx = Math.abs(stick.x);
  if (dzx < deadzone)
    stick.x = 0;
  const dzy = Math.abs(stick.y);
  if (dzy < deadzone)
    stick.y = 0;
}

const jqInventoryWindow = $("#allinventorywindow");
const jqMenuWindow = $("#menucontainer");
const jqSkillWindow = $("#skillsDialog");
const jqStatWindow = $("#statsDialog");
const jqPlayerPopupWindow = $("#playerPopupMenuContainer");
const jqInviteWindow = $("#partyconfirm");
const jqQuestWindow = $("#questlog");
const jqSocialWindow = $("#socialwindow");
const jqSettingsWindow = $("#settings");
const jqLeaderWindow = $("#leaderboard");
const jqDropWindow = $("#dropDialog");
const jqInputWindow = $("#inputDialog");
const jqConfirmWindow = $("#dialogModalConfirm");
const jqNotifyWindow = $("#dialogModalNotify");
const jqDiedWindow = $("#diedwindow");
const jqAuctionSellWindow = $("#auctionSellDialog");
const jqAchievementWindow = $("#achievementlog");
const jqShopWindow = $("#shopDialog");
const jqBankWindow = $("#bankDialog");
const jqLooksWindow = $('#appearanceDialog');
const jqLooksPreview = $('#looksDialogPlayer');

const selectFirstItem = {
  socialconfirm: "#socialconfirmyes",
  diedwindow: "#respawn",
  dialogModalConfirm: "#dialogModalConfirmButton1",
  dialogModalNotify: "#dialogModalNotifyButton1",
  dropDialog: "#dropAccept",
  playerPopupMenuContainer: "#playerPopupMenuPartyInvite",

  allinventorywindow: "#equipBackground0",
  statsDialog: "#charAddAttack",
  skillsDialog: "#skill0 div.skillbody",
  questlog: "#questCloseButton",
  socialwindow: "#socialclose",
  settings: "#settingchat",
  auctionSellDialog: "#auctionSellAccept",
  bankDialog: "#bankDialogBank0Background",
  appearanceDialog: "#storeDialogStore1Button",
  craftDialog: "#craftDialogStore0Button",
  shopDialog: "#shopSKU",
  storeDialog: "#storeDialogStore0Button",

  menucontainer: "#inventorybutton",

  shortcut_bar: "#shortcut0",
  combatContainer: "#shortcut0",
};

export default class Gamepad {
    constructor(game) {
      const self = this;

  self.shopPageIndex = 0;
  self.craftPageIndex = 0;
  self.invPageIndex = 0;
	self.storeDialogSide = ['#storeDialogStore0Button', '#storeDialogStore1Button', '#storeDialogStore2Button', '#storeDialogStore3Button'];
  self.looksDialogSide = ['#storeDialogStore0Button', '#storeDialogStore3Button'];
  self.craftDialogButtons = "#craftDialogStore{0}Button";
	self.storeDialogBuyButton = "#storeDialogStore{0}BuyButton";

  self.bankPages = ["#bankDialog0Button", "#bankDialog1Button", "#bankDialog2Button", "#bankDialog3Button", "#bankDialogStoreButton", "#bankGoldFrame"];
  self.bankPageIndex = 0;


  self.playerInventory = "#inventoryitembackground{0}";
  self.playerBank = "#bankDialogBank{0}Background";
  self.playerEquipment = ["#equipBackground0","#equipBackground1","#equipBackground2","#equipBackground3","#equipBackground4"];
  self.playerShortcut = ["#attack-shortcut","#scbackground0","#scbackground1","#scbackground2","#scbackground3","#scbackground4","#scbackground5"];

  self.playerDialogSkill = "#skill{0} div.skillbody";
  self.playerDialogStat = ["#charAddAttack","#charAddDefense","#charAddHealth",/*"#charAddEnergy",*/"#charAddLuck"];
  self.playerSettings = ["#buttonchat","#buttonsound","#buttonjoystick","#buttonmenucolor","#buttonbuttoncolor"];
  self.leaderboardselect = ["#lbselect","#lbindex"];

  self.mainButtonsActive = false;
  self.mainButtons = [
    "#charactermenu",
    "#chatbutton"
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

  self.funcNavigation = function () {
    if (self.navNone) {
      return;
    }
    if (!self.isActive())
    {
      return;
    }

    const navigate = self.navigate;

    if (game.storeDialog.visible ||
         game.auctionDialog.visible ||
         game.appearanceDialog.visible && !jqLooksPreview.is(':visible') ||
         game.craftDialog.visible)
    {
       if (navigate === Navigate.UP)
       {
         self.joystickY = Utils.clamp(0,5, (self.joystickY-1));
         if (self.joystickY === 0)
         {
           const index = self.storeDialogSide[self.joystickX];
           this.setSelectedItem($(index));
           if (self.joystickX === 3)
           {
             self.joystickX = 0;
             self.joystickY = 0;
           }
           $(index).trigger("click");
         }
         else {
           const index = self.storeDialogBuyButton.format(self.joystickY-1);
           this.setSelectedItem($(index));
         }
       }
       if (navigate === Navigate.DOWN)
       {
         self.joystickY = Utils.clamp(0,5,(self.joystickY+1));
         if (self.joystickY >= 1) {
           const index = self.storeDialogBuyButton.format(self.joystickY-1);
           this.setSelectedItem($(index));
         }
       }
       if (navigate === Navigate.LEFT)
       {
         if (self.joystickY === 0) {
           self.joystickX = Utils.clamp(0,3,(self.joystickX-1));
           const index = self.storeDialogSide[self.joystickX];
           this.setSelectedItem($(index));
           $(index).trigger("click");
         }
         else {
           $('#storePageNavPrev').trigger("click");
         }
       }
       if (navigate === Navigate.RIGHT)
       {
         if (self.joystickY === 0) {
           self.joystickX = Utils.clamp(0,3,(self.joystickX+1));
           const index = self.storeDialogSide[self.joystickX];
           if (self.joystickX === 3)
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
    else if (jqLooksPreview.is(':visible')) {
      if (!game.appearanceDialog.unlockLookMode) {
        if (navigate === Navigate.LEFT)
        {
          $("#changeLookPrev").trigger("click");
        }
        if (navigate === Navigate.RIGHT)
        {
          $("#changeLookNext").trigger("click");
        }
      }
      return;
    }
    else if (jqBankWindow.is(':visible'))
    {
      let modx = 0, mody = 0;
      if (navigate === Navigate.UP)
      {
        mody = -1;
      }
      if (navigate === Navigate.DOWN)
      {
        mody = 1;
      }
      if (navigate === Navigate.LEFT)
      {
        modx = -1;
      }
      if (navigate === Navigate.RIGHT)
      {
        modx = 1;
      }

      if (navigate !== 0) {
        self.joystickX = ((self.joystickX+6+modx)%6);
        self.joystickY = ((self.joystickY+16+mody)%16);
        const index =(self.joystickY)*6+(self.joystickX);
        const jqi = self.playerBank.format(index);
        $(jqi).get(0).scrollIntoView();
        this.setSelectedItem($(jqi));
      }
    }
    else if (jqMenuWindow.is(':visible'))
    {
      const len = self.menuButtons.length;
      //{
        let mody = 0;
        if (navigate === Navigate.UP)
        {
          mody=-1;
        }
        if (navigate === Navigate.DOWN)
        {
          mody=1;
        }

      if (navigate !== 0) {
        self.joystickY = (self.joystickY+mody+len)%len;
        const index = self.menuButtons[self.joystickY];
        this.setSelectedItem($(index));
      }
    }
    else if (self.mainButtonsActive)
    {
      if (navigate === 0)
        return;

      const buttons = {};
      let modx = 0, mody = 0;

      buttons['0-0'] = self.mainButtons[0];
      buttons['1-0'] = self.mainButtons[1];

      if (ShortcutStyle.indexOf('horizontal') === 0)
      {
        buttons['1-1'] = self.playerShortcut[0];
        buttons['1-2'] = self.playerShortcut[1];
        buttons['1-3'] = self.playerShortcut[2];
        buttons['1-4'] = self.playerShortcut[3];
        buttons['1-5'] = self.playerShortcut[4];
        buttons['1-6'] = self.playerShortcut[5];
        buttons['1-7'] = self.playerShortcut[6];

        if (ShortcutStyle === "horizontal-asc") {
          if (navigate === Navigate.LEFT)
            modx = -1;
          if (navigate === Navigate.RIGHT)
            modx = 1;
        }
        else if (ShortcutStyle === "horizontal-desc") {
          if (navigate === Navigate.LEFT)
            modx = 1;
          if (navigate === Navigate.RIGHT)
            modx = -1;
        }

        if (navigate === Navigate.UP || navigate === Navigate.DOWN) {
          mody = 1;
        }
        self.joystickX = (self.joystickX+modx+8)%8;
        self.joystickY = (self.joystickY+mody+2)%2;
      }
      if (ShortcutStyle.indexOf('vertical') === 0)
      {
        buttons['1-1'] = self.playerShortcut[0];
        buttons['2-1'] = self.playerShortcut[1];
        buttons['3-1'] = self.playerShortcut[2];
        buttons['4-1'] = self.playerShortcut[3];
        buttons['5-1'] = self.playerShortcut[4];
        buttons['6-1'] = self.playerShortcut[5];
        buttons['7-1'] = self.playerShortcut[6];

        if (ShortcutStyle === "vertical-asc") {
          if (navigate === Navigate.UP)
            mody = -1;
          if (navigate === Navigate.DOWN)
            mody = 1;
        }
        else if (ShortcutStyle === "vertical-desc") {
          if (navigate === Navigate.UP)
            mody = 1;
          if (navigate === Navigate.DOWN)
            mody = -1;
        }
        if (navigate === Navigate.LEFT || navigate === Navigate.RIGHT) {
          modx = 1;
        }
        self.joystickX = (self.joystickX+modx+2)%2;
        self.joystickY = (self.joystickY+mody+8)%8;
      }

      if (self.joystickY === 0) {
        this.setSelectedItem($(buttons['0-0']));
      }
      else if (self.joystickX === 0) {
        this.setSelectedItem($(buttons['1-0']));
      }
      else {
        this.setSelectedItem($(buttons[self.joystickY+'-'+self.joystickX]));
      }
      return;
    }
    else if (jqInventoryWindow.is(':visible'))
    {
      let equipment = false;
      let modx = 0, mody = 0;
      if (navigate === Navigate.UP)
      {
        mody = -1;
      }
      if (navigate === Navigate.DOWN)
      {
        mody = 1;
      }
      if (navigate === Navigate.LEFT)
      {
        modx = -1;
      }
      if (navigate === Navigate.RIGHT)
      {
        modx = 1;
      }

      if (navigate !== 0) {
        self.joystickX = ((self.joystickX+5+modx)%5);
        self.joystickY = ((self.joystickY+11+mody)%11);
  			if (self.joystickY === 0)
  			{
  				equipment = true;
  			}

        let index = self.playerInventory.format((self.joystickY-1)*5+(self.joystickX));
        if (equipment) {
          index = self.playerEquipment[self.joystickX];
        }
        $(index).get(0).scrollIntoView();
        this.setSelectedItem($(index));
      }
      return;
    }
    else if (jqSkillWindow.is(':visible'))
    {
      let modx = 0;
      let mody = 0;
      if (navigate === Navigate.UP)
      {
        mody = -1;
      }
      if (navigate === Navigate.DOWN)
      {
        mody = 1;
      }
      if (navigate === Navigate.LEFT)
      {
        modx = -1;
      }
      if (navigate === Navigate.RIGHT)
      {
        modx = 1;
      }
      if (navigate !== 0 || !ShortcutData) {
        self.joystickX = (self.joystickX+(4 + modx)) % 4;
        self.joystickY = (self.joystickY+(2 + mody)) % 2;
        const index = self.playerDialogSkill.format((self.joystickY)*4+(self.joystickX));
        this.setSelectedItem($(index));
        $(index).trigger("click");
      }
    }
    else if (jqStatWindow.is(':visible'))
    {
      if (navigate === Navigate.UP)
      {
        self.joystickY = Utils.clamp(0,4,(self.joystickY-1));
        const index = self.playerDialogStat[self.joystickY];
        this.setSelectedItem($(index));
      }
      if (navigate === Navigate.DOWN)
      {
        self.joystickY = Utils.clamp(0,4,(self.joystickY+1));
        const index = self.playerDialogStat[self.joystickY];
        this.setSelectedItem($(index));
      }
    }
    else if (jqSettingsWindow.is(':visible'))
    {
      if (navigate === Navigate.UP)
      {
        self.joystickY = Utils.clamp(0,5,(self.joystickY-1));
        const index = self.playerSettings[self.joystickY];
        this.setSelectedItem($(index));
      }
      if (navigate === Navigate.DOWN)
      {
        self.joystickY = Utils.clamp(0,5,(self.joystickY+1));
        const index = self.playerSettings[self.joystickY];
        this.setSelectedItem($(index));
      }
    }
    else if (jqLeaderWindow.is(':visible'))
    {
      if (navigate === Navigate.LEFT)
      {
        const index = self.leaderboardselect[0];
        this.setSelectedItem($(index));
      }
      if (navigate === Navigate.RIGHT)
      {
        const index = self.leaderboardselect[1];
        this.setSelectedItem($(index));
      }
    }
  };

  self.setSelectedItem = function (val) {
    //{
      const defHighlight = "3px solid rgb(0, 0, 255)";
      if (self.selectedItem) {
        if (!GamePadShortcut || GamePadShortcut.item !== self.selectedItem)
        {
          self.selectedItem.css('border', self.selectedItemBorder);
          self.selectedItemBorder = null;
        }
      }

      if (val)
      {
        self.selectedItemBorder = val.css('border');
        val.css({'border': defHighlight});
        self.selectedItem = val;
      }
    //}
  };



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

    self.setSelectedItem($("#charactermenu"));
    self.mainButtonsActive = true;
    self.joystickX = 0;
    self.joystickY = 0;
  });

  self.pressShortcut = function (index) {
    self.setSelectedItem($(self.playerShortcut[index]));
    self.selectedItem.trigger("click");
  };

  self.pxgamepad.buttonOn('x', function() {
    if (self.leftTopPressed) {
      self.pressShortcut(2);
      return;
    }
    if (self.rightTopPressed) {
      return;
    }

    if (jqInventoryWindow.is(':visible')) {
      if (!DragItem)
        self.selectedItem.trigger('click');
      if (DragItem) {
        GamePadShortcut = {
            x: self.joystickX,
            y: self.joystickY,
            item: self.selectedItem
        };
        self.mainButtonsActive = true;
        self.joystickX = 1;
        self.joystickY = 1;
        return;
      }

      $('#allinventorywindow .inventoryGoldFrame').trigger('click');
      return;
    }

    if (jqSkillWindow.is(':visible')) {
      if (ShortcutData) {
        GamePadShortcut = {
            x: self.joystickX,
            y: self.joystickY,
            item: self.selectedItem
        };
        self.mainButtonsActive = true;
        self.joystickX = 1;
        self.joystickY = 1;
        return;
      }
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
	});

  self.pxgamepad.buttonOn('y', function() {
    if (self.leftTopPressed) {
      self.pressShortcut(3);
      return;
    }
    if (self.rightTopPressed) {
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
        if (game.storeDialog.visible ||
            game.auctionDialog.visible ||
            game.appearanceDialog.visible && !jqLooksPreview.is(':visible') ||
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
        if (jqLooksPreview.is(':visible'))
        {
          if (game.appearanceDialog.unlockLookMode)
            $("#changeLookUnlock").trigger("click");
          else
            $("#changeLookNext").trigger("click");
          return;
        }
        else if (jqSkillWindow.is(':visible'))
    		{
          if (game.selectedSkill) {
            $(self.playerShortcut.format(self.shortcutAssign)).trigger("click");
            self.mainButtonsActive = false;
            self.joystickX = 0;
            self.joystickY = 0;
          }
          else if (self.selectedItem) {
            self.selectedItem.trigger("click");
            if (ShortcutData == null) {
              self.mainButtonsActive = false;
              if (GamePadShortcut) {
                self.joystickX = GamePadShortcut.x;
                self.joystickY = GamePadShortcut.y;
                self.setSelectedItem(GamePadShortcut.item);
                GamePadShortcut = null;
              }
              else {
                self.joystickX = 0;
                self.joystickY = 0;
              }
            }
          }
          return;
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
          if (self.selectedItem) {
            self.selectedItem.trigger("click");
          }
          if (DragItem == null) {
            self.mainButtonsActive = false;
            if (GamePadShortcut) {
              self.joystickX = GamePadShortcut.x;
              self.joystickY = GamePadShortcut.y;
              self.setSelectedItem(GamePadShortcut.item);
              GamePadShortcut = null;
            }
            else {
              self.joystickX = 0;
              self.joystickY = 0;
            }
          }
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
        else if (self.mainButtonsActive)
        {
          log.info("self.mainButtonsActive");
          if (self.selectedItem)
          {
              self.selectedItem.trigger("click");

              /*if (self.selectedItem.attr('id') === 'charactermenu')
              {
                self.setSelectedItem($("#inventorybutton"));
              }*/
              /*if (self.selectedItem[0].id === 'shortcutbutton')
              {
                self.shortcutActive = true;
              }*/
              self.dialogOpen($('#charactermenu'));
          }
          self.mainButtonsActive = false;
        }
        self.joystickX = 0;
        self.joystickY = 0;
     }
     else
     {
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
            const inv = game.inventoryHandler;
            if (inv.selectedItem >= 0) {
              inv.deselectItem();
              return;
            } else {
	    	      $("#inventoryCloseButton").trigger("click");
            }
	    	}
	    	else if (jqQuestWindow.is(':visible'))
	    	{
	    	    $("#questCloseButton").trigger("click");
	    	}
        else if (jqAchievementWindow.is(':visible'))
        {
            $("#achievementCloseButton").trigger("click");
        }
	    	else if (jqSocialWindow.is(':visible'))
	    	{
	    	    $("#socialclose").trigger("click");
	    	}
	    	else if (jqSettingsWindow.is(':visible'))
	    	{
	    	    $("#settingsclose").trigger("click");
	    	}
	    	else if (jqLeaderWindow.is(':visible'))
	    	{
	    	    $("#leaderboardclose").trigger("click");
	    	}
        else if (jqShopWindow.is(':visible'))
	    	{
	    	    $("#shopCloseButton").trigger("click");
	    	}
    		else if (jqMenuWindow.is(':visible'))
    		{
    		    jqMenuWindow.trigger("click");
          self.mainButtonsActive = false;
    		}
    		else if (jqDropWindow.is(':visible'))
    		{
    		    $("#dropCancel").trigger("click");
          return;
    		}
    		else if (game.storeDialog.visible ||
          game.auctionDialog.visible ||
          game.appearanceDialog.visible)
    		{
          $("#storeDialogCloseButton").trigger("click");
    		}
        else if (game.craftDialog.visible)
    		{
    		    $("#craftDialogCloseButton").trigger("click");
    		}
    		else if (jqBankWindow.is(':visible'))
    		{
          if (game.bankDialog.bankFrame.selectedItem >= 0)
            game.bankDialog.bankFrame.deselectItem();
          else
    		      $("#bankDialogCloseButton").trigger("click");
    		}
        else if (jqLooksWindow.is(':visible'))
        {
          $("#appearanceCloseButton").trigger("click");
        }
        else if (jqLooksPreview.is(':visible'))
        {
          $("#appearanceCloseButton").trigger("click");
        }
        else if (self.mainButtonsActive)
        {
          self.mainButtonsActive = false;
          self.setSelectedItem(null);
        }
        if (!self.isDialogOpen())
        {
      		self.joystickIndex = 0;
          self.setSelectedItem(null);
          self.joystickX = -1;
          self.joystickY = -1;
        }
	    }
	    else
	    {
	    }
	});

    	self.pxgamepad.buttonOff('b', function() {
        log.info("buttonOff = b");

        /*if ($("#attackContainer").is(':visible') && self.selectedItem && self.shortcutActive)
            self.selectedItem.trigger("click");
        self.shortcutActive = false;*/



      });

      /*var switchInventoryDialogPage = function (mod) {
        var l = self.playerInventoryButtons.length;
        var i = (l+self.invPageIndex+mod) % l;
        self.invPageIndex = i;
        var jq = $(self.playerInventoryButtons[i]);

        self.setSelectedItem(jq);
      }*/

      /*var switchBankDialogPage = function (mod) {
        var l = self.bankPages.length;
        var i = (l+self.bankPageIndex+mod) % l;
        self.bankPageIndex = i;
        var jq = $(self.bankPages[i]);

        self.setSelectedItem(jq);
      }*/

      const switchShopDialogPage = function (mod) {
        let sides = self.storeDialogSide;
        if (game.appearanceDialog.visible)
          sides = self.looksDialogSide;

        const l = sides.length;
        const i = (l+self.shopPageIndex+mod) % l;
        self.shopPageIndex = i;
        const jq = $(sides[i]);

        self.setSelectedItem(jq);
      }

      const switchLooksDialogPage = function (mod) {
        const l = self.looksDialogSide.length;
        const i = (l+self.shopPageIndex+mod) % l;
        self.shopPageIndex = i;
        const jq = $(self.looksDialogSide[i]);

        self.setSelectedItem(jq);
      }

      const switchCraftDialogPage = function (mod) {
        const l = 3;
        const i = (l+self.craftPageIndex+mod) % l;
        self.craftPageIndex = i;
        const jq = $(self.craftDialogButtons.format(i));

        self.setSelectedItem(jq);
      }

      self.pxgamepad.buttonOn('leftTop', function() {
        if (jqInventoryWindow.is(':visible'))
        {
          return;
        }
        if (jqBankWindow.is(':visible')) {
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

        self.leftTopPressed = true;
      });
      self.pxgamepad.buttonOff('leftTop', function() {
        self.leftTopPressed = false;
      });

      self.pxgamepad.buttonOn('rightTop', function() {
        if (jqInventoryWindow.is(':visible'))
        {
          return;
        }
        if (jqBankWindow.is(':visible')) {
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

        self.rightTopPressed = true;
      });

      self.pxgamepad.buttonOff('rightTop', function() {
        self.rightTopPressed = false;
      });



      // Default.

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

    }

    interval() {
      if (this.pxgamepad.getGamepad() === null)
        return;

	    const self = this;

      self.pxgamepad.update();

      applyDeadZone(self.pxgamepad.leftStick, 0.10);
      applyDeadZone(self.pxgamepad.rightStick, 0.10);

      self.navigate = Navigate.NONE;

			const p = game.player;
      if (!p || !game.started || !game.ready)
        return;

			const o = p.orientation;
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

       const ignorezone = 0.25;
       const modx = self.dpadX || self.pxgamepad.leftStick.x,
           mody = self.dpadY || self.pxgamepad.leftStick.y;

       const modxa = Math.abs(modx), modya = Math.abs(mody);
       const mod = Math.max(modxa, modya);
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

      const mouse = game.mouse,
        width = game.renderer.renderer.screen.width,
        height = game.renderer.renderer.screen.height,
        ts = G_TILESIZE,
        speed = (ts >> 3) * game.renderer.scale;

      const modx2 = self.navMouse ? (self.dpadX || self.pxgamepad.leftStick.x) : self.pxgamepad.rightStick.x,
          mody2 = self.navMouse ? (self.dpadY || self.pxgamepad.leftStick.y) : self.pxgamepad.rightStick.y;
      const modxa2 = Math.abs(modx2),
          modya2 = Math.abs(mody2),
          mod2 = Math.max(modxa2, modya2);

      if (mod2 > ignorezone)
      {
        mouse.x += modx2 * speed;
        mouse.y += mody2 * speed;
     }

     game.mouse.x = ~~(Utils.clamp(0, (width-1), mouse.x));
     game.mouse.y = ~~(Utils.clamp(0, (height-1), mouse.y));

      const navigate = self.navigate;

      if (!self.isDialogOpen() && !self.navMouse)
      {
        if (!game.player.keyMove) {
          if (navigate === Navigate.LEFT)
          {
              p.move(3, true);
              this.movePad = 3;
          }
          if (navigate === Navigate.RIGHT)
          {
              p.move(4, true);
              this.movePad = 4;
          }
          if (navigate === Navigate.UP)
          {
              p.move(1, true);
              this.movePad = 1;
          }
          if (navigate === Navigate.DOWN)
          {
              p.move(2, true);
              this.movePad = 2;
          }
        }
        // FIX: `>` binds tighter than `&`, so this was parsing as
        // `p.keyMove & (this.movePad > 0)` (bitwise-AND against a 0/1 boolean) instead of
        // the intended "movePad bit is set" check `(p.keyMove & this.movePad) > 0`. Broke
        // detection of a released gamepad-driven walk direction.
        if (navigate === Navigate.NONE && navigate === Navigate.NONE && (p.keyMove & this.movePad) > 0)
        {
          p.move(this.movePad, false);
          this.movePad = 0;
        }
      }

	    game.movecursor();
	    game.updateCursorLogic();

      /*if (!self.isDialogOpen()) {
        self.funcNavigation();
      }*/

      if (navigate !== 0) {
        if (!self.navInterval)
          self.funcNavigation();
        if (self.navInterval == null)
          self.resetNavInterval(200);
      }
      else {
        clearInterval(self.navInterval);
        self.navInterval = null;
      }
    }

    isDialogOpen() {
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
        jqLooksPreview.is(':visible') ||
        this.mainButtonsActive;
    }

    isActive() {
    	return (this.pxgamepad.getGamepad() !== null);
    }

    navActive() {
    	if (this.pxgamepad.getGamepad() === null)
        return true;
      return this.navigate !== 0;
    }

    dialogNavigate(direction) {
     this.joystickSide = 0;
     this.joystickIndex = 0;
     this.joystickX = 0;
     this.joystickY = 0;
    }

    dialogOpen(dialog) {
      this.setSelectedItem(null);
      for (let k in selectFirstItem) {
          if ($('#'+k).is(':visible'))
          {
              this.setSelectedItem($(selectFirstItem[k]));
            break;
          }
      }
      this.dialogNavigate();
    }

    dialogClose() {
    }
}
