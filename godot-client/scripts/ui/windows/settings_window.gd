class_name SettingsWindow
extends GameWindow
## Settings (settingshandler.js): chat log, sound, music, on-screen joystick,
## menu / button colours, zoom and shortcut bar layout. Saved in
## user://settings.cfg.

const ZOOMS := [["Closest", 0.6], ["Closer", 0.8], ["Normal", 1.0], ["Further", 1.2], ["Furthest", 1.4]]
const SHORTCUT_STYLES := [["Horizontal ascending", "horizontal-asc"], ["Horizontal descending", "horizontal-desc"],
	["Vertical ascending", "vertical-asc"], ["Vertical descending", "vertical-desc"]]


func _init() -> void:
	super._init("SETTINGS", Vector2(380, 0))


func build() -> void:
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
	var zoom := OptionButton.new()
	for z in ZOOMS:
		zoom.add_item(z[0])
	var cur := float(Config.get_setting("ui", "gamezoom", 1.0))
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
	content.add_child(HSeparator.new())
	content.add_child(UiStyle.button("Log out", func(): hud.back_to_login.emit()))


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


func _color(text: String, key: String, default_value: String) -> void:
	var cp := ColorPickerButton.new()
	cp.color = Color(str(Config.get_setting("ui", key, default_value)))
	cp.edit_alpha = false
	cp.custom_minimum_size = Vector2(80, 28)
	cp.color_changed.connect(func(c: Color):
		Config.set_setting("ui", key, "#" + c.to_html(false))
		UiStyle.load_settings()
		hud.restyle())
	_row(text, cp)
