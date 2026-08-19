// Converted from AMD (define) + Class.extend to a native ES6 module/class.
/* global Types, Utils */
import Dialog from './dialog.js';
import TabPage from '../tabpage.js';

class StatPage extends TabPage {
    constructor(parent) {
        super(parent, '#frameStatsPage'); // FIX (conversion): this._super(parent, '#frameStatsPage') -> super(parent, '#frameStatsPage')
        this.parent = parent;
        const self = this;

        this.jqCharAddAttack = $('#charAddAttack');
        this.jqCharAddDefense = $('#charAddDefense');
        this.jqCharAddHealth = $('#charAddHealth');
        this.jqCharAddLuck = $('#charAddLuck');

        this.jqCharacterPoints = $('#characterPoints');
        this.jqCharacterAttack = $('#characterAttack');
        this.jqCharacterDefense = $('#characterDefense');
        this.jqCharacterHealth = $('#characterHealth');
        this.jqCharacterEnergy = $('#characterEnergy');
        this.jqCharacterLuck = $('#characterLuck');
        this.jqCharacterBaseCrit = $('#characterBaseCrit');
        this.jqCharacterBaseCritDef = $('#characterBaseCritDef');
        this.jqCharacterBaseDamage = $('#characterBaseDamage');
        this.jqCharacterBaseDamageDef = $('#characterBaseDamageDef');

        this.jqCharacterName = $('#characterName');
        this.jqCharacterLevelSword = $('#characterLevelSword');
        this.jqCharacterLevelBow = $('#characterLevelBow');
        this.jqCharacterLevelHammer = $('#characterLevelHammer');
        this.jqCharacterLevelAxe = $('#characterLevelAxe');
        this.jqCharacterLevelLogging = $('#characterLevelLogging');
        this.jqCharacterLevelMining = $('#characterLevelMining');
        this.jqCharacterLevel = $('#characterLevel');
        this.jqCharacterAttackLevel = $('#characterAttackLevel');
        this.jqCharacterDefenseLevel = $('#characterDefenseLevel');

        this.jqCharAddAttack.click(function (e) {
            game.client.sendAddStat(1, 1);
            self.refreshStats();
        });
        this.jqCharAddDefense.click(function (e) {
            game.client.sendAddStat(2, 1);
            self.refreshStats();
        });
        this.jqCharAddHealth.click(function (e) {
            game.client.sendAddStat(3, 1);
            self.refreshStats();
        });
        /*$('#charAddEnergy').click(function(e) {
            	game.client.sendAddStat(4, 1);
              self.refreshStats();
            });*/
        this.jqCharAddLuck.click(function (e) {
            game.client.sendAddStat(4, 1);
            self.refreshStats();
        });
    }

    refreshStats() {
        const p = game.player;
        const stats = game.player.stats;
        this.jqCharacterPoints.text('Free Points:\t\t' + stats.free);
        this.jqCharacterAttack.text('Attack:\t\t' + stats.attack);
        this.jqCharacterDefense.text('Defense:\t\t' + stats.defense);
        this.jqCharacterHealth.text('Health:\t\t' + stats.health);
        this.jqCharacterEnergy.text('Energy:\t\t' + stats.energy);
        this.jqCharacterLuck.text('Luck:\t\t' + stats.luck);

        this.jqCharacterBaseCrit.text(
            'Base Crit\t\t' + p.combat.baseCrit()
        );
        this.jqCharacterBaseCritDef.text(
            'Base Crit Def\t\t' + p.combat.baseCritDef()
        );
        this.jqCharacterBaseDamage.html(
            'Base Damage<br/>' +
                p.combat.baseDamage()[0] +
                '-' +
                p.combat.baseDamage()[1]
        );
        this.jqCharacterBaseDamageDef.html(
            'Base Damage Def<br/>' +
                p.combat.baseDamageDef()[0] +
                '-' +
                p.combat.baseDamageDef()[1]
        );

        if (stats.free > 0) {
            this.jqCharAddAttack.css('display', 'inline-block');
            this.jqCharAddDefense.css('display', 'inline-block');
            this.jqCharAddHealth.css('display', 'inline-block');
            // FIX: #charAddEnergy's click handler is commented out above
            // (energy-point allocation is disabled -- gamepad.js also has
            // this button excluded from its stat-button list), but this
            // still showed the button, so clicking it silently did
            // nothing. Stopped showing it to match the rest of the app.
            this.jqCharAddLuck.css('display', 'inline-block');
        }
    }

