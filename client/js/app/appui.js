// Mixin extracted from app.js: HUD/dialog setup and show/hide: player bars, target HUD, menu/combat bar init, chat/drop/auction dialogs, window show/hide, resize.
// Applied onto App.prototype via install*(...) call in app.js; not a standalone class.
import Detect from '../detect.js';
import Mob from '../entity/mob.js';
import MobData from '../data/mobdata.js';
import PlayerAnim from '../playeranim.js';
/* global Utils, log, game, app */

export function installAppUI(proto) {
    proto.center = function () {
        window.scrollTo(0, 1);
    };

    proto.showPlayerLoad = function () {
        this.jqPlayerLoad.show();
        this.jqPlayerSelect.show();
        this.jqLblPlayerSelect.show();
        this.jqPlayerCreateForm.hide();
    };

    proto.showPlayerCreate = function () {
        this.jqPlayerLoad.hide();
        this.jqPlayerSelect.hide();
        this.jqLblPlayerSelect.hide();
        this.jqPlayerCreateForm.show();
    };

    proto.getZoom = function () {
        const zoom = game.renderer.zoom * game.renderer.scaleHUD;
        return zoom;
    };

    proto.setMouseCoordinates = function (x, y) {
        // TODO Width and Height not clamping mouse properly.

        const r = game.renderer;
        let scale = r.scale,
            width = r.innerWidth,
            height = r.innerHeight,
            mouse = game.mouse;

        const zoom = 1 / r.resolution;

        width = ~~(width / zoom) - 1;
        height = ~~(height / zoom) - 1;

        mouse.x = ~~((Utils.clamp(0, width, x) * zoom) / scale);
        mouse.y = ~~((Utils.clamp(0, height, y) * zoom) / scale);
    };

    proto.initPlayerBar = function () {
        const player = game.player;

        if (player && !game.isMobile) {
            const anim = new PlayerAnim();
            anim.sprites = [];
            anim.addSprite(player.getSprite(0));
            anim.addSprite(player.getSprite(1));
            anim.setHTML(['#characterLookArmor2', '#characterLookWeapon2']);
            anim.showHTML('#characterLook2', 2, 2);
            anim.idle(Types.Orientations.DOWN);
            anim.show();
        }
    };

    proto.npcDialoguePic = function (entity) {
        const scale = 2;

        const sprite = entity.getSprite();
        // FIX: sprite.animations was dereferenced before the sprite-null checks below ran,
        // so a falsy sprite (e.g. not loaded yet) threw instead of no-oping like the rest
        // of this function was clearly designed to handle
        if (!sprite) return;

        const anim = sprite.animations['idle_down'];
        const oc = anim.col * anim.width * scale;
        const or = anim.row * anim.height * scale;
        const width2 = sprite.width * scale;
        const height2 = sprite.height * scale;

        app.jqNpcDialoguePic.css('width', '' + ~~width2 + 'px');
        app.jqNpcDialoguePic.css('height', '' + ~~(height2 * 0.75) + 'px');
        app.jqNpcDialoguePic.css(
            'background-position',
            '-' + ~~oc + 'px -' + ~~or + 'px'
        );
        app.jqNpcDialoguePic.css('transform', 'scale(1.5)');

        app.jqNpcDialoguePic.css(
            'background-image',
            'url("' + sprite.filepath + '")'
        );
    };

    //Init the hud that makes it show what creature you are mousing over and attacking
    proto.initTargetHud = function () {
        const guiScale = game.renderer.getUiScaleFactor();

        // app.jqTarget/jqTargetName/jqTargetHealth/jqTargetHealthText/jqTargetHealthChild/
        // jqCombatContainer are cached once in App's constructor (app.js) and reused here by
        // the onSetTarget/onUpdateTarget/onRemoveTarget callbacks registered below, which fire
        // repeatedly for the lifetime of these listeners - `app.` (not `this.`) is used
        // because these are plain (non-arrow) callbacks with no bound `this`.
        if (game.player) {
            game.player.onSetTarget(function (target, mouseover) {
                let targetName = target.name;
                if (!(
                    targetName &&
                    target.hasOwnProperty('stats') &&
                    target.stats.hasOwnProperty('hpMax') &&
                    target.stats.hpMax > 0
                )) {
                    return;
                }

                const mobData = MobData.Kinds[target.kind];
                if (target instanceof Mob && mobData) {
                    if (mobData.name) targetName = mobData.name;
                    else targetName = mobData.key;
                }

                targetName = targetName.capitalizeFirstLetter();
                app.jqTargetName.text(targetName + ' Lv' + target.level);

                if (target.stats.hp) {
                    app.jqTargetHealth.css(
                        'width',
                        Math.round(
                            (target.stats.hp / target.stats.hpMax) *
                                60 *
                                guiScale
                        ) + 'px'
                    );
                    app.jqTargetHealthText.html(
                        'HP: ' + target.stats.hp + '/' + target.stats.hpMax
                    );
                } else {
                    app.jqTargetHealth.css('width', 60 * guiScale + 'px');
                }

                app.jqTarget.fadeIn('fast');
            });
        }

        game.onUpdateTarget(function (target) {
            log.info(
                'targetHealth: ' + target.stats.hp + ' ' + target.stats.hpMax
            );
            app.jqTargetHealth.css(
                'width',
                Math.round(
                    (target.stats.hp / target.stats.hpMax) * 60 * guiScale
                ) + 'px'
            );
            app.jqTargetHealthText.html(
                'HP: ' + target.stats.hp + '/' + target.stats.hpMax
            );
        });

        if (game.player) {
            game.player.onRemoveTarget(function (targetId) {
                app.jqTarget.fadeOut('fast');
                app.jqTargetHealthChild.css('width', 60 * guiScale + 'px');

                app.jqCombatContainer.fadeOut('fast');
            });
        }
    };

    proto.initExpBar = function () {
        // app.jqExp/jqExpBar/jqExpLevel cached once in App's constructor (app.js).
        let maxWidth = parseInt(app.jqExpBar.width());

        game.onPlayerExpChange(function (level, exp) {
            const prevLvlExp = Types.expForLevel[level - 1];
            const expInThisLevel = exp - prevLvlExp;
            const expForLevelUp = Types.expForLevel[level] - prevLvlExp;

            if (!expInThisLevel && !expForLevelUp) {
                app.jqExp.css('width', '0px');
                app.jqExpBar.attr('title', 'Exp: 0%');
                app.jqExpBar.html('Exp: 0%');
                return;
            }

            maxWidth = parseInt(app.jqExpBar.width());
            const rate = Utils.clamp(0, 1, expInThisLevel / expForLevelUp);

            const rateFmt = Utils.Percent(rate, 0);
            app.jqExp.css('width', rateFmt);
            app.jqExpBar.attr('title', 'Exp: ' + rateFmt);
            app.jqExpBar.html('Exp: ' + rateFmt);
            app.jqExpLevel.html(level);
        });
    };

    proto.initHealthBar = function () {
        // app.jqStatBars/jqHealth/jqHealthText cached once in App's constructor (app.js).
        let healthMaxWidth = app.jqStatBars.width();
        log.info('healthMaxWidth=' + healthMaxWidth);

        game.onPlayerHealthChange(function (hp, maxHp) {
            healthMaxWidth = app.jqStatBars.width();
            const barWidth = Math.round(
                (healthMaxWidth / maxHp) * (hp > 0 ? hp : 0)
            );
            app.jqHealth.css('width', barWidth + 'px');
            app.jqHealthText.html('HP: ' + hp + '/' + maxHp);
        });

        game.onPlayerHurt(this.blinkHealthBar.bind(this));
    };

    proto.blinkHealthBar = function () {
        // app.jqHealth cached once in App's constructor (app.js); shared with initHealthBar.
        app.jqHealth.addClass('white');
        setTimeout(function () {
            app.jqHealth.removeClass('white');
        }, 500);
    };

    proto.initMenuButton = function () {
        log.info('initMenuButton');

        // app.jqMenuContainer/jqCharacterMenu cached once in App's constructor (app.js).
        $(document).ready(function () {
            app.jqMenuContainer.css('display', 'none');
        });

        app.jqCharacterMenu.click(function (e) {
            if (app.jqMenuContainer.is(':visible')) {
                app.jqMenuContainer.fadeOut();
            } else {
                app.jqMenuContainer.show();
            }
        });

        $(window).resize(function () {
            app.resizeUi();
        });

        $(document).ready(function () {
            app.jqMenuContainer.on('click', 'div', function (e) {
                app.jqMenuContainer.fadeOut();
            });
        });

        app.jqMenuContainer.click(function (e) {
            app.jqMenuContainer.fadeOut();
        });
    };

    proto.initCombatBar = function () {
        // app.jqCombatContainer cached once in App's constructor (app.js); shared with
        // initTargetHud.
        app.jqCombatContainer.children().click(function (e) {
            app.jqCombatContainer.children().removeClass('lightup');
            $(this).addClass('lightup');
        });
        app.jqCombatContainer.children().eq(1).addClass('lightup');
    };

    proto.hideIntro = function () {
        clearInterval(this.watchNameInputInterval);
        // app.jqBody cached once in App's constructor (app.js).
        app.jqBody.removeClass('intro');
        setTimeout(function () {
            app.jqBody.addClass('game');
        }, 500);
    };

    proto.showChat = function (flag) {
        if (game.started) {
            if (flag) {
                this.jqChatbox.addClass('active');
                this.jqChatInput.focus();
                this.jqChatButton.addClass('active');
            } else {
                this.jqChatbox.removeClass('active');
                this.jqChatInput.blur();
                this.jqChatButton.removeClass('active');
            }
        }
    };

    proto.showChatLog = function () {
        if (game.started) {
            this.jqChatButton.addClass('active');
            this.jqChatLog.hide();
        }
    };

    proto.hideChatLog = function () {
        if (game.started) {
            this.jqChatButton.removeClass('active');
            this.jqChatLog.css('display', 'flex');
        }
    };

    proto.showDropDialog = function (dropAction) {
        if (game.started) {
            // this.jqDropCount cached once in App's constructor (app.js).
            this.jqDropDialog.show();
            this.jqDropCount.focus();
            this.jqDropCount.select();

            this.dropAction = dropAction;
            this.dropDialogPopuped = true;
        }
    };

    proto.hideDropDialog = function () {
        if (game.started) {
            this.jqDropDialog.hide();

            this.dropDialogPopuped = false;
        }
    };

    proto.showAuctionSellDialog = function (inventoryNumber) {
        if (game.started) {
            // this.jqAuctionSellCount cached once in App's constructor (app.js).
            this.jqAuctionSellDialog.show();
            this.jqAuctionSellCount.focus();
            this.jqAuctionSellCount.select();

            this.inventoryNumber = inventoryNumber;
            this.auctionsellDialogPopuped = true;
        }
    };

    proto.hideAuctionSellDialog = function () {
        if (game.started) {
            this.jqAuctionSellDialog.hide();

            this.auctionsellDialogPopuped = false;
        }
    };

    proto.hideWindows = function () {};

    proto.loadWindow = function (origin, destination) {
        // TODO: origin/destination are computed selectors, and this function is called with
        // many different id pairs across the codebase (not just 'user_window'/'player_window' -
        // see also 'playerwindow'/'errorwindow' in gameclient.js, 'loginWindow'/'passwordWindow'
        // in main.js, 'loginwindow'/'errorwindow' in userclient.js), so there's no single fixed
        // pair of elements to cache here the way the other selectors in this file were. It's
        // also called once synchronously from App's constructor before this.jqUserWindow/
        // this.jqPlayerWindow (set later in that same constructor) are populated, so even the
        // two most common id values couldn't be pre-cached as a special case without reordering
        // the constructor.
        $('#' + origin).hide();
        $('#' + destination).show();
        if (destination !== 'user_window') {
            this.jqAboutButton.hide();
        }
        if (destination === 'player_window') this.jqUserRemove.show();
    };

    proto.resizeUi = function () {
        if (game && game.started) {
            game.resize(game.zoom);
            this.initHealthBar();
            this.initTargetHud();
            this.initExpBar();
            this.initPlayerBar();
            game.updateBars();
        }
    };

    proto.onUserReady = function () {
        app.userReady = true;
        app.jqUserCreate.removeClass('loading');
        app.jqUserLoad.removeClass('loading');
        app.jqLoginInfo.text('Connected.');
    };
}
