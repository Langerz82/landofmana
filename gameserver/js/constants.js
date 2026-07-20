// Shared, static server constants -- pulled out of main.js because main.js
// is the process entry point (config loading, server bootstrap, shutdown),
// not a natural home for values that ~25 unrelated files across area/,
// entity/, map/, packets/, etc. need just to get a tile size or a debug
// flag. Historically everything below lived in main.js: in the project's
// original CommonJS/sloppy-mode form, assigning a bare identifier anywhere
// implicitly created a property on Node's `global` object, so any file could
// reach `G_TILESIZE`/`mobState` as a leaked global no matter where it was
// declared. Once the codebase moved to real ES modules that trick stopped
// working, and the constants were turned into named exports of main.js as a
// stopgap -- which meant every consumer's dependency graph pointed at the
// bootstrap file. Moving them here keeps main.js scoped to what it actually
// does and gives every other module an honest "I depend on constants"
// import instead of "I depend on the entry point".
export const G_LATENCY = 75;
export const G_ROUNDTRIP = G_LATENCY * 2;

export const G_TILESIZE = 16;

export const G_FRAME_INTERVALS = 2;
export const G_FRAME_INTERVAL_EXACT = (1000/60);
export const G_FRAME_INTERVAL = ~~(G_FRAME_INTERVAL_EXACT);
export const G_UPDATE_INTERVAL = ~~(G_FRAME_INTERVAL*G_FRAME_INTERVALS);
export const G_INTERVAL =( G_UPDATE_INTERVAL * G_FRAME_INTERVALS);

// PERF: spatial-hash cell size (in tiles) used by map/mapentities.js's
// spatial grid (getSpatialEntities/addSpatial/removeSpatial), which backs
// every proximity query in the game -- sendNeighbours()/processWho()
// (r=64, the most frequent query in the codebase: fires on essentially
// every move/attack/chat/spawn/despawn/harvest/block broadcast),
// MobAI.Roaming() (r=32, once/sec/player), MobAI.checkAggro() (r=4,
// once/sec/mob -- the highest raw query *count* since a populated map can
// have hundreds of mobs), and checkChase()'s overlap check (r=1).
//
// Benchmarked by reproducing this exact bucket grid plus the real mob
// layout from map/mapmanager.js's map1 spawn logic (~875 mobs across 51
// mob areas) and the query mix above, sweeping cell size 8-48 across map
// sizes 1024/2048/4096 tiles and 20/60/120 concurrent players. Cells much
// smaller than this make every query touch dozens of mostly-empty buckets
// (pure iteration overhead); cells much larger make every query drag in
// 2-3x more candidate entities than actually match the exact-distance
// filter afterward (pure waste). 24 came out fastest overall and stayed
// competitive-or-best as player count scaled up specifically, beating the
// previous value of 32 by ~6.5% in aggregate (and by more at higher
// concurrent player counts).
export const G_SPATIAL_SIZE = 24;

export const G_SCREEN_WIDTH = 34;
export const G_SCREEN_HEIGHT = 18;

export const ATTACK_INTERVAL = 1000 - G_UPDATE_INTERVAL;
export const ATTACK_MAX = 1000;

export const PLAYER_SAVE_INTERVAL = 1800000;

// NOTE: STUCK is currently unused -- nothing in the codebase ever calls
// mob.setAiState(mobState.STUCK), even though mobai.js's checkReturn() has a
// branch that treats it the same as CHASING/ROAMING. It looks like it was
// meant to be set from checkChase()'s "can't reach a target that hasn't
// moved" case (see the FIX comment there), but never was -- which used to
// mean a mob in that situation could sit forever, never re-checked by
// checkReturn() at all. That's fixed now by re-running checkReturn() from
// inside the existing CHASING state instead (mobai.js), so introducing an
// actual STUCK transition wasn't necessary to fix the soft-lock. Left
// defined (and still accepted by checkReturn()) as a reserved value rather
// than removed, in case a future change wants a state that's visibly
// distinct from "actively pathing toward target" (e.g. for a different
// client-side animation) -- just be aware nothing sets it today.
export const mobState = {
    IDLE: 1,
    ROAMING: 2,
    AGGRO: 3,
    CHASING: 4,
    ATTACKING: 5,
    RETURNING: 6,
    STUCK: 7
};

// PERF: Master switch for verbose per-tick/per-packet debug logging
// (console.info/log.info calls that JSON.stringify packets, paths, damage
// events, etc.). Those calls run on literally every incoming packet, every
// combat hit, and every pathfind, so leaving them unconditionally on costs
// real CPU under load -- the string building/JSON.stringify happens whether
// or not the log line is actually useful to anyone.
//
// `false` here is just the fallback in case config.json has no `debug` key
// (or fails to load before something reads G_DEBUG). The real switch is
// config.json's `"debug": 0`/`"debug": 1` -- see main.js's main(config),
// which calls setG_DEBUG(!!config.debug) once the config file is read.
//
// This has to be a mutable module-scoped `let`, not a `const`: every module
// that gates logging on G_DEBUG does `import { G_DEBUG } from
// '../constants.js'`, and ES module named imports are live bindings, so
// updating the value here is what makes every one of those already-imported
// references see the config-driven value with no extra plumbing needed
// anywhere else. The catch is that a live binding can only be reassigned by
// the module that declared it -- main.js can't `import { G_DEBUG }` and then
// set it directly (that throws), which is why setG_DEBUG() exists below as
// the one function allowed to mutate it.
export let G_DEBUG = false;

export function setG_DEBUG(value) {
    G_DEBUG = value;
}
