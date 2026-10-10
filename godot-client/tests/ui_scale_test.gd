extends "res://tests/npc_dialogue_test.gd"
## Settings -> UI scale (0.5 .. 1.5, default 1): the whole HUD grows or shrinks,
## panels keep their screen corners, windows stay on screen, and mouse
## clicks / window dragging still hit the right places.
## Run: godot res://tests/ui_scale_test.tscn [-- --shots=DIR]


func find_spin(n: Node) -> SpinBox:
	for c in n.get_children():
		if c is SpinBox and c.tooltip_text.begins_with("Size of the whole"):
			return c
		var r := find_spin(c)
		if r:
			return r
	return null


func drag(from: Vector2, to: Vector2) -> void:
	var m := InputEventMouseMotion.new()
	m.position = from
	m.global_position = from
	get_viewport().push_input(m)
	await get_tree().process_frame
	for pressed in [true]:
		var d := InputEventMouseButton.new()
		d.button_index = MOUSE_BUTTON_LEFT
		d.pressed = pressed
		d.position = from
		d.global_position = from
		get_viewport().push_input(d)
		await get_tree().process_frame
	for i in range(1, 6):
		var mm := InputEventMouseMotion.new()
		mm.position = from.lerp(to, i / 5.0)
		mm.global_position = mm.position
		mm.button_mask = MOUSE_BUTTON_MASK_LEFT
		get_viewport().push_input(mm)
		await get_tree().process_frame
	var u := InputEventMouseButton.new()
	u.button_index = MOUSE_BUTTON_LEFT
	u.position = to
	u.global_position = to
	get_viewport().push_input(u)
	await get_tree().process_frame


func on_screen(r: Rect2, vp: Vector2) -> bool:
	return r.position.x >= -1 and r.position.y >= -1 and r.end.x <= vp.x + 1 and r.end.y <= vp.y + 1


