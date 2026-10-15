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

// Converted from AMD (define) + Class.extend to a native ES6 module/class.
function isUndefined(value) {
    return typeof value === 'undefined';
}

function isObject(value) {
    return typeof value === 'object';
}

function assign(target, source1, source2, items) {
    let index, item;
    for (index = 0; index < items.length; index++) {
        item = items[index];
        if (isObject(source1) && !isUndefined(source1[item])) {
            target[item] = source1[item];
        } else if (isObject(source2) && !isUndefined(source2[item])) {
            target[item] = source2[item];
        }
    }
}

function indexOf(array_, value, default_) {
    const result = array_.indexOf(value);
    return result >= 0 ? result : default_;
}

export default class Button2 {
    // kind - normal: 0, disabled: 1, downed: 2, overed: 3, blinked: 4
    constructor(id, configure) {
        this.id = id + 'button';
        this.id2 = id + 'text';
        this.background = {};
        assign(
            this.background,
            configure.background,
            Button2.configure.background,
            ['left', 'top', 'width']
        );
        this.kinds = isObject(configure.kinds)
            ? configure.kinds
            : isObject(Button2.configure.kinds)
              ? Button2.configure.kinds
              : [0];
        this.visible = isUndefined(configure.visible)
            ? true
            : configure.visible;
        this.enabled = isUndefined(configure.enabled)
            ? true
            : configure.enabled;
        this.downed = isUndefined(configure.downed) ? false : configure.downed;
        this.overed = false;
        this.blinked = false;
        this.blinkFlag = false;
        this.blinkHandle = null;
        this.jqBody = $(this.id);
        this.jqBodyText = $(this.id2);
        this.kind = -1;
        this.clickHandler = null;

        this.refresh();

        this.jqBody.bind(
            'click',
            function (event) {
                if (this.enabled && this.clickHandler) {
                    this.clickHandler(this, event);
                }
            }.bind(this)
        );
        this.jqBodyText.bind(
            'click',
            function (event) {
                if (this.enabled && this.clickHandler) {
                    this.clickHandler(this, event);
                }
            }.bind(this)
        );

        if (this.kinds.indexOf(3) >= 0) {
            this.jqBody.unbind('mouseover').bind(
                'mouseover',
                function (event) {
                    this.overed = true;
                    this.refresh();
                }.bind(this)
            );
            this.jqBody.unbind('mouseout').bind(
                'mouseout',
                function (event) {
                    this.overed = false;
                    this.refresh();
                }.bind(this)
            );
        }
    }

    setBackground(background) {
        this.background = background;
        this.kind = this.kind ? this.kind : 0;
        this.setBackgroundPosition(this.kind);
    }

    getBackgroundPosition(kind) {
        const left = isUndefined(this.background.left)
                ? 0
                : this.background.left,
            top = isUndefined(this.background.top) ? 0 : this.background.top,
            width = isUndefined(this.background.width)
                ? 25
                : this.background.width,
            index = indexOf(this.kinds, kind, 0);
        return '-' + (left + width * index) + 'px -' + top + 'px';
    }

    setBackgroundPosition(kind) {
        this.kind = kind;
        this.jqBody.css(
            'background-position',
            this.getBackgroundPosition(kind)
        );
    }

    refresh() {
        if (this.visible) {
            this.setBackgroundPosition(
                this.enabled
                    ? this.overed
                        ? 3
                        : this.downed
                          ? 2
                          : this.blinked
                            ? this.blinkFlag
                                ? 4
                                : 0
                            : 0
                    : 1
            );
        }
    }

    show() {
        this.visible = true;
        this.jqBody.show();
    }

    hide() {
        this.visible = false;
        this.jqBody.hide();
    }

    enable() {
        this.enabled = true;
        this.refresh();
    }

    disable() {
        if (this.blinked) {
            this.blink(false);
        }

        this.enabled = false;
        this.refresh();
    }

    down() {
        this.downed = true;
        if (this.enabled) {
            this.refresh();
        }
    }

    up() {
        this.downed = false;
        if (this.enabled) {
            this.refresh();
        }
    }

    blink(flag) {
        if (this.enabled) {
            if (flag) {
                if (this.kinds.indexOf(4) >= 0 && !this.blinked) {
                    this.blinkFlag = false;
                    this.blinkHandle = setInterval(
                        function () {
                            this.blinkFlag = !this.blinkFlag;
                            this.refresh();
                        }.bind(this),
                        500
                    );
                    this.blinked = true;
                }
            } else {
                if (this.blinked) {
                    clearInterval(this.blinkHandle);
                    this.blinkHandle = null;
                    this.blinked = false;
                    this.refresh();
                }
            }
        }
    }

    onClick(handler) {
        this.clickHandler = handler;
    }
}
Button2.configure = {};
