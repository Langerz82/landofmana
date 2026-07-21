// Split out of map/mapentities.js -- the per-player outgoing packet queue
// (`packets`) and everything that reads/writes it: the 16ms flush
// (processPackets), and the three ways game code enqueues an outgoing
// message (sendToPlayer/sendBroadcast/sendNeighbours). Needs a
// back-reference to the owning MapEntities (`this.me`) for two things it
// doesn't own itself: getPlayerAround() (sendNeighbours' recipient list) and
// getEntityById()/server (processPackets' connection lookup). Nothing
// outside mapentities.js touches `packets`/`maxPackets` directly (confirmed:
// no external `entities.packets`/`entities.maxPackets` access anywhere in
// the codebase), so those stay fully private here; MapEntities keeps its
// existing processPackets/sendToPlayer/sendBroadcast/sendNeighbours method
// names as one-line delegates, so no external call site changes.
class MapBroadcaster {
    constructor(mapEntities) {
        this.me = mapEntities;
        this.maxPackets = 10;

        // PERF: was a plain object keyed by player id, iterated everywhere
        // (sendBroadcast/sendNeighbours/processPackets -- i.e. on every chat
        // message, attack, spawn/despawn, and every 16ms flush tick) via
        // Utils.forEach's `for...in` + `hasOwnProperty` loop. A Map avoids
        // the hasOwnProperty check per entry and iterates faster than
        // for...in over an object.
        this.packets = new Map();
    }

    registerPlayer(id) {
        this.packets.set(id, []);
    }

    unregisterPlayer(id) {
        this.packets.delete(id);
    }

    processPackets() {
        const self = this;

        // NOTE: the old `self.packets.length > 0` check was dead code even
        // before `packets` became a Map -- it was a plain object, which has
        // no `.length`, so this always compared `undefined > 0` (always
        // false) and the JSON.stringify of the *entire* packet queue never
        // actually ran. Dropped rather than "fixed": wiring it up for real
        // would mean unconditionally paying that stringify cost on this
        // 16ms flush tick for every map with players.

        // PERF: iterate the Map directly with for...of instead of
        // Utils.forEach's `for...in` + `hasOwnProperty` loop -- this runs
        // once every 16ms for every map that has players connected.
        for (const [id, packet] of this.packets) {
            const len = packet.length;
            if (len > 0) {
                const player = self.me.getEntityById(id);
                let conn = self.me.server.socket.getConnection(id);
                if (
                    player &&
                    player.map &&
                    player.mapStatus >= 2 &&
                    conn !== null &&
                    typeof conn !== 'undefined'
                ) {
                    const packets = [];
                    for (let i = 0; i < self.maxPackets; ++i) {
                        if (packet.length === 0) break;
                        packets.push(packet.shift());
                    }
                    conn.send(packets);
                } else {
                    conn = null;
                }
            }
        }
    }

    // FIX (perf): sendToPlayer/sendBroadcast/sendNeighbours each used to call
    // this.processPackets() immediately after queuing, on top of the
    // setInterval(processPackets, 16) flush already running for every map
    // with players (worldserver.js). processPackets() iterates every queued
    // player's packet list on the map, so every single event -- one chat
    // message, one attack, one item pickup -- paid a full
    // O(players-on-map) cost immediately, in addition to being flushed again
    // a few milliseconds later by the interval. Queuing here and letting the
    // 16ms interval be the sole flush point removes that redundant work;
    // worst case this delays delivery by <16ms, which is already the
    // effective batching granularity the interval assumes.
    sendToPlayer(player, message) {
        if (!message) return;

        if (player) {
            const queue = this.packets.get(player.id);
            if (queue) queue.push(message.serialize());
        }
    }

    sendBroadcast(message, ignoredPlayer) {
        if (!message) return;

        // PERF: message.serialize() (message.js) is a pure function of the
        // message's own fields -- it doesn't vary per recipient -- so it
        // only needs to be computed once per broadcast call instead of once
        // per connected player. This used to re-serialize the same message
        // from scratch for every single player on the map on every chat
        // message, spawn, despawn, and attack broadcast. The resulting array
        // is only ever read (never mutated) by the packet-flush/send path in
        // processPackets()/ws.js, so sharing one reference across every
        // player's queue is safe.
        const serialized = message.serialize();
        for (const [id, packet] of this.packets) {
            if (id !== ignoredPlayer) packet.push(serialized);
        }
    }

    sendNeighbours(entity, message, ignoredPlayer, areaLength) {
        const self = this;
        areaLength = areaLength || 64;
        const players = self.me.getPlayerAround(entity, areaLength);
        players.push(entity);

        // PERF: serialize once and share the reference across recipients --
        // see sendBroadcast above for why that's safe.
        const serialized = message.serialize();

        for (const player of players) {
            // NOTE: previously `packets.hasOwnProperty(player.id) && !ignoredPlayer ||
            // (ignoredPlayer && player !== ignoredPlayer)` -- because && binds tighter
            // than ||, the ignoredPlayer branch bypassed the hasOwnProperty check
            // entirely, so a player around who isn't the ignored one but somehow has
            // no packets entry would throw on push() below instead of being skipped.
            const queue = self.packets.get(player.id);
            if (queue && (!ignoredPlayer || player !== ignoredPlayer)) {
                queue.push(serialized);
            }
        }
    }
}

export default MapBroadcaster;
