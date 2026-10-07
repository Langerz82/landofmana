class_name Character
extends EntityMoving
## Port of client/js/entity/character/*.js (hp/ep, combat, targeting).

var atk_speed := 64
var attack_cooldown: GTimer
var attack_range := 1
var target = null
var attackers: Dictionary = {}
var attacking_mode := false
var inspecting = null
var is_stunned := false

var death_cb: Callable = Callable()
var remove_cb: Callable = Callable()
var settarget_cb: Callable = Callable()
var removetarget_cb: Callable = Callable()


func _init() -> void:
	super._init()
	orientation = Types.Orientation.DOWN
	set_attack_rate(64)
	stats = {"hp": 0, "hpMax": 0, "ep": 0, "epMax": 0}


func is_character() -> bool:
	return true


func set_attack_rate(rate: int) -> void:
	attack_cooldown = GTimer.new(rate)


# --------------------------------------------------------------------- hp

func set_hp(v: int) -> void:
	stats.hp = v


func set_ep(v: int) -> void:
	stats.ep = v


func set_hp_max(v: int) -> void:
	stats.hpMax = v
	stats.hp = v


func set_ep_max(v: int) -> void:
	stats.epMax = v
	stats.ep = v


func mod_hp(v: int) -> int:
	var prev: int = stats.hp
	stats.hp = clampi(stats.hp + v, 0, stats.hpMax)
	if stats.hp == 0:
		die()
	return prev - stats.hp


func mod_ep(v: int) -> int:
	var prev: int = stats.ep
	stats.ep = clampi(stats.ep + v, 0, stats.epMax)
	return prev - stats.ep


# ----------------------------------------------------------------- combat

func hit(o: int = 0) -> bool:
	set_orientation(o if o != 0 else orientation)
	fsm = "ATTACK"
	animate("atk", atk_speed, 1, func():
		fsm = "IDLE"
		idle(orientation))
	return true


func dead() -> void:
	is_dead = true
	is_dying = false
	force_stop()
	freeze = true


func die() -> void:
	force_stop()
	remove_target()
	is_dying = true
	freeze = true
	if death_cb.is_valid():
		death_cb.call()


func can_attack(_time: int = 0) -> bool:
	return not is_dead and attack_cooldown.is_over()


func force_stop() -> void:
	_force_stop()
	if not is_dying and not is_dead and not has_animation("atk"):
		idle(orientation)


func engage(c) -> void:
	attacking_mode = true
	set_target(c)


func disengage() -> void:
	attacking_mode = false
	remove_target()


func add_attacker(c) -> void:
	attackers[c.id] = c


func remove_attacker(c) -> void:
	attackers.erase(c.id)


func clean() -> void:
	for a in attackers.values():
		if is_instance_valid(a):
			a.disengage()
			a.idle(a.orientation)


func follow_attack(e) -> bool:
	var spot = get_closest_spot(e, 1, attack_range)
	if spot != null:
		move_to(spot.x, spot.y)
		return true
	return false


# -------------------------------------------------------------- targeting

func set_target(c) -> void:
	if c == null or c.is_dying or c.is_dead:
		remove_target()
		return
	if target != c:
		if has_target():
			remove_target()
		target = c
		if settarget_cb.is_valid():
			settarget_cb.call(c, true)


func remove_target() -> void:
	if target != null:
		if is_instance_valid(target) and target.is_character():
			target.remove_attacker(self)
		if removetarget_cb.is_valid():
			removetarget_cb.call(target.id if is_instance_valid(target) else 0)
		target = null


func clear_target() -> void:
	target = null


func has_target() -> bool:
	if target != null and not is_instance_valid(target):
		target = null
	return target != null


func can_reach_target() -> bool:
	return has_target() and can_reach(target)


func can_interact(e) -> bool:
	return is_next_too_entity(e) and is_facing_entity(e)


func can_reach(e) -> bool:
	if e == null:
		return false
	if attack_range == 1:
		return is_next_too_entity(e) and is_facing_entity(e)
	if attack_range > 1:
		return is_within_dist_entity(e, attack_range * TS)
	return false
