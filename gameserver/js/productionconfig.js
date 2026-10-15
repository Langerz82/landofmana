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

import { createRequire } from 'module';

// NOTE: `init()`/the constructor below needs a *synchronous*, dynamically
// computed require (the path depends on `config.production`, which isn't
// known until runtime). Static ES `import` statements only accept string
// literals, and dynamic `import()` is always asynchronous, which would
// change this constructor's (and its callers') behavior. `createRequire`
// is the standard, documented way to keep a synchronous, computed
// `require()` available inside an ES module, so it is used here to
// preserve the exact original behavior.
const require = createRequire(import.meta.url);

class ProductionConfig {
    constructor(config) {
        this.config = config;

        // FIX: config.production was concatenated straight into a require()
        // path with no validation. It's operator-controlled config today
        // (not remote/client input), so this wasn't reachable as a live
        // path-traversal bug, but there was nothing here stopping a value
        // like '../../../../etc/passwd%00' or '../secrets/whatever' from
        // being require()'d if this field's provenance ever changed (e.g.
        // became settable from a merged/less-trusted config source). Added a
        // whitelist check as cheap defense-in-depth: only plain filename
        // characters are allowed, matching what a real production_hosts/*.js
        // module name should look like.
        const isSafeProductionName =
            typeof config.production === 'string' &&
            /^[A-Za-z0-9_-]+$/.test(config.production);

        try {
            if (!isSafeProductionName)
                throw new Error(
                    'Invalid config.production value: ' + config.production
                );

            this.production = require(
                '../production_hosts/' + config.production + '.js'
            );
        } catch (err) {
            this.production = null;
        }
    }

    inProduction() {
        if (this.production !== null) {
            return this.production.isActive();
        }
        return false;
    }

    getProductionSettings() {
        if (this.inProduction()) {
            return this.production;
        }
    }
}

export default ProductionConfig;
