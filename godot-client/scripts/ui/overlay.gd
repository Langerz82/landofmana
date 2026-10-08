class_name Overlay
extends Control
## Screen-space overlay drawn on top of the world: entity names, health bars,
## floating combat text and speech bubbles. Equivalent of the
## renderer's HUD container (renderer/rendererdraw{names,bars,hud}.js), drawn
## at screen resolution so text stays crisp at the 3x game zoom.

const KOMIKA := preload("res://assets/fonts/KOMIKAH.ttf")
const TS := Types.G_TILESIZE

var world = null


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE


func _to_screen(p: Vector2) -> Vector2:
	return world.get_canvas_transform() * p


func _draw() -> void:
	if world == null or world.player == null or world.map_status < 2:
		return
	var scale_f: float = world.game_scale
	var view := get_viewport_rect().grow(64)
	var p = world.player
	# (The target marker is drawn under the sprites by World's TargetMarker.)
	if _bars.size() > 0 and Engine.get_process_frames() % 120 == 0:
		for id in _bars.keys():
			if not world.entities.has(id):
				_bars.erase(id)
	for e in world.entities.values():
		if e.hidden_by_area or e.is_dead:
			continue
		var sp := _to_screen(Vector2(e.x, e.y))
		if not view.has_point(sp):
			continue
		_draw_name(e, sp, scale_f)
		if e != p and e is Character and not e.is_dying:
			_draw_health(e, sp, scale_f)
	if p.start_harvest_time > 0:
		var r := clampf((Time.get_ticks_msec() - p.start_harvest_time) / float(maxi(p.harvest_duration, 1000)), 0, 1)
		_draw_bar(_to_screen(Vector2(p.x, p.y - TS - (TS >> 1))), r, Color(0, 1, 0), scale_f)
	for info in world.infos:
		var ip := _to_screen(Vector2(info.x, info.y - TS))
		var col: Color = info.color
		col.a = clampf(info.opacity, 0, 1)
		var fs := UiStyle.fs(info.size * 3)
		_text_centered(str(info.text), ip, fs, col, Color(0, 0, 0, col.a))
	for b in world.bubbles.values():
		if is_instance_valid(b.entity):
			_draw_bubble(b, scale_f)


func _draw_name(e, sp: Vector2, s: float) -> void:
	var text := ""
	var color := Color.WHITE
	if e is Player:
		text = e.ename
		color = Color(1, 1, 0) if e == world.player else (Color(1, 0, 0) if e.admin else Color("#fcda5c"))
	elif e is Mob:
		text = "Level %d" % e.level
		color = Color("#FF3333") if e.is_aggressive else Color(1, 1, 0)
	elif e is Npc:
		text = e.ename
		color = Color(0, 1, 1) if e.type == Types.EntityType.NPCMOVE else Color.WHITE
	elif e is ItemEntity:
		text = e.display_name()
	if text == "":
		return
	var y_off := -TS * s
	if e is Npc and e.type == Types.EntityType.NPCMOVE:
		y_off -= (TS >> 1) * s
	_text_centered(text, sp + Vector2(0, y_off), UiStyle.fs(12), color, Color.BLACK)


func _draw_health(e, sp: Vector2, s: float) -> void:
	var hp_max := int(e.stats.get("hpMax", 0))
	if hp_max <= 0:
		_bars.erase(e.id)
		return
	var hp := int(e.stats.get("hp", 0))
	var ratio := _smooth_ratio(e.id, clampf(float(hp) / hp_max, 0, 1))
	# Hidden at full health, but only once the slide back up has finished.
	if hp >= hp_max and ratio >= 0.999:
		return
	_draw_bar(sp + Vector2(0, -(TS + (TS >> 1)) * s), ratio, Color(1, 0, 0), s)


## Overhead bars slide to a new value over SmoothBar.duration_ms() (ease out),
## like the HUD bars. Per entity: {from, to, start}.
var _bars: Dictionary = {}


func _smooth_ratio(id: int, to: float) -> float:
	var now := Time.get_ticks_msec()
	var ms := SmoothBar.duration_ms()
	var b = _bars.get(id)
	if b == null or ms <= 0:
		_bars[id] = {"from": to, "to": to, "start": now}
		return to
	var cur := _eval(b, now, ms)
	if not is_equal_approx(to, b.to):
		b.from = cur
		b.to = to
		b.start = now
		cur = b.from
	return cur


static func _eval(b: Dictionary, now: int, ms: int) -> float:
	var t := clampf(float(now - int(b.start)) / ms, 0, 1)
	t = sin(t * PI / 2)   # ease out, same curve as the HUD tween
	return lerpf(float(b.from), float(b.to), t)


func _draw_bar(center: Vector2, ratio: float, color: Color, s: float) -> void:
	var w := TS * s
	var h := (TS >> 2) * s
	var r := Rect2(center - Vector2(w / 2, h / 2), Vector2(w, h))
	draw_rect(r, Color(0, 0, 0, 0.6))
	draw_rect(Rect2(r.position + Vector2(1, 1), Vector2((w - 2) * clampf(ratio, 0, 1), h - 2)), Color(color, 0.8))
	draw_rect(r, Color.BLACK, false, 2.0)


func _text_centered(text: String, pos: Vector2, size: int, color: Color, outline: Color) -> void:
	var width := KOMIKA.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, size).x
	var at := pos - Vector2(width / 2.0, -size / 3.0)
	draw_string_outline(KOMIKA, at, text, HORIZONTAL_ALIGNMENT_LEFT, -1, size, 4, outline)
	draw_string(KOMIKA, at, text, HORIZONTAL_ALIGNMENT_LEFT, -1, size, color)


func _draw_bubble(b: Dictionary, s: float) -> void:
	var e = b.entity
	var text := str(b.text)
	var font_size := UiStyle.fs(12)
	var max_w := 260.0
	var lines := _wrap(text, max_w, font_size)
	var line_h := font_size + 4
	var w := 0.0
	for l in lines:
		w = maxf(w, KOMIKA.get_string_size(l, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x)
	w += 20
	var h := lines.size() * line_h + 12
	var y_extra := (TS >> 1) * s if (e is Npc and e.type == Types.EntityType.NPCMOVE) else 0.0
	var anchor := _to_screen(Vector2(e.x, e.y)) - Vector2(0, TS * 1.6 * s + y_extra)
	var rect := Rect2(anchor - Vector2(w / 2, h), Vector2(w, h))
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(1, 1, 1, 0.9)
	sb.border_color = Color.BLACK
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(10)
	draw_style_box(sb, rect)
	var tail := PackedVector2Array([anchor + Vector2(-6, -1), anchor + Vector2(6, -1), anchor + Vector2(0, 8)])
	draw_colored_polygon(tail, Color(1, 1, 1, 0.9))
	var y := rect.position.y + 6 + font_size
	for l in lines:
		var lw := KOMIKA.get_string_size(l, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x
		draw_string(KOMIKA, Vector2(anchor.x - lw / 2, y), l, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size, Color.BLACK)
		y += line_h


func _wrap(text: String, max_w: float, size: int) -> Array:
	var out: Array = []
	var cur := ""
	for word in text.split(" "):
		var cand := word if cur == "" else cur + " " + word
		if KOMIKA.get_string_size(cand, HORIZONTAL_ALIGNMENT_LEFT, -1, size).x > max_w and cur != "":
			out.append(cur)
			cur = word
		else:
			cur = cand
	if cur != "":
		out.append(cur)
	return out