func run() -> void:
	check("enter world", await until(func(): return world.started and world.map_status >= 2, 15000))
	await wait(800)
	var saved = Config.get_setting("ui", "uiscale", 1.0)
	check("default scale is 1", is_equal_approx(UiStyle.DEFAULT_UI_SCALE, 1.0))
	# Change it through the settings window like a player.
	var sw = hud.window("uisettings")
	sw.open()
	await wait(200)
	var spin := find_spin(sw)
	check("settings has a UI scale option", spin != null)
	check("range 0.5 to 1.5", spin != null and is_equal_approx(spin.min_value, 0.5) and is_equal_approx(spin.max_value, 1.5))
	if spin:
		spin.value = 1.0
		await wait(100)
	sw.close()
	await wait(200)
	var vp := get_viewport().get_visible_rect().size
	var base_bar: Vector2 = hud.shortcut_bar.get_global_rect().size
	var base_player: Vector2 = hud._root.get_child(1).get_global_rect().size
	for st in ["horizontal-asc", "vertical-asc"]:
		Config.set_setting("ui", "shortcutstyle", st)
		hud.apply_shortcut_style()
		for sc in [0.5, 1.5]:
			spin.value = sc
			await wait(300)
			var mm: Rect2 = hud._menu_panel.get_global_rect()
			var bb: Rect2 = hud.shortcut_bar.get_global_rect()
			check("%s %.1f: menu and bar apart, on screen" % [st, sc], not mm.intersects(bb) and on_screen(mm, vp) and on_screen(bb, vp), "%s %s" % [mm, bb])
			await shot("ui_scale_%s_%s" % [st, str(sc).replace(".", "_")])
	Config.set_setting("ui", "shortcutstyle", "horizontal-asc")
	hud.apply_shortcut_style()
	for s in [0.5, 1.5]:
		spin.value = s
		await wait(300)
		check("%.1f: saved" % s, is_equal_approx(float(Config.get_setting("ui", "uiscale", 0)), s))
		var b: Rect2 = hud.shortcut_bar.get_global_rect()
		check("%.1f: shortcut bar scaled" % s, absf(b.size.x - base_bar.x * s) < base_bar.x * s * 0.05, "%s vs %s" % [b.size, base_bar])
		check("%.1f: shortcut bar still in its corner" % s, on_screen(b, vp) and b.end.y > vp.y - 20 * s - 2, str(b))
		var m: Rect2 = hud._menu_panel.get_global_rect()
		check("%.1f: menu on screen, clear of the shortcut bar" % s, on_screen(m, vp) and m.end.x > vp.x - 20 and not m.intersects(b), "%s %s" % [m, b])
		var c: Rect2 = hud._chat_box.get_global_rect()
		check("%.1f: chat bottom-left" % s, c.position.x < 20 and c.end.y <= vp.y + 1 and c.end.y > vp.y - 30, str(c))
		check("%.1f: blackout still covers the screen" % s, hud._blackout.get_global_rect().size.distance_to(vp) < 2)
		# Crisp text: HUD text is rasterized at its on-screen size.
		var nf = hud._name_label.get_theme_font("font")
		check("%.1f: HUD text font oversampled to the scale" % s, nf is FontFile and is_equal_approx(nf.oversampling, s), str(nf.oversampling if nf is FontFile else nf))
		var base_fs := int(hud._name_label.get_meta("base_font_size", 12))
		var on_screen_px: float = hud._name_label.get_theme_font_size("font_size") * s
		check("%.1f: HUD text not below 0.8x on screen" % s, on_screen_px >= base_fs * UiStyle.font_scale * minf(s, 0.8) - 1.0 and on_screen_px <= base_fs * UiStyle.font_scale * maxf(s, 0.8) + 1.0, "%.1f px (base %d)" % [on_screen_px, base_fs])
		var df = hud._chat_log.get_theme_default_font()
		check("%.1f: HUD default font oversampled" % s, df is FontFile and is_equal_approx(df.oversampling, s))
		check("%.1f: fonts outside the HUD untouched" % s, is_zero_approx((load("res://assets/fonts/KOMIKAH.ttf") as FontFile).oversampling) and is_zero_approx((ThemeDB.fallback_font as FontFile).oversampling) and (ThemeDB.fallback_font as FontFile).resource_path.ends_with("advocut-webfont.ttf"))
		# window opens on screen; title-bar drag follows the mouse 1:1
		var inv = hud.window("inventory")
		inv.open()
		await wait(250)
		var w: Rect2 = inv.get_global_rect()
		check("%.1f: inventory on screen" % s, on_screen(w, vp), str(w))
		var tb: Rect2 = inv._title_bar.get_global_rect()
		var from := tb.position + Vector2(20, tb.size.y / 2)
		await drag(from, from + Vector2(-40, 30))
		await wait(100)
		var w2: Rect2 = inv.get_global_rect()
		check("%.1f: window drag follows the mouse" % s, w2.position.distance_to(w.position + Vector2(-40, 30)) < 2, "%s -> %s" % [w.position, w2.position])
		inv.close()
		# real click on the chat menu button
		var cb: Control = hud._menu.get_child(0)
		await mouse_click(cb.get_global_rect().get_center())
		await wait(100)
		check("%.1f: clicking a menu button works" % s, hud.is_chat_open())
		hud.open_chat(false)
		hud.show_dialogue("Old Man", "Checking the dialogue box at this UI scale.", old_man())
		await get_tree().process_frame
		var d: Rect2 = hud._dialogue_panel.get_global_rect()
		check("%.1f: dialogue on screen, clear of the bars" % s, on_screen(d, vp) and not d.intersects(b) and not d.intersects(m), str(d))
		await shot("ui_scale_%s" % str(s).replace(".", "_"))
		hud.hide_dialogue()
	spin.value = 1.0
	await wait(200)
	check("back to 1: same size as before", hud.shortcut_bar.get_global_rect().size.distance_to(base_bar) < 2)
	Config.set_setting("ui", "uiscale", saved)
	_report()
