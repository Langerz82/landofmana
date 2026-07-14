// PERF: centralizes the many one-shot "run this callback once, N ms from
// now" deferred calls that used to be scattered across the entity code as
// independent setTimeout() calls -- one Node timer per dropped item's
// blink+despawn, per combat hit's hurt-flash, per stun's un-freeze, per
// depleted node/mob-area's respawn, per harvest attempt. All of that volume
// scales with combat/harvest/loot activity, i.e. directly with player count
// and playtime, so under real load these add up to a lot of independent
// timers all doing near-identical bookkeeping (check "has enough time
// passed yet?", fire a callback). A single shared low-resolution tick
// scanning one flat list of pending deadlines produces the exact same "fire
// once, ~N ms from now" behavior without a timer per call. Mirrors the
// pattern mobAI.js already used for mob respawns (mobsToRespawn, a flat
// list scanned once per its own tick) -- this generalizes that pattern for
// reuse anywhere in the codebase instead of every module reimplementing its
// own copy (see the git history of item.js for the first, one-off version
// of this before it was pulled out here).
//
// Resolution is intentionally coarse (50ms) rather than millisecond-exact:
// every caller in this codebase is either driving a brief visual cue
// (hurt-flash, ~75ms) or a multi-second-to-multi-minute cooldown (item
// despawn, node/mob-area respawn, harvest completion). 50ms of jitter is
// well under the game's own network latency budget (G_LATENCY = 75ms, see
// main.js) for the former, and utterly negligible for the latter.
//
// every() (below) builds a setInterval() replacement out of self-
// rescheduling schedule() calls, for worldserver.js's own recurring ticks
// (mob AI, roaming, regen, idle-timeout, save, notifications -- all
// periods >=256ms, so 50ms resolution is well under 20% jitter even on the
// tightest of them). Deliberately NOT used for worldserver.js's fastest two
// ticks (the ~32ms world-movement update and the 16ms packet flush): those
// need sub-50ms precision to stay smooth/responsive, so they're faster than
// this scheduler's own resolution and are left as plain setInterval().

const TICK_MS = 50;

// PERF: `pending` was a plain array of {token, deadline, callback} entries.
// The tick scan below needs to walk every entry regardless of structure, but
// cancel() (see below) only ever needs to reach *one* entry by its token --
// keying this by token in a Map turns that from an O(n) linear scan into an
// O(1) lookup+delete, while leaving the tick scan itself just as cheap as
// the old array (Map iteration is not meaningfully slower than array
// iteration for this purpose, and deleting during iteration is well-defined
// for Maps -- see the tick loop below).
const pending = new Map();
let tickerStarted = false;
let nextToken = 1;

function ensureTickerStarted() {
    if (tickerStarted)
        return;
    tickerStarted = true;
    setInterval(function () {
        const now = Date.now();
        // Deleting from a Map mid-iteration is safe and well-defined (unlike
        // a plain object, and unlike splicing an array out from under a
        // forward loop): entries already visited or deleted are simply
        // skipped, nothing is revisited or skipped incorrectly. Mirrors the
        // old array version's "loop backwards so splice() doesn't skip
        // entries" trick, just without needing the trick.
        for (const [token, entry] of pending) {
            if (now < entry.deadline)
                continue;
            // Remove before invoking the callback: callbacks routinely
            // schedule/cancel other entries (e.g. item.js chaining its
            // despawn schedule() call from inside its blink callback, or
            // cancelling their own just-fired token as a defensive no-op) --
            // deleting first keeps this loop's view of `pending` consistent
            // no matter what the callback does.
            pending.delete(token);
            entry.callback();
        }
    }, TICK_MS);
}

const Scheduler = {
    // Schedules `callback` to run once, approximately `delay` ms from now
    // (accurate to within TICK_MS). Returns a token usable with cancel().
    schedule(callback, delay) {
        ensureTickerStarted();
        const token = nextToken++;
        pending.set(token, { deadline: Date.now() + delay, callback });
        return token;
    },

    // PERF: this used to be pending.findIndex(e => e.token === token) -- an
    // O(n) linear scan across *every* pending scheduled callback server-wide
    // (every dropped item's blink/despawn, every stun/freeze, every depleted
    // node/mob-area respawn, every harvest attempt, every active skill
    // effect tick), no matter which module's timer was being cancelled. The
    // busiest single call site is entity/character.js's hurt(), which
    // cancels its own previous hurt-flash token on every single hit landed
    // by every player/mob in combat -- i.e. the highest-frequency call in
    // the game was paying for a scan sized by everyone else's pending timers
    // too. Keying `pending` by token (see above) makes this an O(1)
    // lookup+delete instead.
    //
    // Cancels a pending schedule() call. Safe no-op if it already fired, was
    // already cancelled, or token is null/undefined -- mirrors the existing
    // behavior of Node's own clearTimeout() on an invalid/already-fired id,
    // so callers can keep unconditionally cancelling a possibly-null token
    // the same way they used to with clearTimeout().
    cancel(token) {
        if (token == null)
            return;
        pending.delete(token);
    },

    // setInterval() replacement: runs `callback` repeatedly, approximately
    // every `period` ms, by having each tick reschedule the next one through
    // schedule() above. No cancel() support -- none of this codebase's
    // setInterval call sites this is meant to replace (worldserver.js's
    // world-tick loops) ever stop once started; they run for the life of
    // the process, same as the setIntervals they replace.
    every(callback, period) {
        function tick() {
            callback();
            Scheduler.schedule(tick, period);
        }
        Scheduler.schedule(tick, period);
    }
};

export default Scheduler;
