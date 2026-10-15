// This file is part of Land of Mana (https://github.com/Langerz82/retrorpgonline2-client).
// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2023-2026 Joshua Langley and contributors
// Portions derived from BrowserQuest (Little Workshop) and BrowserQuest-Asky, MPL-2.0.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, version 3 of the License.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program. See the LICENSE file in the project root,
// or <https://www.gnu.org/licenses/>.

// Converted from AMD (define) + Class.extend to a native ES6 module/class.
export default class PlayerPopupMenu {
    constructor(game) {
        this.jqContainer = $('#playerPopupMenuContainer');
        this.jqPartyInvite = $('#playerPopupMenuPartyInvite');
        this.jqPartyLeader = $('#playerPopupMenuPartyLeader');
        this.jqPartyKick = $('#playerPopupMenuPartyKick');
        this.jqAttack = $('#playerPopupMenuAttack');
        this.jqName = $('#playerPopupMenuName');

        this.width = parseInt(this.jqContainer.css('width'));
        this.height = parseInt(this.jqContainer.css('height'));
        this.game = game;
        this.selectedPlayer = null;

        const self = this;
        this.jqPartyInvite.click(function (event) {
            if (self.selectedPlayer) {
                self.game.client.sendPartyInvite(self.selectedPlayer.name, 0);
                self.close();
            }
        });
        this.jqPartyLeader.click(function (event) {
            if (self.selectedPlayer) {
                self.game.client.sendPartyLeader(self.selectedPlayer.name);
                self.close();
            }
        });
        this.jqPartyKick.click(function (event) {
            if (self.selectedPlayer) {
                self.game.client.sendPartyKick(self.selectedPlayer.name);
                self.close();
            }
        });
        this.jqAttack.click(function (event) {
            if (self.selectedPlayer) {
                if (
                    self.game.player.pvpTarget &&
                    self.game.player.pvpTarget === self.selectedPlayer
                ) {
                    self.jqAttack.html('Attack');
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
            this.jqContainer.width() / 2;
        const y =
            (player.y - this.game.camera.y) * s -
            this.jqContainer.height() / 2;
        const ph = this.game.socialHandler;

        this.selectedPlayer = player;

        if (
            ph.isPartyLeader(this.game.player.name) &&
            ph.isPartyMember(this.selectedPlayer.name)
        ) {
            this.jqPartyKick.css('display', 'block');
            this.jqPartyLeader.css('display', 'block');
        } else {
            this.jqPartyKick.css('display', 'none');
            this.jqPartyLeader.css('display', 'none');
        }

        if (
            (ph.isPartyLeader(this.game.player.name) &&
                !ph.isPartyMember(this.selectedPlayer.name)) ||
            ph.partymembers.length === 0
        ) {
            this.jqPartyInvite.show();
            const jqPartyInvite = this.jqPartyInvite;
            setTimeout(function () {
                jqPartyInvite.hide();
            }, 10000);
        } else {
            this.jqPartyInvite.hide();
        }

        if (
            this.selectedPlayer.level >= 20 &&
            this.game.player.level >= 20 &&
            this.game.mapIndex !== 0
        ) {
            this.jqAttack.css('display', 'block');
        } else {
            this.jqAttack.css('display', 'none');
        }

        this.jqContainer.css('display', 'block');
        this.jqContainer.css('top', '' + y + 'px');
        this.jqContainer.css('left', '' + x + 'px');
        // FIX: use .text() instead of .html() - player.name is plain text content, no HTML needed, avoids XSS
        this.jqName.text(player.name);
    }
    close() {
        this.selectedPlayer = null;
        this.jqContainer.css('display', 'none');
    }
}
