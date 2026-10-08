extends "res://tests/npc_dialogue_test.gd"
## Settings -> Panel border / Panel background re-colour every panel (windows,
## HUD panels, shortcut bar, menu bar, dialogue box, modals) straight away.
## Run: godot res://tests/panel_colors_test.tscn [-- --shots=DIR]


func _sb(c: Control) -> StyleBoxFlat:
	return c.get_theme_stylebox("panel") as StyleBoxFlat


## Same colour ignoring opacity, within the 8-bit rounding of the saved hex.
func _close(a: Color, b: Color) -> bool:
	return absf(a.r - b.r) < 0.01 and absf(a.g - b.g) < 0.01 and absf(a.b - b.b) < 0.01


func run() -> void:
	check("enter world", await until(func(): return world.started and world.map_status >= 2, 15000))
	await wait(500)
	var old_b = Config.get_setting("ui", "panelborder", UiStyle.DEFAULT_PANEL_BORDER)
	var old_g = Config.get_setting("ui", "panelbg", UiStyle.DEFAULT_PANEL_BG)
	var sw: GameWindow = hud.window("settings")
	sw.open()
	var inv: GameWindow = hud.window("inventory")
	inv.open()
	hud.show_dialogue("Old Man", "Testing the panel colours.", old_man())
	await wait(300)
	# change through the settings window's own pickers
	var border := Color("#E04040")
	var bg := Color(0.1, 0.3, 0.1, 0.8)
	var pb: ColorPickerButton = sw._pickers["panelborder"][0]
	var pg: ColorPickerButton = sw._pickers["panelbg"][0]
	pb.color = border
	pb.color_changed.emit(border)
	pg.color = bg
	pg.color_changed.emit(bg)
	await wait(200)
	var targets := {
		"inventory window": inv, "settings window": sw, "shortcut bar": hud.shortcut_bar,
		"menu bar": hud._menu_panel, "dialogue box": hud._dialogue_panel,
		"player panel": hud._hp_bar.get_parent().get_parent().get_parent(),
		"modal": hud.modals._panel,
	}
	for n in targets:
		var sb := _sb(targets[n])
		check("%s border" % n, sb != null and sb.border_color.is_equal_approx(border), str(sb.border_color) if sb else "none")
		check("%s background" % n, sb != null and _close(sb.bg_color, bg), str(sb.bg_color) if sb else "none")
	check("window opacity from setting", absf(_sb(inv).bg_color.a - 0.8) < 0.01, str(_sb(inv).bg_color.a))
	check("saved", str(Config.get_setting("ui", "panelborder", "")).to_lower() == "#e04040", str(Config.get_setting("ui", "panelborder", "")))
	await shot("panel_colors")
	# windows opened later get the new colours too
	var sk: GameWindow = hud.window("skills")
	sk.open()
	await wait(100)
	check("new window uses colours", _sb(sk).border_color.is_equal_approx(border))
	sw._reset_colors()
	check("reset restores border", _sb(inv).border_color.is_equal_approx(Color(UiStyle.DEFAULT_PANEL_BORDER)))
	await shot("panel_colors_reset")
	Config.set_setting("ui", "panelborder", old_b)
	Config.set_setting("ui", "panelbg", old_g)
	_report()
