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
var _hp_bar: SmoothBar
var _ep_bar: ProgressBar
var _xp_bar: ProgressBar
var _hp_text: Label
var _ep_text: Label
var _gold_label: Label
var _target_panel: PanelContainer
var _target_name: Label
var _target_bar: SmoothBar
var _chat_log: RichTextLabel
var _chat_input: LineEdit
var _announce: Label
var _dialogue_panel: PanelContainer
var _dialogue_text: Label
var _dialogue_name: Label
var _dialogue_pic: TextureRect
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
var _root: Control
var windows: Dictionary = {}     # name -> GameWindow
var modals: Modals
var shortcut_bar: ShortcutBar
var joystick: TouchJoystick
var _menu: BoxContainer
var _menu_panel: PanelContainer
var _alarm: Label
var _alarm_queue: Array = []
var _alarm_until := 0
var _player_menu: PopupMenu
var _menu_player = null
var _chat_box: VBoxContainer
var _hover = null
var _panels: Array = []


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
	_root = root
	UiStyle.load_settings()
	if world != null and world.get("data") != null:
		_build_game_ui(root)
	announce("Welcome to Land Of Mana!", 5000)


# ------------------------------------------------------------- building

static func panel_style(alpha := 0.6) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.set_meta("panel_alpha", alpha)
	sb.bg_color = UiStyle.panel_bg_for(alpha)
	sb.border_color = UiStyle.panel_border
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(6)
	sb.content_margin_left = 8
	sb.content_margin_right = 8
	sb.content_margin_top = 6
	sb.content_margin_bottom = 6
	return sb


func _bar(color: Color, height := 14, smooth := false) -> ProgressBar:
	var b: ProgressBar = SmoothBar.new() if smooth else ProgressBar.new()
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
	_panels.append(p)
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
	_hp_bar = _bar(Color(0.8, 0.1, 0.1), 16, true)
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
	_target_panel.position = Vector2(-120, 30)
	_target_panel.custom_minimum_size = Vector2(240, 0)
	_target_panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_target_panel.visible = false
	root.add_child(_target_panel)
	var v := VBoxContainer.new()
	_target_panel.add_child(v)
	_target_name = _label("", 14, KOMIKA)
	_target_name.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(_target_name)
	_target_bar = _bar(Color(0.85, 0.15, 0.15), 10, true)
	v.add_child(_target_bar)


func _build_chat(root: Control) -> void:
	var box := VBoxContainer.new()
	_chat_box = box
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
	_debug.offset_top = 30
	_debug.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	root.add_child(_debug)
	var help := _label("Space: attack/talk   T/Y: target   1-6: shortcuts   I: items   C: player   K: skills   Q: quests   Enter: chat   Esc: settings", 11, null, Color(1, 1, 1, 0.6))
	help.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	help.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	help.offset_left = -900
	help.offset_right = -10
	help.offset_top = 8
	help.offset_bottom = 26
	root.add_child(help)


