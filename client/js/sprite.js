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
import Animation from './animation.js';

export default class Sprite {
    constructor(data, scale, container) {
        this.name = data.id;
        this.file = data.file;
        this.scale = scale;
        this.container = container;
        this.offsetX = 0;
        this.offsetY = 0;
        this.data = data;

        this.loadJSON(data);

        this.createAnimations();
    }

    loadJSON(data) {
        this.id = data.id;

        if (this.file || data.file)
            this.filepath = 'img/' + this.scale + '/sprites/' + this.file;
        else
            this.filepath =
                'img/' + this.scale + '/sprites/' + this.id + '.png';

        this.animationData = data.animations;
        this.width = data.width;
        this.height = data.height;
        this.offsetX = data.offset_x ?? -16;
        this.offsetY = data.offset_y ?? -16;
    }

    createAnimations() {
        this.animations = {};

        for (let name in this.animationData) {
            const a = this.animationData[name];
            if (!a.hasOwnProperty('col')) a.col = 0;
            if (!a.hasOwnProperty('row')) a.row = 0;
            this.animations[name] = new Animation(
                name,
                a.length,
                a.col,
                a.row,
                this.width,
                this.height
            );
        }

        return this.animations;
    }

    getAnimationByName(name) {
        let animation = null;

        if (name in this.animations) {
            animation = this.animations[name];
        } else {
            const e = new Error();
            log.error(e.stack);
            log.error('No animation called ' + name);
        }
        return animation;
    }

    setAnimation(name, speed, count, onEndCount) {
        const self = this;

        if (this.currentAnimation && this.currentAnimation.name === name) {
            return;
        }

        const a = this.getAnimationByName(name);

        if (a) {
            this.currentAnimation = a;
            this.currentAnimation.setSpeed(speed);
            this.currentAnimation.setCount(count ? count : 0, onEndCount);
        }
    }
}
