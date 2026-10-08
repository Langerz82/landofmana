class_name Player
extends Character
## Port of client/js/entity/player/player.js. The local player additionally
## gets the behaviour of entity/player/playerlocalmovement.js (is_local).

var is_local := false
var key_move := false
var stop_key_move = false      # false/true or a queued orientation (int)
var move_orientation := 0
var sent_move = null
var last_move_throttle := 0
var hide_weapon := false
var admin := false
var colors: Array = [0, 0]
var gold: Array = [0, 0]
var gems := 0
var start_harvest_time := 0
var dialogue_entity = null
var target_index := 0
var suppress_teleport_check := false
var spawn_gx := 0
var spawn_gy := 0
var ex := -1
var ey := -1
var weapon_kind := 0
var attack_skill := -1        # skill index used by the next attack (SkillActive "attack")
var pvp_target = null
var holding_block = null      # Block entity being carried
var harvest_duration := 0

var key_move_cb: Callable = Callable()
var attack_delay = null        # Game.Delay (JS attackInterval)
var _move_retry = null
var _moving_delay = null
var _harvest_timer = null
var _observe_timer: GTimer = null


func _init() -> void:
	super._init()
	move_speed = 500
	set_move_rate(500)
	atk_speed = 64
	set_attack_rate(64)
	attack_range = 1
	sprites = [null, null]
	old_sprites = [null, null]
	stats = {"hp": 0, "hpMax": 0, "ep": 0, "epMax": 0, "exp": {}}


func set_pos(nx: int, ny: int) -> void:
	super.set_pos(nx, ny)
	key_move = false
	if holding_block != null and is_instance_valid(holding_block):
		var p := get_tile_position_next_to(orientation, 1)
		holding_block.set_pos(p.x, p.y)


func set_pos_spawn(nx: int, ny: int) -> void:
	set_pos(nx, ny)
	spawn_gx = gx
	spawn_gy = gy


func set_sprite_by_index(index: int, appearance: int) -> void:
	var def = GameData.get_sprite(GameData.get_appearance_sprite(appearance))
	if def != null:
		set_sprite(def, index)


func is_archer() -> bool:
	return GameData.is_archer_weapon(weapon_kind)


func set_range() -> void:
	attack_range = 10 if is_archer() else 1


# ----------------------------------------------------------- remote player

## Player.move() for other players (WC_MOVE): lock-step start, stop at ex/ey.
func server_move(time: int, o: int, state: int, px: int, py: int) -> void:
	set_orientation(o)
	if state == 1 and o != Types.Orientation.NONE:
		var lock := Types.G_LATENCY - (Game.world_time() - time)
		lock = clampi(lock, Types.G_UPDATE_INTERVAL, Types.G_LATENCY) + Types.G_LATENCY
		if _moving_delay:
			_moving_delay.cancel()
		_moving_delay = Game.after(lock, func():
			force_stop()
			set_pos(px, py)
			ex = -1
			ey = -1
			_moving_delay = null
			walk(o)
			freeze = false
			key_move = true)
	elif state == 0 or o == Types.Orientation.NONE:
		ex = px
		ey = py
		if not movement.in_progress or _moving_delay != null:
			force_stop()
			set_pos(px, py)
			if _moving_delay:
				_moving_delay.cancel()
			_moving_delay = null
	elif state == 2 and o != Types.Orientation.NONE:
		force_stop()
		set_pos(px, py)
		ex = -1
		ey = -1
		if _moving_delay:
			_moving_delay.cancel()
		_moving_delay = null


func revive() -> void:
	is_dead = false
	is_dying = false
	freeze = false
	stats.hp = stats.hpMax
	stats.ep = stats.epMax
	disengage()


func respawn(died: bool = false) -> void:
	if died:
		restore_sprite(0)
		restore_sprite(1)
	force_stop()
	set_orientation(Types.Orientation.DOWN)
	idle(orientation)
	fsm = "IDLE"


func reset_position(px: int, py: int) -> void:
	movement.stop()
	key_move = false
	force_stop()
	set_pos(px, py)
	fsm = "IDLE"


# ------------------------------------------------------- overrides (local)

func idle(o: int = 0) -> void:
	if is_local and fsm == "ATTACK" and not is_dying and not is_dead:
		return
	super.idle(o)


func force_stop() -> void:
	if not is_local:
		super.force_stop()
		return
	harvest_off()
	if not is_moving_path():
		if key_move_cb.is_valid():
			key_move_cb.call(0)
	if not (fsm == "ATTACK" and not is_dying and not is_dead):
		_force_stop()
	var queued = stop_key_move if (stop_key_move is int) else null
	move_orientation = 0
	key_move = false
	stop_key_move = false
	if queued != null:
		schedule_move_retry(queued, Types.G_UPDATE_INTERVAL, Callable(), false)


func hit(o: int = 0) -> bool:
	if not is_local:
		fsm = "ATTACK"
		force_stop()
		return super.hit(o)
	if fsm == "ATTACK":
		return false
	set_orientation(o if o != 0 else orientation)
	force_stop()
	fsm = "ATTACK"
	animate("atk", atk_speed, 1, func():
		fsm = "IDLE"
		idle(orientation)
		if move_orientation != 0:
			key_input(move_orientation, true)
			move_orientation = 0
			return
		force_stop())
	return true


func can_attack(_time: int = 0) -> bool:
	return not is_dead and attack_cooldown.is_over()


