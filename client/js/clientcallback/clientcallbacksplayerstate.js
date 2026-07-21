// Mixin extracted from clientcallbacks.js: initial player-state deserialization from the
// server (onPlayerInfo, onPlayer -- the big handshake that populates stats/inventory/
// bank/quests/achievements/skills/shortcuts on login or reconnect).
// Applied onto ClientCallbacks.prototype via install*(...) call in clientcallbacks.js; not a standalone class.
import { ItemRoom } from '../entity/item.js';
import AppearanceData from '../data/appearancedata.js';
import Quest from '../quest.js';
import Achievement from '../achievement.js';
import SkillHandler from '../skillhandler.js';
/* global Types, Utils, game */

export function installClientCallbacksPlayerState(proto) {

      proto.onPlayerInfo = function(data) {
          game.statDialog.page.assign(data);
      };

      proto.onPlayer = function(data) {
            data.shift();
            data.shift();

            const p = game.player;

            p.id = Number(data.shift());
            p.name = data.shift();
            p.mapIndex = Number(data.shift());
            p.orientation = Types.Orientations.DOWN;
            p.x = Number(data.shift()), p.y = Number(data.shift());
            p.setPositionSpawn(p.x, p.y);

            p.setHpMax(Number(data.shift()));
            p.setEpMax(Number(data.shift()));

            p.stats.exp = {
              base: parseInt(data.shift()),
              attack: parseInt(data.shift()),
              defense: parseInt(data.shift()),
              move: parseInt(data.shift()),
              sword: parseInt(data.shift()),
              bow: parseInt(data.shift()),
              hammer: parseInt(data.shift()),
              axe: parseInt(data.shift()),
              logging: parseInt(data.shift()),
              mining: parseInt(data.shift())
            };

            p.level = Types.getLevel(p.stats.exp.base);

            p.colors = [];
            p.colors[0] = parseInt(data.shift());
            p.colors[1] = parseInt(data.shift());

            p.gold = [];
            p.gold[0] = parseInt(data.shift()); // inventory gold.
            p.gold[1] = parseInt(data.shift()); // bank gold.
            p.gems = parseInt(data.shift());

            game.inventoryDialog.setCurrency(p.gold[0], p.gems);
            game.bankHandler.setGold(p.gold[1]);

            p.setMoveRate(500);

            p.stats.attack = parseInt(data.shift());
            p.stats.defense = parseInt(data.shift());
            p.stats.health = parseInt(data.shift());
            p.stats.energy = parseInt(data.shift());
            p.stats.luck = parseInt(data.shift());
            p.stats.free = parseInt(data.shift());

            // TODO fix item inits, and skill functions.
            // FIX (var cleanup): this method reuses `itemCount` as a scratch variable for three
            // separate item lists below (equipment/inventory/bank) via three sequential `var
            // itemCount = ...` redeclarations - legal for var (same function-scoped variable,
            // reassigned each time) but a SyntaxError if all three became `let`/`const` at this
            // same scope level. Declared once here with `let`; the other two occurrences below
            // are now plain reassignments.
            let itemCount = parseInt(data.shift());
            if (itemCount > 0)
            {
              const items = [];
              // FIX: parseInt() was an Array.prototype monkey-patch that has
              // been removed from utils.js; migrated to Utils.ArrayParseInt().
              const itemArray = Utils.ArrayParseInt(data.splice(0,(itemCount*6)));
              for(let i=0; i < itemCount; ++i)
              {
                const index = i*6;
                const itemRoom = new ItemRoom(
                  itemArray[index+0],
                  itemArray[index+1],
                  itemArray[index+2],
                  itemArray[index+3],
                  itemArray[index+4],
                  itemArray[index+5],
                );
                items.push(itemRoom);
              }
              game.equipmentHandler.setEquipment(items);
            }

            const aid = parseInt(data.shift());
            const wid = parseInt(data.shift());

            const aSprite = game.sprites[AppearanceData[aid].sprite];
            const wSprite = game.sprites[AppearanceData[wid].sprite];

            p.setSprite(aSprite, 0);
            p.setSprite(wSprite, 1);

            itemCount = parseInt(data.shift());
            if (itemCount > 0)
            {
              const items = [];
              // FIX: parseInt() was an Array.prototype monkey-patch that has
              // been removed from utils.js; migrated to Utils.ArrayParseInt().
              const itemArray = Utils.ArrayParseInt(data.splice(0,(itemCount*6)));
              for(let i=0; i < itemCount; ++i)
              {
                const index = i*6;
                const itemRoom = new ItemRoom(
                  itemArray[index+0],
                  itemArray[index+1],
                  itemArray[index+2],
                  itemArray[index+3],
                  itemArray[index+4],
                  itemArray[index+5],
                );
                items.push(itemRoom);
              }
              game.inventory.initInventory(items);
            }
            p.setRange();

            itemCount = parseInt(data.shift());
            if (itemCount > 0)
            {
              const items = [];
              // FIX: parseInt() was an Array.prototype monkey-patch that has
              // been removed from utils.js; migrated to Utils.ArrayParseInt().
              const itemArray = Utils.ArrayParseInt(data.splice(0,(itemCount*6)));
              for(let i=0; i < itemCount; ++i)
              {
                  const index = i*6;
                  const itemRoom = new ItemRoom(
                    itemArray[index+0],
                    itemArray[index+1],
                    itemArray[index+2],
                    itemArray[index+3],
                    itemArray[index+4],
                    itemArray[index+5],
                  );
                  items.push(itemRoom);
              }
              game.bankHandler.initBank(items);
            }

            p.quests = {};
            const questCount = parseInt(data.shift());
            if (questCount > 0)
            {
              // FIX: `questArray.parseInt();` called the old
              // Array.prototype.parseInt monkey-patch (since removed)
              // without capturing its return value -- it was a no-op even
              // when the method existed, since Quest.update() (called via
              // `new Quest(...)` below) already runs its own
              // Utils.ArrayParseInt() on the raw slice. Removed rather than
              // converted, since keeping a discarded-result call around is
              // just dead code.
              const questArray = data.splice(0,(questCount*13));
              for(let i=0; i < questCount; ++i)
              {
                const index = i*13;
                p.quests[questArray[index]] = new Quest(questArray.slice(index,index+13));
              }
            }

            p.achievements = [];
            const achieveCount = parseInt(data.shift());
            if (achieveCount > 0)
            {
              // FIX: `achieveArray.parseInt();` called the old
              // Array.prototype.parseInt monkey-patch (since removed)
              // without capturing its return value -- it was a no-op even
              // when the method existed, since Achievement.update() (called
              // via `new Achievement(...)` below) already runs its own
              // Utils.ArrayParseInt() on the raw slice. Removed rather than
              // converted, since keeping a discarded-result call around is
              // just dead code.
              const achieveArray = data.splice(0,(achieveCount*7));
              let achievement = null;
              for(let i=0; i < achieveCount; ++i)
              {
                const index = i*7;
                achievement = new Achievement(achieveArray.slice(index,index+7));
                p.achievements.push(achievement);
              }
              game.achievementHandler.achievementReloadLog();
            }

            // FIX: `self` was never declared in this scope, so it resolved to the global
            // `window.self`, not the intended `game` object - every sibling handler in this
            // file is constructed with `game` directly
            p.skillHandler = new SkillHandler(game);

            const skillCount = parseInt(data.shift());
            // FIX: `skillExps.parseInt();` called the old
            // Array.prototype.parseInt monkey-patch without capturing its
            // return value, so skillExps was never actually converted to
            // numbers (unlike questArray/achieveArray above, nothing
            // downstream re-parses this -- Skill level math in
            // SkillHandler/skilldialog.js just divides these values, which
            // happens to coerce strings fine, but this was clearly meant to
            // parse before use). Fixed to capture the parsed result.
            const skillExps = Utils.ArrayParseInt(data.splice(0,skillCount));
            p.setSkills(skillExps);
            game.skillDialog.page.setSkills(skillExps);


            const shortcutCount = parseInt(data.shift());
            if (shortcutCount > 0)
            {
              // FIX: parseInt() was an Array.prototype monkey-patch that has
              // been removed from utils.js; migrated to Utils.ArrayParseInt().
              let shortcutArray = data.splice(0,(shortcutCount*3));
              shortcutArray = Utils.ArrayParseInt(shortcutArray);
              const shortcuts = [];
              for(let i=0; i < shortcutCount; ++i)
              {
                const index = i*3;
                shortcuts.push(shortcutArray.slice(index,index+3));
              }
              game.shortcuts.installAll(shortcuts);
            }

            game.onPlayerLoad(p);
      };

}
