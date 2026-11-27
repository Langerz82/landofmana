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
## Draws the map tiles with TileMapLayers. Large maps (map1 is 1024x1024
## tiles) are streamed in CHUNK x CHUNK blocks around the camera.
##
## Each chunk owns its own layer nodes, so unloading one is a single node free
## instead of thousands of erase_cell calls. Chunks on screen are always drawn
## at once; a ring of PREFETCH chunks around the view is built in the
## background, at most FRAME_BUDGET_USEC per frame, so walking across a chunk
## edge never stalls a frame. Chunks are only freed once they are KEEP chunks
## off screen, so walking back and forth over an edge doesn't rebuild them.
## Tiles listed in map.high go to foreground layers drawn above entities
## (z_index > 0).

const TS := Constants.G_TILESIZE
const CHUNK := 16                    # matches TileMapLayer's rendering quadrant size
const MAX_LAYERS := 6
const PREFETCH := 2                  # chunks built beyond the visible edge
const KEEP := 3                      # chunks kept beyond the visible edge before freeing
const FRAME_BUDGET_USEC := 2000      # background chunk building per frame
const TILESET_PATH := "res://assets/img/common/ts-1-1.png"

var map: MapData
var _chunks: Dictionary = {}         # Vector2i -> Node2D holding that chunk's layers
var _queue: Array = []               # Vector2i chunks waiting to be built, nearest first
var _queued: Dictionary = {}         # Vector2i -> true (members of _queue)
var _tileset: TileSet
var _source_id := 0
var _cols := 20
var _area_rect = null                # Rect2i in pixels or null (camera area)
var _last_vis := Rect2i()
var _dirty := true                   # recompute wanted chunks on the next update_view


func _ready() -> void:
	_build_tileset()


func _build_tileset() -> void:
	_tileset = TileSet.new()
	_tileset.tile_size = Vector2i(TS, TS)
	var tex: Texture2D = load(TILESET_PATH)
	var src := TileSetAtlasSource.new()
	src.texture = tex
	src.texture_region_size = Vector2i(TS, TS)
	_cols = int(tex.get_width() / TS)
	var rows := int(tex.get_height() / TS)
	for r in range(rows):
		for c in range(_cols):
			src.create_tile(Vector2i(c, r))
	_source_id = _tileset.add_source(src)


func set_map(m: MapData) -> void:
	map = m
	clear_all()


func clear_all() -> void:
	for key in _chunks.keys():
		_free_chunk(key)
	_queue.clear()
	_queued.clear()
	_dirty = true


## Restrict drawing to a camera area (pixels) or null for the whole map.
func set_area(rect) -> void:
	if rect == _area_rect:
		return
	_area_rect = rect
	clear_all()


## Number of tiles currently placed (all layers), for tests and debugging.
func used_cell_count() -> int:
	var n := 0
	for holder in _chunks.values():
		for l in holder.get_children():
			n += (l as TileMapLayer).get_used_cells().size()
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
	if not _queue.is_empty():
		_queue = _queue.filter(func(k): return want.has_point(k))
		_queued.clear()
		for k in _queue:
			_queued[k] = true
	# on screen: draw right away so there are never gaps
	for cy in range(vis.position.y, vis.end.y):
		for cx in range(vis.position.x, vis.end.x):
			var k := Vector2i(cx, cy)
			if not _chunks.has(k):
				_build_chunk(k)
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
	if _queue.is_empty():
		return
	var t0 := Time.get_ticks_usec()
	while not _queue.is_empty() and Time.get_ticks_usec() - t0 < FRAME_BUDGET_USEC:
		var k: Vector2i = _queue.pop_front()
		_queued.erase(k)
		if not _chunks.has(k):
			_build_chunk(k)


func _build_chunk(c: Vector2i) -> void:
	var holder := Node2D.new()
	holder.name = "Chunk_%d_%d" % [c.x, c.y]
	var bg: Array = []
	var fg: Array = []
	bg.resize(MAX_LAYERS)
	fg.resize(MAX_LAYERS)
	var x0 := c.x * CHUNK
	var y0 := c.y * CHUNK
	var x1 := mini(x0 + CHUNK, map.width)
	var y1 := mini(y0 + CHUNK, map.height)
	var area: Rect2i = _area_rect if _area_rect != null else Rect2i()
	var use_area := _area_rect != null
	var tiles := map.tiles
	var w := map.width
	for gy in range(y0, y1):
		for gx in range(x0, x1):
			if use_area and not area.has_point(Vector2i(gx * TS + 8, gy * TS + 8)):
				continue
			var t = tiles[gy * w + gx]
			if t is Array:
				var bi := 0
				var fi := 0
				for id in t:
					var tid := int(id)
					if tid <= 0:
						continue
					if map.is_high_tile(tid):
						if fi < MAX_LAYERS:
							_set_tile(_layer(holder, fg, fi, true), gx, gy, tid)
						fi += 1
					else:
						if bi < MAX_LAYERS:
							_set_tile(_layer(holder, bg, bi, false), gx, gy, tid)
						bi += 1
			elif t != null:
				var tid := int(t)
				if tid > 0:
					if map.is_high_tile(tid):
						_set_tile(_layer(holder, fg, 0, true), gx, gy, tid)
					else:
						_set_tile(_layer(holder, bg, 0, false), gx, gy, tid)
	# filled off-tree, then added once, so the renderer builds it in one go
	add_child(holder)
	_chunks[c] = holder


## The chunk's i-th background/foreground layer, created on first use.
func _layer(holder: Node2D, list: Array, i: int, front: bool) -> TileMapLayer:
	var l = list[i]
	if l == null:
		l = TileMapLayer.new()
		l.tile_set = _tileset
		l.z_index = (20 if front else -20) + i
		holder.add_child(l)
		list[i] = l
	return l


func _set_tile(layer: TileMapLayer, gx: int, gy: int, tid: int) -> void:
	var i := tid - 1
	layer.set_cell(Vector2i(gx, gy), _source_id, Vector2i(i % _cols, i / _cols))


func _free_chunk(c: Vector2i) -> void:
	var holder: Node2D = _chunks.get(c)
	_chunks.erase(c)
	if holder:
		remove_child(holder)
		holder.queue_free()
