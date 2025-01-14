# Land of Mana - Beta.
formerly Retro RPG Online 2/Rogue Quest

## PLAY FOR FREE NOW IN YOUR BROWSER NO DOWNLOAD REQUIRED:
https://www.landofmana.com/play/index.html

## ANDROID RELEASE ON MOBILES, TABLETS AND SMART TV/BOXES (WITH A GAME CONTROLLER):
https://play.google.com/store/apps/details?id=com.landofmana

## UPDATES:
### 20/12/2024
This project now uses a seperate User Server and Game Server thats in the experimental folder. Completed Quests may have reset for players but other than that everything should work ok. If there are issues please let me know, cheers.

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

### For Setup User Server:
#### Linux:
```
sudo apt-get update
sudo apt-get install redis-server
```
Linux - see: https://www.dragonflydb.io/faq/how-to-start-redis-server
#### Windows:
Windows - For as a windows redis-server server download here: https://redis.io/download/

### Run User Server:
#### Linux:
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

#### Windows:
run userserver-win.bat
For debug mode run userserver-inspect-win.bat

### Run Game Server:
#### Linux:
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


#### Windows:
run gameserver-win.bat
For debug mode run gameserver-inspect-win.bat

### Terms and Conditions:
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

## Old Version History

### 25/11/2024
I am still working on this code. If you like this game give the project a Star/Like. Haha!!

### 18/07/2024 - NOTICE
I have provided the source to the Client and Server, see the js directory in client and server.

### 24/04/2024 - NOTICE
I will be no longer working on this project. I've come to the realisation that in order for this project to grow, I need more content and variety. Coding a game like this in a browser has several technical challenges and resource costs which I simply cannot afford being a solo developer. Compiled Client and Server code will be kept up here. The Live Server will run for as long as I can keep it up for without running extra costs but any new releases will most likely not occur.

### 19/04/2024 - v0.90.01
Mainly code restructuring, some minor fixes.
Any bugs or issues or even just suggestions please open a issue. https://github.com/Langerz82/roguequest/issues

### 13/04/2024 - v0.89.04
Various stability fixes and code re-structure.

### 13/03/2024
You can now remove your user account. Beware it will remove all your players as well as the account PERMANENTLY from the Data Store.

### 11/03/2024
Achievements had to be reset as they were not working properly on the server. The data structure also changed. Any bugs with the new format let me know, thanks.

### 10/03/2024
Minor update to the targetting and movement.

### 05/03/2024 - Version 0.88
Various fixes and code restructuring. Any bugs or issues or even just suggestions please open a issue.
https://github.com/Langerz82/roguequest/issues

### 06/12/2023
The version uploaded to this repository is v87, which is a new test version. The test server is still at the previous version 86. I will update the Game Server to the same version when I have tested the version more. Thanks.

### 22/11/2023
Unfortunately there were major errors when saving Players. For this reason I had to wipe the Server data. Old accounts will need to be re-created and Players will have to start from new again. My sincere apologies however this was a necessary step as the data save process corrupted accounts and did not let the users in again once created. Thanks for understanding.

Note - Report any bugs to the issue tracker here: https://github.com/Langerz82/roguequest/issues

![alt text](https://github.com/Langerz82/roguequest/blob/main/rro2-promo.png?raw=true)

### 11/11/2023
Items and Quests may have been wiped for current accounts. This was needed as they save in a new format. Having it done now will make the saving backend faster, thanks for your understanding.

### 09/11/2023 Version 0.85 Released.
* Initial Craft System Added. You can now craft armors, weapons and gather nodes will come later on.
* Archer and Fighter class merged. You can switch by equipping a ranged weapon or melee weapon.
* Weapon Types Levelling now introduced in addition to specific weapon sepcializations.
* Various Armor slots now introduced instead of just one.
* Various code re-factoring and bug fixes.

### 23/10/2023 Version 0.74 Released.
* Fixed a bunch of stability and gameplay bugs without hopefully creating new ones.
* Achievements feature added.
* Preliminary party system added. To create a party in chat enter /party [username], /leader [username], and you can leave the party in the menu >> social window.
* Also improved some of the loading system, so it downloads and loads faster. For older users on Chrome press Ctrl+F5 to reload the cache.

### 18/09/2023 - New Version. 
Various changes to re-factor of code, please report all bugs in Github issues, thanks.

### 07/09/2023 - New version released. 
To play the latest version in chrome for existing users please press CTRL+F5 to reload the cache.
If that does not work, click on chrome://settings/privacy, and select Clear Browsing Data, then tick ONLY Cached images and files then select Clear Data.

If anything needs changing let me know.



