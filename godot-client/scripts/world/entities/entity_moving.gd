class_name EntityMoving
extends Entity
## Port of client/js/entity/entitymoving/*.js (path following, orientation,
## spatial helpers). Movement is driven by World's updater each 16ms tick.

var move_speed := 100
var walk_speed := 150
var tick_px := 10           # pixels per game tick (JS: this.tick)
var tick_frames := 0
var move_cooldown: GTimer
var movement: Transition
var move_path = null        # Array of [x, y] waypoints (JS: this.path)
var step := 0
var new_destination = null  # Vector2i or null
var destination = null
var interrupted := false
var freeze := false
var _freeze_delay = null

# callbacks (JS on*(callback) registrations)
var request_path_cb: Callable = Callable()
var start_pathing_cb: Callable = Callable()
var stop_pathing_cb: Callable = Callable()
var abort_pathing_cb: Callable = Callable()
var movestop_cb: Callable = Callable()
var step_cb: Callable = Callable()


func _init() -> void:
	super._init()
	movement = Transition.new(self)
	set_move_rate(move_speed)
	walk_speed = 150
	idle_speed = randi_range(750, 1000)


func is_moving_entity() -> bool:
	return true


func set_freeze(ms: int, callback: Callable = Callable()) -> void:
	if _freeze_delay:
		_freeze_delay.cancel()
	if ms <= 0:
		freeze = false
		return
	freeze = true
	_freeze_delay = Game.after(ms, func():
		freeze = false
		if callback.is_valid():
			callback.call(self))


func set_move_rate(rate: int) -> void:
	move_speed = rate
	walk_speed = int(rate / 4)
	move_cooldown = GTimer.new(rate)
	tick_px = roundi(1000.0 / maxf(move_speed, 1))


# ------------------------------------------------------------- orientation

func get_orientation_to(px: int, py: int) -> int:
	return Types.orientation_between(x, y, px, py)


func look_at_xy(px: int, py: int) -> int:
	set_orientation(get_orientation_to(px, py))
	# JS: if (!(hasAnimation fn && !hasAnimation('idle'))) idle(); -> only when already idling
	if has_animation("idle"):
		idle(orientation)
	return orientation


func look_at_entity(e) -> void:
	if e != null:
		look_at_xy(e.x, e.y)


func look_at_tile(px: int, py: int) -> void:
	var tsh := TS >> 1
	look_at_xy((px >> 4 << 4) + tsh, (py >> 4 << 4) + tsh)


func is_facing(px: int, py: int) -> bool:
	var dx := px - x
	var dy := py - y
	var ax := absi(dx)
	var ay := absi(dy)
	if ax == 0 and ay == 0:
		return true
	if ax == ay:
		var horiz := Types.Orientation.RIGHT if dx > 0 else Types.Orientation.LEFT
		var vert := Types.Orientation.DOWN if dy > 0 else Types.Orientation.UP
		return orientation == horiz or orientation == vert
	return orientation == get_orientation_to(px, py)


func is_facing_entity(e) -> bool:
	return is_facing(e.x, e.y)


func is_in_reach(px: int, py: int, o: int = 0, r: int = 0, rs: int = 0) -> bool:
	if o == 0:
		o = orientation
	if rs == 0:
		rs = TS >> 1
	if r == 0:
		r = TS + rs
	var a := rs
	var b := rs
	match o:
		Types.Orientation.UP, Types.Orientation.DOWN:
			b = r
		Types.Orientation.LEFT, Types.Orientation.RIGHT:
			a = r
		_:
			return false
	return absi(x - px) <= a and absi(y - py) <= b


# --------------------------------------------------------------- spatial

func next_dist(px: int, py: int, o: int, dist: int) -> Vector2i:
	match o:
		Types.Orientation.UP: return Vector2i(px, py - dist)
		Types.Orientation.DOWN: return Vector2i(px, py + dist)
		Types.Orientation.LEFT: return Vector2i(px - dist, py)
		Types.Orientation.RIGHT: return Vector2i(px + dist, py)
	return Vector2i(px, py)


func next_move(px: int, py: int, o: int = 0) -> Vector2i:
	return next_dist(px, py, o if o != 0 else orientation, 1)


func next_tile(o: int = 0) -> Vector2i:
	return next_dist(x, y, o if o != 0 else orientation, TS)


## getSpotsAround(): points on a circle of radius adj_dist tiles around dest.
func get_spots_around(dest_x: int, dest_y: int, adj_dist: int = 1, start_blocks: int = 4) -> Array:
	var d := adj_dist * TS
	var iterations := adj_dist * start_blocks
	var sec := TAU / iterations
	var deg := 0.0
	var seen := {}
	var coords: Array = []
	for _i in range(iterations):
		deg += sec
		var px := dest_x + int(cos(deg) * d)
		var py := dest_y + int(sin(deg) * d)
		var key := Vector2i(px, py)
		if seen.has(key):
			continue
		seen[key] = true
		coords.append({"d": Types.real_distance(x, y, px, py), "x": px, "y": py})
	return coords


