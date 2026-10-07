class_name Hud
extends CanvasLayer
## In-game HUD: player bars, target frame, chat, announcements, NPC dialogue,
## death / error windows. Replaces the HTML/CSS HUD of the JS client.

signal respawn_pressed
signal back_to_login

const KOMIKA := preload("res://assets/fonts/KOMIKAH.ttf")
const PIXEL := preload("res://assets/fonts/graphicpixel-webfont.ttf")
const MAX_CHAT_LINES := 60

var world = null
var _name_label: Label
var _hp_bar: ProgressBar
var _ep_bar: ProgressBar
var _xp_bar: ProgressBar
var _hp_text: Label
var _ep_text: Label
var _gold_label: Label
var _target_panel: PanelContainer
var _target_name: Label
var _target_bar: ProgressBar
var _chat_log: RichTextLabel
var _chat_input: LineEdit
var _announce: Label
var _dialogue_panel: PanelContainer
var _dialogue_text: Label
var _died_panel: PanelContainer
var _error_panel: PanelContainer
var _error_text: Label
var _loading: Label
var _debug: Label
var _debug_on := true
var _announcements: Array = []
var _announce_until := 0
var _target = null
var _chat_lines: Array = []


func _ready() -> void:
	layer = 10
	var root := Control.new()
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root)
	_build_player_panel(root)
	_build_target_panel(root)
	_build_chat(root)
	_build_center_texts(root)
	_build_dialogue(root)
	_build_died(root)
	_build_error(root)
	announce("Welcome to Land Of Mana!", 5000)


# ------------------------------------------------------------- building

static func panel_style(alpha := 0.6) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.05, 0.04, 0.08, alpha)
	sb.border_color = Color(0.85, 0.7, 0.35, 0.9)
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(6)
	sb.content_margin_left = 8
	sb.content_margin_right = 8
	sb.content_margin_top = 6
	sb.content_margin_bottom = 6
	return sb


func _bar(color: Color, height := 14) -> ProgressBar:
	var b := ProgressBar.new()
	b.custom_minimum_size = Vector2(200, height)
	b.show_percentage = false
	var bg := StyleBoxFlat.new()
	bg.bg_color = Color(0, 0, 0, 0.7)
	bg.set_corner_radius_all(3)
	var fg := StyleBoxFlat.new()
	fg.bg_color = color
	fg.set_corner_radius_all(3)
	b.add_theme_stylebox_override("background", bg)
	b.add_theme_stylebox_override("fill", fg)
	return b


func _label(text: String, size := 14, font: Font = null, color := Color.WHITE) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	if font:
		l.add_theme_font_override("font", font)
	l.add_theme_color_override("font_color", color)
	l.add_theme_color_override("font_outline_color", Color.BLACK)
	l.add_theme_constant_override("outline_size", 4)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l


func _build_player_panel(root: Control) -> void:
	var p := PanelContainer.new()
	p.add_theme_stylebox_override("panel", panel_style())
	p.position = Vector2(10, 10)
	p.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(p)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 3)
	p.add_child(v)
	_name_label = _label("", 16, KOMIKA, Color(1, 1, 0))
	v.add_child(_name_label)
	var hp_row := Control.new()
	hp_row.custom_minimum_size = Vector2(220, 16)
	_hp_bar = _bar(Color(0.8, 0.1, 0.1), 16)
	_hp_bar.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	hp_row.add_child(_hp_bar)
	_hp_text = _label("", 11)
	_hp_text.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_hp_text.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_hp_text.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	hp_row.add_child(_hp_text)
	v.add_child(hp_row)
	var ep_row := Control.new()
	ep_row.custom_minimum_size = Vector2(220, 12)
	_ep_bar = _bar(Color(0.15, 0.45, 0.95), 12)
	_ep_bar.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	ep_row.add_child(_ep_bar)
	_ep_text = _label("", 10)
	_ep_text.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_ep_text.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_ep_text.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	ep_row.add_child(_ep_text)
	v.add_child(ep_row)
	_xp_bar = _bar(Color(0.2, 0.9, 0.9), 6)
	_xp_bar.custom_minimum_size = Vector2(220, 6)
	v.add_child(_xp_bar)
	_gold_label = _label("", 12, null, Color(1, 0.85, 0.3))
	v.add_child(_gold_label)


func _build_target_panel(root: Control) -> void:
	_target_panel = PanelContainer.new()
	_target_panel.add_theme_stylebox_override("panel", panel_style())
	_target_panel.set_anchors_preset(Control.PRESET_CENTER_TOP)
	_target_panel.position = Vector2(-120, 10)
	_target_panel.custom_minimum_size = Vector2(240, 0)
	_target_panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_target_panel.visible = false
	root.add_child(_target_panel)
	var v := VBoxContainer.new()
	_target_panel.add_child(v)
	_target_name = _label("", 14, KOMIKA)
	_target_name.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(_target_name)
	_target_bar = _bar(Color(0.85, 0.15, 0.15), 10)
	v.add_child(_target_bar)


