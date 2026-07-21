// Converted to a native ES6 module. This file never actually called AMD define() even though
// other files depend on it via define(['detect'], ...) - it just set a bare global `Detect` as a
// script side-effect and relied on consumers reading that global rather than the (effectively
// unshimmed/undefined) injected AMD parameter. Real ES6 imports below now resolve properly.
const Detect = {};

Detect.supportsWebSocket = function () {
    return window.WebSocket || window.MozWebSocket;
};

Detect.userAgentContains = function (string) {
    return navigator.userAgent.indexOf(string) !== -1;
};

Detect.isTablet = function (screenWidth) {
    return (
        screenWidth > 720 &&
        (Detect.userAgentContains('Android') ||
            Detect.userAgentContains('Mobile') ||
            Detect.userAgentContains('iPad'))
    );
};

Detect.isMobile = function () {
    return (
        Detect.userAgentContains('Mobile') || Detect.userAgentContains('iPhone')
    );
};

Detect.isWindows = function () {
    return Detect.userAgentContains('Windows');
};

Detect.isChromeOnWindows = function () {
    return (
        Detect.userAgentContains('Chrome') &&
        Detect.userAgentContains('Windows')
    );
};

Detect.isCanaryOnWindows = function () {
    return (
        Detect.userAgentContains('Chrome/52') &&
        Detect.userAgentContains('Windows')
    );
};

Detect.isEdgeOnWindows = function () {
    return (
        Detect.userAgentContains('Edge') && Detect.userAgentContains('Windows')
    );
};

Detect.isFirefox = function () {
    return Detect.userAgentContains('Firefox');
};

Detect.canPlayMP3 = function () {
    return Modernizr.audio.mp3;
};

Detect.isSafari = function () {
    return (
        Detect.userAgentContains('Safari') &&
        !Detect.userAgentContains('Chrome')
    );
};

Detect.isOpera = function () {
    return Detect.userAgentContains('Opera');
};

Detect.isFirefoxAndroid = function () {
    return (
        Detect.userAgentContains('Android') &&
        Detect.userAgentContains('Firefox')
    );
};

export default Detect;
