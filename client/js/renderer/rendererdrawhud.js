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
const GUIDE_COLOR = 0x00ffff; // NPC with quests for the player
const GUIDE_QUEST_COLOR = 0xffd23f; // quest done: go back to this NPC
const GUIDE_MOB_COLOR = 0xffffff; // mob to kill for an active quest (kill / collect items)
// Overall size of the guide arrows and their name text (1 = normal; default 1.25). Change it
// at runtime with game.renderer.guidePointerScale.
const GUIDE_POINTER_SCALE = 1.25;
// Mobs of one kind near a group's lead mob share one arrow (at the group's
// middle, labelled "Name xN"); at most GUIDE_MOB_MAX_GROUPS arrows per kind,
// nearest first. "Near" grows with the lead's distance from the player: far
// away mobs group loosely, close ones tightly. Group radius (tiles) =
// distance (tiles) x GUIDE_MOB_GROUP_RATIO, kept between GUIDE_MOB_GROUP_MIN_TILES
// and GUIDE_MOB_GROUP_MAX_TILES.
const GUIDE_MOB_GROUP_RATIO = 0.25;
const GUIDE_MOB_GROUP_MIN_TILES = 2;
const GUIDE_MOB_GROUP_MAX_TILES = 20;

// Group radius (world px) for a lead mob `dist` world px from the player.
function guideGroupRadius(dist, tilesize) {
    const tiles = Math.min(
        Math.max((dist / tilesize) * GUIDE_MOB_GROUP_RATIO, GUIDE_MOB_GROUP_MIN_TILES),
        GUIDE_MOB_GROUP_MAX_TILES
    );
    return tiles * tilesize;
}
const GUIDE_MOB_MAX_GROUPS = 3;
// Mob arrows stick to the groups they point at (no flipping as mobs wander):
// another group only takes an arrow's place when it's at least
// GUIDE_MOB_SWITCH_RATIO and GUIDE_MOB_SWITCH_TILES closer.
const GUIDE_MOB_SWITCH_RATIO = 0.25;
const GUIDE_MOB_SWITCH_TILES = 3;
// How fast a mob arrow's target point eases toward its group's centre (per
// second; higher = snappier). Smoothed in world space, so the arrow tracks the
// camera exactly and only the target's own jumps (server position snaps,
// mobs joining / leaving the group) glide. Frame-rate independent.
const GUIDE_MOB_FOLLOW_RATE = 5;
// When a group's lead changes (lead died, walked on screen, group re-formed),
// the new arrow carries on from the old one (glides instead of snapping) if
// it's the same group: they share a mob, or are within this many tiles. An
// arrow switching to a different group never glides over (that would sweep it
// across the screen): the old one fades out and the new one fades in.
const GUIDE_MOB_INHERIT_TILES = 4;
// A mob stays in the group it was in last frame until it's this many times
// the group radius from the group's lead (new mobs join within the radius), so
// mobs wandering around the group's edge - or the player walking toward or
// away from it - don't keep splitting / merging the arrows.
const GUIDE_MOB_KEEP_RATIO = 1.5;
// A mob only switches between "on screen" (marker) and "off screen" (arrow)
// once it's this far (renderer px) past the screen edge, so one walking along
// the edge doesn't flicker between the two.
const GUIDE_MOB_EDGE_PX = 24;
// Mob arrows fade in / out over this long (ms) instead of popping in / out.
const GUIDE_MOB_FADE_MS = 250;

// Mob kinds the player has to kill for an unfinished quest: the target of a
// kill-mob-kind quest, or the mob dropping a collect-items quest's items.
// npcQuestIds of the NPCs whose quest the player has accepted and not finished.
function guideActiveQuestNpcs() {
    const ids = {};
    const quests = (game.player && game.player.quests) || {};
    for (const q of Object.values(quests)) {
        if (q && q.status !== Types.QuestStatus.COMPLETE) ids[q.npcQuestId] = true;
    }
    return ids;
}

