// Converted from AMD (define) + Class.extend to a native ES6 module/class.
export default class PlayerPopupMenu {
    constructor(game) {
        this.width = parseInt($('#playerPopupMenuContainer').css('width'));
        this.height = parseInt($('#playerPopupMenuContainer').css('height'));
        this.game = game;
        this.selectedPlayer = null;

        const self = this;
        $('#playerPopupMenuPartyInvite').click(function (event) {
            if (self.selectedPlayer) {
                self.game.client.sendPartyInvite(self.selectedPlayer.name, 0);
                self.close();
            }
        });
        $('#playerPopupMenuPartyLeader').click(function (event) {
            if (self.selectedPlayer) {
                self.game.client.sendPartyLeader(self.selectedPlayer.name);
                self.close();
            }
        });
        $('#playerPopupMenuPartyKick').click(function (event) {
            if (self.selectedPlayer) {
                self.game.client.sendPartyKick(self.selectedPlayer.name);
                self.close();
            }
        });
        $('#playerPopupMenuAttack').click(function (event) {
            if (self.selectedPlayer) {
                if (
                    self.game.player.pvpTarget &&
                    self.game.player.pvpTarget === self.selectedPlayer
                ) {
                    $('#playerPopupMenuAttack').html('Attack');
                } else {
                    self.game.player.pvpTarget = self.selectedPlayer;
                    // Player has 60 seconds of battle time.
                    setTimeout(function () {
                        // FIX: was `clearInterval(self.game.makePlayerAttackAuto)` --
                        // `game.makePlayerAttackAuto` doesn't exist anywhere in this
                        // codebase, so that call was a silent no-op
                        // (clearInterval(undefined) doesn't throw). The player's
                        // auto-attack retry loop is tracked as `player.attackInterval`,
                        // a setTimeout handle (see gameinteractioncombat.js's
                        // scheduleAttackRetry()), cleared via clearTimeout everywhere
                        // else in the codebase. Cancel that instead, so an in-progress
                        // auto-attack against this pvpTarget actually stops once its
                        // 60-second battle timer expires, rather than continuing to
                        // retry against a target that's no longer a valid attack target.
                        if (self.game.player) {
                            clearTimeout(self.game.player.attackInterval);
                            self.game.player.pvpTarget = null;
                        }
                    }, 60000);
                }
            }
            self.close();
        });
    }
    click(player) {
        const s = this.game.renderer.scale;
        const x =
            (player.x - this.game.camera.x) * s -
            $('#playerPopupMenuContainer').width() / 2;
        const y =
            (player.y - this.game.camera.y) * s -
            $('#playerPopupMenuContainer').height() / 2;
        const ph = this.game.socialHandler;

        this.selectedPlayer = player;

        if (
            ph.isPartyLeader(this.game.player.name) &&
            ph.isPartyMember(this.selectedPlayer.name)
        ) {
            $('#playerPopupMenuPartyKick').css('display', 'block');
            $('#playerPopupMenuPartyLeader').css('display', 'block');
        } else {
            $('#playerPopupMenuPartyKick').css('display', 'none');
            $('#playerPopupMenuPartyLeader').css('display', 'none');
        }

        if (
            (ph.isPartyLeader(this.game.player.name) &&
                !ph.isPartyMember(this.selectedPlayer.name)) ||
            ph.partymembers.length === 0
        ) {
            $('#playerPopupMenuPartyInvite').show();
            setTimeout(function () {
                $('#playerPopupMenuPartyInvite').hide();
            }, 10000);
        } else {
            $('#playerPopupMenuPartyInvite').hide();
        }

        if (
            this.selectedPlayer.level >= 20 &&
            this.game.player.level >= 20 &&
            this.game.mapIndex !== 0
        ) {
            $('#playerPopupMenuAttack').css('display', 'block');
        } else {
            $('#playerPopupMenuAttack').css('display', 'none');
        }

        $('#playerPopupMenuContainer').css('display', 'block');
        $('#playerPopupMenuContainer').css('top', '' + y + 'px');
        $('#playerPopupMenuContainer').css('left', '' + x + 'px');
        // FIX: use .text() instead of .html() - player.name is plain text content, no HTML needed, avoids XSS
        $('#playerPopupMenuName').text(player.name);
    }
    close() {
        this.selectedPlayer = null;
        $('#playerPopupMenuContainer').css('display', 'none');
    }
}