func _build_dialogue(root: Control) -> void:
	# #npcDialog: speaker portrait + text, centred above the shortcut bar.
	# It ignores the mouse like the HTML one, so clicks reach the world
	# (a click next to the NPC shows the next line).
	_dialogue_panel = PanelContainer.new()
	_dialogue_panel.add_theme_stylebox_override("panel", panel_style(0.85))
	_dialogue_panel.anchor_left = 0.5
	_dialogue_panel.anchor_right = 0.5
	_dialogue_panel.anchor_top = 1.0
	_dialogue_panel.anchor_bottom = 1.0
	_dialogue_panel.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_dialogue_panel.grow_vertical = Control.GROW_DIRECTION_BEGIN
	_dialogue_panel.offset_left = -270
	_dialogue_panel.offset_right = 270
	_dialogue_panel.offset_bottom = -92
	_dialogue_panel.offset_top = -92
	_dialogue_panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_dialogue_panel.visible = false
	root.add_child(_dialogue_panel)
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 12)
	h.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_dialogue_panel.add_child(h)
	var frame := PanelContainer.new()
	var fsb := StyleBoxFlat.new()
	fsb.bg_color = Color(1, 1, 1, 0.9)
	fsb.border_color = Color.BLACK
	fsb.set_border_width_all(2)
	frame.add_theme_stylebox_override("panel", fsb)
	frame.custom_minimum_size = Vector2(72, 72)
	frame.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
	frame.mouse_filter = Control.MOUSE_FILTER_IGNORE
	h.add_child(frame)
	_dialogue_pic = TextureRect.new()
	_dialogue_pic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_dialogue_pic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	_dialogue_pic.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	_dialogue_pic.custom_minimum_size = Vector2(68, 68)
	_dialogue_pic.mouse_filter = Control.MOUSE_FILTER_IGNORE
	frame.add_child(_dialogue_pic)
	var v := VBoxContainer.new()
	v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	v.mouse_filter = Control.MOUSE_FILTER_IGNORE
	h.add_child(v)
	_dialogue_name = _label("", 16)
	_dialogue_name.add_theme_font_override("font", KOMIKA)
	_dialogue_name.add_theme_color_override("font_color", Color(1, 1, 0.55))
	v.add_child(_dialogue_name)
	_dialogue_text = _label("", 16)
	_dialogue_text.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_dialogue_text.custom_minimum_size = Vector2(420, 0)
	v.add_child(_dialogue_text)
	var hint := _label("Space / click to continue", 11)
	hint.modulate = Color(1, 1, 1, 0.55)
	hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	v.add_child(hint)


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
	_hp_bar.set_smooth(int(p.stats.get("hp", 0)), hp_max)
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
	var changed: bool = e != _target
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
		# A different entity snaps; the same one slides.
		_target_bar.set_smooth(int(e.stats.hp), int(e.stats.hpMax), changed)


func update_debug(w) -> void:
	if _target != null and not is_instance_valid(_target):
		set_target(null)
	elif _target != null and _target_bar.visible:
		_target_bar.set_smooth(int(_target.stats.get("hp", 0)), maxi(1, int(_target.stats.get("hpMax", 1))))
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


## game.createMessage(): show one dialogue line with the speaker's portrait
## (app.npcDialoguePic). `entity` may be null.
func show_dialogue(speaker: String, text: String, entity = null) -> void:
	_dialogue_name.text = speaker
	_dialogue_text.text = text
	_dialogue_pic.texture = portrait(entity)
	_dialogue_pic.get_parent().visible = _dialogue_pic.texture != null
	# Keep the box above the shortcut bar whatever its layout.
	# Keep the box above whatever sits at the bottom centre (shortcut bar or
	# menu icons, depending on the shortcut layout).
	var bottom := 16.0
	var vp := get_viewport().get_visible_rect().size
	for c in [shortcut_bar, _menu_panel]:
		if c == null or not c.visible:
			continue
		var r: Rect2 = c.get_global_rect()
		if r.position.x < vp.x / 2 + 270 and r.end.x > vp.x / 2 - 270 and r.end.y > vp.y * 0.6:
			bottom = maxf(bottom, vp.y - r.position.y + 10)
	_dialogue_panel.offset_bottom = -bottom
	_dialogue_panel.offset_top = -bottom
	_dialogue_panel.visible = true


## First idle frame of an entity's body sprite, facing down.
static func portrait(entity) -> Texture2D:
	if entity == null or not is_instance_valid(entity) or entity.sprites.is_empty():
		return null
	var def = entity.sprites[0]
	if def == null or def.texture == null:
		return null
	var a: Dictionary = def.animations.get("idle_down", {})
	if a.is_empty():
		for k in def.animations:
			a = def.animations[k]
			break
	var s := GameData.SPRITE_SCALE
	var at := AtlasTexture.new()
	at.atlas = def.texture
	at.region = Rect2(int(a.get("col", 0)) * def.width * s, int(a.get("row", 0)) * def.height * s, def.width * s, def.height * s)
	return at


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


# ======================================================================
# Game windows, menu, shortcut bar, modals (the rest of the JS client UI)
# ======================================================================

const MENU := [
	# [window, icon x, icon y, tooltip, hotkey]
	["inventory", 0, 32, "Equipment & items (I)", KEY_I],
	["stats", 128, 0, "Player (C)", KEY_C],
	["skills", 96, 0, "Skills (K)", KEY_K],
	["quests", 352, 0, "Quests (Q)", KEY_Q],
	["achievements", 448, 0, "Achievements (J)", KEY_J],
	["social", 416, 0, "Social / party (O)", KEY_O],
	["town", 480, 0, "Warp to town", 0],
	["settings", 32, 0, "Settings (Esc)", 0],
	["gemshop", 160, 0, "Store (gems)", 0],
]