func send_move(state: int) -> void:
	if state != 0 or sent_move != state:
		world.client.send_move_entity(self, state)
		sent_move = state


func move_throttle(delay: int) -> bool:
	var now := Time.get_ticks_msec()
	if now - last_move_throttle < delay:
		return true
	last_move_throttle = now
	return false


func schedule_move_retry(o: int, delay: int, still_wanted: Callable, recheck_throttle: bool) -> void:
	if _move_retry:
		_move_retry.cancel()
	_move_retry = Game.after(delay, func():
		if still_wanted.is_valid() and not still_wanted.call():
			return
		key_input(o, true, not recheck_throttle))


func reject_move() -> bool:
	if fsm == "ATTACK":
		return true
	if move_throttle(Types.G_ROUNDTRIP):
		force_stop()
		return true
	if key_move:
		force_stop()
		return false
	return false


func cancel_attack_delay() -> void:
	if attack_delay:
		attack_delay.cancel()
		attack_delay = null


func move_to(px: int, py: int) -> void:
	if not is_local:
		super.move_to(px, py)
		return
	reset_movement_state()
	if reject_move():
		return
	move_orientation = 0
	cancel_attack_delay()
	walk()
	_move_to(px, py)


## Keyboard movement (playerlocalmovement.js move(orientation, state)).
func key_input(o: int, state: bool, skip_throttle: bool = false) -> void:
	if is_dying or is_dead:
		return
	if state and o != Types.Orientation.NONE:
		if not skip_throttle and movement.in_progress and not is_moving_path() and orientation != o:
			if fsm == "ATTACK" or move_throttle(Types.G_ROUNDTRIP):
				return
			stop_key_move = o
			return
		move_orientation = o
		set_orientation(o)
		if fsm != "ATTACK":
			idle(o)
			cancel_attack_delay()
			if not skip_throttle and reject_move():
				schedule_move_retry(o, Types.G_ROUNDTRIP, func(): return move_orientation == o, true)
				return
			start_key_movement(o)
	elif not state:
		key_move = false
		stop_key_move = true
		move_orientation = 0
		if _move_retry:
			_move_retry.cancel()
		if not is_moving():
			force_stop()


func reset_movement_state() -> void:
	key_move = false
	stop_key_move = false
	move_orientation = 0
	new_destination = null
	move_path = null
	step = 0
	interrupted = false
	if movement:
		movement.stop()


func can_observe() -> bool:
	if _observe_timer == null:
		_observe_timer = GTimer.new(4096)
	return _observe_timer.is_over()


func start_key_movement(o: int) -> void:
	if is_dying or is_dead:
		return
	reset_movement_state()
	set_orientation(o)
	key_move = true
	stop_key_move = false
	move_orientation = o
	walk(o)
	if key_move_cb.is_valid():
		key_move_cb.call(1)
	movement.stop()
	cancel_attack_delay()


# ---------------------------------------------------------------- harvest

func harvest_on(kind_name: String) -> void:
	var do_harvest := func():
		fsm = "HARVEST"
		animate("atk", atk_speed, 1, func(): idle(orientation))
		if kind_name == "any":
			hide_weapon = true
	do_harvest.call()
	_harvest_timer = Game.after(1000, _harvest_tick.bind(do_harvest))
	start_harvest_time = Time.get_ticks_msec()


func _harvest_tick(do_harvest: Callable) -> void:
	if _harvest_timer == null:
		return
	if has_target() and target.type != Types.EntityType.NODE:
		force_stop()
		return
	do_harvest.call()
	_harvest_timer = Game.after(1000, _harvest_tick.bind(do_harvest))


func harvest_off() -> void:
	if fsm == "HARVEST":
		if _harvest_timer:
			_harvest_timer.cancel()
		_harvest_timer = null
		start_harvest_time = 0
		hide_weapon = false


## Player.makeAttack(): returns attack_ok / attack_toofar / ...
func make_attack(e) -> String:
	if e == self or is_dead or is_dying:
		return ""
	if e != null and e.is_dead:
		remove_target()
		return ""
	if (is_moving() or is_moving_path()) and not can_reach(e):
		return ""
	set_target(e)
	look_at_entity(e)
	if not can_reach(e):
		return "attack_moving" if follow_attack(e) else "attack_toofar"
	if not can_attack():
		return "attack_outoftime"
	if hit() and has_target():
		return "attack_ok"
	return "attack_aborted"


# --------------------------------------------------------------------- view

func sync_view() -> void:
	super.sync_view()
	# weapon layer follows the body's animation row / frame
	if _views.size() < 2:
		return
	var view: Sprite2D = _views[1]
	var wdef = sprites[1]
	if wdef == null or wdef.texture == null or current_anim == null or is_dead or is_dying or hide_weapon or hidden_by_area:
		view.visible = false
		return
	var wa: Dictionary = wdef.animations.get(current_anim.anim_name, {})
	var idx := current_anim.index
	if not wa.is_empty():
		var wl: int = maxi(1, int(wa.get("length", 1)))
		idx = idx if idx < wl else idx % wl
	else:
		idx = 0
	var s := GameData.SPRITE_SCALE
	view.region_rect = Rect2(wdef.width * idx * s, wdef.height * current_anim.row * s, wdef.width * s, wdef.height * s)
	view.flip_h = flip_x
	view.visible = true
