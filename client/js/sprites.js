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
/* global JSZipUtils, JSZip */
import fetchJsonSync from './lib/fetchjsonsync.js';

export default class Sprites {
    constructor(data) {
        const self = this;

        const $file = 'data/sprites/sprites.zip';
        JSZipUtils.getBinaryContent($file, function (err, data) {
            if (err) {
                console.error('Failed to load sprites.zip:', err);
                self.loadSpritesJSON();
                return;
            }

            JSZip.loadAsync(data)
                .then(function (zip) {
                    try {
                        // FIX: no .catch on this promise chain meant a corrupt/missing sprites.json
                        // entry silently hung sprite loading forever - the surrounding try/catch only
                        // catches synchronous setup errors, not this async rejection. Same class of
                        // bug map.js's own map<N>.json load used to guard against too, back when it
                        // also read from a zip (see map/mapcamera.js's own header comment - that's
                        // since been removed there, map.js fetches its data directly now).
                        zip.file('sprites.json')
                            .async('string')
                            .then(function (data) {
                                self.makeSprites(data);
                                game.setSpriteJSON();
                            })
                            .catch(function (err) {
                                console.error(
                                    'Failed to load sprites.json from zip:',
                                    err
                                );
                                self.loadSpritesJSON();
                            });
                    } catch (err) {
                        console.error(JSON.stringify(err));
                        self.loadSpritesJSON();
                    }
                })
                .catch(function (err) {
                    // FIX: if sprites.zip is present but fails to parse (corrupt file,
                    // stale/partial cached response, etc.) fall back to loading sprites.json
                    // directly instead of leaving this promise rejection unhandled.
                    console.error('Failed to load sprites.zip contents:', err);
                    self.loadSpritesJSON();
                });
        });
    }

    // FIX: fallback used whenever data/sprites/sprites.zip can't be loaded or parsed --
    // loads data/sprites/sprites.json directly instead, via the same fetchJsonSync helper
    // already used by the data/*.js modules (shared/data/items2.json etc.).
    loadSpritesJSON() {
        try {
            const spriteJson = fetchJsonSync('data/sprites/sprites.json');
            this.makeSprites(JSON.stringify(spriteJson));
            game.setSpriteJSON();
        } catch (err) {
            console.error('Failed to load sprites.json fallback:', err);
        }
    }

    makeSprites(data) {
        const sprites = {};

        const spriteJson = JSON.parse(data);
        for (let id in spriteJson) {
            const sprite = spriteJson[id];
            sprites[sprite.id] = sprite;
        }

        this.sprites = sprites;

        return sprites;
    }
}
