class_name MapData
extends RefCounted
## Port of client/js/map/*.js (data side): tiles, collision grid, doors,
## camera areas and the collision queries used by movement/pathfinding.

const TS := Types.G_TILESIZE

var map_index := 0
var map_name := ""
var width := 0
var height := 0
var tilesize := 16
var tiles: Array = []                  # flat, each entry int or Array[int]
var collision := PackedByteArray()     # flat, 1 = blocked
var high: Dictionary = {}              # tile id -> true (drawn above entities)
var doors: Array = []                  # Array[Dictionary]
var camera_areas: Array = []           # Array[Rect2i] with "id" in meta dict
var loaded := false


static func load_map(index: int, n: String) -> MapData:
	var m := MapData.new()
	m.map_index = index
	m.map_name = n
	var path := "res://assets/maps/%s/%s.json" % [n, n]
	var text := FileAccess.get_file_as_string(path)
	if text == "":
		push_error("MapData: cannot read %s" % path)
		return m
	var d = JSON.parse_string(text)
	text = ""
	if not (d is Dictionary):
		push_error("MapData: invalid json %s" % path)
		return m
	m._init_from(d)
	return m


func _init_from(d: Dictionary) -> void:
	width = int(d.get("width", 0))
	height = int(d.get("height", 0))
	tilesize = int(d.get("tilesize", 16))
	tiles = d.get("data", [])
	var col: Array = d.get("collision", [])
	collision.resize(width * height)
	for i in range(mini(col.size(), collision.size())):
		collision[i] = 1 if int(col[i]) == 1 else 0
	for h in d.get("high", []):
		high[int(h)] = true
	var count := 0
	for door in d.get("doors", []):
		var w := int(door.get("width", 1)) if door.get("width") else 1
		var hh := int(door.get("height", 1)) if door.get("height") else 1
		var tmap_v = door.get("tmap")
		doors.append({
			"id": count,
			"rect": Rect2i(int(door.x), int(door.y), w, hh),
			"tmap": int(tmap_v) if tmap_v != null and float(tmap_v) >= 0 else map_index,
			"tx": int(door.tx) if door.get("tx") else -1,
			"ty": int(door.ty) if door.get("ty") else -1,
			"orientation": int(door.to) if door.get("to") else 2,
			"minLevel": int(door.get("tminLevel", 0)) if door.get("tminLevel") else 0,
			"maxLevel": int(door.get("tmaxLevel", 200)) if door.get("tmaxLevel") else 200,
		})
		count += 1
	for ca in d.get("camera", []):
		camera_areas.append({"id": int(ca.get("id", 0)),
			"rect": Rect2i(int(ca.x), int(ca.y), int(ca.w), int(ca.h))})
	loaded = true


# --------------------------------------------------------------- queries

func pixel_width() -> int:
	return width * TS


func pixel_height() -> int:
	return height * TS


func is_out_of_bounds(gx: int, gy: int) -> bool:
	return gx < 0 or gy < 0 or gx >= width or gy >= height


func is_colliding_cell(gx: int, gy: int) -> bool:
	return collision[gy * width + gx] == 1


func get_collision(gx: int, gy: int) -> bool:
	if is_out_of_bounds(gx, gy):
		return false
	return is_colliding_cell(gx, gy)


## Tile ids at a cell as an Array (empty if none).
func get_tiles(gx: int, gy: int) -> Array:
	if is_out_of_bounds(gx, gy):
		return []
	var t = tiles[gy * width + gx]
	if t is Array:
		return t
	if t == null or int(t) == 0:
		return []
	return [t]


func is_high_tile(id: int) -> bool:
	return high.has(id)


## isCollidingPoint(): the single cell containing (x, y).
func is_colliding_point(px: int, py: int) -> bool:
	var gx := floori(px / float(TS))
	var gy := floori(py / float(TS))
	return is_out_of_bounds(gx, gy) or is_colliding_cell(gx, gy)


## isColliding(): an entity-sized box (just under one tile) centred on (x, y).
func is_colliding(px: int, py: int) -> bool:
	var fx := px / float(TS)
	var fy := py / float(TS)
	var dd := 0.49
	var x1 := floori(fx - dd)
	var y1 := floori(fy - dd)
	var x2 := floori(fx + dd)
	var y2 := floori(fy + dd)
	if x1 < 0 or y1 < 0 or x2 >= width or y2 >= height:
		return true
	return is_colliding_cell(x1, y1) or is_colliding_cell(x2, y1) \
		or is_colliding_cell(x1, y2) or is_colliding_cell(x2, y2)


func get_door(px: int, py: int) -> Variant:
	for door in doors:
		var r: Rect2i = door.rect
		if px >= r.position.x and py >= r.position.y and px < r.end.x and py < r.end.y:
			return door
	return null


func get_camera_area(px: int, py: int, current = null) -> Variant:
	var containing: Array = []
	for a in camera_areas:
		if (a.rect as Rect2i).has_point(Vector2i(px, py)):
			containing.append(a)
	if current != null and containing.has(current):
		return current
	return containing[0] if not containing.is_empty() else null


const HARVEST_TILE_TYPES := {"axe": [678, 679, 698, 699, 855, 875, 274, 275, 294, 295]}


func is_harvest_tile(gx: int, gy: int, weapon_type: String) -> bool:
	if not HARVEST_TILE_TYPES.has(weapon_type):
		return false
	for t in get_tiles(gx, gy):
		if HARVEST_TILE_TYPES[weapon_type].has(int(t)):
			return true
	return false
