// Converted from AMD (define) to a native ES6 module.
const config = {};

// Master switch for verbose client-side debug logging -- mirrors the
// gameserver's G_DEBUG (gameserver/js/main.js), driven by config_build.json
// (or config_build_live.json for the live build)'s own "debug": 0/1 key
// instead of a value hardcoded in source, so it can be toggled per
// deployment (local dev vs. the live/production build) without editing any
// .js file. `false` here is just the fallback for the window before the
// fetch below resolves (or if it fails, or the key is absent); it's
// reassigned to the real config-driven value once config.build is set.
// Like the gameserver's G_DEBUG, this has to be `let`, not `const`: any
// other module that does `import { G_DEBUG } from './config.js'` gets a
// live binding, so this reassignment is all that's needed for every such
// import to see the up-to-date value once the config loads -- no need to
// re-check config.waitForConfig() at every gated call site.
export let G_DEBUG = false;

fetch('./config/config_build.json')
    .then((response) => response.json())
    .then((json) => {
        config.build = json;
        G_DEBUG = !!json.debug;
    })
    // FIX: no .catch meant a failed fetch (network blip, 404, offline) left config.build
    // unset forever with no visible error; waitForConfig() below would then poll silently
    // every 100ms with no way to ever succeed. Surface the failure so it's at least visible.
    .catch((err) => {
        console.error('Failed to load config/config_build.json:', err);
    });

config.waitForConfig = function (callback) {
    if (config.hasOwnProperty('build')) {
        callback();
        return true;
    }
    setTimeout(function () {
        config.waitForConfig(callback);
    }, 100);
    return false;
};

export default config;
