extends "res://tests/systems_test.gd"
## NPC talk driven by real input events (mouse clicks and the Space key go
## through the viewport and the GUI, like a player's): speech bubble, dialogue
## box, advancing with Space / clicks, quest acceptance, ambient NPC speech.
## Run: godot res://tests/npc_dialogue_test.tscn -- --user=NAME --pass=PW [--shots=DIR]


func _ready() -> void:
	user = "npcdlg3"
	pw = "secret1"
	super._ready()


func push_key(code: Key, pressed: bool) -> void:
	var e := InputEventKey.new()
	e.keycode = code
	e.physical_keycode = code
	e.pressed = pressed
	get_viewport().push_input(e)


func press_space() -> void:
	push_key(KEY_SPACE, true)
	await get_tree().process_frame
	push_key(KEY_SPACE, false)
	await get_tree().process_frame


func mouse_click(screen: Vector2) -> void:
	var m := InputEventMouseMotion.new()
	m.position = screen
	m.global_position = screen
	get_viewport().push_input(m)
	for pressed in [true, false]:
		var e := InputEventMouseButton.new()
		e.button_index = MOUSE_BUTTON_LEFT
		e.position = screen
		e.global_position = screen
		e.pressed = pressed
		get_viewport().push_input(e)
		await get_tree().process_frame


func world_to_screen(x: int, y: int) -> Vector2:
	return world.get_canvas_transform() * Vector2(x, y)


func old_man():
	for n in world.npcs.values():
		if n.ename == "Old Man":
			return n
	return null


func run() -> void:
	var p: Player
	check("enter world", await until(func(): return world.started and world.map_status >= 2, 15000))
	p = world.player
	await until(func(): return old_man() != null, 5000)
	var npc = old_man()
	check("old man spawned", npc != null)
	if npc == null:
		_report()
		return
	await wait(800)
	# Use the GUI first (menu button + close) so a button may hold keyboard focus.
	var inv_btn: Control = hud._menu.get_child(1)   # 0 is the chat button
	await mouse_click(inv_btn.get_global_rect().get_center())
	check("menu button opens inventory", await until(func(): return hud.window("inventory").visible, 2000))
	hud.window("inventory").close()
	await wait(200)
	# ------------------------------------------------ click the NPC
	await mouse_click(world_to_screen(npc.x, npc.y - 18))
	var started := await until(func(): return p.dialogue_entity == npc, 8000)
	check("click NPC starts dialogue", started, "pos %d,%d npc %d,%d" % [p.x, p.y, npc.x, npc.y])
	check("npc bubble shown", world.bubbles.has(npc.id))
	check("dialogue box visible", hud._dialogue_panel.visible)
	var dr: Rect2 = hud._dialogue_panel.get_global_rect()
	var sr: Rect2 = hud.shortcut_bar.get_global_rect() if hud.shortcut_bar else Rect2()
	check("dialogue box not covered by shortcut bar", not dr.intersects(sr), "%s vs %s" % [dr, sr])
	await shot("npc_01_dialogue")
	# ------------------------------------------------ advance with Space
	if started:
		var lines: int = npc.dialogue.size()
		var i0: int = npc.dialogue_index
		await press_space()
		check("space advances dialogue", await until(func(): return npc.dialogue_index > i0 or p.dialogue_entity == null, 1500), "index %d -> %d" % [i0, npc.dialogue_index])
		var guard := 0
		while p.dialogue_entity != null and guard < lines + 10:
			guard += 1
			if guard % 2 == 0:
				await press_space()
			else:
				await mouse_click(world_to_screen(npc.x, npc.y - 18))
			await wait(250)
		check("dialogue finishes", p.dialogue_entity == null)
		check("dialogue box hidden at end", not hud._dialogue_panel.visible)
		check("quest accepted", await until(func(): return not world.data.quests.is_empty(), 4000), "quests=%s" % [world.data.quests.keys()])
		# The server answers the acceptance with the quest speech.
		await wait(600)
		while p.dialogue_entity != null and guard < 60:
			guard += 1
			await press_space()
			await wait(250)
		await shot("npc_02_after")
	# ------------------------------------------------ keyboard-only talk
	await wait(5500)   # let bubbles expire
	var face := await until(func(): return p.is_next_too_entity(npc), 100)
	if face:
		p.look_at_entity(npc)
		await press_space()
		check("space next to NPC talks", await until(func(): return world.bubbles.has(npc.id) or p.dialogue_entity == npc, 3000))
	await finish_dialogue(p)
	# ------------------------------------------------ every talking NPC in town
	world.warp_to_town()
	await until(func(): return world.map_index == 0 and world.map_status >= 2, 8000)
	await wait(1500)
	print("  map ", world.map_index, " npcs: ", world.npcs.values().map(func(n): return "%s/%s/%d" % [n.ename, n.title(), n.type]))
	var shops := ["Craft", "Beginner shop", "Bank", "Enchant", "Repair", "Auction", "Looks"]
	for n in world.npcs.values():
		if not is_instance_valid(n) or n.title() in shops:
			continue
		await mouse_click(world_to_screen(n.x, n.y))
		var ok := await until(func(): return p.dialogue_entity == n or world.bubbles.has(n.id), 10000)
		check("talk to %s (%s)" % [n.ename, "moving" if n.type == Types.EntityType.NPCMOVE else "static"], ok,
			"pos %d,%d npc %d,%d" % [p.x, p.y, n.x, n.y])
		if ok:
			await shot("npc_town_" + n.ename.replace(" ", "_"))
		await finish_dialogue(p)
	_report()


func finish_dialogue(p) -> void:
	var guard := 0
	while p.dialogue_entity != null and guard < 40:
		guard += 1
		await press_space()
		await wait(250)
	if p.dialogue_entity != null:
		print("  dialogue did not finish with Space; entity=", p.dialogue_entity.ename)
