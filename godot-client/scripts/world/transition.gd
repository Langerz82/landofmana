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

class_name Transition
extends RefCounted
## Port of client/js/transition.js -- fixed-timestep movement transition.
##
## Movement is simulated on a fixed Constants.MOVE_FPS timeline that is
## independent of the real frame rate. Every fixed frame that has elapsed adds
## MOVE_FRAME_MS / delay pixels of progress (delay = ms per pixel, the
## entity's move_delay), and update_fn(obj, dir) is called once per whole
## pixel. Frame drops / stalls are caught up on the next step(), so an entity
## always covers the same distance for the same elapsed time as on the
## gameserver; a faster frame rate just means some step()s do nothing.
##
## update_fn returns true to end the transition (path node reached, path
## finished, blocked, ...). If it ends that way without an external stop()
## (just turning at a path node), the fixed-frame clock and fractional pixel
## progress carry into the next start() so nothing is lost at corners. Any
## external stop() discards the carry.

var in_progress := false
var dir := 0                 # -1 or 1
var delay := 0.0             # ms per pixel
var frame_time := 0.0        # time of the last simulated fixed frame
var progress := 0.0          # fractional pixels accumulated, not yet moved
var update_fn: Callable = Callable()
var stop_fn: Callable = Callable()
var obj = null

var _stepping := false
var _external_stop := false
var _has_carry := false
var _carry_frame_time := 0.0
var _carry_progress := 0.0


func _init(o = null) -> void:
	obj = o


static func now() -> float:
	return Time.get_ticks_usec() / 1000.0


## direction: sign gives direction. move_delay: ms per pixel, <= 0 = don't move.
func start(update_function: Callable, stop_function: Callable, direction: int, move_delay: float) -> void:
	var t := now()
	update_fn = update_function
	stop_fn = stop_function
	dir = signi(direction)
	delay = move_delay if move_delay > 0.0 else 0.0

	var carry := _has_carry
	_has_carry = false
	if carry and t - _carry_frame_time >= 0.0 and t - _carry_frame_time <= Constants.MAX_CATCHUP_MS:
		frame_time = _carry_frame_time
		progress = _carry_progress
	else:
		frame_time = t
		progress = 0.0

	in_progress = true


## Change speed mid-transition; takes effect from the next fixed frame.
func set_delay(move_delay: float) -> void:
	delay = move_delay if move_delay > 0.0 else 0.0


func step() -> void:
	if not in_progress or not update_fn.is_valid():
		return
	if dir == 0 or delay <= 0.0:
		return

	var t := now()
	if t - frame_time > Constants.MAX_CATCHUP_MS:
		frame_time = t - Constants.MAX_CATCHUP_MS

	var px_per_frame := Constants.MOVE_FRAME_MS / delay

	_stepping = true
	_external_stop = false
	while t - frame_time >= Constants.MOVE_FRAME_MS - Constants.EPSILON:
		frame_time += Constants.MOVE_FRAME_MS
		progress += px_per_frame

		while progress >= 1.0 - Constants.EPSILON:
			if not in_progress:
				_stepping = false
				return

			progress -= 1.0
			if update_fn.call(obj, dir):
				var external := _external_stop or not in_progress
				var cft := frame_time
				var cp := maxf(progress, 0.0)
				_stepping = false
				stop()
				if not external:
					_has_carry = true
					_carry_frame_time = cft
					_carry_progress = cp
				return
	_stepping = false


func stop() -> void:
	if _stepping:
		_external_stop = true
	_has_carry = false
	if stop_fn.is_valid():
		stop_fn.call(obj)
	in_progress = false
