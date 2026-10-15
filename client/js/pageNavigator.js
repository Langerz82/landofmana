// This file is part of Land of Mana (https://github.com/Langerz82/landofmana).
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
export default class PageNavigator {
    constructor(parent, scale, name) {
        this.parent = parent;
        this.name = name || 'store';
        this.jqBody = $('#' + this.name + 'PageNav');
        this.jqMovePreviousButton = $('#' + this.name + 'PageNavPrev');
        this.jqNumbers = [];
        for (let index = 0; index < 5; index++) {
            this.jqNumbers.push($('#' + this.name + 'PageNavNumber' + index));
        }
        this.jqMoveNextButton = $('#' + this.name + 'PageNavNext');

        this.changeHandler = null;

        this.rescale(scale);

        const self = this;

        this.jqMovePreviousButton.click(function (event) {
            if (!self.parent.visible) return;

            if (self.index > 1) {
                self.setIndex(self.index - 1);
            }
        });
        this.jqMoveNextButton.click(function (event) {
            if (!self.parent.visible) return;

            if (self.index < self.count) {
                self.setIndex(self.index + 1);
            }
        });
    }

    rescale(scale) {}

    getCount() {
        return this.count;
    }
    setCount(value) {
        this.count = value;

        this.jqNumbers[3].html(~~(value / 10));
        this.jqNumbers[4].html(value % 10);
    }
    getIndex() {
        return this.index;
    }
    setIndex(value) {
        this.pageChanged = this.index !== value;
        this.index = value;

        this.jqNumbers[0].html(~~(value / 10));
        this.jqNumbers[1].html(value % 10);

        this.jqMovePreviousButton.attr(
            'class',
            this.index > 1 ? 'enabled' : ''
        );
        this.jqMoveNextButton.attr(
            'class',
            this.index < this.count ? 'enabled' : ''
        );

        if (this.pageChanged && this.changeHandler) {
            this.changeHandler(this);
        }
    }
    getVisible() {
        return this.jqBody.css('display') === 'block';
    }
    setVisible(value) {
        this.jqBody.css('display', value ? 'block' : 'none');
    }

    onChange(handler) {
        this.changeHandler = handler;
    }

    open() {
        this.setIndex(1);
        this.setVisible(this.index < this.count);
    }
}
