// Converted from AMD (define) + Class.extend to a native ES6 module/class.
/* global Types, Utils */
import Dialog from './dialog.js';
import TabPage from '../tabpage.js';

class StatPage extends TabPage {
        constructor(parent) {
            super(parent, '#frameStatsPage'); // FIX (conversion): this._super(parent, '#frameStatsPage') -> super(parent, '#frameStatsPage')
            this.parent = parent;
            var self = this;
            $('#charAddAttack').click(function(e) {
            	game.client.sendAddStat(1, 1);
              self.refreshStats();
            });
            $('#charAddDefense').click(function(e) {
            	game.client.sendAddStat(2, 1);
              self.refreshStats();
            });
            $('#charAddHealth').click(function(e) {
            	game.client.sendAddStat(3, 1);
              self.refreshStats();
            });
            /*$('#charAddEnergy').click(function(e) {
            	game.client.sendAddStat(4, 1);
              self.refreshStats();
            });*/
            $('#charAddLuck').click(function(e) {
            	game.client.sendAddStat(4, 1);
              self.refreshStats();
            });
        }

        refreshStats() {
            var p = game.player;
            var stats = game.player.stats;
            $('#characterPoints').text("Free Points:\t\t"+stats.free);
            $('#characterAttack').text("Attack:\t\t"+stats.attack);
            $('#characterDefense').text("Defense:\t\t"+stats.defense);
            $('#characterHealth').text("Health:\t\t"+stats.health);
            $('#characterEnergy').text("Energy:\t\t"+stats.energy);
            $('#characterLuck').text("Luck:\t\t"+stats.luck);

            $('#characterBaseCrit').text("Base Crit\t\t"+p.combat.baseCrit());
            $('#characterBaseCritDef').text("Base Crit Def\t\t"+p.combat.baseCritDef());
            $('#characterBaseDamage').html("Base Damage<br/>"+p.combat.baseDamage()[0]+"-"+p.combat.baseDamage()[1]);
            $('#characterBaseDamageDef').html("Base Damage Def<br/>"+p.combat.baseDamageDef()[0]+"-"+p.combat.baseDamageDef()[1]);

            if (stats.free > 0)
            {
            	$('#charAddAttack').css('display','inline-block');
            	$('#charAddDefense').css('display','inline-block');
            	$('#charAddHealth').css('display','inline-block');
            	$('#charAddEnergy').css('display','inline-block');
            	$('#charAddLuck').css('display','inline-block');
            }
        }

        assign(data) {
            var weapon, armor,
                width1, height1, width2, height2, width3, height3;
            var self = this;

            if (game.renderer) {
                if (game.renderer.mobile) {
                    this.scale = 1;
                } else {
                    this.scale = game.renderer.getUiScaleFactor();
                }
            } else {
                this.scale = 2;
            }

            data = data.parseInt();

            var p = game.player;
            //p.exp = {};
            p.stats.exp.base = data.shift();
            p.stats.exp.attack = data.shift();
            p.stats.exp.defense = data.shift();
            //p.exp.move = data.shift();
            p.stats.exp.sword = data.shift();
            p.stats.exp.bow = data.shift();
            p.stats.exp.hammer = data.shift();
            p.stats.exp.axe = data.shift();
            p.stats.exp.logging = data.shift();
            p.stats.exp.mining = data.shift();

            this.refreshStats();

            if (game.renderer) {
                if (game.renderer.mobile) {
                    this.scale = 1;
                } else {
                    this.scale = game.renderer.getUiScaleFactor();
                }
            } else {
                this.scale = 2;
            }

            $('#characterName').text("Name\t\t"+p.name);

            var xp = p.stats.exp.sword || 0;
            var lvl = Types.getWeaponLevel(xp);
            var fnXP = Types.weaponExp;
            var ratio = (xp) ? (xp - fnXP[lvl-1])/(fnXP[lvl] - fnXP[lvl-1]) : 0;
            var ratioFmt = Utils.Percent(ratio);
            $('#characterLevelSword').text("Sword Level\t\t"+lvl+"\t"+ratioFmt);

            xp = p.stats.exp.bow || 0;
            fnXP = Types.weaponExp;
            ratio = (xp) ? (xp - fnXP[lvl-1])/(fnXP[lvl] - fnXP[lvl-1]) : 0;
            ratioFmt = Utils.Percent(ratio);
            $('#characterLevelBow').text("Bow Level\t\t"+lvl+"\t"+ratioFmt);

            xp = p.stats.exp.hammer || 0;
            fnXP = Types.weaponExp;
            ratio = (xp) ? (xp - fnXP[lvl-1])/(fnXP[lvl] - fnXP[lvl-1]) : 0;
            ratioFmt = Utils.Percent(ratio);
            $('#characterLevelHammer').text("Hammer Level\t\t"+lvl+"\t"+ratioFmt);

            xp = p.stats.exp.axe || 0;
            fnXP = Types.weaponExp;
            ratio = (xp) ? (xp - fnXP[lvl-1])/(fnXP[lvl] - fnXP[lvl-1]) : 0;
            ratioFmt = Utils.Percent(ratio);
            $('#characterLevelAxe').text("Axe Level\t\t"+lvl+"\t"+ratioFmt+"%");

            xp = p.stats.exp.logging || 0;
            lvl = Types.getSkillLevel(xp);
            fnXP = Types.skillExp;
            ratio = (xp) ? (xp - fnXP[lvl-1])/(fnXP[lvl] - fnXP[lvl-1]) : 0;
            ratioFmt = Utils.Percent(ratio);
            $('#characterLevelLogging').text("Logging Level\t\t"+lvl+"\t"+ratioFmt);

            xp = p.stats.exp.mining || 0;
            lvl = Types.getSkillLevel(xp);
            fnXP = Types.skillExp;
            ratio = (xp) ? (xp - fnXP[lvl-1])/(fnXP[lvl] - fnXP[lvl-1]) : 0;
            ratioFmt = Utils.Percent(ratio);
            $('#characterLevelMining').text("Mining Level\t\t"+lvl+"\t"+ratioFmt);

            xp = p.stats.exp.base || 0;
            lvl = Types.getLevel(xp);
            fnXP = Types.expForLevel;
            ratio = (xp) ? (xp - fnXP[lvl-1])/(fnXP[lvl] - fnXP[lvl-1]) : 0;
            $('#characterLevel').text("Level\t\t"+lvl+"\t"+Utils.Percent(ratio));

            xp = p.stats.exp.attack || 0;
            lvl = Types.getAttackLevel(p.stats.exp.attack);
            fnXP = Types.attackExp;
            ratio = (xp) ? (xp - fnXP[lvl-1])/(fnXP[lvl] - fnXP[lvl-1]) : 0;
            $('#characterAttackLevel').text("Attack Level\t\t"+lvl+"\t"+Utils.Percent(ratio));

            xp = p.stats.exp.defense || 0;
            lvl = Types.getDefenseLevel(p.stats.exp.defense);
            fnXP = Types.defenseExp;
            ratio = (xp) ? (xp - fnXP[lvl-1])/(fnXP[lvl] - fnXP[lvl-1]) : 0;
            $('#characterDefenseLevel').text("Defense Level\t\t"+lvl+"\t"+Utils.Percent(ratio));

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
            //this.page.assign();
        }

        /*hide: function() {
            this._super();
        }*/
}
