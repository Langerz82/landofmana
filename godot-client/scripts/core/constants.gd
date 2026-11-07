# This file is part of Land of Mana (https://github.com/Langerz82/landofmana).
# SPDX-License-Identifier: GPL-3.0-only
# Copyright (C) 2023-2026 Joshua Langley and contributors
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, version 3 of the License.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program. See the LICENSE file in the project root,
# or <https://www.gnu.org/licenses/>.

class_name Constants
## Shared client constants (mirrors client/js/constants.js and
## gameserver/js/constants.js -- keep the values in sync).

# Network / timing.
const G_LATENCY := 75
const G_ROUNDTRIP := G_LATENCY * 2
const G_UPDATE_INTERVAL := 16

# Constant wait (ms) between the local player asking to move and actually
# starting to move on screen. The move packet (CW_MOVE / CW_MOVEPATH) is sent
# straight away; this wait gives it time to reach the server, so both sides
# start walking at about the same moment. The server holds a packet that
# arrives early until the same point (gameserver/js/constants.js's
# G_MOVE_DELAY) -- keep the two equal.
const G_MOVE_DELAY := 100

# Map.
const G_TILESIZE := 16

# Combat.
const ATTACK_MAX := 1000

# Fixed simulation frame rate for entity movement (transition.gd), and the
# length of one frame in ms. Must match the JS client and gameserver.
const MOVE_FPS := 60
const MOVE_FRAME_MS := 1000.0 / MOVE_FPS

# Global movement speed multiplier for every moving entity (players, mobs,
# NPCs). 1 = original speed; 0.75 = 25% slower.
const MOVE_SPEED_SCALE := 0.75

# Never simulate more than this much missed movement time in one
# Transition.step() (e.g. after the app was suspended) -- avoids
# teleport-length bursts.
const MAX_CATCHUP_MS := 1000.0

# Float tolerance for Transition's fixed-frame / pixel-progress comparisons.
const EPSILON := 1e-9