    assign(data) {
        let weapon, armor, width1, height1, width2, height2, width3, height3;
        const self = this;

        if (game.renderer) {
            if (game.isMobile) {
                this.scale = 1;
            } else {
                this.scale = game.renderer.getUiScaleFactor();
            }
        } else {
            this.scale = 2;
        }

        // FIX: parseInt() was an Array.prototype monkey-patch that has
        // been removed from utils.js; migrated to Utils.ArrayParseInt().
        data = Utils.ArrayParseInt(data);

        const p = game.player;
        p.stats.exp.base = data.shift();
        p.stats.exp.attack = data.shift();
        p.stats.exp.defense = data.shift();
        p.stats.exp.sword = data.shift();
        p.stats.exp.bow = data.shift();
        p.stats.exp.hammer = data.shift();
        p.stats.exp.axe = data.shift();
        p.stats.exp.logging = data.shift();
        p.stats.exp.mining = data.shift();

        this.refreshStats();

        if (game.renderer) {
            if (game.isMobile) {
                this.scale = 1;
            } else {
                this.scale = game.renderer.getUiScaleFactor();
            }
        } else {
            this.scale = 2;
        }

        this.jqCharacterName.text('Name\t\t' + p.name);

        let xp = p.stats.exp.sword || 0;
        let lvl = Types.getWeaponLevel(xp);
        let fnXP = Types.weaponExp;
        let ratio = xp ? (xp - fnXP[lvl - 1]) / (fnXP[lvl] - fnXP[lvl - 1]) : 0;
        let ratioFmt = Utils.Percent(ratio);
        this.jqCharacterLevelSword.text(
            'Sword Level\t\t' + lvl + '\t' + ratioFmt
        );

        xp = p.stats.exp.bow || 0;
        // FIX: lvl was never recomputed for bow, so it kept the sword's level; now recomputed from bow's own xp
        lvl = Types.getWeaponLevel(xp);
        fnXP = Types.weaponExp;
        ratio = xp ? (xp - fnXP[lvl - 1]) / (fnXP[lvl] - fnXP[lvl - 1]) : 0;
        ratioFmt = Utils.Percent(ratio);
        this.jqCharacterLevelBow.text('Bow Level\t\t' + lvl + '\t' + ratioFmt);

        xp = p.stats.exp.hammer || 0;
        // FIX: lvl was never recomputed for hammer, so it kept the bow's level; now recomputed from hammer's own xp
        lvl = Types.getWeaponLevel(xp);
        fnXP = Types.weaponExp;
        ratio = xp ? (xp - fnXP[lvl - 1]) / (fnXP[lvl] - fnXP[lvl - 1]) : 0;
        ratioFmt = Utils.Percent(ratio);
        this.jqCharacterLevelHammer.text(
            'Hammer Level\t\t' + lvl + '\t' + ratioFmt
        );

        xp = p.stats.exp.axe || 0;
        // FIX: lvl was never recomputed for axe, so it kept the hammer's level; now recomputed from axe's own xp
        lvl = Types.getWeaponLevel(xp);
        fnXP = Types.weaponExp;
        ratio = xp ? (xp - fnXP[lvl - 1]) / (fnXP[lvl] - fnXP[lvl - 1]) : 0;
        ratioFmt = Utils.Percent(ratio);
        this.jqCharacterLevelAxe.text(
            'Axe Level\t\t' + lvl + '\t' + ratioFmt + '%'
        );

        xp = p.stats.exp.logging || 0;
        lvl = Types.getSkillLevel(xp);
        fnXP = Types.skillExp;
        ratio = xp ? (xp - fnXP[lvl - 1]) / (fnXP[lvl] - fnXP[lvl - 1]) : 0;
        ratioFmt = Utils.Percent(ratio);
        this.jqCharacterLevelLogging.text(
            'Logging Level\t\t' + lvl + '\t' + ratioFmt
        );

        xp = p.stats.exp.mining || 0;
        lvl = Types.getSkillLevel(xp);
        fnXP = Types.skillExp;
        ratio = xp ? (xp - fnXP[lvl - 1]) / (fnXP[lvl] - fnXP[lvl - 1]) : 0;
        ratioFmt = Utils.Percent(ratio);
        this.jqCharacterLevelMining.text(
            'Mining Level\t\t' + lvl + '\t' + ratioFmt
        );

        xp = p.stats.exp.base || 0;
        lvl = Types.getLevel(xp);
        fnXP = Types.expForLevel;
        ratio = xp ? (xp - fnXP[lvl - 1]) / (fnXP[lvl] - fnXP[lvl - 1]) : 0;
        this.jqCharacterLevel.text(
            'Level\t\t' + lvl + '\t' + Utils.Percent(ratio)
        );

        xp = p.stats.exp.attack || 0;
        lvl = Types.getAttackLevel(p.stats.exp.attack);
        fnXP = Types.attackExp;
        ratio = xp ? (xp - fnXP[lvl - 1]) / (fnXP[lvl] - fnXP[lvl - 1]) : 0;
        this.jqCharacterAttackLevel.text(
            'Attack Level\t\t' + lvl + '\t' + Utils.Percent(ratio)
        );

        xp = p.stats.exp.defense || 0;
        lvl = Types.getDefenseLevel(p.stats.exp.defense);
        fnXP = Types.defenseExp;
        ratio = xp ? (xp - fnXP[lvl - 1]) / (fnXP[lvl] - fnXP[lvl - 1]) : 0;
        this.jqCharacterDefenseLevel.text(
            'Defense Level\t\t' + lvl + '\t' + Utils.Percent(ratio)
        );
    }
}

export default class StatDialog extends Dialog {
    constructor() {
        super(null, '#statsDialog'); // FIX (conversion): this._super(null, '#statsDialog') -> super(null, '#statsDialog')

        this.addClose();
        this.page = new StatPage(this);
    }

    show(index, datas) {
        super.show(); // FIX (conversion): this._super() -> super.show()
        this.update();
    }

    update() {
        game.client.sendPlayerInfo();
    }

    /*hide: function() {
            this._super();
        }*/
}
