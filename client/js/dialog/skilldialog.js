// Converted from AMD (define) + Class.extend to a native ES6 module/class.
/* global Types */
import Dialog from './dialog.js';
import TabPage from '../tabpage.js';
import SkillData from '../data/skilldata.js';

class Skill {
        constructor(parent, i, level, position) {
            const id = this.id = '#skill' + i;
            this.background = $(id);
            this.body = $(id + ' .skillbody');
            this.jqCooltime = $(id + ' .skillcd');
            this.levels = [];
            this.level = level;
            this.parent = parent;

            this.index = i;

            const data = this.data = SkillData.Data[i];
            this.cooldownDuration = (data.recharge) ? data.recharge : 2000;
            log.info(i+" = "+JSON.stringify(data));
            //log.info(JSON.stringify(SkillData.Data));
            //log.info("SkillData.Data[id].name"+SkillData.Data[id].name);
            this.detail = data.detail.replace('[l]',this.level)
            	.replace('[u]', data.baseLevel+data.perLevel*this.level);

            this.position = position;
            this.scale = game.renderer.getUiScaleFactor();

            const self = this;

            const fnSelectSkill = function (index) {
              self.parent.clearHighlight();
              self.parent.selectedSkill = self;
              self.body.css('border', self.scale+"px solid #f00");
              $('#skillDetail').html(self.detail);
              ShortcutData = self;
            };

            const clickSkill = function (index) {
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
        }

        cooldownStart() {
          this.cooltime = Date.now();
          this.cooldown();
          this.cooltimeHandle = setInterval(this.cooldown.bind(this), 1000);
        }

        cooldown() {
          const duration = (Date.now() - this.cooltime);
          const coolms = this.cooldownDuration;
          if (duration < coolms) {
            const counter = Math.ceil((coolms-duration)/1000);
            this.jqCooltime.css('display', 'block');
            this.jqCooltime.html('' + counter.toFixed(0));
          }
          else {
            this.jqCooltime.css('display', 'none');
            clearInterval(this.cooltimeHandle);
            this.cooltimeHandle = null;
          }
        }

        rescale() {
          const scale = this.scale = game.renderer.getUiScaleFactor();
          const position = this.position;

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

        }

        getName() {
            return this.name;
        }
        getLevel() {
            return this.level;
        }
        setLevel(value) {
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
}

class SkillPage extends TabPage {
        constructor(parent) {
            super(parent, '#frameSkillsPage'); // FIX (conversion): this._super(parent, '#frameSkillsPage') -> super(parent, '#frameSkillsPage')
            this.skills = [];
            this.selectedSkill = null;
            const self = this;
        }

        setSkills(skillExps) {
      		for (let i=0; i < skillExps.length; ++i)
      		{
            this.skills[i] = {level: Types.getSkillLevel(skillExps[i]), skill: null};
      		}
          this.assign();
        }
        setSkill(index, level) {
          this.skills[index] = {level: level, skill: null};
        }

        cooldownStart(index) {
            if (this.skills[index])
              this.skills[index].skill.cooldownStart();
        }

        clear() {
            const scale = game.renderer.getUiScaleFactor();
            for (let i = this.skills.length-1; i >= 0; --i)
            {
                const tSkill = this.skills[i];
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
        }

        rescale() {
          for(let i = 0; i < this.skills.length; ++i) {
              const skill = this.skills[i].skill;
              skill.rescale();
          }
        }

        assign() {
            //SendNative(["PlayerSkills"].concat(this.skills));
            const scale = game.renderer.getUiScaleFactor();
            for(let i = 0; i < this.skills.length; ++i) {
                const tSkill = this.skills[i];
                const data = SkillData.Data[i];
                if(tSkill) {
                    log.info('#skill1' + i);
                    const skill = new Skill(this, i, tSkill.level,
                        data.iconOffset);
                    const ix = (i % 4),
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
        }

        clearHighlight() {
          this.selectedSkill = null;
        	for(let i = 0; i < this.skills.length; ++i)
          {
        		if (this.skills[i].skill)
        			this.skills[i].skill.body.css('border',"3px solid black");
          }
        }
}

export default class SkillDialog extends Dialog {
        constructor() {
            super(null, '#skillsDialog'); // FIX (conversion): this._super(null, '#skillsDialog') -> super(null, '#skillsDialog')
            //this.frame = new Frame(this, game);
            this.addClose();
            this.page = new SkillPage(this);

            ShortcutData = null;

            $('#skillsCloseButton').add('#skillsDialog').add('#game').on('click', function(event){
              if (ShortcutData)
                ShortcutData.parent.clearHighlight();
            	ShortcutData = null;
            });
        }

        show() {
            this.page.rescale();
            super.show(); // FIX (conversion): this._super() -> super.show()
        }

        update(datas) {
            this.page.update(datas);
        }
}
