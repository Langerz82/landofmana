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

// Shared client constants as ES module exports.

// Network / timing.
export const G_LATENCY = 75;
export const G_ROUNDTRIP = G_LATENCY * 2;
export const G_UPDATE_INTERVAL = 16;

// Map.
export const G_TILESIZE = 16;

// Combat.
export const ATTACK_INTERVAL = 1000;
export const ATTACK_MAX = 1000;

// Fixed simulation frame rate for entity movement (transition.js), and the
// length of one frame in ms. Must match gameserver/js/constants.js.
export const MOVE_FPS = 60;
export const MOVE_FRAME_MS = 1000 / MOVE_FPS;

// Global movement speed multiplier for every moving entity (players, mobs,
// NPCs). 1 = original speed; 0.75 = 25% slower.
export const MOVE_SPEED_SCALE = 0.75;

// Never simulate more than this much missed movement time in one
// Transition.step() (e.g. after a tab was backgrounded for minutes) -- avoids
// teleport-length bursts.
export const MAX_CATCHUP_MS = 1000;

// Float tolerance for Transition's fixed-frame / pixel-progress comparisons.
export const EPSILON = 1e-9;
