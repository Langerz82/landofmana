class_name SettingsWindow
extends GameWindow
## Settings (settingshandler.js): chat log, sound, music, on-screen joystick,
## menu / button colours, zoom and shortcut bar layout. Saved in
## user://settings.cfg.

var _scroll: ScrollContainer
var _pickers: Dictionary = {}   # setting key -> [ColorPickerButton, default]

const ZOOMS := [["Closest", 0.4], ["Closer", 0.6], ["Normal", 0.8], ["Further", 1.0], ["Furthest", 1.2]]
const BAR_SPEEDS := [["Instant", 0], ["Fast (250 ms)", 250], ["Normal (500 ms)", 500], ["Slow (1000 ms)", 1000]]
const SHORTCUT_STYLES := [["Horizontal ascending", "horizontal-asc"], ["Horizontal descending", "horizontal-desc"],
	["Vertical ascending", "vertical-asc"], ["Vertical descending", "vertical-desc"]]


func _init() -> void:
	super._init("SETTINGS", Vector2(380, 0))


func build() -> void:
	# The rows scroll when large fonts make them taller than the screen.
	_scroll = ScrollContainer.new()
	_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	content.add_child(_scroll)
	var rows := VBoxContainer.new()
	rows.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	rows.add_theme_constant_override("separation", 6)
	_scroll.add_child(rows)
	content = rows
	_toggle("Chat log", "ui", "chat", true, func(v): hud.set_chat_visible(v))
	_toggle("Sound", "audio", "sfx", true, func(v): world.audio.sfx_on = v)
	_toggle("Music", "audio", "music", true, func(v):
		if world.audio.music_on != v:
			world.audio.toggle_music(world.map_index))
	_toggle("Joystick", "ui", "joystick", OS.has_feature("mobile"), func(v): hud.set_joystick_visible(v))
	_toggle("Fullscreen", "ui", "fullscreen", false, func(v):
		DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_FULLSCREEN if v else DisplayServer.WINDOW_MODE_WINDOWED))
	_color("Menu color", "menucolor", "#38A7DF")
	_color("Button color", "buttoncolor", "#F7B132")
	_color("Panel border", "panelborder", UiStyle.DEFAULT_PANEL_BORDER)
	_color("Panel background", "panelbg", UiStyle.DEFAULT_PANEL_BG, true)
	content.add_child(UiStyle.button("Reset colours", _reset_colors))
	var zoom := OptionButton.new()
	for z in ZOOMS:
		zoom.add_item(z[0])
	var cur := float(Config.get_setting("ui", "gamezoom", 0.8))
	for i in range(ZOOMS.size()):
		if is_equal_approx(ZOOMS[i][1], cur):
			zoom.select(i)
	zoom.item_selected.connect(func(i):
		Config.set_setting("ui", "gamezoom", ZOOMS[i][1])
		world.set_zoom(ZOOMS[i][1]))
	_row("Zoom", zoom)
	var sc := OptionButton.new()
	var cur_sc := str(Config.get_setting("ui", "shortcutstyle", "horizontal-asc"))
	for i in range(SHORTCUT_STYLES.size()):
		sc.add_item(SHORTCUT_STYLES[i][0])
		if SHORTCUT_STYLES[i][1] == cur_sc:
			sc.select(i)
	sc.item_selected.connect(func(i):
		Config.set_setting("ui", "shortcutstyle", SHORTCUT_STYLES[i][1])
		hud.apply_shortcut_style())
	_row("Shortcuts", sc)
	var hb := OptionButton.new()
	var cur_ms := SmoothBar.duration_ms()
	for i in range(BAR_SPEEDS.size()):
		hb.add_item(BAR_SPEEDS[i][0])
		if int(BAR_SPEEDS[i][1]) == cur_ms:
			hb.select(i)
	hb.item_selected.connect(func(i): Config.set_setting("ui", "healthbarms", BAR_SPEEDS[i][1]))
	_row("Health bars", hb)
	# Font size: a scale for all text; 1 = normal, above 1 bigger, below 1 smaller.
	var fsb := SpinBox.new()
	fsb.min_value = UiStyle.FONT_SCALE_MIN
	fsb.max_value = UiStyle.FONT_SCALE_MAX
	fsb.step = 0.05
	fsb.value = UiStyle.font_scale
	fsb.tooltip_text = "1 = normal size, above 1 = bigger, below 1 = smaller (default %.1f)" % UiStyle.DEFAULT_FONT_SCALE
	fsb.value_changed.connect(func(v: float):
		Config.set_setting("ui", "fontscale", snappedf(v, 0.01))
		UiStyle.font_scale = v
		UiStyle.apply_font_scale(get_tree())
		hud.relayout_windows.call_deferred())
	_row("Font size", fsb)
	content.add_child(HSeparator.new())
	content.add_child(UiStyle.button("Log out", func(): hud.back_to_login.emit()))


## Show all rows when they fit, otherwise as many as fit and scroll.
func _place() -> void:
	if _scroll:
		var rows: Control = _scroll.get_child(0)
		var avail := get_viewport_rect().size.y - 70.0 - 90.0   # shortcut bar, title, margins
		_scroll.custom_minimum_size = Vector2(rows.get_combined_minimum_size().x, minf(rows.get_combined_minimum_size().y, maxf(160.0, avail)))
	super._place()


func _row(text: String, c: Control) -> void:
	var h := HBoxContainer.new()
	var l := UiStyle.label(text, 14)
	l.custom_minimum_size = Vector2(130, 0)
	h.add_child(l)
	c.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	h.add_child(c)
	content.add_child(h)


func _toggle(text: String, section: String, key: String, default_value: bool, apply: Callable) -> void:
	var b := CheckButton.new()
	b.button_pressed = bool(Config.get_setting(section, key, default_value))
	b.text = "On" if b.button_pressed else "Off"
	b.toggled.connect(func(v: bool):
		b.text = "On" if v else "Off"
		Config.set_setting(section, key, v)
		apply.call(v))
	_row(text, b)


## A colour setting; `with_alpha` also lets the player pick the opacity.
func _color(text: String, key: String, default_value: String, with_alpha := false) -> void:
	var cp := ColorPickerButton.new()
	cp.color = Color(str(Config.get_setting("ui", key, default_value)))
	cp.edit_alpha = with_alpha
	cp.custom_minimum_size = Vector2(80, 28)
	cp.color_changed.connect(func(c: Color):
		Config.set_setting("ui", key, "#" + c.to_html(with_alpha))
		UiStyle.load_settings()
		hud.restyle())
	_pickers[key] = [cp, default_value]
	_row(text, cp)


func _reset_colors() -> void:
	for key in _pickers:
		var cp: ColorPickerButton = _pickers[key][0]
		Config.set_setting("ui", key, _pickers[key][1])
		cp.color = Color(str(_pickers[key][1]))
	UiStyle.load_settings()
	hud.restyle()
