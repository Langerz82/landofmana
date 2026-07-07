import _ from 'underscore';
import Memcache from 'memcache';

class Metrics {
    constructor(config) {
        this.config = config;
        this.client = new Memcache.Client(config.memcached_port, config.memcached_host);
        this.client.connect();

        this.isReady = false;
        this.readyCallback = null;

        this.client.on('connect', () => {
            console.info(`Metrics enabled: memcached client connected to ${config.memcached_host}:${config.memcached_port}`);
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
        const playerCount = _.reduce(worlds, (sum, world) => sum + world.playerCount, 0);

        if (this.isReady) {
            // Set the number of players on this server
            this.client.set(`player_count_${config.server_name}`, playerCount, () => {
                let totalPlayers = 0;

                // Recalculate the total number of players and set it
                _.each(config.game_servers, (server) => {
                    this.client.get(`player_count_${server.name}`, (error, result) => {
                        const count = result ? parseInt(result, 10) : 0;

                        totalPlayers += count;
                        numServers -= 1;

                        if (numServers === 0) {
                            this.client.set('total_players', totalPlayers, () => {
                                if (updatedCallback) {
                                    updatedCallback(totalPlayers);
                                }
                            });
                        }
                    });
                });
            });
        } else {
            console.error('Memcached client not connected');
        }
    }

    updateWorldDistribution(worlds) {
        this.client.set(`world_distribution_${this.config.server_name}`, worlds);
    }

    updateWorldCount() {
        this.client.set(`world_count_${this.config.server_name}`, this.config.nb_worlds);
    }

    getOpenWorldCount(callback) {
        this.client.get(`world_count_${this.config.server_name}`, (error, result) => {
            callback(result);
        });
    }

    getTotalPlayers(callback) {
        this.client.get('total_players', (error, result) => {
            callback(result);
        });
    }
}

export default Metrics;
