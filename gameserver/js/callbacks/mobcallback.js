import Messages from '../message.js';
import { mobState, G_DEBUG } from '../main.js';
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
        });

        entity.onStep(function (x, y) {
            return;
        });

        entity.onRequestPath(function(x, y) {
            const ignored = [this];

            if (this.target)
                ignored.push(this.target);

            const path = this.map.entities.findPath(this, x, y, ignored);

            // PERF: onRequestPath fires on every mob roam/chase/return-to-spawn
            // path request -- a routine, high-frequency event under real combat
            // load (see the PERF comments on mobai.js's checkChase/Roaming for
            // the same call volume). A 1-node path here isn't a true anomaly
            // (findPath() can legitimately resolve to a single point), so this
            // console.error + JSON.stringify ran unconditionally on a path that
            // isn't actually erroring; gated behind G_DEBUG like the equivalent
            // per-event diagnostic logging elsewhere in this codebase.
            if (G_DEBUG && path && path.length === 1)
                console.error(this.id + " " + JSON.stringify(path));

            if (path && path.length > 1)
            {
                this.orientation = this.getOrientation([this.x,this.y], path[1]);
                const msg = new Messages.MovePath(this, path);

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

            // TEMP-DEBUG: see the matching note in mob.js returnToSpawn()/
            // returnedToSpawn(). This fires on every clean path completion,
            // not just RETURNING ones -- filter the log for this mob's id.
            // PERF: onStopPathing runs for every mob that finishes any path
            // (roam, chase, or return-to-spawn) -- a routine, high-frequency
            // event under real combat load across every mob on the map. This
            // ran unconditionally while the matching "RETURNING-DEBUG" logs in
            // mob.js's returnToSpawn()/returnedToSpawn() are already gated
            // behind G_DEBUG; gating this one too for consistency.
            if (G_DEBUG)
                console.info("RETURNING-DEBUG onStopPathing id="+this.id+" aiState="+this.aiState+" x="+x+" y="+y);

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
            const msg = new Messages.Move(this, this.orientation, 2, this.x, this.y);
            this.map.entities.sendNeighbours(this, msg);

            // TEMP-DEBUG: see the matching note in mob.js returnToSpawn()/
            // returnedToSpawn(). If this ever logs with aiState RETURNING,
            // that's proof case 4 (interrupted return path) is actually
            // reachable in live play, not just in theory.
            // PERF: onAbortPathing runs for every mob whose in-progress path
            // gets interrupted (target moved, blocked, etc.) -- same routine,
            // high-frequency combat event as onStopPathing above. Gated behind
            // G_DEBUG for the same reason.
            if (G_DEBUG)
                console.info("RETURNING-DEBUG onAbortPathing id="+this.id+" aiState="+this.aiState+" x="+x+" y="+y);

            // FIX: this used to just `return` when a RETURNING mob's path
            // got aborted mid-walk (as opposed to completing cleanly, which
            // is handled by onStopPathing above via returnedToSpawn()).
            // Since aiState never got reset, the mob stayed stuck in
            // RETURNING forever: mobai.js's update loop unconditionally
            // skips RETURNING mobs (no more AI ticks), and
            // packethandler.js's handleHitEntity unconditionally blocks
            // attacks on RETURNING targets -- so an aborted return-to-spawn
            // path permanently bricked the mob: frozen in place, invincible,
            // and silently unattackable. Routing this through
            // returnedToSpawn() (same as the clean-completion path) resets
            // its position/behaviour/state instead of leaving it stranded.
            if (this.aiState === mobState.RETURNING) {
                this.returnedToSpawn();
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
