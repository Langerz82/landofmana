// Converted from AMD (define) + Class.extend to a native ES6 module/class.
/* global Utils, Class, _, questSerial */

export default class AchievementHandler {
    constructor() {
      this.hideDelay = 5000; //How long the notification shows for.
      this.progressHideDelay = 1000;
      this.showlog = false;

      const self = this;
      this.closeButton = $('#achievementCloseButton');
      this.closeButton.click(function(event) {
        self.toggleShowLog();
      });
    }

    toggleShowLog() {
      this.showlog = !this.showlog;
      if (this.showlog) {
        this.achievementReloadLog();
        $('#achievementlog').show();
        //this.closeButton.show();
      } else {
        $('#achievementlog').hide();
        //this.closeButton.hide();
      }
    }

    achievementReloadLog() {
      $("#achievementLogInfo tbody").find("tr:gt(0)").remove();

      for (let achievement of game.player.achievements) {
        const progress = Utils.Percent(achievement.count / achievement.objectCount, 0);

        $('#achievementLogInfo tbody').append(
          "<tr id='ad_"+achievement.index+"'>" +
            "<td class='frame-stroke1'>" + achievement.summary + "</td>" +
            "<td class='frame-stroke1'>" + progress + "</td>" +
          "</tr>");
      }
    }

    handleAchievement(achievement) {
      let htmlStr = '';

      if (achievement.count === achievement.objectCount) {
        htmlStr = '<p><h2>Achievement Completed</h2></p><p>' + achievement.summary + '</p>';
        game.userAlarm.alarm(htmlStr, this.hideDelay);
      }
      this.achievementReloadLog();
    }
}
