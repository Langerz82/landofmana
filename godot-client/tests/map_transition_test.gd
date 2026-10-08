extends "res://tests/npc_dialogue_test.gd"
## Map changes show a solid black screen from the moment the teleport starts
## until the new map is loaded and the server has placed the player on it.
## Run: godot res://tests/map_transition_test.tscn [-- --shots=DIR]


func watch_teleport(label: String, start: Callable) -> void:
	var saw_black := false
	var leaked := 0          # frames showing the world before the teleport finished
	var black_after := 0     # frames still black after it finished
	start.call()
	check("%s: black right away" % label, hud.is_blacked_out())
	await RenderingServer.frame_post_draw
	await shot("transition_%s_black" % label)
	var t := Time.get_ticks_msec()
	while Time.get_ticks_msec() - t < 10000:
		await get_tree().process_frame
		var done: bool = world.map_status >= 2 and world.started
		if hud.is_blacked_out():
			saw_black = true
			if done:
				black_after += 1
		elif not done:
			leaked += 1
		if done and not hud.is_blacked_out():
			break
	check("%s: stayed black while loading" % label, saw_black and leaked == 0, "leaked %d frames" % leaked)
	check("%s: map shown once placed" % label, not hud.is_blacked_out() and black_after <= 3, "black %d frames after" % black_after)
	await wait(300)
	await shot("transition_%s_after" % label)


func run() -> void:
	check("enter world", await until(func(): return world.started and world.map_status >= 2, 15000))
	await wait(300)
	check("login: map shown", not hud.is_blacked_out())
	await watch_teleport("to_town", func(): world.warp_to_town())
	var door = null
	for d in world.current_map.doors:
		if d.tmap != world.map_index:
			door = d
			break
	if door:
		await watch_teleport("through_door", func(): world.teleport_maps(door.tmap, door.tx, door.ty, door.id))
	_report()
