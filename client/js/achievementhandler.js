// This file is part of Land of Mana (https://github.com/Langerz82/landofmana).
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
/* global Utils, Class, _, questSerial */

export default class AchievementHandler {
    constructor() {
        this.hideDelay = 5000; //How long the notification shows for.
        this.progressHideDelay = 1000;
        this.showlog = false;

        const self = this;
        this.jqCloseButton = $('#achievementCloseButton');
        this.jqAchievementLog = $('#achievementlog');
        this.jqAchievementLogInfoBody = $('#achievementLogInfo tbody');
        this.jqCloseButton.click(function (event) {
            self.toggleShowLog();
        });
    }

    toggleShowLog() {
        this.showlog = !this.showlog;
        if (this.showlog) {
            this.achievementReloadLog();
            this.jqAchievementLog.show();
        } else {
            this.jqAchievementLog.hide();
        }
    }

    achievementReloadLog() {
        this.jqAchievementLogInfoBody.find('tr:gt(0)').remove();

        for (let achievement of game.player.achievements) {
            const progress = Utils.Percent(
                achievement.count / achievement.objectCount,
                0
            );

            this.jqAchievementLogInfoBody.append(
                "<tr id='ad_" +
                    achievement.index +
                    "'>" +
                    "<td class='frame-stroke1'>" +
                    achievement.summary +
                    '</td>' +
                    "<td class='frame-stroke1'>" +
                    progress +
                    '</td>' +
                    '</tr>'
            );
        }
    }

    handleAchievement(achievement) {
        let htmlStr = '';

        if (achievement.count === achievement.objectCount) {
            htmlStr =
                '<p><h2>Achievement Completed</h2></p><p>' +
                achievement.summary +
                '</p>';
            game.userAlarm.alarm(htmlStr, this.hideDelay);
        }
        // FIX (perf): was rebuilding the entire achievement log table (DOM
        // remove + re-append per achievement) every single time any
        // achievement progressed, even while the log panel is closed and
        // invisible. questhandler.js's equivalent handler already gates its
        // own log rebuild behind `if (this.showlog)` - mirror that here.
        // toggleShowLog() already reloads the log when it's opened, so
        // nothing is missed: the log is simply rebuilt lazily instead of on
        // every progress tick.
        if (this.showlog) {
            this.achievementReloadLog();
        }
    }
}
