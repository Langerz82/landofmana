// Mixin extracted from userclient.js: outbound sendXxx() message builders (each just packs
// args into a Types.UserMessages.* packet and calls sendMessage()). Applied onto
// UserClient.prototype via installUserClientSend(...) call in userclient.js; not a standalone
// class. Same split pattern used for gameclient/gameclient.js -> gameclient/gameclientsend.js.

/* global Types */

export function installUserClientSend(proto) {

          proto.sendUserConnected = function() {
              this.sendMessage([Types.UserMessages.CU_CONNECT_USER]);
          };

          proto.sendLoginUser = function(user) {
            this.sendMessage([Types.UserMessages.CU_LOGIN_USER,
                              user.username,
                              user.hash]);
          };

          proto.sendCreateUser = function(user) {
            this.sendMessage([Types.UserMessages.CU_CREATE_USER,
                              user.username,
                              user.hash]);
          };

          proto.sendRemoveUser = function(user) {
            this.sendMessage([Types.UserMessages.CU_REMOVE_USER,
                              user.username,
                              user.hash]);
          };

          proto.sendLoginPlayer = function(worldIndex, playerIndex) {
            this.sendMessage([Types.UserMessages.CU_LOGIN_PLAYER,
                              worldIndex,
                              playerIndex]);
          };

          proto.sendCreatePlayer = function(worldIndex, playerName) {
            this.sendMessage([Types.UserMessages.CU_CREATE_PLAYER,
              worldIndex,
              playerName]);
          };

}
