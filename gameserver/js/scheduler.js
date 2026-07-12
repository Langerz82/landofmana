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

const pending = [];
let tickerStarted = false;
let nextToken = 1;

function ensureTickerStarted() {
    if (tickerStarted)
        return;
    tickerStarted = true;
    setInterval(function () {
        const now = Date.now();
        // Loop from the end so splice() during iteration doesn't skip
        // entries -- same technique mobAI.js uses for its mobsToRespawn scan.
        for (let i = pending.length - 1; i >= 0; i--) {
            const entry = pending[i];
            if (now < entry.deadline)
                continue;
            // Remove before invoking the callback: callbacks routinely
            // schedule/cancel other entries (e.g. item.js chaining its
            // despawn schedule() call from inside its blink callback, or
            // cancelling their own just-fired token as a defensive no-op) --
            // splicing first keeps this loop's view of `pending` consistent
            // no matter what the callback does.
            pending.splice(i, 1);
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
        pending.push({ token, deadline: Date.now() + delay, callback });
        return token;
    },

    // Cancels a pending schedule() call. Safe no-op if it already fired, was
    // already cancelled, or token is null/undefined -- mirrors the existing
    // behavior of Node's own clearTimeout() on an invalid/already-fired id,
    // so callers can keep unconditionally cancelling a possibly-null token
    // the same way they used to with clearTimeout().
    cancel(token) {
        if (token == null)
            return;
        const idx = pending.findIndex(e => e.token === token);
        if (idx >= 0)
            pending.splice(idx, 1);
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
