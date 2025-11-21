define(['./dialog', '../tabpage', 'data/skilldata'], function(Dialog, TabPage, SkillData) {
    var Skill = Class.extend({
        init: function(parent, i, level, position) {
            var id = this.id = '#skill' + i;
            this.background = $(id);
            this.body = $(id + ' .skillbody');
            this.jqCooltime = $(id + ' .skillcd');
            this.levels = [];
            this.level = level;
            this.parent = parent;

            this.index = i;

            var data = this.data = SkillData.Data[i];
            this.cooldownDuration = (data.recharge) ? data.recharge : 2000;
            log.info(i+" = "+JSON.stringify(data));
            //log.info(JSON.stringify(SkillData.Data));
            //log.info("SkillData.Data[id].name"+SkillData.Data[id].name);
            this.detail = data.detail.replace('[l]',this.level)
            	.replace('[u]', data.baseLevel+data.perLevel*this.level);

            this.position = position;
            this.scale = game.renderer.getUiScaleFactor();

            var self = this;

            var fnSelectSkill = function (index) {
              self.parent.clearHighlight();
              self.parent.selectedSkill = self;
              self.body.css('border', self.scale+"px solid #f00");
              $('#skillDetail').html(self.detail);
              ShortcutData = self;
            };

            var clickSkill = function (index) {
              if (self.parent.selectedSkill === self) {
                if (game.player.skillHandler.execute(self.index))
                {
                  self.cooldownStart();
                  game.shortcuts.cooldownStart(2, self.index);
                }
              } else {
                fnSelectSkill(index);
              }
            };

            this.body.data('skillIndex', this.index);

            this.body.bind('dragstart', function(event) {
              fnSelectSkill($(this).data("skillIndex"));
            	log.info("Began DragStart.")
            });

            this.body.on('click', function(event){
            	clickSkill($(this).data("skillIndex"));
              event.stopPropagation();
            });

            this.rescale();
        },

        cooldownStart: function () {
          this.cooltime = Date.now();
          this.cooldown();
          this.cooltimeHandle = setInterval(this.cooldown.bind(this), 1000);
        },

        cooldown: function() {
          var duration = (Date.now() - this.cooltime);
          var coolms = this.cooldownDuration;
          if (duration < coolms) {
            var counter = Math.ceil((coolms-duration)/1000);
            this.jqCooltime.css('display', 'block');
            this.jqCooltime.html('' + counter.toFixed(0));
          }
          else {
            this.jqCooltime.css('display', 'none');
            clearInterval(this.cooltimeHandle);
            this.cooltimeHandle = null;
          }
        },

        rescale: function () {
          var scale = this.scale = game.renderer.getUiScaleFactor();
          var position = this.position;

          this.body.css({
              'position': 'absolute',
              'left': '0',
              'top': '0',
              'width': 24 * scale,
              'height': 24 * scale,
              'display': 'none'
          });
          if(position) {
              this.body.css({
                  'background-image': 'url("img/' + scale + '/misc/skillicons.png")',
                  'background-position': (-position[0]*24*scale)+"px "+(-position[1]*24*scale)+"px" ,
                  'background-size': (360 * scale) + "px " + (336 * scale) + "px",
                  'display': 'block',
                  'border': scale+"px solid #000"
              });
          }

        },

        getName: function() {
            return this.name;
        },
        getLevel: function() {
            return this.level;
        },
        setLevel: function(value) {
            this.level = value;
            if(value > 0) {
                this.body.css('display', 'inline');
                if (this.body[0])
                    this.body[0].draggable = true;
            } else {
                this.body.css('display', 'none');
                if (this.body[0])
                    this.body[0].draggable = false;
            }
        }
    });

    var SkillPage = TabPage.extend({
        init: function(parent) {
            this._super(parent, '#frameSkillsPage');
            this.skills = [];
            this.selectedSkill = null;
            var self = this;
        },

        setSkills: function(skillExps) {
      		for (var i=0; i < skillExps.length; ++i)
      		{
            this.skills[i] = {level: Types.getSkillLevel(skillExps[i]), skill: null};
      		}
          this.assign();
        },
        setSkill: function(index, level) {
          this.skills[index] = {level: level, skill: null};
        },

        cooldownStart: function (index) {
            if (this.skills[index])
              this.skills[index].skill.cooldownStart();
        },

        clear: function() {
            var scale = game.renderer.getUiScaleFactor();
            for (var i = this.skills.length-1; i >= 0; --i)
            {
                var tSkill = this.skills[i];
                //log.info("tSkill="+JSON.stringify(tSkill));
                if(tSkill.skill) {
                    tSkill.skill.background.css({
                        //'display': 'none'
                        'background-image': 'url("../img/'+scale+'/misc/itembackground.png")',
                    });
                    $('#skill' + i).attr('title', '');
                    $('#skill' + i).html();
                    tSkill.level = 0;
                }
            }
            this.skills.splice(0, this.skills.length);
        },

        rescale: function() {
          for(var i = 0; i < this.skills.length; ++i) {
              var skill = this.skills[i].skill;
              skill.rescale();
          }
        },

        assign: function() {
            //SendNative(["PlayerSkills"].concat(this.skills));
            var scale = game.renderer.getUiScaleFactor();
            for(var i = 0; i < this.skills.length; ++i) {
                var tSkill = this.skills[i];
                var data = SkillData.Data[i];
                if(tSkill) {
                    log.info('#skill1' + i);
                    var skill = new Skill(this, i, tSkill.level,
                        data.iconOffset);
                    var ix = (i % 4),
                        iy = Math.floor(i / 4);
                    skill.background.css({
                        'position': 'absolute',
                        'left': (ix * 26 * scale) + 'px',
                        'top': (iy * 26 * scale) + 'px',
                        'width': (24*scale)+'px',
                        'height': (24*scale)+'px',
                        'display': 'block'
                    });
                    this.skills[i].skill = skill;
                    //log.info("this.skills[id].skill="+JSON.stringify(this.skills[id].skill));
                    $('#skill' + i).attr('title', data.name + " Lv: " + tSkill.level);
                    $('#skill' + i + ' .skillbody').css({
                        'text-align': 'center',
                        'color': '#fff',
                        'line-height': (24*scale)+'px',
                        'font-size': (6*scale)+'px',
                        'font-weight': 'bold'
                    });
                    $('#skill' + i + ' .skillbody').html("Lv "+tSkill.level);
                    skill.setLevel(tSkill.level);
                }
            }
        },

        clearHighlight: function() {
          this.selectedSkill = null;
        	for(var i = 0; i < this.skills.length; ++i)
          {
        		if (this.skills[i].skill)
        			this.skills[i].skill.body.css('border',"3px solid black");
          }
        }
    });

    SkillDialog = Dialog.extend({
        init: function() {
            this._super(null, '#skillsDialog');
            //this.frame = new Frame(this, game);
            this.addClose();
            this.page = new SkillPage(this);

            ShortcutData = null;

            $('#skillsCloseButton').add('#skillsDialog').add('#game').on('click', function(event){
              if (ShortcutData)
                ShortcutData.parent.clearHighlight();
            	ShortcutData = null;
            });
        },

        show: function() {
            this.page.rescale();
            this._super();
        },

        update: function(datas) {
            this.page.update(datas);
        },
    });

    return SkillDialog;
});
