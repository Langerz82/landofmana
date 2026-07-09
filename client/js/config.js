// Converted from AMD (define) to a native ES6 module.
const config = {};
fetch('./config/config_build.json')
    .then((response) => response.json())
    .then((json) => config.build = json);

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
