class_name MapRenderer
extends Node2D
## Draws the map tiles with TileMapLayers. Large maps (map1 is 1024x1024
## tiles) are streamed in CHUNK x CHUNK blocks around the camera. Tiles listed
## in map.high go to foreground layers drawn above entities (z_index > 0).

const TS := Types.G_TILESIZE
const CHUNK := 32
const MAX_LAYERS := 6
const TILESET_PATH := "res://assets/img/common/ts-1-1.png"

var map: MapData
var bg_layers: Array = []
var fg_layers: Array = []
var _loaded_chunks: Dictionary = {}   # Vector2i -> true
var _tileset: TileSet
var _source_id := 0
var _cols := 20
var _area_rect = null                  # Rect2i in pixels or null (camera area)
var _last_center := Vector2i(-99999, -99999)


func _ready() -> void:
	_build_tileset()
	for i in range(MAX_LAYERS):
		var bg := TileMapLayer.new()
		bg.tile_set = _tileset
		bg.z_index = -20 + i
		bg.name = "Background%d" % i
		add_child(bg)
		bg_layers.append(bg)
	for i in range(MAX_LAYERS):
		var fg := TileMapLayer.new()
		fg.tile_set = _tileset
		fg.z_index = 20 + i
		fg.name = "Foreground%d" % i
		add_child(fg)
		fg_layers.append(fg)


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
	for l in bg_layers + fg_layers:
		l.clear()
	_loaded_chunks.clear()
	_last_center = Vector2i(-99999, -99999)


## Restrict drawing to a camera area (pixels) or null for the whole map.
func set_area(rect) -> void:
	if rect == _area_rect:
		return
	_area_rect = rect
	clear_all()


## Ensure the chunks around a world position (pixels) are drawn.
func update_view(center: Vector2, view_size: Vector2) -> void:
	if map == null or not map.loaded:
		return
	var cc := Vector2i(floori(center.x / (CHUNK * TS)), floori(center.y / (CHUNK * TS)))
	if cc == _last_center and not _loaded_chunks.is_empty():
		return
	_last_center = cc
	var rx := int(ceil(view_size.x / (CHUNK * TS) / 2.0)) + 1
	var ry := int(ceil(view_size.y / (CHUNK * TS) / 2.0)) + 1
	var wanted := {}
	var max_cx := int(ceil(map.width / float(CHUNK)))
	var max_cy := int(ceil(map.height / float(CHUNK)))
	for cy in range(cc.y - ry, cc.y + ry + 1):
		for cx in range(cc.x - rx, cc.x + rx + 1):
			if cx < 0 or cy < 0 or cx >= max_cx or cy >= max_cy:
				continue
			wanted[Vector2i(cx, cy)] = true
	for key in _loaded_chunks.keys():
		if not wanted.has(key):
			_erase_chunk(key)
	for key in wanted:
		if not _loaded_chunks.has(key):
			_draw_chunk(key)


func _draw_chunk(c: Vector2i) -> void:
	var used := Vector2i(1, 1)   # layers touched (bg, fg) so erase is cheap
	var x0 := c.x * CHUNK
	var y0 := c.y * CHUNK
	var x1 := mini(x0 + CHUNK, map.width)
	var y1 := mini(y0 + CHUNK, map.height)
	var area: Rect2i = _area_rect if _area_rect != null else Rect2i()
	var use_area := _area_rect != null
	for gy in range(y0, y1):
		for gx in range(x0, x1):
			if use_area and not area.has_point(Vector2i(gx * TS + 8, gy * TS + 8)):
				continue
			var t = map.tiles[gy * map.width + gx]
			if t is Array:
				var bi := 0
				var fi := 0
				for id in t:
					var tid := int(id)
					if tid <= 0:
						continue
					if map.is_high_tile(tid):
						if fi < MAX_LAYERS:
							_set_tile(fg_layers[fi], gx, gy, tid)
						fi += 1
						used.y = maxi(used.y, mini(fi, MAX_LAYERS))
					else:
						if bi < MAX_LAYERS:
							_set_tile(bg_layers[bi], gx, gy, tid)
						bi += 1
						used.x = maxi(used.x, mini(bi, MAX_LAYERS))
			elif t != null:
				var tid := int(t)
				if tid > 0:
					_set_tile(fg_layers[0] if map.is_high_tile(tid) else bg_layers[0], gx, gy, tid)
	_loaded_chunks[c] = used


func _set_tile(layer: TileMapLayer, gx: int, gy: int, tid: int) -> void:
	var i := tid - 1
	layer.set_cell(Vector2i(gx, gy), _source_id, Vector2i(i % _cols, i / _cols))


func _erase_chunk(c: Vector2i) -> void:
	var used: Vector2i = _loaded_chunks.get(c, Vector2i(MAX_LAYERS, MAX_LAYERS))
	_loaded_chunks.erase(c)
	var x0 := c.x * CHUNK
	var y0 := c.y * CHUNK
	for gy in range(y0, mini(y0 + CHUNK, map.height)):
		for gx in range(x0, mini(x0 + CHUNK, map.width)):
			var cell := Vector2i(gx, gy)
			for i in range(used.x):
				bg_layers[i].erase_cell(cell)
			for i in range(used.y):
				fg_layers[i].erase_cell(cell)
