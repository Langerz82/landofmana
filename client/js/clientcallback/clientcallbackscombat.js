// Mixin extracted from clientcallbacks.js: Combat/stats: damage, level-up (player/attack/item), stat changes, health-change bookkeeping and floating damage numbers.
// Applied onto ClientCallbacks.prototype via install*(...) call in clientcallbacks.js; not a standalone class.
import HoveringInfo from '../hoveringinfo.js';
import Player from '../entity/player.js';
/* global Types, Utils, log, game */

export function installClientCallbacksCombat(proto) {

      proto.onCharacterDamage = function(data) {
            // FIX: `data.parseInt();` called the old Array.prototype.parseInt
            // monkey-patch (since removed) without capturing its return value
            // -- it was a no-op even when the method existed, since every
            // field below is already explicitly wrapped in Number(). Removed
            // rather than converted to Utils.ArrayParseInt(), since keeping a
            // discarded-result call around is just dead code.
            const sEntity = game.getEntityById(Number(data[0])),
                tEntity = game.getEntityById(Number(data[1])),
                orientation = Number(data[2]),
                hpMod = Number(data[3]),
                hp = Number(data[4]),
                hpMax = Number(data[5]),
                epMod = Number(data[6]),
                ep = Number(data[7]),
                epMax = Number(data[8]),
                crit = (data[9] === 1);

            if (!sEntity || !tEntity)
              return;

            this.client.change_points_callback([tEntity.id,hp,hpMax,hpMod,ep,epMax,epMod,crit]);

            if(hpMod < 0) {
                if (sEntity !== game.player) {
                  sEntity.hit(orientation);
                }
            }

            if (game.player === sEntity) // sanity
            {
              sEntity.attackTime = game.currentTime;
            }
      };


      proto.onPlayerStat = function(data) {
            const statType = data[0];
            const statValue = Number(data[1]);
            const statChange = Number(data[2]);
            const p = game.player;

            Utils.setValueByPath(p.stats, statType, statValue);
            if (statType === "exp.base") // exp.base
            {
              p.level = Types.getLevel(statValue)
              if (statChange > 0) {
                game.infoManager.addDamageInfo("+"+statChange+" exp", p.x, p.y, "experience", 3000);
              }
              game.updateExpBar();
            }
      };


      proto.onPlayerLevelUp = function(data) {
          const type = data[0];
          const level = Number(data[1]);
          const exp = Number(data[2]);
          const p = game.player;

          const scale = game.renderer.scale;
          let x=p.x, y=p.y, id=p.id;
          if (type==="base" && p.level !== level) {
              id="lu"+id+"_"+level;
              const info = new HoveringInfo(id, "Level "+level, x, y, 5000, 'levelUp');
              game.infoManager.addInfo(info);
              p.level = level;
              return;
          }
          else if (type==="attack") {
            const curLevel = Types.getAttackLevel(p.stats.exp.attack);
            if (curLevel !== level) {
              id="lau"+id+"_"+level;
              const info = new HoveringInfo(id, "Attack Level "+level, x, y, 3500, 'minorLevelUp');
              game.infoManager.addInfo(info);
            }
          }
          else if (type==="defense") {
            const curLevel = Types.getDefenseLevel(p.stats.exp.defense);
            if (curLevel !== level) {
              id="ldu"+id+"_"+level;
              const info = new HoveringInfo(id, "Defense Level "+level, x, y, 3500, 'minorLevelUp');
              game.infoManager.addInfo(info);
            }
          }
          else if (p.stats.exp.hasOwnProperty(type)) {
            const curLevel = Types.getWeaponLevel(p.stats.exp[type]);
            if (curLevel !== level) {
              id="wu"+id+"_"+level;
              const info = new HoveringInfo(id, type+" Level "+level, x, y, 3500, 'minorLevelUp');
              game.infoManager.addInfo(info);
            }
            p.stats.exp[type] = exp
          }
      };


      proto.onPlayerItemLevelUp = function(data) {
          const type = Number(data[0]);
          const level = Number(data[1]);
          const exp = Number(data[2]);

          let x=game.player.x, y=game.player.y, id=game.player.id;
          if (type === 0)
          {
            id="laru"+id+"_"+level;
            const info = new HoveringInfo(id, "Armor Level "+level, x, y, 3500, 'minorLevelUp');
            game.infoManager.addInfo(info);
          }
          else if (type === 1)
          {
            id="lweu"+id+"_"+level;
            const info = new HoveringInfo(id, "Weapon Level "+level, x, y, 3500, 'minorLevelUp');
            game.infoManager.addInfo(info);
          }
      };


      proto.onStatInfo = function(data) {
          const stats = {
            attack: Number(data[0]),
            defense: Number(data[1]),
            health: Number(data[2]),
            energy: Number(data[3]),
            luck: Number(data[4]),
            free: Number(data[5]),
            hp: Number(data[6]),
            hpMax: Number(data[7]),
            ep: Number(data[8]),
            epMax: Number(data[9])
          };

          Object.assign(game.player.stats, stats);
          game.statDialog.update();
          game.updateBars();
      };


      // FIX (maintainability): was a shared inner closure (`const onPlayerChangeHealth =
      // function(player, points, crit) {...}`) only reachable from the onCharacterChangePoints
      // handler below; moved to a method and renamed from `onPlayerChangeHealth` to
      // `applyPlayerHealthChange` to avoid reading like a registered server-message handler -
      // every other `onXxx` method in this class is one, and this isn't. Body unchanged.
      proto.applyPlayerHealthChange = function(player, points, crit) {
            let isRegen = false;
            if (points > 0)
              isRegen = true;

            if (!player || !(player instanceof Player) || player.isDead)
              return;

            const isHurt = (points <= player.stats.hp);
            if(isHurt && game.playerhurt_callback) {
                game.playerhurt_callback();
            }

            game.updateBars();
      };


      // FIX (maintainability): was a shared inner closure only reachable from the
      // onCharacterChangePoints handler below; moved to a method. Body unchanged.
      proto.showDamageInfo = function(entity, points, x, y, crit) {
            if(points === 0) {
              game.infoManager.addDamageInfo("miss", x, y - 15, "health");
              return;
            }

            if(points < 0) {
                if (crit > 0) {
                    game.infoManager.addDamageInfo(-points, x, y - 15, "crit", 1500, crit);
                }
                else {
                  game.infoManager.addDamageInfo(-points, x, y - 15, "inflicted");
                }
                if (game.camera.isVisible(entity))
                  game.audioManager.playSound("hurt");
            } else {
                game.infoManager.addDamageInfo(points, x, y - 15, "healed");
            }
      };


      proto.onCharacterChangePoints = function(data) {
          const id = Number(data[0]);
          const hp = Number(data[1]);
          const hpMax = Number(data[2]);
          let hpMod = Number(data[3]);
          const ep = Number(data[4]);
          const epMax = Number(data[5]);
          const epMod = Number(data[6]);
          const crit = Number(data[7]) || 0;

          if (id <= 0)
            return;

          const entity = game.getEntityById(id);
          if (!entity)
            return;

          this.showDamageInfo(entity, hpMod, entity.x, entity.y, crit);

          if (hpMod > hp)
            hpMod += (hp - hpMod);

          entity.modHp(hpMod);
          entity.modEp(epMod);

          if (entity === game.player)
          {
            if (hpMod !== 0) {
              game.playerhp_callback(hp, hpMax);
              this.applyPlayerHealthChange(entity, hpMod);
            }
            game.updateBars();
          }
          else {
            game.updatetarget_callback(entity);
          }
      };

}
