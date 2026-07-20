import Character from '../entity/character.js';
import Messages from '../message.js';

// Split out of packethandler.js -- CW_SKILL (actually casting a skill),
// plus the small shared helper (_getActiveEffectIds) and post-cast
// notification (handleSkillEffects) that only handleSkill uses.
// CW_SHORTCUT used to live here too, but binding a skill/item to a hotbar
// slot doesn't cast anything -- it's a client-preference write, the same
// category as CW_CONFIG (screen width/height, etc.), so it moved to sit
// next to handleConfig() in packethandler.js's core instead. Same
// constructor(packetHandler) convention as the other split-out handlers.
class SkillActionHandler {
    constructor(packetHandler) {
        this.ph = packetHandler;
        this.player = this.ph.player;
        this.world = this.ph.world;
    }

    handleSkill(message) {
        const skillId = parseInt(message[0]),
            targetId = parseInt(message[1]),
            x = parseInt(message[2]),
            y = parseInt(message[3]),
            p = this.player;

        if (p.isDead)
            return;

        if (skillId < 0 || skillId >= p.skills.length)
            return;

        const skill = p.skills[skillId];

        // Perform the skill.
        let target;
        if (targetId) {
            target = p.map.entities.getEntityById(targetId);
            if (!target)
                return;
            // FIX: any entity id the client has seen (Item, Block, Node,
            // NpcStatic -- not just Player/Mob) is a valid, reachable
            // getEntityById() result, but only Character (Player/Mob)
            // subclasses have the `activeEffects` skill-effect state that
            // effectHandler.cast() below needs for "enemy"/"ally"-targeted
            // skills. Casting at a non-Character id reached
            // effecthandler.js's applyEffect() -> target.activeEffects
            // .indexOf(...) and threw -- but only *after* skill.xp(1) had
            // already run and the SkillEffect was already registered in
            // skillEffects with no cleanup path, since the "end" phase that
            // normally deregisters it was never reached. Reject before any
            // of that happens.
            if (!(target instanceof Character))
                return;

            // FIX: unlike handleHitEntity() (the plain-attack path, in
            // combathandler.js, which gates on sEntity.canReach(tEntity)
            // before doing anything), this had no distance check at all --
            // a client could send CW_SKILL with any entity id it had ever
            // seen on the map and get full skill damage/heal/effects
            // applied instantly, regardless of actual distance from the
            // caster. That's a map-wide ranged-attack/heal hack, and it
            // also let skill.xp(1) (below) be farmed for free from a safe
            // distance. Reuse the same canReach() range gate the base
            // attack path already trusts -- it's keyed off the caster's own
            // attackRange, so melee and ranged characters are still bound
            // by whatever range rules already apply to their normal
            // attacks.
            if (!p.canReach(target))
                return;
        }

        // Make sure the skill is ready.
        if (!skill.isReady())
            return;

        p.effectHandler.cast(skillId, target, x, y);

        this.handleSkillEffects(p, target);
    }

    // SIMPLIFY: this used to build the "which effect ids are currently
    // active" list twice with copy-pasted loops (once for source, once for
    // target). Factored the loop out; behavior unchanged.
    _getActiveEffectIds(entity) {
        const effects = [];
        for (const [k, v] of Object.entries(entity.effects)) {
            if (v === 1)
                effects.push(parseInt(k));
        }
        return effects;
    }

    handleSkillEffects(source, target)
    {
        if (!source.effects)
            return;

        this.ph.sendToPlayer(source, new Messages.SkillEffects(source, this._getActiveEffectIds(source)));

        if (!target) return;

        this.ph.sendToPlayer(source, new Messages.SkillEffects(target, this._getActiveEffectIds(target)));
    }
}

export default SkillActionHandler;