func _build_game_ui(root: Control) -> void:
	var data: PlayerData = world.data
	var actions: ItemActions = world.actions
	var wlayer := Control.new()
	wlayer.name = "Windows"
	wlayer.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	wlayer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(wlayer)
	var inv := InventoryWindow.new()
	_add_window(wlayer, "inventory", inv)
	inv.bind(data, actions)
	var bank := BankWindow.new()
	_add_window(wlayer, "bank", bank)
	bank.bind(data, actions, inv)
	for pair in [["store", StoreWindow.new()], ["craft", CraftWindow.new()], ["auction", AuctionWindow.new()], ["looks", AppearanceWindow.new()]]:
		_add_window(wlayer, pair[0], pair[1])
		pair[1].bind(data, actions, inv)
	var stats := StatsWindow.new()
	_add_window(wlayer, "stats", stats)
	stats.bind(data, actions)
	var skills := SkillsWindow.new()
	_add_window(wlayer, "skills", skills)
	skills.bind(data, actions)
	var quests := QuestWindow.new()
	_add_window(wlayer, "quests", quests)
	quests.bind(data)
	var ach := AchievementWindow.new()
	_add_window(wlayer, "achievements", ach)
	ach.bind(data)
	var social := SocialWindow.new()
	_add_window(wlayer, "social", social)
	social.bind(data, actions)
	_add_window(wlayer, "settings", SettingsWindow.new())
	_add_window(wlayer, "gemshop", GemShopWindow.new())
	_add_window(wlayer, "rankings", LeaderboardWindow.new())
	# shortcut bar
	shortcut_bar = ShortcutBar.new()
	root.add_child(shortcut_bar)
	shortcut_bar.bind(world, data, actions)
	apply_shortcut_style()
	# menu bar (#charactermenu)
	var mp := PanelContainer.new()
	mp.add_theme_stylebox_override("panel", UiStyle.panel(0.6))
	_panels.append(mp)
	root.add_child(mp)
	_menu_panel = mp
	_menu = BoxContainer.new()
	_menu.add_theme_constant_override("separation", 2)
	mp.add_child(_menu)
	var entries: Array = MENU.duplicate()
	if LeaderboardWindow.available():
		entries.insert(6, ["rankings", 448, 32, "Rankings", 0])
	for m in entries:
		var b := TextureButton.new()
		b.texture_normal = UiStyle.menu_icon(m[1], m[2])
		b.ignore_texture_size = true
		b.stretch_mode = TextureButton.STRETCH_KEEP_ASPECT_CENTERED
		b.custom_minimum_size = Vector2(36, 36)
		b.tooltip_text = m[3]
		b.focus_mode = Control.FOCUS_NONE
		var wname: String = m[0]
		b.pressed.connect(func(): menu_action(wname))
		_menu.add_child(b)
	_layout_menu()
	# modals, alarm, popup menu, joystick
	modals = Modals.new()
	root.add_child(modals)
	_alarm = _label("", 18, KOMIKA, Color(0.6, 1, 0.6))
	_alarm.set_anchors_preset(Control.PRESET_TOP_WIDE)
	_alarm.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_alarm.offset_top = 80
	_alarm.offset_bottom = 110
	root.add_child(_alarm)
	_player_menu = PopupMenu.new()
	_player_menu.id_pressed.connect(_on_player_menu)
	root.add_child(_player_menu)
	joystick = TouchJoystick.new()
	joystick.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	joystick.offset_left = 20
	joystick.offset_top = -170
	joystick.offset_right = 160
	joystick.offset_bottom = -30
	joystick.direction_changed.connect(func(o): world.joystick_direction(o))
	root.add_child(joystick)
	set_joystick_visible(bool(Config.get_setting("ui", "joystick", OS.has_feature("mobile"))))
	set_chat_visible(bool(Config.get_setting("ui", "chat", true)))
	data.achievement_completed.connect(func(a): alarm("Achievement completed: " + str(a.summary)))
	data.party_invite.connect(_on_party_invite)
	data.gold_changed.connect(func(): update_bars(world.player))


func _add_window(layer: Control, wname: String, w: GameWindow) -> void:
	w.hud = self
	w.world = world
	w.name = wname.capitalize().replace(" ", "") + "Window"
	layer.add_child(w)
	windows[wname] = w


func window(wname: String) -> GameWindow:
	return windows.get(wname)