func _build_chat(root: Control) -> void:
	var box := VBoxContainer.new()
	box.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	box.position = Vector2(10, -250)
	box.custom_minimum_size = Vector2(460, 240)
	box.size = Vector2(460, 240)
	box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(box)
	_chat_log = RichTextLabel.new()
	_chat_log.bbcode_enabled = true
	_chat_log.scroll_following = true
	_chat_log.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_chat_log.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_chat_log.add_theme_constant_override("outline_size", 3)
	_chat_log.add_theme_color_override("font_outline_color", Color.BLACK)
	_chat_log.add_theme_font_size_override("normal_font_size", 13)
	box.add_child(_chat_log)
	_chat_input = LineEdit.new()
	_chat_input.placeholder_text = "Type a message and press Enter..."
	_chat_input.max_length = 256
	_chat_input.visible = false
	_chat_input.text_submitted.connect(_on_chat_submitted)
	box.add_child(_chat_input)


func _build_center_texts(root: Control) -> void:
	_announce = _label("", 22, KOMIKA, Color(1, 1, 0))
	_announce.set_anchors_preset(Control.PRESET_TOP_WIDE)
	_announce.position.y = 120
	_announce.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	root.add_child(_announce)
	_loading = _label("", 24, KOMIKA)
	_loading.set_anchors_preset(Control.PRESET_CENTER)
	_loading.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_loading.grow_horizontal = Control.GROW_DIRECTION_BOTH
	root.add_child(_loading)
	_debug = _label("", 14, PIXEL)
	_debug.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	_debug.offset_left = -300
	_debug.offset_right = -10
	_debug.offset_top = 40
	_debug.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	root.add_child(_debug)
	var help := _label("Click / arrows: move    Space: attack/talk    T/Y: target    Enter: chat    M: music    F3: debug", 11, null, Color(1, 1, 1, 0.6))
	help.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	help.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	help.offset_left = -900
	help.offset_right = -10
	help.offset_top = -24
	help.offset_bottom = -6
	root.add_child(help)


func _build_dialogue(root: Control) -> void:
	_dialogue_panel = PanelContainer.new()
	_dialogue_panel.add_theme_stylebox_override("panel", panel_style(0.85))
	_dialogue_panel.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	_dialogue_panel.custom_minimum_size = Vector2(520, 70)
	_dialogue_panel.position = Vector2(-260, -110)
	_dialogue_panel.visible = false
	root.add_child(_dialogue_panel)
	_dialogue_text = _label("", 15)
	_dialogue_text.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_dialogue_text.custom_minimum_size = Vector2(500, 0)
	_dialogue_panel.add_child(_dialogue_text)


func _modal(root: Control, title: String, button_text: String, cb: Callable) -> Array:
	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", panel_style(0.92))
	panel.set_anchors_preset(Control.PRESET_CENTER)
	panel.custom_minimum_size = Vector2(380, 150)
	panel.position = Vector2(-190, -75)
	panel.visible = false
	root.add_child(panel)
	var v := VBoxContainer.new()
	v.alignment = BoxContainer.ALIGNMENT_CENTER
	v.add_theme_constant_override("separation", 12)
	panel.add_child(v)
	var t := _label(title, 18, KOMIKA)
	t.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	t.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	t.custom_minimum_size = Vector2(360, 0)
	v.add_child(t)
	var b := Button.new()
	b.text = button_text
	b.custom_minimum_size = Vector2(160, 36)
	b.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	b.pressed.connect(cb)
	v.add_child(b)
	return [panel, t]


func _build_died(root: Control) -> void:
	_died_panel = _modal(root, "You have died...", "Respawn", func():
		_died_panel.visible = false
		respawn_pressed.emit())[0]


func _build_error(root: Control) -> void:
	var r := _modal(root, "", "Back to login", func():
		_error_panel.visible = false
		back_to_login.emit())
	_error_panel = r[0]
	_error_text = r[1]


# ---------------------------------------------------------------- update

func on_player_loaded(p) -> void:
	update_bars(p)


