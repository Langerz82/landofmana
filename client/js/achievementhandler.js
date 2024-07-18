/* global Types, Class, _, questSerial */

define([], function() {

  var AchievementHandler = Class.extend({
    init: function() {
      this.hideDelay = 5000; //How long the notification shows for.
      this.progressHideDelay = 1000;
      this.showlog = false;

      var self = this;
      this.closeButton = $('#achievementCloseButton');
      this.closeButton.click(function(event) {
        self.toggleShowLog();
      });
    },

    /*achievementAlarmShow: function(str, delay) {
      delay = delay || this.hideDelay;
      $('#questalarm').html(str);
      $('#questalarm').fadeIn();
      setTimeout(function() {
        $('#questalarm').fadeOut();
      }, delay);
    },*/

    toggleShowLog: function() {
      this.showlog = !this.showlog;
      if (this.showlog) {
        this.achievementReloadLog();
        $('#achievementlog').css('display', 'block');
        $('#achievementCloseButton').css('display', 'block');
      } else {
        $('#achievementlog').css('display', 'none');
        $('#achievementCloseButton').css('display', 'none');
      }
    },

    achievementReloadLog: function() {
      $("#achievementLogInfo tbody").find("tr:gt(0)").remove();

      for (var achievement of game.player.achievements) {
        var progress = Number((achievement.count / achievement.objectCount) * 100).toFixed(0)+"%";

        $('#achievementLogInfo tbody').append(
          "<tr id='ad_"+achievement.index+"'>" +
            "<td class='frame-stroke1'>" + achievement.summary + "</td>" +
            "<td class='frame-stroke1'>" + progress + "</td>" +
          "</tr>");
      }
    },

    handleAchievement: function(achievement) {
      var htmlStr = '';

      if (achievement.count == achievement.objectCount) {
        htmlStr = '<p><h2>Achievement Completed</h2></p><p>' + achievement.summary + '</p>';
        game.userAlarm.alarm(htmlStr, this.hideDelay);
      }
      this.achievementReloadLog();
    }
  });
  return AchievementHandler;
});
