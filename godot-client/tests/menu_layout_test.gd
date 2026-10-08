extends "res://tests/npc_dialogue_test.gd"
## HUD layout with the horizontal and vertical shortcut styles: the menu
## icons are a column at the right middle (bar bottom-right) or a row at the bottom
## right (bar vertical at the right middle), and the NPC
## dialogue box stays clear of both bars.
## Run: godot res://tests/menu_layout_test.tscn [-- --shots=DIR]


func run() -> void:
	check("enter world", await until(func(): return world.started and world.map_status >= 2, 15000))
	await wait(800)
	var old_style = Config.get_setting("ui", "shortcutstyle", "horizontal-asc")
	for st in ["horizontal-asc", "vertical-asc"]:
		Config.set_setting("ui", "shortcutstyle", st)
		hud.apply_shortcut_style()
		await wait(300)
		var vp := get_viewport().get_visible_rect().size
		var m: Rect2 = hud._menu_panel.get_global_rect()
		var b: Rect2 = hud.shortcut_bar.get_global_rect()
		if st.begins_with("vertical"):
			check("vertical bar: shortcut bar at the right middle", absf(b.get_center().y - vp.y / 2) < 2 and b.end.x > vp.x - 20, str(b))
			check("vertical bar: menu row at the bottom right",
				m.end.x > vp.x - 20 and m.end.y > vp.y - 20 and m.size.x > m.size.y, str(m))
		else:
			check("horizontal bar: shortcut bar at the bottom right", b.end.x > vp.x - 20 and b.end.y > vp.y - 20 and b.size.x > b.size.y, str(b))
			check("horizontal bar: menu column at the right middle",
				absf(m.get_center().y - vp.y / 2) < 2 and m.end.x > vp.x - 20 and m.size.y > m.size.x, str(m))
		await wait(100)
		var c: Rect2 = hud._chat_box.get_global_rect()
		check("%s: chat log in the bottom-left corner" % st, c.position.x < 20 and c.end.y >= vp.y - 12 and c.position.y > 0, str(c))
		check("%s: menu and shortcut bar apart" % st, not m.intersects(b), "%s %s" % [m, b])
		var npc = old_man()
		if npc:
			world.bubble(npc, "Testing the layout.")
		hud.show_dialogue("Old Man", "A line of dialogue to check where the box sits.", npc)
		await get_tree().process_frame
		var d: Rect2 = hud._dialogue_panel.get_global_rect()
		check("%s: dialogue box clear of both bars" % st, not d.intersects(m) and not d.intersects(b), str(d))
		await wait(200)
		await shot("layout_" + st)
		hud.hide_dialogue()
	Config.set_setting("ui", "shortcutstyle", old_style)
	_report()
