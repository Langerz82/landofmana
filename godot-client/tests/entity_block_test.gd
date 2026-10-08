extends "res://tests/npc_dialogue_test.gd"
## The local player cannot walk through other entities on screen (mobs, NPCs,
## other players, items, nodes...), with the keyboard or by clicking, but can
## always walk off one it is standing on. Uses stand-in entities placed next to us.
## Run: godot --headless res://tests/entity_block_test.tscn


const TS := Types.G_TILESIZE


func free_line(p: Player, o: int, tiles: int) -> bool:
	var m: MapData = world.current_map
	for i in range(1, tiles + 1):
		var t := p.get_tile_position_next_to(o, i)
		if m.is_colliding(t.x, t.y):
			return false
		for e in world.entities.values():
			if e != p and e is Entity and e.is_within_dist(t.x, t.y, TS):
				return false
	return true


func run() -> void:
	check("enter world", await until(func(): return world.started and world.map_status >= 2, 15000))
	var p: Player = world.player
	await wait(800)
	# Find a direction with 4 free tiles.
	var dir := -1
	var t0 := Time.get_ticks_msec()
	while dir < 0 and Time.get_ticks_msec() - t0 < 15000:
		for o in [Types.Orientation.RIGHT, Types.Orientation.LEFT, Types.Orientation.DOWN, Types.Orientation.UP]:
			if free_line(p, o, 5):
				dir = o
				break
		if dir < 0:
			await wait(250)   # wait for wandering mobs to move away
	check("found open ground", dir > 0, "at %d,%d" % [p.x, p.y])
	if dir < 0:
		_report()
		return
	var start := Vector2i(p.x, p.y)
	# A stand-in other player two tiles away.
	var other := Player.new()
	other.id = 987654
	other.type = Types.EntityType.PLAYER
	other.ename = "Blocker"
	var bpos := p.get_tile_position_next_to(dir, 2)
	other.set_pos(bpos.x, bpos.y)
	world._add_entity(other)
	check("other player blocks me", world.blocks_movement(other, p))
	check("other players do not block each other", not world.blocks_movement(p, other))
	# ---------------------------------------------- keyboard
	p.key_input(dir, true)
	await wait(1200)
	p.key_input(dir, false)
	await wait(400)
	var gap := Types.real_distance(p.x, p.y, other.x, other.y)
	check("keyboard stops before the other player", gap >= TS, "gap %d pos %d,%d other %d,%d" % [gap, p.x, p.y, other.x, other.y])
	check("keyboard still moved up to it", p.x != start.x or p.y != start.y)
	# ---------------------------------------------- click past it
	var beyond := p.get_tile_position_next_to(dir, 3)
	var path := world.find_path(p, beyond.x, beyond.y)
	var through := false
	for i in range(path.size() - 1):
		var a: Array = path[i]
		var b: Array = path[i + 1]
		# Does the segment pass the blocker's tile centre?
		if (int(a[0]) == other.x and int(b[0]) == other.x and other.y >= mini(int(a[1]), int(b[1])) and other.y <= maxi(int(a[1]), int(b[1]))) \
			or (int(a[1]) == other.y and int(b[1]) == other.y and other.x >= mini(int(a[0]), int(b[0])) and other.x <= maxi(int(a[0]), int(b[0]))):
			through = true
	check("click path goes around", path.size() > 0 and not through, str(path))
	# ---------------------------------------------- something steps into the path
	world.remove_entity(other)
	other.queue_free()
	await wait(200)
	var item := ItemEntity.new()
	item.id = 987655
	item.type = Types.EntityType.ITEM
	item.kind = 34
	var ipos := p.get_tile_position_next_to(dir, 1)
	item.set_pos(ipos.x, ipos.y)
	world._add_entity(item)
	check("items block too", world.blocks_movement(item, p))
	p.key_input(dir, true)
	await wait(700)
	p.key_input(dir, false)
	await wait(400)
	check("keyboard stops before the item", Types.real_distance(p.x, p.y, item.x, item.y) >= TS, "pos %d,%d item %d,%d" % [p.x, p.y, item.x, item.y])
	# Standing on an item (e.g. one just dropped): walking off it works.
	item.set_pos(p.x, p.y)
	var s3 := Vector2i(p.x, p.y)
	var away := -1
	match dir:
		Types.Orientation.RIGHT: away = Types.Orientation.LEFT
		Types.Orientation.LEFT: away = Types.Orientation.RIGHT
		Types.Orientation.UP: away = Types.Orientation.DOWN
		Types.Orientation.DOWN: away = Types.Orientation.UP
	p.key_input(away, true)
	await wait(500)
	p.key_input(away, false)
	await wait(400)
	check("can walk off an item it stands on", Types.real_distance(p.x, p.y, s3.x, s3.y) >= TS, "from %s to %d,%d" % [s3, p.x, p.y])
	world.remove_entity(item)
	item.queue_free()
	# ---------------------------------------------- blocker steps into a walking path
	var back := -1
	match dir:
		Types.Orientation.RIGHT: back = Types.Orientation.LEFT
		Types.Orientation.LEFT: back = Types.Orientation.RIGHT
		Types.Orientation.UP: back = Types.Orientation.DOWN
		Types.Orientation.DOWN: back = Types.Orientation.UP
	await wait(300)
	var dest := p.get_tile_position_next_to(back, 4)
	world.click(dest.x, dest.y)
	await wait(50)
	var blocker := Player.new()
	blocker.id = 987656
	blocker.type = Types.EntityType.PLAYER
	var bp := p.get_tile_position_next_to(back, 2)
	blocker.set_pos(bp.x, bp.y)
	world._add_entity(blocker)
	await wait(1500)
	check("walking path stops before someone who steps in", Types.real_distance(p.x, p.y, blocker.x, blocker.y) >= TS and not p.is_moving_path(),
		"pos %d,%d blocker %d,%d" % [p.x, p.y, blocker.x, blocker.y])
	world.remove_entity(blocker)
	blocker.queue_free()
	_report()
