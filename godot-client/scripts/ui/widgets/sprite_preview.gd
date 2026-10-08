class_name SpritePreview
extends Control
## Animated character preview (playeranim.js): draws an armor sprite and an
## optional weapon sprite, cycling walk / attack animations in all directions.

var armor_id := ""
var weapon_id := ""
var scale_px := 3.0
var _t := 0.0
var _anim_i := 0
var _frame := 0
const SEQ := [["walk", "down"], ["atk", "down"], ["walk", "right"], ["atk", "right"], ["walk", "up"], ["atk", "up"], ["walk", "left"], ["atk", "left"]]


func _init() -> void:
	custom_minimum_size = Vector2(120, 120)
	mouse_filter = Control.MOUSE_FILTER_IGNORE


func set_sprites(armor: String, weapon: String) -> void:
	armor_id = armor
	weapon_id = weapon
	queue_redraw()


func _process(delta: float) -> void:
	if not is_visible_in_tree():
		return
	_t += delta
	if _t > 0.15:
		_t = 0.0
		_frame += 1
		if _frame >= 8:
			_frame = 0
			_anim_i = (_anim_i + 1) % SEQ.size()
		queue_redraw()


func _draw() -> void:
	var a = GameData.get_sprite(armor_id)
	if a == null or a.texture == null:
		return
	var seq: Array = SEQ[_anim_i]
	var dir: String = "right" if seq[1] == "left" else seq[1]
	var anim_name: String = seq[0] + "_" + dir
	var ad: Dictionary = a.animations.get(anim_name, a.animations.get("idle_down", {}))
	if ad.is_empty():
		return
	var flip: bool = seq[1] == "left"
	var len_a: int = maxi(1, int(ad.length))
	var idx := _frame % len_a
	var s := GameData.SPRITE_SCALE
	var dest := Rect2((size - Vector2(a.width, a.height) * scale_px) / 2.0, Vector2(a.width, a.height) * scale_px)
	_draw_frame(a.texture, Rect2((int(ad.col) + idx) * a.width * s, int(ad.row) * a.height * s, a.width * s, a.height * s), dest, flip)
	var w = GameData.get_sprite(weapon_id) if weapon_id != "" else null
	if w != null and w.texture != null:
		var wd: Dictionary = w.animations.get(anim_name, {})
		var wl: int = maxi(1, int(wd.get("length", 1)))
		var wi := idx % wl if not wd.is_empty() else 0
		var wdest := Rect2((size - Vector2(w.width, w.height) * scale_px) / 2.0, Vector2(w.width, w.height) * scale_px)
		_draw_frame(w.texture, Rect2(wi * w.width * s, int(ad.row) * w.height * s, w.width * s, w.height * s), wdest, flip)


func _draw_frame(tex: Texture2D, src: Rect2, dest: Rect2, flip: bool) -> void:
	if flip:
		draw_set_transform(Vector2(dest.position.x * 2 + dest.size.x, 0), 0, Vector2(-1, 1))
	draw_texture_rect_region(tex, dest, src)
	draw_set_transform(Vector2.ZERO, 0, Vector2.ONE)
