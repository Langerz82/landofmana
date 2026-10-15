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
class TabButton {
    constructor(id, page) {
        const self = this;
        this.id = id;
        this.jqBody = $(id);
        this.page = page;

        this.visibleChangeHandler = null;

        this.jqBody.on('click', function (event) {
            if (self.page.parent.parent.showing) self.page.active();
        });
    }

    getVisible() {
        return this.jqBody.attr('class') === 'active';
    }
    setVisible(value) {
        if (value) {
            this.jqBody.addClass('active');
        } else {
            this.jqBody.removeClass('active');
        }
    }
}

export default class TabPage {
    constructor(parent, id, buttonId) {
        // FIX: was `this.parent;` - a no-op expression statement that discarded the `parent`
        // constructor argument entirely. Pages added via TabBook.add() got `this.parent` fixed
        // up later by setParent(), which masked this, but SkillPage (dialog/skilldialog.js) is
        // constructed directly (`new SkillPage(this)`) and never goes through TabBook.add(),
        // so its `this.parent` stayed undefined for the page's entire lifetime - active()
        // (`this.parent.setActivePage(this)`) would throw if ever called on it.
        this.parent = parent;
        this.id = id;
        this.jqBody = $(id);
        this.button = buttonId ? new TabButton(buttonId, this) : null;

        this.activeHandler = null;
    }

    getParent() {
        return this.parent;
    }
    setParent(value) {
        this.parent = value;
    }
    getVisible() {
        return this.jqBody.css('display') === 'block';
    }
    setVisible(value) {
        if (this.button) {
            this.button.setVisible(value);
        }
        this.jqBody.css('display', value ? 'block' : 'none');

        if (this.visibleChangeHandler) {
            // FIX: referenced undeclared `self` (only TabButton.setVisible has a `self`
            // local; this is TabPage.setVisible) - would throw ReferenceError the moment
            // any caller registered a handler via onVisibleChange(). Use `this`.
            this.visibleChangeHandler(this, value);
        }
    }

    active() {
        if (this.parent) {
            this.parent.setActivePage(this);
        }
    }

    onVisibleChange(handler) {
        this.visibleChangeHandler = handler;
    }
}
