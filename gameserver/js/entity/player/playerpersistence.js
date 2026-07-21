import Utils from '../../utils.js';
import { Types } from '../../common.js';
import SkillData from '../../data/skilldata.js';

// Split out of entity/player.js -- restoring a Player from the
// database-shaped `db_player` payload (map/position, sprites, exp, gold,
// stat-total validation, quest-log sanitization, skills, shortcuts) was
// almost a third of that file by itself, and every one of these steps is
// only ever called from fillPlayerInfo() below -- nothing external reaches
// _load*/_initDerivedStats directly (confirmed: zero external callers of
// any of them). fillPlayerInfo() itself does have one external caller
// (userhandler.js), so player.js keeps that one as a thin delegate; nothing
// else needed to change. Same constructor(entity) convention as the other
// entity/components/*.js files.
class PlayerPersistence {
    constructor(entity) {
        this.entity = entity;
    }

    _loadMapState(db_player) {
        const entity = this.entity;
        entity.mapIndex = parseInt(db_player.map[0]);
        entity.map = entity.world.maps[entity.mapIndex];
        entity.x = parseInt(db_player.map[1]);
        entity.y = parseInt(db_player.map[2]);
        entity.orientation = parseInt(db_player.map[3]);
    }

    _loadSprites(db_player) {
        const entity = this.entity;
        if (db_player.sprites.length === 2) {
            db_player.sprites[2] = 151;
            db_player.sprites[3] = 50;
        }
        // FIX: parseInt() was an Array.prototype monkey-patch; migrated to
        // Utils.ArrayParseInt() (see utils.js).
        entity.sprites = Utils.ArrayParseInt(db_player.sprites);
        entity.colors = db_player.colors;
    }

    _loadExp(db_player) {
        const entity = this.entity;
        entity.stats.exp.base = parseInt(db_player.exps[0]);
        entity.stats.exp.attack = parseInt(db_player.exps[1]);
        entity.stats.exp.defense = parseInt(db_player.exps[2]);
        entity.stats.exp.move = parseInt(db_player.exps[3]);
        if (db_player.exps.length >= 8) {
            entity.stats.exp.sword = parseInt(db_player.exps[4]);
            entity.stats.exp.bow = parseInt(db_player.exps[5]);
            entity.stats.exp.hammer = parseInt(db_player.exps[6]);
            entity.stats.exp.axe = parseInt(db_player.exps[7]);
        } else {
            entity.stats.exp.sword = 0;
            entity.stats.exp.bow = 0;
            entity.stats.exp.hammer = 0;
            entity.stats.exp.axe = 0;
        }
        if (db_player.exps.length === 10) {
            entity.stats.exp.logging = parseInt(db_player.exps[8]);
            entity.stats.exp.mining = parseInt(db_player.exps[9]);
        } else {
            entity.stats.exp.logging = 0;
            entity.stats.exp.mining = 0;
        }

        entity.level = Types.getLevel(entity.stats.exp.base);
    }

    _loadGold(db_player) {
        const entity = this.entity;
        // REFACTOR: db_player.gold[0]/[1] are already real numbers now --
        // userserver sends gold as a real [gold0, gold1] array, not a CSV
        // string (see userhandler.js's handleLoadPlayerInfo()), so this
        // parseInt() is no longer an actual string-to-number parse. Kept
        // (with a radix and `|| 0` fallback, matching how gold_0/gold_1 are
        // guarded everywhere else on the userserver side) as cheap defensive
        // coercion rather than trusting the wire payload outright.
        entity.items.gold[0] = parseInt(db_player.gold[0], 10) || 0;
        entity.items.gold[1] = parseInt(db_player.gold[1], 10) || 0;
    }

    _loadPStats(db_player) {
        const entity = this.entity;
        // FIX: parseInt() was an Array.prototype monkey-patch; migrated to
        // Utils.ArrayParseInt() (see utils.js).
        entity.pStats = Utils.ArrayParseInt(db_player.pStats);

        db_player.stats = Utils.ArrayParseInt(db_player.stats);

        // Check to make sure stats are correct for level.
        const isValidStats = function (lvl, stats) {
            let total = 0;
            if (lvl < 10) total = lvl * 10;
            else total = 9 * 10 + 5 * (lvl - 9);

            const statTotal = stats.reduce(function (a, b) {
                return a + b;
            }, 0);

            return total === statTotal;
        };

        const lvl = parseInt(entity.level);
        if (!isValidStats(lvl, db_player.stats)) {
            if (lvl < 10) {
                entity.stats.attack = lvl * 2;
                entity.stats.defense = lvl * 2;
                entity.stats.health = lvl * 2;
                entity.stats.energy = lvl * 2;
                entity.stats.luck = lvl * 2;

                entity.stats.free = 0;
            } else {
                entity.stats.attack = 18;
                entity.stats.defense = 18;
                entity.stats.health = 18;
                entity.stats.energy = 18;
                entity.stats.luck = 18;

                entity.stats.free = (lvl - 9) * 5;
            }
        } else {
            entity.stats.attack = db_player.stats[0];
            entity.stats.defense = db_player.stats[1];
            entity.stats.health = db_player.stats[2];
            entity.stats.energy = db_player.stats[3];
            entity.stats.luck = db_player.stats[4];

            entity.stats.free = db_player.stats[5];
        }
    }