func open_window(wname: String) -> GameWindow:
	var w := window(wname)
	if w:
		w.open()
	return w


func toggle_window(wname: String) -> void:
	var w := window(wname)
	if w:
		w.toggle()


func menu_action(wname: String) -> void:
	if wname == "town":
		world.warp_to_town()
		return
	toggle_window(wname)


func any_window_open() -> bool:
	for w in windows.values():
		if w.visible:
			return true
	return false


func close_all_windows() -> void:
	for w in windows.values():
		w.close()


func is_pointer_over_ui() -> bool:
	var c := get_viewport().gui_get_hovered_control()
	return c != null and not (c is Overlay)


# -------------------------------------------------------------- modals

func confirm(message: String, cb: Callable) -> void:
	modals.confirm(message, cb)


func notify(message: String, cb: Callable = Callable()) -> void:
	modals.notify(message, cb)


func ask_count(message: String, default_value: int, max_value: int, cb: Callable) -> void:
	modals.ask_count(message, default_value, max_value, cb)


## Shop-type notifications pop up while a shop window is open (game.showNotification).
func shop_window_open() -> bool:
	for n in ["store", "craft", "auction", "looks", "bank"]:
		if windows.has(n) and windows[n].visible:
			return true
	return windows.has("inventory") and windows["inventory"].visible and world.actions.mode != ItemActions.Mode.NORMAL


# ---------------------------------------------------------------- alarm

## UserAlarm (useralarm.js): queued messages fading in the top centre.
func alarm(text: String, ms := 5000) -> void:
	_alarm_queue.append([text, ms])


func _process(_d: float) -> void:
	if _alarm == null:
		return
	var now := Time.get_ticks_msec()
	if _alarm_until > 0:
		var left := _alarm_until - now
		_alarm.modulate.a = clampf(left / 1500.0, 0, 1)
		if left <= 0:
			_alarm_until = 0
			_alarm.text = ""
	elif not _alarm_queue.is_empty():
		var a: Array = _alarm_queue.pop_front()
		_alarm.text = a[0]
		_alarm.modulate.a = 1
		_alarm_until = now + int(a[1]) + 1500


# ------------------------------------------------------------- settings

func set_chat_visible(v: bool) -> void:
	if _chat_log:
		_chat_log.visible = v


func set_joystick_visible(v: bool) -> void:
	if joystick:
		joystick.visible = v


func apply_shortcut_style() -> void:
	if shortcut_bar == null:
		return
	var st := str(Config.get_setting("ui", "shortcutstyle", "horizontal-asc"))
	shortcut_bar.set_style(st)
	if st.begins_with("vertical"):
		shortcut_bar.set_anchors_preset(Control.PRESET_CENTER_RIGHT)
		shortcut_bar.grow_horizontal = Control.GROW_DIRECTION_BEGIN
		shortcut_bar.grow_vertical = Control.GROW_DIRECTION_BOTH
		shortcut_bar.offset_left = -80
		shortcut_bar.offset_right = -8
		shortcut_bar.offset_top = -220
		shortcut_bar.offset_bottom = 220
	else:
		shortcut_bar.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
		shortcut_bar.grow_horizontal = Control.GROW_DIRECTION_BOTH
		shortcut_bar.grow_vertical = Control.GROW_DIRECTION_BEGIN
		shortcut_bar.offset_left = -220
		shortcut_bar.offset_right = 220
		shortcut_bar.offset_top = -72
		shortcut_bar.offset_bottom = -8
	shortcut_bar.reset_size()
	_layout_menu()


## The menu icons go where the shortcut bar is not: shortcut bar along the
## bottom -> vertical menu in the middle of the right edge; shortcut bar
## vertical on the right -> horizontal menu in the middle of the bottom.
func _layout_menu() -> void:
	if _menu_panel == null or shortcut_bar == null:
		return
	var vertical_bar := str(Config.get_setting("ui", "shortcutstyle", "horizontal-asc")).begins_with("vertical")
	var mp := _menu_panel
	_menu.vertical = not vertical_bar
	if vertical_bar:
		mp.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
		mp.grow_horizontal = Control.GROW_DIRECTION_BOTH
		mp.grow_vertical = Control.GROW_DIRECTION_BEGIN
		mp.offset_left = 0
		mp.offset_right = 0
		mp.offset_top = -8
		mp.offset_bottom = -8
	else:
		mp.set_anchors_preset(Control.PRESET_CENTER_RIGHT)
		mp.grow_horizontal = Control.GROW_DIRECTION_BEGIN
		mp.grow_vertical = Control.GROW_DIRECTION_BOTH
		mp.offset_left = -8
		mp.offset_right = -8
		mp.offset_top = 0
		mp.offset_bottom = 0
	mp.reset_size()