function guideMobKinds() {
    const kinds = {};
    const quests = (game.player && game.player.quests) || {};
    for (const q of Object.values(quests)) {
        if (!q || q.status === Types.QuestStatus.COMPLETE || !q.object) continue;
        if (q.type === Types.QuestType.KILLMOBKIND) {
            if (q.object.count > 0 && q.count < q.object.count)
                kinds[q.object.kind] = true;
        } else if (q.type === Types.QuestType.GETITEMKIND) {
            if (q.object2 && q.object2.count > 0 && q.count < q.object2.count)
                kinds[q.object.kind] = true;
        }
    }
    return kinds;
}

export function installRendererDrawHud(proto) {
    // Guide arrows: at the screen edge, pointing at nearby off-screen NPCs
    // (white, the nearest GUIDE_MAX_NEAR within GUIDE_NEAR_TILES) and at any
    // NPC the player has to return to for a completed quest (gold, pulsing,
    // at any distance on the map). A quest NPC that's on screen gets a
    // bobbing gold marker over its name instead. NPCs with quests for the
    // player get cyan arrows; the nearest off-screen mob of each kind needed
    // for an unfinished kill / collect-items quest gets a white one. One
    // Graphics redrawn each frame, plus a cached name label per NPC / mob.
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

        const active = guideActiveQuestNpcs();
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
                // On screen: bobbing marker over its name instead of an arrow
                // (gold: quest to hand in; cyan: new quest for us).
                if (isQuest) this.drawGuideMarker(gfx, n, sx, sy, GUIDE_QUEST_COLOR, now);
                else if (!(game.npcNoQuests && game.npcNoQuests[n.npcQuestId]) && !active[n.npcQuestId])
                    this.drawGuideMarker(gfx, n, sx, sy, GUIDE_COLOR, now);
                continue;
            }
            const dist = Math.hypot(n.x - p.x, n.y - p.y);
            if (isQuest) {
                quest.push([n, sx, sy, dist]);
                continue;
            }
            // Nothing more for us there (no more quests): no arrow.
            if (game.npcNoQuests && game.npcNoQuests[n.npcQuestId]) continue;
            // Their quest is already under way: no arrow until it's done.
            if (active[n.npcQuestId]) continue;
            if (dist <= nearPx) plain.push([dist, n, sx, sy]);
        }
        plain.sort((a, b) => a[0] - b[0]);

        // Off-screen mobs of each quest-target kind, in groups: mobs within
        // guideGroupRadius() of a group's lead share one arrow. Groups
        // shown last frame are formed first around the same lead and keep
        // their members out to GUIDE_MOB_KEEP_RATIO x that, so they keep their
        // identity, and keep their arrow unless another group is clearly
        // closer (GUIDE_MOB_SWITCH_*).
        const mobKinds = guideMobKinds();
        const groups = []; // {kind, lead, members, x, y, dist, key, alpha}
        const tracked = this.guideMobGroups || (this.guideMobGroups = {}); // kind -> {lead id: [member ids]}
        const onScreen = this.guideMobOnScreen || new Set();
        const nowOn = new Set();
        const radius = (lead) => guideGroupRadius(Math.hypot(lead.x - p.x, lead.y - p.y), ts);
        const near = (a, b, px) => Math.hypot(a.x - b.x, a.y - b.y) <= px;
        for (const kind in mobKinds) {
            const cands = []; // [mob, dist]
            for (const e of this.guideMobsOfKind(Number(kind))) {
                if (area && !area.contains(e)) continue;
                const sx = (e.x - c.x) * s;
                const sy = (e.y - c.y) * s;
                // Was on screen: has to get well off it to get an arrow; and the reverse.
                const m = onScreen.has(e.id) ? -GUIDE_MOB_EDGE_PX : GUIDE_MOB_EDGE_PX;
                if (sx >= m && sx <= W - m && sy >= m && sy <= H - m) {
                    // On screen: white bobbing marker over it instead.
                    nowOn.add(e.id);
                    this.drawGuideMarker(gfx, e, sx, sy, GUIDE_MOB_COLOR, now);
                    continue;
                }
                cands.push([e, Math.hypot(e.x - p.x, e.y - p.y)]);
            }
            const prev = tracked[kind] || {};
            const isPrev = (e) => prev[e.id] !== undefined;
            cands.sort((a, b) => (isPrev(b[0]) - isPrev(a[0])) || a[1] - b[1]);
            const used = new Set();
            const byLead = new Map(); // lead -> members
            // 1) Last frame's groups: same lead, keep their old members.
            for (const [lead] of cands) {
                if (!isPrev(lead)) break; // previous leads sort first
                used.add(lead);
                byLead.set(lead, [lead]);
            }
            for (const [lead, members] of byLead) {
                const was = prev[lead.id];
                const keepPx = radius(lead) * GUIDE_MOB_KEEP_RATIO;
                for (const [e] of cands)
                    if (!used.has(e) && was.includes(e.id) && near(e, lead, keepPx)) {
                        used.add(e);
                        members.push(e);
                    }
            }
            // 2) Everything else joins / forms groups as usual.
            for (const [lead] of cands) {
                let members = byLead.get(lead);
                if (!members) {
                    if (used.has(lead)) continue;
                    used.add(lead);
                    byLead.set(lead, (members = [lead]));
                }
                const groupPx = radius(lead);
                for (const [e] of cands)
                    if (!used.has(e) && near(e, lead, groupPx)) {
                        used.add(e);
                        members.push(e);
                    }
            }
            const kindGroups = [];
            for (const [lead, members] of byLead) {
                let mx = 0,
                    my = 0;
                for (const e of members) {
                    mx += e.x;
                    my += e.y;
                }
                mx /= members.length;
                my /= members.length;
                const dist = Math.hypot(mx - p.x, my - p.y);
                // A group already shown ranks as if this much closer.
                const rank = isPrev(lead)
                    ? dist - Math.max(dist * GUIDE_MOB_SWITCH_RATIO, GUIDE_MOB_SWITCH_TILES * ts)
                    : dist;
                kindGroups.push({ kind, lead, members, x: mx, y: my, dist, rank });
            }
            kindGroups.sort((a, b) => a.rank - b.rank);
            const chosen = kindGroups.slice(0, GUIDE_MOB_MAX_GROUPS);
            const next = {};
            for (const g of chosen) next[g.lead.id] = g.members.map((e) => e.id);
            tracked[kind] = next;
            for (const g of chosen) groups.push(g);
        }
        this.guideMobOnScreen = nowOn;
        // Forget the groups of kinds no longer needed.
        for (const kind in tracked) if (!mobKinds[kind]) delete tracked[kind];

        // One smoothed arrow state per group, keyed by kind + lead (world-space
        // target, so it tracks the camera exactly; alpha for fading). A new
        // group (new lead) takes over the state of the same group under its
        // old lead; states nobody takes over fade out where they were.
        const smooth = this.guideMobPos || (this.guideMobPos = {});
        const inheritPx = GUIDE_MOB_INHERIT_TILES * ts;
        const live = {};
        for (const g of groups) live[(g.key = g.kind + ':' + g.lead.id)] = g;
        const orphans = Object.keys(smooth).filter((k) => !live[k]);
        for (const g of groups) {
            if (smooth[g.key]) continue;
            let best = -1,
                bestD = Infinity;
            for (let i = 0; i < orphans.length; i++) {
                const o = smooth[orphans[i]];
                if (o.kind !== g.kind) continue;
                const d = Math.hypot(o.x - g.x, o.y - g.y);
                const same = d <= inheritPx || g.members.some((e) => o.ids.includes(e.id));
                if (same && d < bestD) {
                    bestD = d;
                    best = i;
                }
            }
            if (best >= 0) {
                smooth[g.key] = smooth[orphans[best]];
                delete smooth[orphans[best]];
                orphans.splice(best, 1);
            } else smooth[g.key] = { kind: g.kind, x: g.x, y: g.y, t: now, a: 0 };
        }
        const shown = {};
        for (const k in smooth) {
            const st = smooth[k];
            const g = live[k];
            const dt = Math.min(Math.max((now - st.t) / 1000, 0), 0.25);
            st.t = now;
            if (g) {
                const f = 1 - Math.exp(-GUIDE_MOB_FOLLOW_RATE * dt);
                st.x += (g.x - st.x) * f;
                st.y += (g.y - st.y) * f;
                st.a = Math.min(1, st.a + (dt * 1000) / GUIDE_MOB_FADE_MS);
                st.ids = g.members.map((e) => e.id);
                st.leadId = g.lead.id;
                const t = String(g.lead.title || '');
                st.text = t.charAt(0).toUpperCase() + t.slice(1) + (g.members.length > 1 ? ' x' + g.members.length : '');
            } else {
                st.a -= (dt * 1000) / GUIDE_MOB_FADE_MS;
                if (st.a <= 0) {
                    delete smooth[k];
                    continue;
                }
            }
            this.drawEdgeArrow(
                gfx, { id: st.leadId }, (st.x - c.x) * s, (st.y - c.y) * s, W, H,
                GUIDE_MOB_COLOR, 0.9 * st.a, false, now,
                guideScale(Math.hypot(st.x - p.x, st.y - p.y), ts), st.text
            );
            shown[st.leadId] = 'mob';
        }

        for (let i = 0; i < Math.min(plain.length, GUIDE_MAX_NEAR); i++) {
            const e = plain[i];
            this.drawEdgeArrow(gfx, e[1], e[2], e[3], W, H, GUIDE_COLOR, 0.85, false, now, guideScale(e[0], ts));
            shown[e[1].id] = true;
        }
        for (const e of quest) {
            this.drawEdgeArrow(gfx, e[0], e[1], e[2], W, H, GUIDE_QUEST_COLOR, 1, true, now, guideScale(e[3], ts));
            shown[e[0].id] = true;
        }

        // Hide the labels of NPCs that no longer get an arrow; mob labels are
        // destroyed (mobs respawn with new ids, so they'd pile up otherwise).
        for (const id in this.guideShown || {}) {
            if (shown[id]) continue;
            const key = 'guide_lbl_' + id;
            const lbl = this.pxSprite[key];
            if (!lbl) continue;
            if (this.guideShown[id] === 'mob') {
                lbl.destroy();
                delete this.pxSprite[key];
            } else lbl.visible = false;
        }
        this.guideShown = shown;
    };

    // Small bobbing arrow over the name of an on-screen NPC / mob the guide
    // arrows would otherwise point at.
    proto.drawGuideMarker = function (gfx, e, sx, sy, color, now) {
        const s = this.gameScale;
        const ts = this.tilesize;
        let y = sy - ts * s - 30;
        if (e.type === Types.EntityTypes.NPCMOVE) y -= (ts / 2) * s;
        y += Math.sin(now / 180) * 4;
        gfx.lineStyle(2, 0x000000, 1);
        gfx.beginFill(color, 1);
        gfx.drawPolygon([sx, y, sx - 9, y - 12, sx + 9, y - 12]);
        gfx.endFill();
    };

    // Live mobs of `kind` the client knows about.
    proto.guideMobsOfKind = function (kind) {
        const out = [];
        for (const e of game.entities.values()) {
            if (e && e.type === Types.EntityTypes.MOB && e.kind === kind && !e.isDead && !e.isDying)
                out.push(e);
        }
        return out;
    };

    // Arrow on the screen edge, on the line from the screen centre to the
    // off-screen point (tx, ty), pointing at it, with the NPC's name just
    // inside it. `scale` (guideScale()) makes it bigger the closer the NPC is.
    // (Mob arrows get an already-smoothed target; see GUIDE_MOB_FOLLOW_RATE.)
    // `labelText` overrides the label (default: the entity's name).
    proto.drawEdgeArrow = function (gfx, npc, tx, ty, W, H, color, alpha, pulse, now, scale, labelText) {
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
        const ps = this.guidePointerScale != null ? this.guidePointerScale : GUIDE_POINTER_SCALE;
        let size = (pulse ? 20 : 15) * (scale || 1) * ps;
        if (pulse) size *= 1 + 0.15 * Math.sin(now / 150);

        gfx.lineStyle(3 * ps, 0x000000, alpha);
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
            let text = labelText != null ? labelText : npc.name || '';
            if (!text && npc.title) text = String(npc.title).charAt(0).toUpperCase() + String(npc.title).slice(1);
            lbl = new PIXI.Text(text, new PIXI.TextStyle({
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
        const fs = 4 * this.scale * ps;
        if (labelText != null && lbl.text !== labelText) lbl.text = labelText;
        lbl.style.fill = color;
        lbl.style.fontSize = fs;
        lbl.style.strokeThickness = 4 * ps;
        lbl.alpha = alpha;
        lbl.visible = true;
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
