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

class_name MapRenderer
extends Node2D
## Draws the map tiles. Large maps (map1 is 1024x1024 tiles) are streamed in
## CHUNK x CHUNK blocks around the camera.
##
## Each chunk is two RenderingServer canvas items - one for the background
## tiles (below entities) and one for the map.high foreground tiles (above
## them) - filled with plain texture-rect commands. There are no TileMapLayer
## nodes, so building a chunk is just a few hundred draw commands, freeing it
## is two free_rid calls, and every chunk renders as one batched draw call.
## Within a cell the tiles are drawn in their stacking order, which is all the
## old per-layer TileMapLayers gave us (tiles never overlap other cells).
##
## Chunks on screen are always drawn at once. A ring of PREFETCH chunks around
## the view is built in the background a few rows at a time, at most
## FRAME_BUDGET_USEC per frame (kept hidden until complete), so walking never
## stalls a frame, even on slow phone CPUs. Chunks are only freed once they are
## KEEP chunks off screen, so walking back and forth doesn't rebuild them.

const TS := Constants.G_TILESIZE
const CHUNK := 16
const MAX_LAYERS := 6                # tiles per cell drawn below / above entities
const PREFETCH := 2                  # chunks built beyond the visible edge
const KEEP := 3                      # chunks kept beyond the visible edge before freeing
const FRAME_BUDGET_USEC := 1500      # background chunk building per frame
const BG_Z := -20
const FG_Z := 20
const NO_LIMIT := 1 << 62
const TILESET_PATH := "res://assets/img/common/ts-1-1.png"

var map: MapData
var _chunks: Dictionary = {}         # Vector2i -> Dictionary (see _start_build)
var _queue: Array = []               # Vector2i chunks waiting to be built, nearest first
var _queued: Dictionary = {}         # Vector2i -> true (members of _queue)
var _building = null                 # chunk being built over several frames, or null
var _tex: Texture2D
var _tex_rid: RID
var _src: Array[Rect2] = []          # tile id - 1 -> region in the tileset
var _area_rect = null                # Rect2i in pixels or null (camera area)
var _last_vis := Rect2i()
var _dirty := true                   # recompute wanted chunks on the next update_view


func _ready() -> void:
	_tex = load(TILESET_PATH)
	_tex_rid = _tex.get_rid()
	var cols := int(_tex.get_width() / TS)
	var rows := int(_tex.get_height() / TS)
	_src.resize(cols * rows)
	for i in range(cols * rows):
		_src[i] = Rect2((i % cols) * TS, (i / cols) * TS, TS, TS)


func _notification(what: int) -> void:
	if what == NOTIFICATION_PREDELETE:
		clear_all()


func set_map(m: MapData) -> void:
	map = m
	clear_all()


func clear_all() -> void:
	for key in _chunks.keys():
		_free_chunk(key)
	if _building != null:
		_free_items(_building)
		_building = null
	_queue.clear()
	_queued.clear()
	_dirty = true


## Restrict drawing to a camera area (pixels) or null for the whole map.
func set_area(rect) -> void:
	if rect == _area_rect:
		return
	_area_rect = rect
	clear_all()


## Number of tiles currently drawn, for tests and debugging.
func used_cell_count() -> int:
	var n := 0
	for b in _chunks.values():
		n += int(b.count)
	return n


## Ensure the chunks around a world position (pixels) are drawn. Called
## every frame; also spends the frame's budget on prefetching.
func update_view(center: Vector2, view_size: Vector2) -> void:
	if map == null or not map.loaded:
		return
	var cs := float(CHUNK * TS)
	var half := view_size / 2.0
	var p0 := Vector2i(floori((center.x - half.x) / cs), floori((center.y - half.y) / cs))
	var p1 := Vector2i(floori((center.x + half.x) / cs), floori((center.y + half.y) / cs)) + Vector2i.ONE
	var all := Rect2i(Vector2i.ZERO, Vector2i(ceili(map.width / float(CHUNK)), ceili(map.height / float(CHUNK))))
	var vis := Rect2i(p0, p1 - p0).intersection(all)
	if _dirty or vis != _last_vis:
		_dirty = false
		_last_vis = vis
		_refresh(vis, all)
	_process_queue()


