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

// Mixin extracted from renderer.js/rendererdraw.js: debug/combat HUD text, terrain tile
// pass, FPS/coordinate readouts, cursor, announcement banner, and the letterbox
// cutscene bars (drawDebugInfo, drawCombatInfo, drawTerrain, drawCursor, drawAnnouncement,
// showCutScene/startCutScene/endCutScene).
// Applied onto Renderer.prototype via install*(...) call in renderer.js; not a standalone class.
/* global Utils, PIXI, Container */

// Guide arrows at the screen edge pointing at off-screen NPCs.
const GUIDE_NEAR_TILES = Infinity; // plain NPC arrows only for NPCs this close (tiles; Infinity = any distance on the map)
const GUIDE_MAX_NEAR = 4; // at most this many plain NPC arrows (nearest first)
const GUIDE_MARGIN = 40; // arrow distance from the screen edge (renderer px)
// Arrow size by the NPC's distance from the player: full size (x GUIDE_SCALE_CLOSE)
// at GUIDE_CLOSE_TILES or closer, shrinking to x GUIDE_SCALE_FAR at GUIDE_FAR_TILES+.
const GUIDE_CLOSE_TILES = 12;
const GUIDE_FAR_TILES = 80;
const GUIDE_SCALE_CLOSE = 1.3;
const GUIDE_SCALE_FAR = 0.5;

// Arrow size multiplier for an NPC `dist` world pixels from the player:
// bigger the closer it is.
function guideScale(dist, tilesize) {
    const t = Math.min(
        Math.max(
            (dist / tilesize - GUIDE_CLOSE_TILES) /
                (GUIDE_FAR_TILES - GUIDE_CLOSE_TILES),
            0
        ),
        1
    );
    return GUIDE_SCALE_CLOSE + (GUIDE_SCALE_FAR - GUIDE_SCALE_CLOSE) * t;
}
const GUIDE_COLOR = 0xffffff;
const GUIDE_QUEST_COLOR = 0xffd23f; // quest done: go back to this NPC

