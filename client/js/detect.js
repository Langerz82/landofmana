// This file is part of Land of Mana (https://github.com/Langerz82/retrorpgonline2-client).
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