func update_bars(p) -> void:
	if p == null:
		return
	_name_label.text = "%s  Lv %d" % [p.ename, p.level]
	var hp_max: int = maxi(1, int(p.stats.get("hpMax", 1)))
	var ep_max: int = maxi(1, int(p.stats.get("epMax", 1)))
	_hp_bar.max_value = hp_max
	_hp_bar.value = int(p.stats.get("hp", 0))
	_hp_text.text = "%d / %d" % [int(p.stats.get("hp", 0)), hp_max]
	_ep_bar.max_value = ep_max
	_ep_bar.value = int(p.stats.get("ep", 0))
	_ep_text.text = "%d / %d" % [int(p.stats.get("ep", 0)), ep_max]
	var xp := 0
	if p.stats.get("exp") is Dictionary:
		xp = int(p.stats.exp.get("base", 0))
	var r := Types.exp_range_for_level(p.level)
	_xp_bar.max_value = maxi(1, r.y - r.x)
	_xp_bar.value = clampi(xp - r.x, 0, r.y - r.x)
	_gold_label.text = "Gold: %d    Gems: %d" % [int(p.gold[0]), int(p.gems)]


func set_target(e) -> void:
	_target = e
	if e == null or not is_instance_valid(e):
		_target_panel.visible = false
		return
	_target_panel.visible = true
	var title: String = e.ename
	if e is Mob:
		title = "%s  (Lv %d)" % [str(e.data.get("name", e.ename)), e.level]
	elif e is ItemEntity:
		title = e.display_name()
	_target_name.text = title
	var has_hp: bool = e.stats.has("hpMax") and int(e.stats.hpMax) > 0
	_target_bar.visible = has_hp
	if has_hp:
		_target_bar.max_value = int(e.stats.hpMax)
		_target_bar.value = int(e.stats.hp)


func update_debug(w) -> void:
	if _target != null and not is_instance_valid(_target):
		set_target(null)
	elif _target != null and _target_bar.visible:
		_target_bar.value = int(_target.stats.get("hp", 0))
	var now := Time.get_ticks_msec()
	if _announce_until > 0 and now > _announce_until:
		_announce_until = 0
		_announce.text = ""
	if _announce_until == 0 and not _announcements.is_empty():
		var a: Array = _announcements.pop_front()
		_announce.text = a[0]
		_announce_until = now + int(a[1])
	if not _debug_on or w == null or w.player == null:
		_debug.text = ""
		return
	_debug.text = "FPS: %d\ngx:%d,gy:%d\nx:%d,y:%d" % [Engine.get_frames_per_second(), w.player.gx, w.player.gy, w.player.x, w.player.y]


func toggle_debug() -> void:
	_debug_on = not _debug_on


func announce(text: String, duration_ms: int) -> void:
	_announcements.append([text, duration_ms])


func set_loading(on: bool, text := "Loading...") -> void:
	_loading.text = text if on else ""


func _push_line(bb: String) -> void:
	_chat_lines.append(bb)
	if _chat_lines.size() > MAX_CHAT_LINES:
		_chat_lines.pop_front()
	_chat_log.text = "\n".join(_chat_lines)


func _esc(t: String) -> String:
	return t.replace("[", "[lb]")


func add_chat(who: String, text: String, color := Color(1, 1, 0)) -> void:
	var prefix := (_esc(who) + ": ") if who != "" else ""
	_push_line("[color=#%s]%s%s[/color]" % [color.to_html(false), prefix, _esc(text)])


func add_notification(text: String) -> void:
	_push_line("[color=#80ff80]%s[/color]" % _esc(text))


func add_game_notification(kind: String, text: String) -> void:
	_push_line("[color=#ffff00]%s: %s[/color]" % [_esc(kind), _esc(text)])


func show_dialogue(speaker: String, text: String) -> void:
	_dialogue_text.text = "%s: %s" % [speaker, text]
	_dialogue_panel.visible = true


func hide_dialogue() -> void:
	_dialogue_panel.visible = false


func show_died() -> void:
	_died_panel.visible = true


func show_error(message: String) -> void:
	_error_text.text = message
	_error_panel.visible = true


func is_chat_open() -> bool:
	return _chat_input.visible


func open_chat(open: bool) -> void:
	_chat_input.visible = open
	if open:
		_chat_input.grab_focus()
		if world:
			world.release_keys()
	else:
		_chat_input.release_focus()


func _on_chat_submitted(text: String) -> void:
	if world and text.strip_edges() != "":
		world.say(text)
	_chat_input.text = ""
	open_chat(false)


func _input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_ESCAPE and _chat_input.visible:
			_chat_input.text = ""
			open_chat(false)
			get_viewport().set_input_as_handled()
		elif (event.keycode == KEY_ENTER or event.keycode == KEY_KP_ENTER) and not _chat_input.visible:
			if _error_panel.visible or _died_panel.visible:
				return
			open_chat(true)
			get_viewport().set_input_as_handled()
