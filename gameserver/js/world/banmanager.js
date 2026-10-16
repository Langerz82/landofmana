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

import Messages from '../message.js';

class BanManager {
    constructor(world) {
        this.world = world;
        this.userBans = {};
    }

    saveBans() {
        const now = Date.now();

        const data = [];
        for (const username in this.userBans) {
            const banTime = this.userBans[username];
            if (banTime < now) continue;

            const rec = username + ',' + banTime;
            data.push(rec);
        }
        return data;
    }

    loadBans(msg) {
        const now = Date.now();

        for (const rec of msg) {
            const ban = rec.split(',');
            // FIX: `ban[1]` is a string from split() -- `now > ban[1]` and
            // `this.userBans[ban[0]] = ban[1]` happened to still work via
            // JS's numeric-string coercion on `<`/`>` and isUserBanned()'s
            // `> Date.now()` check, but banuser() (below) stores a real
            // number for the same map. Parsing here keeps the stored type
            // consistent between both code paths.
            const banTime = parseInt(ban[1], 10);
            if (now > banTime) continue;
            this.userBans[ban[0]] = banTime;
        }

        // Bans are userserver-wide: this list may include bans just issued
        // on another gameserver, so drop anyone online here who's now banned.
        this.kickBannedPlayers();
    }

    // Disconnects every online player whose account is currently banned.
    // Sends the same 'USER_BANNED' error a banned login gets (the client
    // shows it as the disconnect reason), then disconnects the socket. That
    // fires the connection's normal close handling (packetHandler onExit),
    // so the player is saved and removed from the world exactly as if they
    // had quit -- the same path the idle-timeout kick relies on.
    kickBannedPlayers() {
        // Copy: players leave world.players as their disconnects complete.
        for (const player of this.world.players.slice()) {
            if (!player.user || player.banKicked) continue;
            if (!this.isUserBanned(player.user.name)) continue;

            player.banKicked = true;
            console.info(
                'BanManager: disconnecting banned user ' +
                    player.user.name +
                    ' (player ' +
                    player.name +
                    ').'
            );
            try {
                player.connection.send(
                    new Messages.Error('USER_BANNED').serialize()
                );
            } catch (err) {
                console.warn('BanManager: ban notice send failed: ' + err);
            }
            player.connection.disconnect();
        }
    }

    isUserBanned(username) {
        if (
            this.userBans.hasOwnProperty(username) &&
            this.userBans[username] > Date.now()
        ) {
            return true;
        }
        return false;
    }

    banplayer(name, duration) {
        name = name.toLowerCase();
        const player = this.world.getPlayerByName(name);
        if (!player) {
            console.info('worldServer, banplayer: player not in world.');
            return;
        }
        const username = player.user.name;
        this.banuser(username, duration);
    }

    banuser(username, duration) {
        duration *= 86400 * 1000;
        const banTime = Date.now() + duration;
        this.userBans[username] = banTime;

        // Kick them here straight away; other gameservers kick them when
        // the userserver pushes the updated ban list (see loadBans()).
        this.kickBannedPlayers();

        // CHANGE: bans are userserver-wide now. Send the new ban to the
        // userserver straight away (it used to sit only in this
        // gameserver's memory until shutdown); the userserver stores it in
        // the shared ban list and pushes it to every gameserver.
        if (this.world.userHandler) {
            this.world.userHandler.sendBansData([username + ',' + banTime]);
        } else {
            console.warn(
                'banuser: userHandler not set -- ban will sync on next save.'
            );
        }
    }

    save() {
        if (this.world.userHandler) {
            const data = this.saveBans();
            this.world.userHandler.sendBansData(data);
            return true;
        } else {
            console.info('worldserver, save: userHandler not set');
        }
        return false;
    }
}

export default BanManager;
