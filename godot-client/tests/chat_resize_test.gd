extends "res://tests/npc_dialogue_test.gd"
## Drag the chat log's top border with the mouse to resize it; the height is
## clamped and saved in the settings.
## Run: godot res://tests/chat_resize_test.tscn [-- --shots=DIR]


func drag(from: Vector2, to: Vector2) -> void:
	var m := InputEventMouseMotion.new()
	m.position = from
	m.global_position = from
	get_viewport().push_input(m)
	await get_tree().process_frame
	var d := InputEventMouseButton.new()
	d.button_index = MOUSE_BUTTON_LEFT
	d.pressed = true
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
	u.pressed = false
	u.position = to
	u.global_position = to
	get_viewport().push_input(u)
	await get_tree().process_frame
	await get_tree().process_frame


func log_rect() -> Rect2:
	return hud._chat_log.get_global_rect()


func run() -> void:
	check("enter world", await until(func(): return world.started and world.map_status >= 2, 15000))
	await wait(800)
	var saved = Config.get_setting("ui", "chatheight", hud.CHAT_HEIGHT)
	hud.set_chat_height(hud.CHAT_HEIGHT)
	await wait(100)
	var vp := get_viewport().get_visible_rect().size
	var r0 := log_rect()
	check("default height", absf(r0.size.y - hud.CHAT_HEIGHT) < 2, str(r0))
	var bottom := r0.end.y
	var px := r0.position.x + 100
	var p: Player = world.player
	var pos0 := Vector2i(p.x, p.y)
	# taller
	await drag(Vector2(px, r0.position.y), Vector2(px, r0.position.y - 120))
	var r1 := log_rect()
	check("drag up makes it taller", absf(r1.size.y - (hud.CHAT_HEIGHT + 120)) < 3, str(r1))
	check("bottom edge stays put", absf(r1.end.y - bottom) < 1, str(r1))
	check("height saved", absf(float(Config.get_setting("ui", "chatheight", 0)) - r1.size.y) < 2)
	await shot("chat_taller")
	# shorter
	await drag(Vector2(px, r1.position.y + 2), Vector2(px, r1.position.y + 250))
	var r2 := log_rect()
	check("drag down makes it shorter", absf(r2.size.y - (r1.size.y - 248)) < 3, str(r2))
	await shot("chat_shorter")
	# limits
	await drag(Vector2(px, r2.position.y), Vector2(px, bottom + 50))
	check("minimum height", absf(log_rect().size.y - hud.CHAT_MIN_HEIGHT) < 2, str(log_rect()))
	await drag(Vector2(px, log_rect().position.y), Vector2(px, -200))
	check("maximum height keeps it on screen", log_rect().position.y >= 100 and log_rect().size.y <= vp.y - 140 + 1, str(log_rect()))
	check("dragging did not move the player", Vector2i(p.x, p.y) == pos0 and not p.is_moving_path(), "%d,%d" % [p.x, p.y])
	# layout keeps the saved height
	hud.set_chat_height(300)
	hud.apply_shortcut_style()
	await wait(200)
	check("relayout keeps the height", absf(log_rect().size.y - 300) < 2, str(log_rect()))
	Config.set_setting("ui", "chatheight", saved)
	hud._layout_chat()
	_report()
