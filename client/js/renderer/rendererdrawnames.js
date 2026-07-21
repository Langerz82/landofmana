// Mixin extracted from renderer.js/rendererdraw.js: entity name labels and speech bubbles
// (drawEntityName, removeEntityName, drawBubbles, drawBubble, removeBubble).
// Applied onto Renderer.prototype via install*(...) call in renderer.js; not a standalone class.
import Item from '../entity/item.js';
import ItemLoot from '../data/itemlootdata.js';
import Player from '../entity/player/player.js';
import Mob from '../entity/mob.js';
/* global Types, ItemTypes, G_TILESIZE, PIXI, Container */

export function installRendererDrawNames(proto) {

    proto.drawEntityName = function(entity) {
        let color = '#FFFFFF';
        let name = "";

        if(entity instanceof Player && entity.isMoving && !entity.isDead) {
            color = (entity.id === this.game.playerId ? "#ffff00" : (entity.admin ? "#ff0000" : "#fcda5c"));

            name = entity.name;
        }
        else if(entity instanceof Mob) {
            const mobLvl = entity.level;
            let playerLvl;

            color = "#FFFF00";
            if (entity.data.isAggressive)
              color = "#FF3333";

            name = "Level "+entity.level;
        }
        else if(entity.type === Types.EntityTypes.NPCSTATIC) {
            color = "#FFFFFF";
            name = entity.name;
        }
        else if(entity.type === Types.EntityTypes.NPCMOVE) {
            color = "#00FFFF";
            name = entity.name;
        }
    		else if(entity instanceof Item) {
    			const item = entity;
          if (ItemTypes.isEquipment(item.kind)) {
            name = ItemTypes.getLevelByKind(item.kind) + '+' + item.count;
          }
          else if (ItemTypes.isLootItem(item.kind)) {
            if (item.count > 1)
              name = item.count + "x ";
            name += ItemLoot[item.kind - 1000].name;
          }
    			else if(ItemTypes.isConsumableItem(item.kind) || ItemTypes.isCraftItem(item.kind)) {
    			    if (item.count > 1)
    				      name = item.count + "x ";
              name += ItemTypes.KindData[item.kind].name;
    			}
    			else {
    			    name = ItemTypes.KindData[item.kind].modifier + '+' + item.count;
    			}
    		}
        const s = this.gameScale;
        const eo = this.getEntityOffset();
        // FIX: was building "en_"+entity.id twice (once to read, once to write below) - compute
        // once and reuse. (Left the cross-method duplication where removeEntityName() etc.
        // rebuild the same key from an id elsewhere as-is - fixing that would mean changing
        // those methods' signatures to take the entity object everywhere they're called, for a
        // marginal gain over a cheap string concat; not worth the call-site churn/risk.)
        const spriteKey = "en_"+entity.id;
        let sprite = this.pxSprite[spriteKey];

        const ts = this.tilesize;
        const x = (entity.x + eo[0]) * s;
        const y = (entity.y + eo[1] - ts) * s;

        if (!sprite)
        {
          const style = new PIXI.TextStyle({
            fontFamily: "KomikaHand",
            fill: color,
            fontSize: 5 * this.scale,
            align: "center",
            strokeThickness: 4,
          });
          sprite = new PIXI.Text(name, style);
          sprite.anchor.set(0.5, 0.5);
          sprite.interactive  = false;
          sprite.interactiveChildren = false;

          Container.HUD.addChild(sprite);
          this.pxSprite[spriteKey] = sprite;
        }
        sprite.text = name; // FIX: .text was never reassigned after creation, so name/stack-count changes never rendered (see drawDebugInfo/drawCombatInfo pattern)
        sprite.visible = true;
        sprite.zIndex = (entity.y*(this.camera.gridW*ts)+entity.x);
        sprite.x = x;
        sprite.y = y;
    };

    proto.removeEntityName = function(entityId)
    {
      this.removeSprite(Container.HUD, "en_"+entityId);
    };

    proto.drawBubbles = function() {
      Object.values(game.bubbleManager.bubbles).forEach((bubble) => this.drawBubble(bubble));
    };

    proto.drawBubble = function(bubble) {
      const eo = this.getEntityOffset();
      const ts = G_TILESIZE;
      const c = game.camera;
      const s = this.scale;
      const id = "bub_"+bubble.id;
      let sprite = this.pxSprite[id];
      let x = (bubble.entity.x + eo[0]) * s;
      let y = (bubble.entity.y + eo[1]) * s;
      if (!sprite)
      {
        const gfx = new PIXI.Graphics();
        gfx.beginFill(0xffffff);
        gfx.lineStyle(2, 0x000000);

        let tw = Math.min(bubble.content.length*12*s,80*s);
        const style = new PIXI.TextStyle({
          fontFamily: "KomikaHand",
          fill: 0x000000,
          fontSize: 5 * this.scale,
          align: "center",
          wordWrap: true,
          wordWrapWidth: ~~(tw*1.3),
          fontWeight: 900,
          strokeThickness: 0,
        });

        const txt = new PIXI.Text(bubble.content, style);

        x = (bubble.entity.x + eo[0] - ts/2) * s;
        y = (bubble.entity.y + eo[1] - tw/2) * s;

        const th = ~~(txt.height * 1.25);
        tw = ~~(tw * 0.75);

        gfx.drawEllipse(x, y, tw, th);
        gfx.endFill();

        // Draw speech triangle.
        gfx.beginFill(0xffffff);
        gfx.moveTo(x, y+th*1.5);
        gfx.lineTo(x-ts/3, y+th);
        gfx.lineTo(x+ts/3, y+th);
        gfx.lineTo(x, y+th*1.5);
        gfx.endFill();

        // Hack cover speech triangle and ellipse join.
        gfx.lineStyle(2, 0xffffff);
        gfx.moveTo(x-ts/3, y+th);
        gfx.lineTo(x+ts/3, y+th);

        const texture = this.renderer.generateTexture(gfx);

        sprite = new PIXI.Sprite(texture);
        sprite.cullable = true;
        sprite.anchor.set(0.5,0.5);
        sprite.alpha = 0.85;


        txt.anchor.set(0.5,0.35);
        txt.position.y = -(th/2);

        sprite.addChild(txt);
        Container.HUD.addChild(sprite);
        this.pxSprite[id] = sprite;

      }

      sprite.anchor.set(0.5, 0.5);
      const os = (ts/2*s);
      x -= os;
      y -= sprite.height/2 + (os*2);
      sprite.x = x;
      sprite.y = y;
    };

    proto.removeBubble = function(bubble) {
      const sprite = this.pxSprite["bub_"+bubble.id];
      Container.HUD.removeChild(sprite);
      this.pxSprite["bub_"+bubble.id] = null;
    };

}
