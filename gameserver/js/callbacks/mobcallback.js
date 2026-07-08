import Messages from '../message.js';
import Formulas from '../formulas.js';
import ChestArea from '../area/chestarea.js';
import { mobState } from '../main.js';
import Player from '../entity/player.js';
import { PlayerEvent } from '../world/taskhandler.js';

/* global EventType */

class MobCallback {
    constructor() {
    }

    setCallbacks(entity) {
        entity.onRespawn(function() {
            //this.setFreeze(2000);
            this.respawn();

            //this.map.entities.addMob(this);

            //if (this.area && this.area instanceof ChestArea)
                //mob.area.addToArea(this);
        });

        entity.onStep(function (x, y) {
            return;
        });

        entity.onRequestPath(function(x, y) {
            var ignored = [this];

            if (this.target)
                ignored.push(this.target);

            var path = this.map.entities.findPath(this, x, y, ignored);

            if (path && path.length === 1)
                console.error(this.id + " " + JSON.stringify(path));

            if (path && path.length > 1)
            {
                this.orientation = this.getOrientation([this.x,this.y], path[1]);
                var msg = new Messages.MovePath(this, path);

                this.map.entities.sendNeighbours(this, msg);
                return path;
            }
            return null;
        });

        entity.onStopPathing(function(x, y) {
            //try { throw new Error(); } catch (e) { console.error(e.stack); }
            //console.info("mob.onStopPathing");
            //console.info("mob.aiState:"+this.aiState);
            //console.info("mob.x:"+this.x+",mob.y:"+this.y);
            //console.info("mob.spawnX:"+this.spawnX+",mob.spawnY:"+this.spawnY);
            //console.info("x:"+x+",y:"+y);
            //console.info("onStopPathing - mob.id: "+this.id);

            if (this.aiState === mobState.RETURNING) {
                this.returnedToSpawn();
                //this.returningToSpawn = false;
            }

            if (!this.hasTarget())
                this.setAiState(mobState.IDLE);

            if (this.aiState === mobState.CHASING)
                this.mobAI.checkReturn(this,x,y);
        });

        entity.onStartPathing(function () {
        });

        entity.onAbortPathing(function (path, x, y) {
            //try { throw new Error(); } catch (e) { console.error(e.stack); }
            //console.info("mob.onAbortPathing");
            //console.info("mob.aiState:"+this.aiState);
            //console.info("mob.x:"+this.x+",mob.y:"+this.y);
            //console.info("mob.spawnX:"+this.spawnX+",mob.spawnY:"+this.spawnY);
            //console.info("x:"+x+",y:"+y);
            //console.info("onAbortPathing - mob.id: "+this.id);

            // NOTE: `msg` was a bare (undeclared) assignment in the original
            // CommonJS source, which created an implicit global there; declared
            // with `var` here since ES modules are always strict mode and forbid
            // implicit globals.
            var msg = new Messages.Move(this, this.orientation, 2, this.x, this.y);
            this.map.entities.sendNeighbours(this, msg);

            if (this.aiState === mobState.RETURNING) {
                return;
            }

            if (!this.target)
                this.setAiState(mobState.IDLE);
        });

        entity.onKilled(function (attacker, damage) {
            if (attacker instanceof Player) {
                attacker.skillHandler.setXPs();
                this.world.taskHandler.processEvent(attacker, PlayerEvent(Types.EventType.DAMAGE, this, damage));
            }
        });

        entity.onDeath(function (attacker) {
            if (attacker instanceof Player) {
                this.world.taskHandler.processEvent(attacker, PlayerEvent(Types.EventType.KILLMOB, this, 1));
            }
            this.world.loot.handleDropItem(this, attacker);
        })
    }
}

export default MobCallback;
