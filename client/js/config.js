// Converted from AMD (define) to a native ES6 module.
const config = {};
fetch('./config/config_build.json')
    .then((response) => response.json())
    .then((json) => config.build = json)
    // FIX: no .catch meant a failed fetch (network blip, 404, offline) left config.build
    // unset forever with no visible error; waitForConfig() below would then poll silently
    // every 100ms with no way to ever succeed. Surface the failure so it's at least visible.
    .catch((err) => {
        console.error("Failed to load config/config_build.json:", err);
    });

config.waitForConfig = function(callback) {
    if (config.hasOwnProperty("build")) {
        callback();
        return true;
    }
    setTimeout(function() {
        config.waitForConfig(callback);
    }, 100);
    return false;
};

export default config;