func get_closest_spot(dest, adj_start: int = 1, adj_end: int = 1) -> Variant:
	var poss: Array = []
	for i in range(mini(adj_start, adj_end), maxi(adj_start, adj_end) + 1):
		poss.append_array(get_spots_around(dest.x, dest.y, i))
	var m = world.current_map
	poss = poss.filter(func(p): return not m.is_colliding(p.x, p.y))
	var tsh := TS >> 1
	var others: Array = world.get_entities_near(x, y, adj_end * TS + TS * 2)
	poss = poss.filter(func(p):
		for e2 in others:
			if e2 == self or e2 == null:
				continue
			var tx: int = e2.x
			var ty: int = e2.y
			if e2.is_moving_entity() and e2.is_moving_path():
				var lm = e2.get_last_move()
				if lm != null:
					tx = lm[0]
					ty = lm[1]
			if absi(p.x - tx) <= tsh and absi(p.y - ty) <= tsh:
				return false
		return true)
	if poss.is_empty():
		return null
	poss.sort_custom(func(a, b): return a.d < b.d)
	return Vector2i(poss[0].x, poss[0].y)


func is_colliding(px: int, py: int) -> bool:
	return world.current_map.is_colliding(px, py)


# ------------------------------------------------------------------ paths

func move_to(px: int, py: int) -> void:
	_move_to(px, py)


func _move_to(px: int, py: int) -> void:
	destination = Vector2i(px, py)
	if is_moving_path():
		continue_to(px, py)
	else:
		var p = request_pathfinding_to(px, py)
		if p != null:
			follow_path(p)


func request_pathfinding_to(px: int, py: int):
	if request_path_cb.is_valid():
		return request_path_cb.call(px, py)
	return null


func follow_path(p: Array) -> void:
	if p == null:
		return
	move_path = p
	step = 0
	if start_pathing_cb.is_valid():
		start_pathing_cb.call(p)


func continue_to(px: int, py: int) -> void:
	new_destination = Vector2i(px, py)


func go(px: int, py: int) -> void:
	move_to(px, py)


func follow(e, mn: int = 1, mx: int = 1) -> bool:
	var spot = get_closest_spot(e, mn, mx)
	if spot != null:
		move_to(spot.x, spot.y)
		return true
	return false


func get_last_move():
	if move_path == null or move_path.is_empty():
		return null
	return move_path[move_path.size() - 1]


func idle(o: int = 0) -> void:
	set_orientation(o if o != 0 else orientation)
	animate("idle", idle_speed)


func walk(o: int = 0) -> void:
	set_orientation(o if o != 0 else orientation)
	animate("walk", walk_speed)


func force_stop() -> void:
	stop()


func _force_stop() -> void:
	stop()


func stop() -> void:
	if is_moving() and not is_moving_path():
		if movestop_cb.is_valid():
			movestop_cb.call()
	_stop_path()
	movement.stop()
	freeze = false
	idle(orientation)


func stop_path() -> void:
	_stop_path()


func _stop_path() -> void:
	if not is_moving_path():
		return
	var lnode = get_last_move()
	interrupted = not (x == int(lnode[0]) and y == int(lnode[1]))
	step = 0
	var old_path = move_path
	move_path = null
	new_destination = null
	movement.stop()
	if interrupted and abort_pathing_cb.is_valid():
		abort_pathing_cb.call(old_path, x, y)
	elif stop_pathing_cb.is_valid():
		stop_pathing_cb.call(x, y)


func update_movement() -> void:
	if move_path == null or step > move_path.size() - 1:
		return
	var o := Types.orientation_between(x, y, int(move_path[step][0]), int(move_path[step][1]))
	set_orientation(o)
	walk(orientation)


func next_step_path() -> bool:
	if step == 0:
		step += 1
		update_movement()
	if step < move_path.size():
		if x == int(move_path[step][0]) and y == int(move_path[step][1]):
			step += 1
			update_movement()
			return true
	return false


func next_step() -> bool:
	var stop_now := false
	var res := false
	if freeze:
		return false
	if not is_moving_path():
		interrupted = true
		stop_now = true
	if not stop_now:
		res = next_step_path()
		if step >= move_path.size():
			stop_now = true
		if step_cb.is_valid():
			step_cb.call()
	if has_changed_its_path():
		set_pos(x, y)
		var dest: Vector2i = new_destination
		new_destination = null
		var p = request_pathfinding_to(dest.x, dest.y)
		if p != null:
			follow_path(p)
		else:
			force_stop()
		return true
	if stop_now:
		force_stop()
		res = true
	return res


func is_moving() -> bool:
	return movement.in_progress


func is_moving_path() -> bool:
	return move_path != null and move_path.size() > 0


func has_changed_its_path() -> bool:
	return new_destination != null


func set_move_path(p: Array) -> void:
	move_path = p
	step = 0
	orientation = Types.orientation_between(x, y, int(p[1][0]), int(p[1][1]))


## Server driven path (WC_MOVEPATH).
func move_along(p: Array) -> void:
	force_stop()
	set_pos(int(p[0][0]), int(p[0][1]))
	set_move_path(p)
	walk()


## Server driven single move (WC_MOVE) - EntityMoving.move().
func server_move(_time: int, o: int, state: int, px: int, py: int) -> void:
	set_orientation(o)
	if state == 1 and o != Types.Orientation.NONE:
		force_stop()
		set_pos(px, py)
		walk(o)
	elif state == 0 or state == 2 or o == Types.Orientation.NONE:
		force_stop()
		set_pos(px, py)


func can_move() -> bool:
	return not is_dead and move_cooldown.is_over()
