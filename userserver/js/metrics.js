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

import _ from 'underscore';
import Memcache from 'memcache';

class Metrics {
    constructor(config) {
        this.config = config;
        this.client = new Memcache.Client(
            config.memcached_port,
            config.memcached_host
        );
        this.client.connect();

        this.isReady = false;
        this.readyCallback = null;

        this.client.on('connect', () => {
            console.info(
                `Metrics enabled: memcached client connected to ${config.memcached_host}:${config.memcached_port}`
            );
            this.isReady = true;

            if (this.readyCallback) {
                this.readyCallback();
            }
        });
    }

    ready(callback) {
        this.readyCallback = callback;
    }

    updatePlayerCounters(worlds, updatedCallback) {
        const config = this.config;
        let numServers = _.size(config.game_servers);
        const playerCount = _.reduce(
            worlds,
            (sum, world) => sum + world.playerCount,
            0
        );

        if (this.isReady) {
            // Set the number of players on this server
            this.client.set(
                `player_count_${config.server_name}`,
                playerCount,
                () => {
                    let totalPlayers = 0;

                    // Recalculate the total number of players and set it
                    _.each(config.game_servers, (server) => {
                        this.client.get(
                            `player_count_${server.name}`,
                            (error, result) => {
                                const count = result ? parseInt(result, 10) : 0;

                                totalPlayers += count;
                                numServers -= 1;

                                if (numServers === 0) {
                                    this.client.set(
                                        'total_players',
                                        totalPlayers,
                                        () => {
                                            if (updatedCallback) {
                                                updatedCallback(totalPlayers);
                                            }
                                        }
                                    );
                                }
                            }
                        );
                    });
                }
            );
        } else {
            console.error('Memcached client not connected');
        }
    }

    updateWorldDistribution(worlds) {
        this.client.set(
            `world_distribution_${this.config.server_name}`,
            worlds
        );
    }

    updateWorldCount() {
        this.client.set(
            `world_count_${this.config.server_name}`,
            this.config.nb_worlds
        );
    }

    getOpenWorldCount(callback) {
        this.client.get(
            `world_count_${this.config.server_name}`,
            (error, result) => {
                callback(result);
            }
        );
    }

    getTotalPlayers(callback) {
        this.client.get('total_players', (error, result) => {
            callback(result);
        });
    }
}

export default Metrics;
