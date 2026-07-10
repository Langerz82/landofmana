// Converted from AMD (define) + Class.extend to a native ES6 module/class.
import Mob from './entity/mob.js';
import SkillData from './data/skilldata.js';
import Character from './entity/character.js';

/* global Types */

class Skill {
    constructor(skillId) {
      this.level = 0;
      this.slots = [];
      this.skillId = skillId;
      this.data = SkillData.Data[skillId];
    }

    getName() {
      return this.data.name; // FIX: constructor sets this.data, not this.skillData; was always undefined
    }
    getLevel() {
      return this.level;
    }
    setLevel(value) {
      this.level = value;
    }

    clear() {}
    add(slot) {
      this.slots.push(slot);
    }
    remove(slot) {
      const index = this.slots.indexOf(slot);
      if (index >= 0) {
        this.slots.splice(index, 1);
      }
    }
}

//var SkillPassive = Skill.extend({});
class SkillActive extends Skill {
    constructor(skillId) {
      super(skillId); // FIX (conversion): this._super(skillId) -> super(skillId)

      // FIX: was `this.cooltime` (lowercase t) divided by 1000, but execute() reads `this.coolTime` (capital T),
      // which was always undefined, so the cooldown gate never blocked repeated skill use. data.recharge is
      // already stored in ms (see data/skilldata.js), matching how skilldialog.js's Skill class uses it directly
      // against Date.now() diffs, so the /1000 conversion was also wrong for this ms-based comparison.
      this.coolTime = this.data.recharge;
    }

    execute() {
      const self = this;
      const player = game.player;

      if (Date.now() - this.cooldownTime < this.coolTime) {
        return false;
      }

      if (this.data.skillType === "attack") {
        player.attackSkill = this;
        //this.activated = false;
        if (!player.attackInterval)
          game.makePlayerInteractNextTo();
        //player.attackSkill = null;
        //if (!this.activated)
          //return false;
        if (this.execute_callback)
          this.execute_callback(self);

      } else if (this.data.skillType === "target") {
        if (player.hasTarget() &&
              player.target instanceof Character) {
          if (this.execute_callback)
            this.execute_callback(self);
          game.client.sendSkill(this.skillId, player.target.id);

        } else {
          game.makePlayerInteractNextTo();
          return false;
        }
      } else if (this.data.skillType === "self") {
        if (this.execute_callback)
          this.execute_callback(self);
        game.client.sendSkill(this.skillId, 0);
      }

      this.cooldownTime = Date.now();
      //log.info("this.name="+this.name);
      player.skillHandler.pushActiveSkill(this);
      return true;
    }
}

const SkillFactory = {
    make: function(index) {
      if (index in SkillFactory.Skills) {
        return new SkillFactory.Skills[index](index);
      } else {
        return null;
      }
    }
};

SkillFactory.Skills = {};
for (var i = 0; i < SkillData.Data.length; ++i) {
    const skillName = SkillData.Data[i].name;
    //log.info("skillName=" + skillName);
    SkillFactory.Skills[i] = SkillActive;
};
log.info("SKillFactory.Skills:" + JSON.stringify(SkillFactory.Skills));

export default class SkillHandler {
    constructor(game) {
      this.game = game;
      this.skills = [];
      this.container = $('#skillcontainer');
      this.activeSkills = [];

      $('#skillsCloseButton').click(function () {
        ShortcutData = null;
      });
    }

    getSkill(skillId) {
      log.info("skillId="+skillId);
      return this.skills.In(skillId) ? this.skills[skillId] : null;
    }

    clear() {
    }

    addAll(skillExps) {
      const sl = skillExps.length; // FIX: missing var, was leaking an implicit global
      for(let i = 0; i < sl; ++i)
      {
        this.add(i, skillExps[i]);
      }
    }

    execute(skillId) {
      return this.skills[skillId].execute();
    }

    add(skillId, exp) {
      //log.info("skillId:" + skillId);
      let skill = null;
      if (skillId in this.skills) {
        skill = this.skills[skillId];
      } else {
        skill = SkillFactory.make(skillId);
        //log.info("skill=" + JSON.stringify(skill));
        if (skill) {
          this.skills[skillId] = skill;
        }
      }
      if (skill) {
        skill.setLevel(Types.getSkillLevel(exp));
      }
      //alert(JSON.stringify(this.skills));
    }

    pushActiveSkill(activeSkill) {
      this.activeSkills.push(activeSkill);
    }
}
