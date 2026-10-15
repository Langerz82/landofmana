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
export default class TabBook {
    // FIX: constructor never declared a `parent` parameter, so `this.parent = parent` resolved
    // to the global `window.parent`, not anything meaningful. Every current subclass
    // (storedialog.js/craftdialog.js/auctiondialog.js/appearancedialog.js) immediately
    // re-assigns `this.parent = parent` right after calling super(), which masked this, but
    // any future subclass that didn't repeat that assignment would silently get window.parent.
    constructor(id, parent) {
        this.parent = parent;
        this.id = id;
        this.jqBody = $(id);
        this.pages = [];
        this.pageIndex = -1;

        this.openHandler = null;
    }

    getPageCount() {
        return this.pages.length;
    }
    getPageIndex() {
        return this.pageIndex;
    }
    setPageIndex(value) {
        if (this.pageIndex >= 0) {
            this.pages[this.pageIndex].setVisible(false);
        }
        if (value >= 0 && value < this.pages.length) {
            const done = this.openHandler
                ? this.openHandler(this, value)
                : true;
            if (done) {
                this.pageIndex = value;
                this.pages[this.pageIndex].setVisible(true);
            }
        } else {
            this.pageIndex = -1;
        }
    }
    getActivePage() {
        return this.pageIndex >= 0 ? this.pages[this.pageIndex] : null;
    }
    setActivePage(value) {
        const index = this.pages.indexOf(value);
        if (index >= 0) {
            this.setPageIndex(index);
        }
    }

    add(page) {
        page.setParent(this);
        this.pages.push(page);
    }

    onOpen(handler) {
        this.openHandler = handler;
    }
}