    _loadQuests(db_player) {
        const entity = this.entity;
        // if quests old format create empty.
        // if quests new but id not a Number delete.
        // FIX: db_player.completeQuests is `null`/`undefined` for any player
        // whose Redis hash never got a "completeQuests" field written (new
        // characters, or characters that never completed a quest -- see
        // redis.js's loadPlayerInfo(), where a missing hash field comes back
        // from hget() as `null`). That fell through to the `else` branch
        // below, which did `self.quests.completeQuests = db_player.completeQuests`
        // unconditionally -- assigning `null`/`undefined` straight onto the
        // player instead of defaulting to `{}`. The next save then sent
        // JSON.stringify(null) === "null" as the completeQuests field, which
        // userserver/js/format.js correctly rejects ("complete quests is not
        // an object"), and userserver/js/worldhandler.js's listener responds
        // to any format-check failure by closing the whole gameserver<->
        // userserver connection (self.connection.close(...)) -- not just
        // dropping that one save -- which is why a single player with an
        // uninitialized quest log could disconnect the entire gameserver.
        if (
            Array.isArray(db_player.completeQuests) ||
            db_player.completeQuests == null
        ) {
            entity.quests.completeQuests = {};
        } else {
            for (const id in db_player.completeQuests) {
                if (!Number(id)) delete db_player.completeQuests[id];
            }
            entity.quests.completeQuests = db_player.completeQuests;
        }
    }

    _initDerivedStats() {
        const entity = this.entity;
        entity.setHpMax();
        entity.setEpMax();

        entity.resetBars();
        entity.setMoveRate(500);
    }

    _loadSkills(db_player) {
        const entity = this.entity;
        if (db_player.skills.length === 1) {
            for (let i = 0; i < SkillData.Skills.length; ++i)
                db_player.skills[i] = 0;
        }
        entity.skillHandler.setSkills(entity, db_player.skills);
    }

    _loadShortcuts(db_player) {
        const entity = this.entity;
        // Needs to convert shortcut into optimum data structure while
        // remaining compatibiltity with old structures.
        // FIX: Array.isArray() was called with no argument, which is always
        // false -- so the old array-format shortcuts branch below was dead
        // code, and every account (including old array-format ones) fell
        // through to the object-keyed `else` branch, misreading an array's
        // numeric indices as slot ids. Passing db_player.shortcuts restores
        // the intended format check.
        if (Array.isArray(db_player.shortcuts)) {
            for (const shortcut of db_player.shortcuts) {
                if (shortcut[0] >= 6) continue;

                if (shortcut) entity.shortcuts[shortcut[0]] = shortcut;
            }
        } else {
            for (const sid in db_player.shortcuts) {
                if (sid >= 6) continue;

                const shortcut = db_player.shortcuts[sid];
                if (shortcut) entity.shortcuts[sid] = shortcut;
            }
        }
    }

    // TODO - Fill db_player variable assignments.
    // SIMPLIFY: this used to be a single ~185-line function mixing map/
    // position restore, sprite migration, exp/level parsing, gold parsing,
    // a stat-total validity check, quest-log sanitization, skill loading,
    // and shortcut-format migration in one body. Broken into the named
    // steps above (each keeping its original FIX/NOTE comments) so each
    // concern can be read/tested on its own; call order and behavior are
    // unchanged.
    fillPlayerInfo(db_player) {
        const entity = this.entity;
        this._loadMapState(db_player);
        this._loadSprites(db_player);
        this._loadExp(db_player);
        this._loadGold(db_player);

        entity.isDead = false;

        this._loadPStats(db_player);
        this._loadQuests(db_player);
        this._initDerivedStats();
        this._loadSkills(db_player);
        this._loadShortcuts(db_player);

        entity.attackTimer = Date.now();
    }
}

export default PlayerPersistence;
