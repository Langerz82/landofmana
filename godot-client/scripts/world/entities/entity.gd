class_name Entity
extends Node2D
## Port of client/js/entity/entity.js. Logical position is kept in integer
## pixels (x, y) exactly like the JS client; the Node2D position is synced
## from it every frame by sync_view().

const TS := Types.G_TILESIZE

var id := 0
var type := 0
var kind := 0
var map_index := 0
var ename := ""
var level := 0
var x := 0
var y := 0
var gx := 0
var gy := 0
var orientation := Types.Orientation.DOWN
var idle_speed := 1000

var sprites: Array = [null]       # GameData.SpriteDef per layer (0 = body, 1 = weapon)
var old_sprites: Array = [null]
var animations: Dictionary = {}
var current_anim: AnimState = null
var flip_x := false
var fsm := "IDLE"
var is_dying := false
var is_dead := false
var hidden_by_area := false
var draw_offset := Vector2.ZERO
var stats: Dictionary = {}

var _views: Array = []            # Sprite2D per sprite layer
var world = null                  # World (set by World.add_entity)


func _init() -> void:
	y_sort_enabled = false


func is_character() -> bool:
	return false


func is_moving_entity() -> bool:
	return false


# ------------------------------------------------------------------ sprites

func set_sprite(def, index: int = 0) -> void:
	if def == null:
		push_warning("Entity %d: missing sprite (layer %d)" % [id, index])
		return
	while sprites.size() <= index:
		sprites.append(null)
		old_sprites.append(null)
	if def == sprites[index]:
		return
	old_sprites[index] = sprites[index]
	sprites[index] = def
	if index == 0:
		animations = def.animations
	_ensure_view(index)
	var view: Sprite2D = _views[index]
	view.texture = def.texture
	view.scale = Vector2.ONE / GameData.SPRITE_SCALE
	# The frame rectangle still belongs to the previous sheet until the next
	# sync; drawing the new texture with it shows a stretched, mostly white
	# smear for a frame (e.g. a mob switching to the death smoke). Re-sync now.
	_refresh_view()


func restore_sprite(index: int = 0) -> void:
	if index < old_sprites.size() and old_sprites[index] != null:
		set_sprite(old_sprites[index], index)


func get_sprite(index: int = 0):
	return sprites[index] if index < sprites.size() else null


func _ensure_view(index: int) -> void:
	while _views.size() <= index:
		var s := Sprite2D.new()
		s.centered = true
		s.region_enabled = true
		s.visible = false
		add_child(s)
		_views.append(s)


func is_loaded() -> bool:
	return sprites.size() > 0 and sprites[0] != null


# --------------------------------------------------------------- animation

func has_animation(prefix: String) -> bool:
	return current_anim != null and current_anim.anim_name.begins_with(prefix)


## Entity.animate(): orientation-aware animation names (left = flipped right).
func animate(anim: String, speed: int, count: int = 0, on_end: Callable = Callable()) -> void:
	var o := orientation if orientation != 0 else Types.Orientation.DOWN
	flip_x = false
	if anim in ["atk", "walk", "idle"]:
		var suffix := "right" if o == Types.Orientation.LEFT else Types.orientation_as_string(o)
		anim += "_" + suffix
		flip_x = orientation == Types.Orientation.LEFT
	set_animation(anim, speed, count, on_end)


func set_animation(anim_name: String, speed: int, count: int = 0, on_end: Callable = Callable()) -> void:
	if not is_loaded():
		return
	var already := current_anim != null and current_anim.anim_name == anim_name
	if already and (count == 0 or current_anim.count > 0):
		return
	if (is_dying or is_dead) and current_anim != null and current_anim.anim_name == "death":
		return
	if fsm == "ATTACK" and not already and current_anim != null and current_anim.anim_name.begins_with("atk"):
		fsm = "IDLE"
	if not animations.has(anim_name):
		if Config.log_packets:
			print("Entity %d: no animation %s" % [id, anim_name])
		return
	if not already:
		current_anim = AnimState.from_def(anim_name, animations[anim_name], sprites[0].width, sprites[0].height)
	current_anim.reset()
	current_anim.speed = speed
	var cb := on_end
	if not cb.is_valid():
		cb = func(): idle(orientation)
	current_anim.set_count(count, cb)
	if not already:
		_refresh_view()


## Re-apply the current frame to the sprite layers right away (instead of
## waiting for the next rendered frame's sync_view()).
func _refresh_view() -> void:
	if is_inside_tree():
		sync_view()


func idle(_o: int = 0) -> void:
	pass


func update_animation(time: int) -> void:
	if current_anim != null:
		current_anim.update(time)


# ----------------------------------------------------------------- position

func set_pos(nx: int, ny: int) -> void:
	x = nx
	y = ny
	gx = int(nx / TS)
	gy = int(ny / TS)


func set_pos_spawn(nx: int, ny: int) -> void:
	set_pos(nx, ny)


func set_orientation(o: int) -> void:
	if o != 0:
		orientation = o


func get_distance_to_entity(e) -> int:
	return maxi(absi(e.x - x), absi(e.y - y))


func is_within_dist(px: int, py: int, dist: int = TS) -> bool:
	return Types.real_distance(x, y, px, py) <= dist


func is_within_dist_entity(e, dist: int = TS) -> bool:
	return is_within_dist(e.x, e.y, dist)


func is_next_too_entity(e) -> bool:
	return is_within_dist(e.x, e.y, TS)


func is_next_too_tile(px: int, py: int) -> bool:
	var cx := (floori(px / float(TS)) + 0.5) * TS
	var cy := (floori(py / float(TS)) + 0.5) * TS
	return is_within_dist(int(cx), int(cy), TS)


func is_adjacent_entity(e, dist: int = TS) -> bool:
	return absi(x - e.x) + absi(y - e.y) <= dist


func is_over_position(px: int, py: int) -> bool:
	return is_within_dist(px, py, TS >> 1)


func is_overlapping_entity(e) -> bool:
	return is_within_dist(e.x, e.y, TS - 1)


func get_tile_position_next_to(o: int = 0, dist: int = 1) -> Vector2i:
	if o == 0:
		o = orientation
	var d := dist * TS
	var p := Vector2i(x, y)
	match o:
		Types.Orientation.LEFT: p.x -= d
		Types.Orientation.RIGHT: p.x += d
		Types.Orientation.UP: p.y -= d
		Types.Orientation.DOWN: p.y += d
	return p


func clean() -> void:
	pass


# --------------------------------------------------------------------- view

## Called every rendered frame: copies logical state into the scene graph.
func sync_view() -> void:
	position = Vector2(x, y) + draw_offset
	var show_it := not is_dead and not hidden_by_area
	_sync_layer(0, show_it)


func _sync_layer(index: int, show_it: bool) -> void:
	if index >= _views.size():
		return
	var view: Sprite2D = _views[index]
	var def = sprites[index] if index < sprites.size() else null
	if def == null or def.texture == null or current_anim == null or not show_it:
		view.visible = false
		return
	var s := GameData.SPRITE_SCALE
	var r := Rect2(def.width * current_anim.frame_col() * s,
		def.height * current_anim.row * s, def.width * s, def.height * s)
	if not frame_fits(def.texture, r):
		view.visible = false   # animation of another sheet; never draw garbage
		return
	view.region_rect = r
	view.flip_h = flip_x
	view.visible = true


static func frame_fits(tex: Texture2D, r: Rect2) -> bool:
	var sz := tex.get_size()
	return r.position.x >= 0 and r.position.y >= 0 and r.end.x <= sz.x + 0.5 and r.end.y <= sz.y + 0.5
