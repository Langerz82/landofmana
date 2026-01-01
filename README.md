# Land of Mana - Beta.
formerly Retro RPG Online 2/Rogue Quest

Land of Mana is a free-to-play 2D Overhead Multiplayer Online Role Playing Game (MORPG) along the style of early SNES Zelda and Secret of Mana series. The client and server code is Open Source and the media content has mixed licensing. It runs in your browser with no download required and in the Google Play Store. It was originally based off the BrowserQuest Game Engine and Asky BrowserQuest extended engine and now uses it own Game Engine that also uses PixiJS for WebGL Graphics, and HTML/JS/CSS for the various game dialogue Screens.

## PLAY FREE IN YOUR BROWSER NO DOWNLOAD REQUIRED:
https://www.landofmana.com/play/index.html

## ANDROID RELEASE ON MOBILES, TABLETS AND SMART TV/BOXES (WITH A GAME CONTROLLER):
https://play.google.com/store/apps/details?id=com.landofmana

https://play.google.com/store/apps/details?id=com.retrorpgonline2

## UPDATES:

## FEATURES:
* The game uses Pixi-JS 3D, and is optimized to work on lower spec GPU's and consume less power.
* Game is online and many people can play on the Server at once.
* A real-time like battle system, power up to deal maximum damage, and avoid enemy attacks by moving away.
* An Inventory system, Equip armor and weapons at level 10 onwards.
* Quest NPC's to take on various quests (will make some more diverse and scripted ones in future).
* NPC Shops to buy various consumables and basic Weapons and Armor.
* Auction House to sell or buy items listed by players.
* Enchant your weapons and armor to make them more powerful.
* Bank system to store items should your inventory get full.
* Change your avatars appearance with paid gems (not yet enabled).
* PvP combat is enabled at level 20 onwards, when you reach that level expect chaos.
* Player stat system that occurs at level 10, distribute the points how you want to make your character more unique.
* Skill system that is still a work in progress.
* A sectional map system that enables larger maps and they will be auto-generated in future.

## INSTRUCTIONS:
* To Move you can can click on the Map, or use the arrow keys.
* To Attack mouse click on the Monster or get within attack range and press Space bar.
* To cycle through targets use keys T to target the closest Character or Y to reverse target.
* Keys 1-4 for Skill Shortcuts.
* Keys 5-8 for Consumables.

## JOYPAD SUPPORT:
* It should have limited support for Game Controllers.
* DPAD - Move Character.
* Down Button to Attack.
* Left Button to Target.
* Top Button to activate Mouse Cursor the use DPAD.
* Right Button to mouse click.
* Hold Shoulder-Left Button then other Button A,B,X,Y to activate Skill shortcut.
* Hold Shoulder-Right Button then other Button A,B,X,Y to activate Consumables.

## HOST YOUR OWN SERVER
Simply git clone this repository.

### For Client:
Copy client directory to a http Server in the root directory, then to access in your browser enter http://localhost/client, for example.
If you need to change the Servers address, in client/config/config_build.js, then enter the IP address or hostname of your server and modify as needed.
If you change the IP address you might have to edit the CORS header in the client/index.html file to allow it to communicate with the server.

## Linux Instructions for Servers:
### For Setup User Server:
```
sudo apt-get update
sudo apt-get install redis-server
```
Linux - see: https://www.dragonflydb.io/faq/how-to-start-redis-server

### Run User Server:
```
sudo apt-get update
sudo apt-get install tmux
./userserver-linux.sh
```
Debug mode:
```
./userserver-inspect-linux.sh
```
To kill userserver enter in:
```
tmux kill-session -t rro2-user
```
### Run Game Server:
```
sudo apt-get update
sudo apt-get install tmux
./gameserver-linux.sh
```
Debug mode:
```
./gameserver-inspect-linux.sh
```
To kill gameserver enter in:
```
tmux kill-session -t rro2-game
```


## Windows Instructions for Servers:
Windows - For as a windows redis-server server download here: https://redis.io/download/

### Run User Server:
run userserver-win.bat

For debug mode run userserver-inspect-win.bat

If you need to exit the server do not close the window, switch to it then press Ctrl+C to exit cleanly so it saves to redis.

### Run Game Server:
run gameserver-win.bat

For debug mode run gameserver-inspect-win.bat

If you need to exit the server do not close the window, switch to it then press Ctrl+C to exit cleanly so it saves to redis.


## Terms and Conditions:
This software is provided as is, is a compiled and covered under MPL V2.0 and is copyright code and content to there respective owners.
You may not profit off the software without permission of the original authors, and content creators.
You may re-distribute the software unmodified, and the assets contained are copyright the original authors.

For more details see:
https://www.mozilla.org/en-US/MPL/2.0/

## FUNDING
* If you have a spare few dollars I would appreciate the help to cover server costs, and to able to afford more game content assets.
https://www.paypal.com/paypalme/Langerz82

## COMMENTS:
* Game is in Alpha Stage.
* This does not reflect the final product and features will be added later on.
* Game Server wipes will only occur if there is significant disruption to Character data or the in-game economy due to exploits.
* Gems that are purchased will be logged and will always be added despite any data wipes.

## LINKS:
* DISCORD:
https://discord.gg/NYV9aJtyK8

## CREDITS:
Copyright Joshua Langley 2023 - Head Developer and Game Designer https://github.com/Langerz82 .

* Initial Game Engine - Browser Quest by Little Workshop
Code is licensed under MPL 2.0. Content is licensed under CC-BY-SA 3.0.
Franck Lecollinet - @whatthefranck
Guillaume Lecollinet - @glecollinet
https://github.com/mozilla/BrowserQuest

* Substantial modifications in this version (Browserquest) by Asky:
Code is licensed under MPL 2.0. Content is licensed under CC-BY-SA 3.0.
RedPain: yootiong@hanmail.net
Heyyo: kinora@gmail.com
https://github.com/browserquest/BrowserQuest-Asky

* PIXIJS - a rendering system that uses WebGL (or optionally Canvas) to display images and other 2D visual content.
This content is released under the (http://opensource.org/licenses/MIT) MIT License.
Copyright (c) 2013-2023 Mathew Groves, Chad Engler
https://github.com/pixijs/pixijs

* All the Node-JS Developers.

Additional Credits:
* Flavius Poenaru, https://github.com/Veradictus

### Game Resources:
* Sprites and game sounds, and some Content is licensed under CC-BY-SA 3.0, others like the resources below are copyright their respective owners.
* Sprites - Time Fantasy: https://finalbossblues.com/timefantasy/contact/
* Skill Icons, Rexard - [Unreal Engine Marketplace ](https://www.unrealengine.com/marketplace/en-US/profile/REXARD)
* Weapon & Armor Icons: Medievalmore https://cartoonsmart.com/profile/?ID=9323
* Craft Icons: BizmasterStudios https://opengameart.org/users/bizmasterstudios
* Menu Icons: Raven Fantasy https://clockworkraven.itch.io/raven-fantasy-pixel-art-rpg-icons-starter-pack
* [Message icons created by Freepik - Flaticon](https://www.flaticon.com/free-icons/message)

To compile client run:
```
cd client
npm run build
npm run css
```
To compile Game Server run:
```
cd gameserver
npm run build
```
To compile User Server run:
```
cd userserver
npm run build
```

If you want to modify or extend on any code you can, I'm releasing only the code under GPL. The resources (sprites/images/fonts/audio) have various copyrights and are subject to the condition respective of the original authors. So you may need pay for licensing any content see at bottom for details if you wish to release the same content in a game.


If anything needs changing let me know.
