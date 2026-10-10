extends "res://tests/npc_dialogue_test.gd"
## The first menu button (messenger icon) opens the chat input bar; clicking
## it again closes it. Uses real mouse clicks.
## Run: godot res://tests/chat_button_test.tscn [-- --shots=DIR]


func run() -> void:
	check("enter world", await until(func(): return world.started and world.map_status >= 2, 15000))
	await wait(800)
	var b: TextureButton = hud._menu.get_child(0)
	check("first menu button is chat", b.tooltip_text.begins_with("Chat"), b.tooltip_text)
	check("messenger icon", b.texture_normal != null and b.texture_normal.resource_path.ends_with("messenger.png"), str(b.texture_normal))
	check("inventory button moved to second", (hud._menu.get_child(1) as TextureButton).tooltip_text.begins_with("Equipment"))
	check("chat input closed at start", not hud.is_chat_open())
	var p: Player = world.player
	var pos0 := Vector2i(p.x, p.y)
	await mouse_click(b.get_global_rect().get_center())
	await wait(100)
	check("click opens the chat input", hud.is_chat_open())
	check("chat input has keyboard focus", hud._chat_input.has_focus())
	check("click did not move the player", Vector2i(p.x, p.y) == pos0 and not p.is_moving_path())
	await shot("chat_button_open")
	# typing + Enter sends and closes
	hud._chat_input.text = "hello from the chat button"
	hud._chat_input.text_submitted.emit(hud._chat_input.text)
	await wait(100)
	check("submitting closes the input", not hud.is_chat_open())
	check("message shows in the chat log", await until(func(): return "hello from the chat button" in hud._chat_log.get_parsed_text(), 3000))
	# toggle
	await mouse_click(b.get_global_rect().get_center())
	await wait(100)
	check("click opens again", hud.is_chat_open())
	await mouse_click(b.get_global_rect().get_center())
	await wait(100)
	check("second click closes it", not hud.is_chat_open())
	_report()
