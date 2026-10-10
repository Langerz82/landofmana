extends "res://tests/npc_dialogue_test.gd"
## Windows open centred on screen and are centred again when their size, the
## font size or the UI scale changes, unless the player dragged them away.
## Run: godot res://tests/window_center_test.tscn [-- --shots=DIR]


func find_spin(n: Node, prefix: String) -> SpinBox:
	for c in n.find_children("*", "SpinBox", true, false):
		if c.tooltip_text.begins_with(prefix):
			return c
	return null


## Distance of the window's centre from the screen centre (screen pixels);
## vertically it may sit higher when it has to clear the bottom bar.
func centre_off(w: Control) -> Vector2:
	var vp := get_viewport().get_visible_rect().size
	return w.get_global_rect().get_center() - vp / 2


func centred(w: Control) -> bool:
	var o := centre_off(w)
	var r: Rect2 = w.get_global_rect()
	var vp := get_viewport().get_visible_rect().size
	var s: float = hud._root.scale.x
	# horizontally exact; vertically exact unless pushed up to clear the bottom bar / top edge
	return absf(o.x) <= 1.5 * s + 0.5 and (absf(o.y) <= 1.5 * s + 0.5 or r.position.y <= 1 or r.end.y >= vp.y - 70 * s - 1)


func drag_title(w: GameWindow, delta: Vector2) -> void:
	var tb: Rect2 = w._title_bar.get_global_rect()
	var from := tb.position + Vector2(20, tb.size.y / 2)
	for ev in [["move", from], ["down", from], ["move", from + delta / 2], ["move", from + delta], ["up", from + delta]]:
		var e: InputEventMouse
		if ev[0] == "move":
			e = InputEventMouseMotion.new()
			e.button_mask = MOUSE_BUTTON_MASK_LEFT
		else:
			e = InputEventMouseButton.new()
			e.button_index = MOUSE_BUTTON_LEFT
			e.pressed = ev[0] == "down"
		e.position = ev[1]
		e.global_position = ev[1]
		get_viewport().push_input(e)
		await get_tree().process_frame


func run() -> void:
	check("enter world", await until(func(): return world.started and world.map_status >= 2, 15000))
	await wait(500)
	var saved_ui = Config.get_setting("ui", "uiscale", 1.0)
	var saved_fs = Config.get_setting("ui", "fontscale", UiStyle.DEFAULT_FONT_SCALE)
	var sw: GameWindow = hud.window("uisettings")
	sw.open()
	await wait(300)
	check("settings opens centred", centred(sw), str(centre_off(sw)))
	await shot("center_settings_1_0")
	var ui := find_spin(sw, "Size of the whole")
	var fsz := find_spin(sw, "1 = normal size")
	for s in [0.5, 1.5, 1.25, 1.0]:
		ui.value = s
		await wait(400)
		check("UI scale %.2f: settings re-centred" % s, centred(sw), "%s %s" % [centre_off(sw), sw.get_global_rect()])
		if s == 0.5 or s == 1.5:
			await shot("center_settings_" + str(s).replace(".", "_"))
	fsz.value = 1.6
	await wait(400)
	check("font size change: re-centred", centred(sw), str(centre_off(sw)))
	fsz.value = float(saved_fs)
	await wait(300)
	# A window the player moved keeps its place (relative), just stays on screen.
	await drag_title(sw, Vector2(-150, 40))
	await wait(200)
	var moved := sw.position
	check("dragged away from centre", absf(centre_off(sw).x) > 100, str(centre_off(sw)))
	ui.value = 1.25
	await wait(400)
	check("dragged window not re-centred by scaling (only kept on screen)", absf(sw.position.x - moved.x) < 2, "%s %s" % [moved, sw.position])
	var vp := get_viewport().get_visible_rect().size
	var r := sw.get_global_rect()
	check("dragged window still on screen", r.position.x >= -1 and r.end.x <= vp.x + 1 and r.position.y >= -1, str(r))
	sw.recenter()
	await wait(100)
	check("recenter() puts it back", centred(sw), str(centre_off(sw)))
	sw.close()
	# Other windows opened after the scale change are centred too.
	for wn in ["inventory", "stats", "quests"]:
		var w: GameWindow = hud.window(wn)
		w.open()
		await wait(300)
		check("%s centred at UI scale 1.25" % wn, centred(w), str(centre_off(w)))
		w.close()
	ui.value = 1.0
	await wait(200)
	Config.set_setting("ui", "uiscale", saved_ui)
	_report()