func _refresh(vis: Rect2i, all: Rect2i) -> void:
	var want := vis.grow(PREFETCH).intersection(all)
	var keep := vis.grow(KEEP).intersection(all)
	for key in _chunks.keys():
		if not keep.has_point(key):
			_free_chunk(key)
	if _building != null and not want.has_point(_building.key):
		_free_items(_building)
		_building = null
	if not _queue.is_empty():
		_queue = _queue.filter(func(k): return want.has_point(k))
		_queued.clear()
		for k in _queue:
			_queued[k] = true
	# on screen: draw right away so there are never gaps
	for cy in range(vis.position.y, vis.end.y):
		for cx in range(vis.position.x, vis.end.x):
			var k := Vector2i(cx, cy)
			if _chunks.has(k):
				continue
			if _building != null and _building.key == k:
				_build_rows(_building, NO_LIMIT)
				_building = null
			else:
				_build_rows(_start_build(k), NO_LIMIT)
	# around the screen: build over the next frames, nearest first
	var added := false
	for cy in range(want.position.y, want.end.y):
		for cx in range(want.position.x, want.end.x):
			var k := Vector2i(cx, cy)
			if not _chunks.has(k) and not _queued.has(k):
				_queue.append(k)
				_queued[k] = true
				added = true
	if added:
		var mid := Vector2(vis.position) + Vector2(vis.size) / 2.0
		_queue.sort_custom(func(a, b): return (Vector2(a) - mid).length_squared() < (Vector2(b) - mid).length_squared())


func _process_queue() -> void:
	if _building == null and _queue.is_empty():
		return
	var end := Time.get_ticks_usec() + FRAME_BUDGET_USEC
	while Time.get_ticks_usec() < end:
		if _building == null:
			if _queue.is_empty():
				return
			var k: Vector2i = _queue.pop_front()
			_queued.erase(k)
			if _chunks.has(k):
				continue
			_building = _start_build(k)
		if _build_rows(_building, end):
			_building = null


func _start_build(c: Vector2i) -> Dictionary:
	return {"key": c, "row": 0, "bg": RID(), "fg": RID(), "count": 0}


## Draws the chunk's next rows until done or past `end` (usec). Returns true
## once the chunk is complete (it is then shown and registered).
func _build_rows(b: Dictionary, end: int) -> bool:
	var c: Vector2i = b.key
	var x0 := c.x * CHUNK
	var y0 := c.y * CHUNK
	var x1 := mini(x0 + CHUNK, map.width)
	var y1 := mini(y0 + CHUNK, map.height)
	var area: Rect2i = _area_rect if _area_rect != null else Rect2i()
	var use_area := _area_rect != null
	var tiles := map.tiles
	var w := map.width
	var nsrc := _src.size()
	var gy: int = y0 + int(b.row)
	while gy < y1:
		for gx in range(x0, x1):
			if use_area and not area.has_point(Vector2i(gx * TS + 8, gy * TS + 8)):
				continue
			var t = tiles[gy * w + gx]
			if t is Array:
				var bi := 0
				var fi := 0
				for id in t:
					var tid := int(id)
					if tid <= 0 or tid > nsrc:
						continue
					if map.is_high_tile(tid):
						if fi < MAX_LAYERS:
							_add_tile(b, true, gx, gy, tid)
						fi += 1
					else:
						if bi < MAX_LAYERS:
							_add_tile(b, false, gx, gy, tid)
						bi += 1
			elif t != null:
				var tid := int(t)
				if tid > 0 and tid <= nsrc:
					_add_tile(b, map.is_high_tile(tid), gx, gy, tid)
		gy += 1
		b.row = gy - y0
		if Time.get_ticks_usec() >= end:
			break
	if gy < y1:
		return false
	for k in ["bg", "fg"]:
		var ci: RID = b[k]
		if ci.is_valid():
			RenderingServer.canvas_item_set_visible(ci, true)
	_chunks[c] = b
	return true


func _add_tile(b: Dictionary, high: bool, gx: int, gy: int, tid: int) -> void:
	var k := "fg" if high else "bg"
	var ci: RID = b[k]
	if not ci.is_valid():
		ci = RenderingServer.canvas_item_create()
		RenderingServer.canvas_item_set_parent(ci, get_canvas_item())
		RenderingServer.canvas_item_set_z_index(ci, FG_Z if high else BG_Z)
		RenderingServer.canvas_item_set_visible(ci, false)   # shown when the chunk is complete
		b[k] = ci
	RenderingServer.canvas_item_add_texture_rect_region(ci, Rect2(gx * TS, gy * TS, TS, TS), _tex_rid, _src[tid - 1])
	b.count += 1


func _free_items(b: Dictionary) -> void:
	for k in ["bg", "fg"]:
		var ci: RID = b[k]
		if ci.is_valid():
			RenderingServer.free_rid(ci)
			b[k] = RID()


func _free_chunk(c: Vector2i) -> void:
	var b = _chunks.get(c)
	_chunks.erase(c)
	if b != null:
		_free_items(b)
