extends "res://tests/npc_dialogue_test.gd"
## Settings -> Font size scales all text: labels with their own size, plain
## controls (buttons, lists), windows built later, and text drawn in code.
## Run: godot res://tests/font_scale_test.tscn [-- --shots=DIR]


func run() -> void:
	check("enter world", await until(func(): return world.started and world.map_status >= 2, 15000))
	await wait(500)
	var old = Config.get_setting("ui", "fontscale", null)
	# With nothing saved, the game starts at the default scale (1.2).
	if Config.settings.has_section_key("ui", "fontscale"):
		Config.settings.erase_section_key("ui", "fontscale")
	UiStyle.load_settings()
	check("default font scale is 1.2", is_equal_approx(UiStyle.font_scale, 1.2), str(UiStyle.font_scale))
	var sw: GameWindow = hud.window("settings")
	sw.open()
	await wait(200)
	var spin: SpinBox = null
	for c in sw.find_children("*", "SpinBox", true, false):
		if c.tooltip_text.begins_with("1 = normal size"):   # font size, not UI scale
			spin = c
	check("font size control in settings", spin != null)
	var name_label: Label = hud._name_label
	var base := int(name_label.get_meta("base_font_size", name_label.get_theme_font_size("font_size")))
	for scale in [1.5, 2.0, 0.75]:
		spin.value = scale
		await wait(200)
		check("x%.2f: label with own size" % scale, name_label.get_theme_font_size("font_size") == roundi(base * scale),
			"%d -> %d" % [base, name_label.get_theme_font_size("font_size")])
		var btn: Button = sw.find_children("*", "Button", true, false).filter(func(b): return b.text == "Log out")[0]
		check("x%.2f: plain button" % scale, btn.get_theme_font_size("font_size") == roundi(16 * scale), str(btn.get_theme_font_size("font_size")))
		check("x%.2f: text drawn in code" % scale, UiStyle.fs(15) == roundi(15 * scale))
		var sk: GameWindow = hud.window("skills")
		sk.open()
		await wait(150)
		var dl: Label = sk._detail
		check("x%.2f: window opened later" % scale, dl.get_theme_font_size("font_size") == roundi(13 * scale), str(dl.get_theme_font_size("font_size")))
		hud.show_dialogue("Old Man", "Font size test line.", old_man())
		await wait(150)
		await wait(100)
		var vp := get_viewport().get_visible_rect().size
		var r: Rect2 = sw.get_global_rect()
		check("x%.2f: settings window on screen" % scale, r.position.y >= 0 and r.end.y <= vp.y - 60, str(r))
		await shot("font_scale_%s" % str(scale).replace(".", "_"))
		sk.close()
		hud.hide_dialogue()
	spin.value = 1.0
	await wait(150)
	check("back to normal", name_label.get_theme_font_size("font_size") == base)
	check("saved", is_equal_approx(float(Config.get_setting("ui", "fontscale", 0)), 1.0))
	if old == null:
		Config.settings.erase_section_key("ui", "fontscale")
		Config.settings.save(Config.SETTINGS_PATH)
	else:
		Config.set_setting("ui", "fontscale", old)
	_report()
