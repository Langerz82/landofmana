define(['./dialog', '../tabpage'], function(Dialog, TabPage) {
    	var StatPage = TabPage.extend({
        init: function(parent) {
            this._super(parent, '#frameStatsPage');
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
        },

        refreshStats: function () {
            var p = game.player;
            var stats = game.player.stats;
            $('#characterPoints').text("Free Points:\t\t"+stats.free);
            $('#characterAttack').text("Attack:\t\t"+stats.attack);
            $('#characterDefense').text("Defense:\t\t"+stats.defense);
            $('#characterHealth').text("Health:\t\t"+stats.health);
            $('#characterEnergy').text("Energy:\t\t"+stats.energy);
            $('#characterLuck').text("Luck:\t\t"+stats.luck);

            $('#characterBaseCrit').text("Base Crit\t\t"+p.baseCrit());
            $('#characterBaseCritDef').text("Base Crit Def\t\t"+p.baseCritDef());
            $('#characterBaseDamage').html("Base Damage<br/>"+p.baseDamage()[0]+"-"+p.baseDamage()[1]);
            $('#characterBaseDamageDef').html("Base Damage Def<br/>"+p.baseDamageDef()[0]+"-"+p.baseDamageDef()[1]);

            if (stats.free > 0)
            {
            	$('#charAddAttack').css('display','inline-block');
            	$('#charAddDefense').css('display','inline-block');
            	$('#charAddHealth').css('display','inline-block');
            	$('#charAddEnergy').css('display','inline-block');
            	$('#charAddLuck').css('display','inline-block');
            }
        },

        assign: function(data) {
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
            p.exp.base = data.shift();
            p.exp.attack = data.shift();
            p.exp.defense = data.shift();
            //p.exp.move = data.shift();
            p.exp.sword = data.shift();
            p.exp.bow = data.shift();
            p.exp.hammer = data.shift();
            p.exp.axe = data.shift();
            p.exp.logging = data.shift();
            p.exp.mining = data.shift();

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

            var xp = p.exp.sword || 0;
            var lvl = Types.getWeaponLevel(xp);
            var ratio = (xp) ? (xp - Types.weaponExp[lvl-1])/(Types.weaponExp[lvl] - Types.weaponExp[lvl-1]) : 0;
            var ratioFmt = Utils.Percent(ratio);
            $('#characterLevelSword').text("Sword Level\t\t"+lvl+"\t"+ratioFmt);

            xp = p.exp.bow || 0;
            lvl = Types.getWeaponLevel(xp);
            ratio = (xp) ? (xp - Types.weaponExp[lvl-1])/(Types.weaponExp[lvl] - Types.weaponExp[lvl-1]) : 0;
            ratioFmt = Utils.Percent(ratio);
            $('#characterLevelBow').text("Bow Level\t\t"+lvl+"\t"+ratioFmt);

            xp = p.exp.hammer || 0;
            lvl = Types.getWeaponLevel(xp);
            ratio = (xp) ? (xp - Types.weaponExp[lvl-1])/(Types.weaponExp[lvl] - Types.weaponExp[lvl-1]) : 0;
            ratioFmt = Utils.Percent(ratio);
            $('#characterLevelHammer').text("Hammer Level\t\t"+lvl+"\t"+ratioFmt);

            xp = p.exp.axe || 0;
            lvl = Types.getWeaponLevel(xp);
            ratio = (xp) ? (xp - Types.weaponExp[lvl-1])/(Types.weaponExp[lvl] - Types.weaponExp[lvl-1]) : 0;
            ratioFmt = Utils.Percent(ratio);
            $('#characterLevelAxe').text("Axe Level\t\t"+lvl+"\t"+ratioFmt+"%");

            xp = p.exp.logging || 0;
            lvl = Types.getSkillLevel(xp);
            ratio = (xp) ? (xp - Types.skillExp[lvl-1])/(Types.skillExp[lvl] - Types.skillExp[lvl-1]) : 0;
            ratioFmt = Utils.Percent(ratio);
            $('#characterLevelLogging').text("Logging Level\t\t"+lvl+"\t"+ratioFmt);

            xp = p.exp.mining || 0;
            lvl = Types.getSkillLevel(xp);
            ratio = (xp) ? (xp - Types.skillExp[lvl-1])/(Types.skillExp[lvl] - Types.skillExp[lvl-1]) : 0;
            ratioFmt = Utils.Percent(ratio);
            $('#characterLevelMining').text("Mining Level\t\t"+lvl+"\t"+ratioFmt);

            p.level = Types.getLevel(p.exp.base);
            p.levels.attack = Types.getAttackLevel(p.exp.attack);
            p.levels.defense = Types.getDefenseLevel(p.exp.defense);

            var expLevelRatio = (p.exp.base) ? (p.exp.base - Types.expForLevel[p.level-1])/(Types.expForLevel[p.level] - Types.expForLevel[p.level-1]) : 0;
            var attackRatio = (p.exp.attack) ? (p.exp.attack - Types.attackExp[p.levels.attack-1])/(Types.attackExp[p.levels.attack] - Types.attackExp[p.levels.attack-1]) : 0;
            var defenseRatio = (p.exp.defense) ? (p.exp.defense - Types.defenseExp[p.levels.defense-1])/(Types.defenseExp[p.levels.defense] - Types.defenseExp[p.levels.defense-1]) : 0;
            //var moveRatio = (p.exp.move) ? (p.exp.move - Types.moveExp[p.levels.move-1])/(Types.moveExp[p.levels.move] - Types.moveExp[p.levels.move-1]) : 0;

            $('#characterLevel').text("Level\t\t"+p.level+"\t"+Utils.Percent(expLevelRatio));
            $('#characterAttackLevel').text("Attack Level\t\t"+p.levels.attack+"\t"+Utils.Percent(attackRatio));
            $('#characterDefenseLevel').text("Defense Level\t\t"+p.levels.defense+"\t"+Utils.Percent(defenseRatio));
            //$('#characterMoveLevel').text("Move Level\t\t"+p.levels.move+"\t"+Utils.Percent(moveRatio));


        }
    });

    StatDialog = Dialog.extend({
        init: function() {
            this._super(null, '#statsDialog');

            this.addClose();
            this.page = new StatPage(this);
        },

        show: function(index, datas) {
            this._super();
            this.update();
        },

        update: function() {
            game.client.sendPlayerInfo();
            //this.page.assign();
        },

        /*hide: function() {
            this._super();
        }*/
    });

    return StatDialog;
});
