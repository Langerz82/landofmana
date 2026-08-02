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