## Re-applies menu/button colours after a settings change.
func restyle() -> void:
	# Panel border / background colours, in place (keeps each panel's shape).
	UiStyle.recolor_tree(self)
	for p in _panels:
		UiStyle.recolor_panel(p.get_theme_stylebox("panel"))
	for w in windows.values():
		w.add_theme_stylebox_override("panel", UiStyle.panel())
		w.restyle_title()
		_restyle_buttons(w)
	if shortcut_bar:
		shortcut_bar.add_theme_stylebox_override("panel", UiStyle.panel(0.6))
		_restyle_buttons(shortcut_bar)


func _restyle_buttons(n: Node) -> void:
	for c in n.get_children():
		if c is Button and not (c is CheckButton or c is OptionButton or c is ColorPickerButton):
			UiStyle.style_button(c)
		_restyle_buttons(c)


# --------------------------------------------------------- social / popup

func _on_party_invite(inviter: String) -> void:
	modals.ask_yes_no("%s invited you to a party. Join?" % inviter, func(ok: bool):
		world.client.send([Types.Messages.CW_PARTY, 1, inviter, 1 if ok else 2]))


## PlayerPopupMenu (playerpopupmenu.js) - right click on another player.
## Pending "select, then click a shortcut slot" assignment: the most recent
## selection in the skills or inventory window. Clears it when taken.
func take_shortcut_pick() -> Dictionary:
	var best: Dictionary = {}
	var best_win = null
	var best_t := -1
	for n in ["skills", "inventory"]:
		var w = window(n)
		if w == null or not w.has_method("shortcut_pick"):
			continue
		var p: Dictionary = w.shortcut_pick()
		if not p.is_empty() and int(w.select_time) > best_t:
			best = p
			best_win = w
			best_t = int(w.select_time)
	if best_win:
		best_win.clear_shortcut_pick()
	return best


func show_player_menu(p) -> void:
	_menu_player = p
	var data: PlayerData = world.data
	var me: String = world.player.ename
	_player_menu.clear()
	_player_menu.add_separator(p.ename)
	if (data.is_party_leader(me) and not data.is_party_member(p.ename)) or data.party.is_empty():
		_player_menu.add_item("Invite to party", 1)
	if data.is_party_leader(me) and data.is_party_member(p.ename):
		_player_menu.add_item("Make party leader", 2)
		_player_menu.add_item("Kick from party", 3)
	if p.level >= 20 and world.player.level >= 20 and world.map_index != 0:
		_player_menu.add_item("Stop attacking" if world.player.pvp_target == p else "Attack (PvP)", 4)
	_player_menu.reset_size()
	_player_menu.position = Vector2i(get_viewport().get_mouse_position())
	_player_menu.popup()


func _on_player_menu(id: int) -> void:
	var p = _menu_player
	if p == null or not is_instance_valid(p):
		return
	var social: SocialWindow = windows.get("social")
	match id:
		1: social.invite(p.ename)
		2: social.make_leader(p.ename)
		3: social.kick(p.ename)
		4:
			if world.player.pvp_target == p:
				world.player.pvp_target = null
			else:
				world.player.pvp_target = p
				world.make_player_attack(p)


# ------------------------------------------------------------- hotkeys

func _unhandled_key_input(e: InputEvent) -> void:
	if windows.is_empty() or not (e is InputEventKey) or not e.pressed or e.echo:
		return
	if modals and modals.is_open():
		return
	if e.keycode == KEY_ESCAPE:
		if any_window_open():
			close_all_windows()
		else:
			toggle_window("settings")
		get_viewport().set_input_as_handled()
		return
	for m in MENU:
		if int(m[4]) != 0 and e.keycode == int(m[4]):
			toggle_window(m[0])
			get_viewport().set_input_as_handled()
			return
	if e.keycode >= KEY_1 and e.keycode <= KEY_6:
		world.actions.exec_shortcut(e.keycode - KEY_1)
		get_viewport().set_input_as_handled()