export function installRendererDrawHud(proto) {
    // Guide arrows: at the screen edge, pointing at nearby off-screen NPCs
    // (white, the nearest GUIDE_MAX_NEAR within GUIDE_NEAR_TILES) and at any
    // NPC the player has to return to for a completed quest (gold, pulsing,
    // at any distance on the map). A quest NPC that's on screen gets a
    // bobbing gold marker over its name instead. One Graphics redrawn each
    // frame, plus a cached name label per NPC.
    proto.drawGuideArrows = function () {
        const p = game.player;
        if (!p) return;

        let gfx = this.pxSprite['guide_gfx'];
        if (!gfx) {
            gfx = new PIXI.Graphics();
            gfx.zIndex = 998;
            Container.HUD.addChild(gfx);
            this.pxSprite['guide_gfx'] = gfx;
        }
        gfx.clear();

        const s = this.gameScale;
        const ts = this.tilesize;
        const c = this.camera;
        const W = this.renderer.screen.width / Container.HUD.scale.x;
        const H = this.renderer.screen.height / Container.HUD.scale.y;
        const area = game.currentMap && game.currentMap.currentCameraArea;
        const returns = game.getQuestReturnIds();
        const nearPx = GUIDE_NEAR_TILES * ts;
        const now = Date.now();

        const plain = [];
        const quest = [];
        for (const id in game.npc) {
            const n = game.npc[id];
            if (!n || n.isDead) continue;
            if (area && !area.contains(n)) continue;
            const isQuest = !!returns[n.npcQuestId];
            const sx = (n.x - c.x) * s;
            const sy = (n.y - c.y) * s;
            if (sx >= 0 && sx <= W && sy >= 0 && sy <= H) {
                if (isQuest) {
                    let y = sy - ts * s - 30;
                    if (n.type === Types.EntityTypes.NPCMOVE) y -= (ts / 2) * s;
                    y += Math.sin(now / 180) * 4;
                    gfx.lineStyle(2, 0x000000, 1);
                    gfx.beginFill(GUIDE_QUEST_COLOR, 1);
                    gfx.drawPolygon([sx, y, sx - 9, y - 12, sx + 9, y - 12]);
                    gfx.endFill();
                }
                continue;
            }
            const dist = Math.hypot(n.x - p.x, n.y - p.y);
            if (isQuest) {
                quest.push([n, sx, sy, dist]);
                continue;
            }
            // Nothing more for us there (no more quests): no arrow.
            if (game.npcNoQuests && game.npcNoQuests[n.npcQuestId]) continue;
            if (dist <= nearPx) plain.push([dist, n, sx, sy]);
        }
        plain.sort((a, b) => a[0] - b[0]);

        const shown = {};
        for (let i = 0; i < Math.min(plain.length, GUIDE_MAX_NEAR); i++) {
            const e = plain[i];
            this.drawEdgeArrow(gfx, e[1], e[2], e[3], W, H, GUIDE_COLOR, 0.85, false, now, guideScale(e[0], ts));
            shown[e[1].id] = true;
        }
        for (const e of quest) {
            this.drawEdgeArrow(gfx, e[0], e[1], e[2], W, H, GUIDE_QUEST_COLOR, 1, true, now, guideScale(e[3], ts));
            shown[e[0].id] = true;
        }

        // Hide the labels of NPCs that no longer get an arrow.
        for (const id in this.guideShown || {}) {
            if (shown[id]) continue;
            const lbl = this.pxSprite['guide_lbl_' + id];
            if (lbl) lbl.visible = false;
        }
        this.guideShown = shown;
    };

    // Arrow on the screen edge, on the line from the screen centre to the
    // off-screen point (tx, ty), pointing at it, with the NPC's name just
    // inside it. `scale` (guideScale()) makes it bigger the closer the NPC is.
    proto.drawEdgeArrow = function (gfx, npc, tx, ty, W, H, color, alpha, pulse, now, scale) {
        const cx = W / 2,
            cy = H / 2;
        const dx = tx - cx,
            dy = ty - cy;
        const len = Math.hypot(dx, dy);
        if (len < 1) return;
        const hw = Math.max(W / 2 - GUIDE_MARGIN, 1);
        const hh = Math.max(H / 2 - GUIDE_MARGIN, 1);
        const t = Math.min(
            hw / Math.max(Math.abs(dx), 0.001),
            hh / Math.max(Math.abs(dy), 0.001)
        );
        const px = cx + dx * t,
            py = cy + dy * t;
        const nx = dx / len,
            ny = dy / len;
        const sx = -ny,
            sy = nx;
        let size = (pulse ? 20 : 15) * (scale || 1);
        if (pulse) size *= 1 + 0.15 * Math.sin(now / 150);

        gfx.lineStyle(3, 0x000000, alpha);
        gfx.beginFill(color, alpha);
        gfx.drawPolygon([
            px + nx * size, py + ny * size,
            px - nx * size * 0.7 + sx * size * 0.85, py - ny * size * 0.7 + sy * size * 0.85,
            px - nx * size * 0.3, py - ny * size * 0.3,
            px - nx * size * 0.7 - sx * size * 0.85, py - ny * size * 0.7 - sy * size * 0.85
        ]);
        gfx.endFill();

        const key = 'guide_lbl_' + npc.id;
        let lbl = this.pxSprite[key];
        if (!lbl) {
            lbl = new PIXI.Text(npc.name || '', new PIXI.TextStyle({
                fontFamily: 'KomikaHand',
                fill: color,
                fontSize: 4 * this.scale,
                align: 'center',
                strokeThickness: 4
            }));
            lbl.anchor.set(0.5, 0.5);
            lbl.zIndex = 998;
            Container.HUD.addChild(lbl);
            this.pxSprite[key] = lbl;
        }
        lbl.style.fill = color;
        lbl.alpha = alpha;
        lbl.visible = true;
        const fs = 4 * this.scale;
        const lw = lbl.width / 2 + 4,
            lh = lbl.height / 2 + 4;
        lbl.x = Math.min(Math.max(px - nx * (size + fs), lw), W - lw);
        lbl.y = Math.min(Math.max(py - ny * (size + fs), lh), H - lh);
    };

    proto.drawDebugInfo = function () {
        const c = game.camera;
        let debugInfo = '';
        debugInfo += this.getFPS() + '\n';
        debugInfo += this.getCoordinates() + '\n';
        if (this.isDebugInfoVisible)
            debugInfo += this.getRealCoordinates() + '\n';

        const s = this.scale;
        let sprite = this.pxSprite['pc_coords'];
        if (!sprite) {
            const style = new PIXI.TextStyle({
                fontFamily: 'GraphicPixel',
                fill: 'white',
                fontSize: 18,
                align: 'right',
                stroke: 'black',
                strokeThickness: 4
            });
            sprite = new PIXI.Text(debugInfo, style);
            sprite.anchor.set(1.0, 0);
            sprite.zIndex = 999;
            Container.HUD.addChild(sprite);
            this.pxSprite['pc_coords'] = sprite;
        }
        sprite.text = debugInfo;
        sprite.x = ~~(this.renderer.screen.width / Container.HUD.scale.x);
        sprite.y = ~~(
            (this.renderer.screen.height / Container.HUD.scale.y) *
            0.06
        );
    };

    proto.drawCombatInfo = function () {
        const self = this;

        this.game.infoManager.forEachInfo(function (info) {
            const id = 'ci_' + info.id;

            let sprite = self.pxSprite[id];
            if (!sprite) {
                const style = new PIXI.TextStyle({
                    fontFamily: 'KomikaHand',
                    fill: info.fillColor,
                    fontSize: info.fontSize * self.scale,
                    align: 'center',
                    strokeThickness: 4
                });
                sprite = new PIXI.Text(info.value, style);
                sprite.anchor.set(0.5, 0);
                Container.HUD.addChild(sprite);
                self.pxSprite[id] = sprite;
            }
            const left = ~~((info.x - self.camera.x) * 3);
            const top = ~~((info.y - self.camera.y - self.tilesize) * 3);

            sprite.text = info.value;
            sprite.x = left;
            sprite.y = top;
            sprite.alpha = info.opacity;
        });
    };

    proto.getFPS = function () {
        const diffTime = Utils.getTime() - this.lastTime;

        if (diffTime >= 1000) {
            if (this.game.player.isMoving()) this.movingFPS = this.frameCount;
            this.realFPS = this.frameCount;
            this.frameCount = 0;
            this.lastTime = Utils.getTime();
        }
        this.frameCount++;
        return 'FPS: ' + this.realFPS;
    };

    proto.getCoordinates = function () {
        // on a section of a split map, show the position in the full map (the section's worldX/worldY offset)
        const m = game.currentMap;
        const realX = game.player.gx + ((m && m.worldX) || 0);
        const realY = game.player.gy + ((m && m.worldY) || 0);

        if (this.game.player) {
            return 'gx:' + realX + ',gy:' + realY;
        }
        return '';
    };

    proto.getRealCoordinates = function () {
        const realX = game.player.x;
        const realY = game.player.y;

        if (this.game.player) {
            return 'x:' + realX + ',y:' + realY;
        }
        return '';
    };

    proto.drawTerrain = function (ctx) {
        const self = this,
            p = game.player,
            mc = game.currentMap,
            tilesetwidth = this.tilesets[0].baseTexture.width / mc.tilesize;

        self.tilesetwidth = tilesetwidth;

        if (game.started) {
            // PERF: drawTile() used to take a single `[isHigh, id, x, y]`
            // array -- see the PERF comment on drawTile() itself
            // (rendererdrawsprites.js) for why passing the same four values
            // as plain arguments instead removes a per-tile, per-frame
            // array allocation on this loop.
            //
            // isHighTile()/high live directly on `mc` (map/mapobjects.js) - it's a
            // plain Map instance now (map/mapcamera.js's own render-grid/camera
            // logic is merged onto Map.prototype, see its own header comment). No
            // getMap(0)/null-map guard needed: `high` defaults to an empty object
            // until the map's own data has loaded (see map.js's constructor), so
            // isHighTile() naturally returns undefined (falsy, same as the old
            // `false` fallback) rather than throwing.
            game.camera.forEachVisibleValidPosition(
                function (x, y) {
                    if (mc.tileGrid[y][x] instanceof Array) {
                        for (let id of mc.tileGrid[y][x]) {
                            self.drawTile(
                                mc.isHighTile(id),
                                id,
                                x,
                                y
                            );
                        }
                    } else {
                        const id = mc.tileGrid[y][x];
                        if (id) {
                            self.drawTile(
                                mc.isHighTile(id),
                                id,
                                x,
                                y
                            );
                        }
                    }
                },
                0,
                null
            );
        }
    };

    proto.drawAnnouncement = function () {
        const id = 'announcement_0';

        let sprite = this.pxSprite[id];

        const announce = this.announcement;
        if (!announce) return;

        if (!sprite) {
            const style = new PIXI.TextStyle({
                fontFamily: 'KomikaHand',
                fill: '#FFFF00',
                fontSize: 6 * this.scale,
                align: 'center',
                strokeThickness: 4
            });
            sprite = new PIXI.Text(announce[0], style);
            sprite.anchor.set(0.5, 0.5);
            sprite.zIndex = 1000000;
            Container.HUD2.addChild(sprite);
            this.pxSprite[id] = sprite;
        }
        sprite.text = announce[0];
        sprite.updateTransform();
        sprite.updateText();
        sprite.position.x = this.renderer.width / 2;
        sprite.position.y = this.renderer.height / 4;
    };

    proto.drawCursor = function () {
        if (game.isMobile) return;
        if (!this.game.currentCursor) return;

        const mx = game.mouse.x,
            my = game.mouse.y;
        const anim = game.currentCursor.currentAnimation;

        if (anim) {
            const frame = anim.currentFrame;
            this.drawSpriteHUD(
                game.currentCursor.pjsSprite,
                frame.x,
                frame.y,
                anim.width,
                anim.height,
                mx,
                my,
                anim.width,
                anim.height
            );
        }
    };

    proto.showCutScene = function () {
        const width = ~~(this.jqContainer.width() * this.gameZoom);
        const height = ~~(this.jqContainer.height() * this.gameZoom);

        const w = width;
        const h = Math.floor(height / 8);
        const y2 = height;
        const y2max = y2 - h;
        const y = -h;
        const ymax = 0;

        let sprite = this.pxSprite['cutscene_1'];
        let sprite2 = this.pxSprite['cutscene_2'];
        if (!sprite) {
            const gfx = new PIXI.Graphics();
            gfx.beginFill(0x000000).drawRect(0, 0, w, h).endFill();

            const texture = this.renderer.generateTexture(gfx);
            sprite = new PIXI.Sprite(texture);
            Container.HUD.addChild(sprite);
            this.pxSprite['cutscene_1'] = sprite;

            sprite2 = new PIXI.Sprite(texture);
            Container.HUD.addChild(sprite2);
            this.pxSprite['cutscene_2'] = sprite2;

            sprite.y = y;
            sprite2.y = y2;
        }

        if (this.cutSceneActive) {
            if (sprite.y < ymax) sprite.y++;
            if (sprite2.y > y2max) sprite2.y--;
        } else {
            sprite.y--;
            sprite2.y++;
            if (sprite.y <= y && sprite2.y >= y2) {
                // Bars are fully retracted offscreen - tear them down so a future
                // startCutScene() rebuilds them cleanly instead of reusing stale sprites.
                Container.HUD.removeChild(sprite);
                Container.HUD.removeChild(sprite2);
                delete this.pxSprite['cutscene_1'];
                delete this.pxSprite['cutscene_2'];
            }
        }
    };

    proto.startCutScene = function () {
        this.cutSceneActive = true;
    };

    proto.endCutScene = function () {
        this.cutSceneActive = false;
    };
}
