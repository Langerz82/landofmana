extends "res://tests/map_transition_test.gd"
## Map loading without threads (what a Web export without "Thread Support"
## gets): maps load on the main thread, behind the black screen.
## Run: godot res://tests/sync_map_load_test.tscn [-- --shots=DIR]


func run() -> void:
	check("enter world", await until(func(): return world.started and world.map_status >= 2, 15000))
	check("desktop build can use threads", world.can_use_threads())
	world.sync_map_loading = true
	world.map_cache.clear()
	await wait(300)
	await watch_teleport("sync_to_town", func(): world.warp_to_town())
	check("no loader thread used", world._loading_thread == null)
	check("map drawn", world.current_map != null and world.current_map.loaded and world.map_renderer.bg_layers[0].get_used_cells().size() > 0)
	var door = null
	for d in world.current_map.doors:
		if d.tmap != world.map_index:
			door = d
			break
	if door:
		world.map_cache.clear()
		await watch_teleport("sync_door", func(): world.teleport_maps(door.tmap, door.tx, door.ty, door.id))
		check("door map loaded", world.map_index == door.tmap and world.current_map.map_index == door.tmap)
	_report()
