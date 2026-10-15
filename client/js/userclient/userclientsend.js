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

// Mixin extracted from userclient.js: outbound sendXxx() message builders (each just packs
// args into a Types.UserMessages.* packet and calls sendMessage()). Applied onto
// UserClient.prototype via installUserClientSend(...) call in userclient.js; not a standalone
// class. Same split pattern used for gameclient/gameclient.js -> gameclient/gameclientsend.js.

/* global Types */

export function installUserClientSend(proto) {
    proto.sendUserConnected = function () {
        this.sendMessage([Types.UserMessages.CU_CONNECT_USER]);
    };

    proto.sendLoginUser = function (user) {
        this.sendMessage([
            Types.UserMessages.CU_LOGIN_USER,
            user.username,
            user.hash
        ]);
    };

    proto.sendCreateUser = function (user) {
        this.sendMessage([
            Types.UserMessages.CU_CREATE_USER,
            user.username,
            user.hash
        ]);
    };

    proto.sendRemoveUser = function (user) {
        this.sendMessage([
            Types.UserMessages.CU_REMOVE_USER,
            user.username,
            user.hash
        ]);
    };

    proto.sendLoginPlayer = function (worldIndex, playerIndex) {
        this.sendMessage([
            Types.UserMessages.CU_LOGIN_PLAYER,
            worldIndex,
            playerIndex
        ]);
    };

    proto.sendCreatePlayer = function (worldIndex, playerName) {
        this.sendMessage([
            Types.UserMessages.CU_CREATE_PLAYER,
            worldIndex,
            playerName
        ]);
    };
}
