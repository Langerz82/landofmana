class_name World
extends Node2D
## The in-game world. Port of client/js/game.js together with its mixins
## (game/*.js), the ClientCallbacks (clientcallback/*.js) and the Updater
## (updater/*.js). Runs the original fixed 16ms logic tick.

signal disconnected(message: String)

const TS := Types.G_TILESIZE
const BASE_SCALE := 3.0
const MAP_NAMES := ["map0", "map1", "map2"]
const PLAYER_KIND := 1

var client: GameClient
var hud = null                  # Hud
var overlay = null              # Overlay
var camera: Camera2D
var map_renderer: MapRenderer
var entity_layer: Node2D
var target_marker: TargetMarker
var audio = null                # AudioManager

var entities: Dictionary = {}   # id -> Entity
var npcs: Dictionary = {}       # id -> Npc
var player: Player
var current_map: MapData = null
var prev_map: MapData = null
var map_cache: Dictionary = {}
var map_index := 0
var map_status := 0
var pathfinder: Pathfinder
var started := false
var current_time := 0
var camera_area = null

var bubbles: Dictionary = {}    # entity id -> {entity, text, until}
var infos: Array = []           # floating combat texts
var announcements: Array = []

var quests: Dictionary = {}
var data := PlayerData.new()     # inventory, bank, quests, skills... (PlayerData)
var actions: ItemActions         # item / shortcut / skill actions
var game_scale := BASE_SCALE     # 3x zoom, divided by the "zoom" setting
var _hover = null
var _pad_dir := 0
var _joy_dir := 0
var auto_potion := 0             # /autopotion <percent>
var _acc := 0.0
var _zone_timer := 0
var _obsolete_timer := 0
var _loading_thread: Thread = null
var _pending_map_request = null
var _dialogue_delay = null
var _info_id := 0
var _login_info: Dictionary = {}
var _keys_down: Dictionary = {}
var _reveal_token := 0   # cancels a pending reveal when a new teleport starts


func _ready() -> void:
	Game.world = self
	map_renderer = MapRenderer.new()
	map_renderer.name = "MapRenderer"
	add_child(map_renderer)
	target_marker = TargetMarker.new()
	target_marker.world = self
	add_child(target_marker)
	entity_layer = Node2D.new()
	entity_layer.name = "Entities"
	entity_layer.y_sort_enabled = true
	add_child(entity_layer)
	camera = Camera2D.new()
	camera.name = "Camera"
	actions = ItemActions.new(self, data)
	game_scale = BASE_SCALE / float(Config.get_setting("ui", "gamezoom", 1.0))
	camera.zoom = Vector2(game_scale, game_scale)
	add_child(camera)
	camera.make_current()
	audio = preload("res://scripts/world/audio_manager.gd").new()
	audio.name = "Audio"
	add_child(audio)
	client = GameClient.new()
	client.name = "GameClient"
	add_child(client)
	Game.game_client = client
	_register_handlers()
	client.disconnected.connect(_on_disconnected)
	client.server_error.connect(func(msg): _show_error(msg))
	get_viewport().size_changed.connect(_send_screen_config)


func start(info: Dictionary) -> void:
	_login_info = info
	player = Player.new()
	player.is_local = true
	player.ename = str(info.get("playername", ""))
	player.type = Types.EntityType.PLAYER
	player.kind = PLAYER_KIND
	player.world = self
	_add_local_player_callbacks()
	if hud:
		hud.add_notification("Connecting to the game server...")
	client.connect_to_server(str(info.url), str(info.playername), str(info.hash))
	client.connected.connect(_send_screen_config, CONNECT_ONE_SHOT)


func _exit_tree() -> void:
	if _loading_thread and _loading_thread.is_started():
		_loading_thread.wait_to_finish()
	if Game.world == self:
		Game.world = null


# ======================================================================
# Main loop
# ======================================================================

func _process(delta: float) -> void:
	_acc += delta * 1000.0
	var steps := 0
	while _acc >= Types.G_UPDATE_INTERVAL and steps < 8:
		_acc -= Types.G_UPDATE_INTERVAL
		_game_tick()
		steps += 1
	if steps >= 8:
		_acc = 0.0
	_render()


func _game_tick() -> void:
	current_time = Time.get_ticks_msec()
	if not started or map_status < 2 or player == null:
		return
	_update_characters()
	_update_transitions()
	_update_animations()
	_update_infos()
	_periodic()
	_check_auto_potion()


func _render() -> void:
	if player == null:
		return
	for e in entities.values():
		e.sync_view()
	_update_camera()
	target_marker.queue_redraw()
	if overlay:
		overlay.queue_redraw()
	if hud:
		hud.update_debug(self)


func _update_camera() -> void:
	if current_map == null or not current_map.loaded:
		return
	var area = current_map.get_camera_area(player.x, player.y, camera_area)
	if area != camera_area:
		camera_area = area
		map_renderer.set_area(area.rect if area != null else null)
	var bounds := Rect2i(0, 0, current_map.pixel_width(), current_map.pixel_height())
	if camera_area != null:
		bounds = camera_area.rect
	var view := get_viewport_rect().size / game_scale
	var target := Vector2(player.x, player.y)
	# Center small areas, clamp large ones (map/mapcamera.js scroll bounds)
	if bounds.size.x <= view.x:
		target.x = bounds.position.x + bounds.size.x / 2.0
	else:
		target.x = clampf(target.x, bounds.position.x + view.x / 2.0, bounds.end.x - view.x / 2.0)
	if bounds.size.y <= view.y:
		target.y = bounds.position.y + bounds.size.y / 2.0
	else:
		target.y = clampf(target.y, bounds.position.y + view.y / 2.0, bounds.end.y - view.y / 2.0)
	camera.position = target.round()
	map_renderer.update_view(camera.position, view)
	for e in entities.values():
		e.hidden_by_area = camera_area != null and not (camera_area.rect as Rect2i).has_point(Vector2i(e.x, e.y))


func _periodic() -> void:
	# zone check (game/gamecallbacks.js onPlayerLoad interval)
	if current_time - _zone_timer > player.move_speed * 4:
		_zone_timer = current_time
		if map_status >= 2 and not player.is_moving() and player.can_observe():
			client.send_who_request()
	# removeObsoleteEntities every 30s
	if current_time - _obsolete_timer > 30000:
		_obsolete_timer = current_time
		_remove_obsolete_entities()


# ----------------------------------------------------------- updater.js

func _update_characters() -> void:
	for e in entities.values():
		if not (e is EntityMoving):
			continue
		e.tick_frames = e.tick_px if e.tick_px > 0 else 0
		if e is Player:
			if e == player:
				_update_player_path_movement(e)
				_update_player_key_movement(e)
			else:
				_update_character_key_movement(e)
				_update_character_path_movement(e)
		elif e is Character:
			_update_character_path_movement(e)


func _update_transitions() -> void:
	for e in entities.values():
		if not (e is EntityMoving):
			continue
		if e.freeze or e.is_dead or e.is_dying:
			continue
		if e.movement.in_progress:
			e.movement.step()


func _update_animations() -> void:
	for e in entities.values():
		if not e.get("is_stunned"):
			e.update_animation(current_time)


func _start_transition(c: EntityMoving, fx: Callable, fy: Callable, stop_fn: Callable) -> void:
	var t: int = c.tick_frames
	match c.orientation:
		Types.Orientation.LEFT: c.movement.start(fx, stop_fn, -t)
		Types.Orientation.RIGHT: c.movement.start(fx, stop_fn, t)
		Types.Orientation.UP: c.movement.start(fy, stop_fn, -t)
		Types.Orientation.DOWN: c.movement.start(fy, stop_fn, t)


func _update_character_path_movement(c) -> void:
	if c.freeze or c.is_stunned or c.is_dying or c.is_dead:
		return
	if not c.movement.in_progress and c.is_moving_path():
		_start_transition(c, _char_path_x, _char_path_y, Callable())


func _update_character_key_movement(c) -> void:
	if c.freeze or c.is_moving_path() or c.is_dying or c.is_dead:
		return
	if not c.movement.in_progress and c.key_move and c.orientation > 0:
		_start_transition(c, _char_key_x, _char_key_y, Callable())


func _update_player_path_movement(c) -> void:
	if c.is_dying or c.is_dead or c.freeze or c.is_stunned or c.key_move or not c.is_moving_path():
		return
	if not c.movement.in_progress:
		var o: int = c.orientation
		c.update_movement()
		var saved: int = c.orientation
		c.orientation = o
		_start_transition(c, _player_path_x, _player_path_y, Callable())
		c.orientation = saved


func _update_player_key_movement(c) -> void:
	if c.is_dying or c.is_dead or c.freeze or c.is_stunned or c.is_moving_path():
		return
	if not c.movement.in_progress and c.key_move and c.orientation > 0:
		_start_transition(c, _player_key_x, _player_key_y, Callable())


func _check_stop_danger(c) -> bool:
	var o: int = c.orientation
	if c.ex == -1 and c.ey == -1:
		return false
	var res: bool = c.x == c.ex and c.y == c.ey
	if o == Types.Orientation.LEFT and c.x < c.ex: return true
	if o == Types.Orientation.RIGHT and c.x > c.ex: return true
	if o == Types.Orientation.UP and c.y < c.ey: return true
	if o == Types.Orientation.DOWN and c.y > c.ey: return true
	if res:
		c.set_pos(c.ex, c.ey)
	return res


func _char_path(c, nx: int, ny: int) -> bool:
	if c.has_changed_its_path():
		return true
	if current_map != null and current_map.is_colliding(nx, ny):
		return true
	c.set_pos(nx, ny)
	return c.next_step()


func _char_path_x(c, m: int) -> bool:
	return _char_path(c, c.x + m, c.y)


func _char_path_y(c, m: int) -> bool:
	return _char_path(c, c.x, c.y + m)


func _char_key(c, nx: int, ny: int) -> bool:
	if _check_stop_danger(c):
		c.force_stop()
		return true
	if move_character(c, nx, ny):
		c.set_pos(nx, ny)
	else:
		c.force_stop()
	return false


func _char_key_x(c, m: int) -> bool:
	return _char_key(c, c.x + m, c.y)


func _char_key_y(c, m: int) -> bool:
	return _char_key(c, c.x, c.y + m)


func _player_key(c, nx: int, ny: int) -> bool:
	var res := move_character(c, nx, ny)
	if res:
		c.set_pos(nx, ny)
	else:
		c.key_move = true
		c.force_stop()
	return not res


func _player_key_x(c, m: int) -> bool:
	return _player_key(c, c.x + m, c.y)


func _player_key_y(c, m: int) -> bool:
	return _player_key(c, c.x, c.y + m)


func _player_path_x(c, m: int) -> bool:
	if _path_blocked(c, c.x + m, c.y):
		return true
	c.set_pos(c.x + m, c.y)
	return c.next_step()


func _player_path_y(c, m: int) -> bool:
	if _path_blocked(c, c.x, c.y + m):
		return true
	c.set_pos(c.x, c.y + m)
	return c.next_step()


## Something stepped into the local player's path: stop just before it (the
## server is told with the usual "path aborted" move).
func _path_blocked(c, nx: int, ny: int) -> bool:
	if c == player and is_overlapping(c, nx, ny):
		c.force_stop()
		return true
	return false


# ======================================================================
# Movement helpers (game/gamemovement.js)
# ======================================================================

func move_character(c, nx: int, ny: int, skip_overlap := false, skip_grid_check := false) -> bool:
	var o: int = c.orientation
	if o == Types.Orientation.NONE:
		return false
	if current_map.is_colliding(nx, ny):
		return false
	if not skip_overlap and is_overlapping(c, nx, ny):
		return false
	if not skip_grid_check:
		var mid := TS >> 1
		var mx := posmod(nx, TS)
		var my := posmod(ny, TS)
		var check := (my == mid) if (o == 1 or o == 2) else (mx == mid)
		var skm = c.get("stop_key_move")
		var stopping: bool = skm != null and ((skm is bool and skm) or (skm is int and skm != 0))
		if stopping and check:
			c.set_pos(nx, ny)
			return false
	return true


func is_overlapping(e, nx: int, ny: int) -> bool:
	for e2 in entities.values():
		if e2 == e or not (e2 is Entity) or not blocks_movement(e2, e):
			continue
		if not e2.is_within_dist(e.x, e.y, TS - 1) and e2.is_within_dist(nx, ny, TS - 1):
			return true
	return false


## Whether `other` is solid for `mover`. The local player cannot walk into
## anything on screen: mobs, NPCs, other players, items on the ground, harvest
## nodes, chests, blocks and traps (standing on one already, you can still
## walk off it - see is_overlapping). Everyone else keeps the JS client's rule
## (players and items never block), so the client never fights the server
## over where other people are.
func blocks_movement(other, mover) -> bool:
	if other.is_dead or other.is_dying or other.hidden_by_area:
		return false
	if mover == player:
		return true
	return not (other is Player or other is ItemEntity)


## Tiles taken by entities that block `mover` (for the path finder).
func blocked_tiles(mover) -> Dictionary:
	var out := {}
	if current_map == null:
		return out
	var w: int = current_map.width
	for e2 in entities.values():
		if e2 == mover or not (e2 is Entity) or not blocks_movement(e2, mover):
			continue
		out[floori(e2.y / float(TS)) * w + floori(e2.x / float(TS))] = true
	return out


func find_path(c, px: int, py: int) -> Array:
	if current_map == null or pathfinder == null or map_status < 2:
		return []
	# The local player's paths go around everything on screen.
	pathfinder.blocked = blocked_tiles(c) if c == player else {}
	var path := pathfinder.find_path(c.x, c.y, px, py)
	pathfinder.blocked = {}
	return path


func click_move_to(px: int, py: int) -> void:
	px = (floori(px / float(TS)) + 0.5) * TS
	py = (floori(py / float(TS)) + 0.5) * TS
	if current_map.is_colliding_point(px, py):
		var spots: Array = player.get_spots_around(px, py, 1)
		spots.sort_custom(func(a, b): return a.d < b.d)
		for n in spots:
			if not current_map.is_colliding_point(n.x, n.y):
				player.go(n.x, n.y)
				return
	else:
		player.go(px, py)


# ======================================================================
# Map loading / teleport (gamemovement.js teleportMaps + clientcallbacksmap.js)
# ======================================================================

func teleport_maps(index: int, tx: int = -1, ty: int = -1, portal_id: int = -1) -> void:
	# Matte black from here until the new map is loaded and the server has
	# placed us on it (_on_teleport_map status 2 -> _reveal_map).
	_reveal_token += 1
	if hud:
		hud.set_blackout(true)
	if current_map != null:
		prev_map = current_map
		if index == current_map.map_index:
			map_status = 0
			client.send_teleport_map(index, 0, tx, ty, portal_id)
			return
	map_status = 0
	if hud:
		hud.set_loading(true, "Loading %s..." % MAP_NAMES[index])
	_pending_map_request = [index, tx, ty, portal_id]
	if map_cache.has(index):
		_on_map_loaded(map_cache[index])
		return
	_loading_thread = Thread.new()
	_loading_thread.start(_thread_load_map.bind(index))


func _thread_load_map(index: int) -> void:
	var m := MapData.load_map(index, MAP_NAMES[index])
	call_deferred("_on_map_thread_done", m)


func _on_map_thread_done(m: MapData) -> void:
	if _loading_thread:
		_loading_thread.wait_to_finish()
		_loading_thread = null
	map_cache[m.map_index] = m
	_on_map_loaded(m)


func _on_map_loaded(m: MapData) -> void:
	current_map = m
	camera_area = null
	map_renderer.set_map(m)
	map_renderer.set_area(null)
	pathfinder = Pathfinder.new(m)
	var r = _pending_map_request
	_pending_map_request = null
	if hud:
		hud.set_loading(false)
	if r != null:
		client.send_teleport_map(r[0], 0, r[1], r[2], r[3])


func _on_teleport_map(d: Array) -> void:
	var map_id := Types.to_int(d[0])
	var status := Types.to_int(d[1])
	var tx := Types.to_int(d[2])
	var ty := Types.to_int(d[3])
	var portal_id := Types.to_int(d[4]) if d.size() > 4 else -1
	map_status = status
	var p := player
	if status == -1:
		map_index = 0
		map_status = 2
		p.force_stop()
		p.clear_target()
		if hud:
			hud.set_blackout(false)
		return
	if status == 1:
		# Also covers map changes the server starts (e.g. revive at a spawn).
		_reveal_token += 1
		if hud:
			hud.set_blackout(true)
		p.force_stop()
		map_index = map_id
		p.map_index = map_id
		p.clear_target()
		_init_player(false)
		p.freeze = true
		if prev_map != null and portal_id >= 0 and portal_id < prev_map.doors.size():
			p.orientation = prev_map.doors[portal_id].orientation
			p.suppress_teleport_check = true
		_clear_entities()
		client.send_teleport_map(map_id, 1, tx, ty, -1)
	elif status == 2:
		p.set_pos_spawn(tx, ty)
		_add_entity(p)
		map_status = 2
		p.force_stop()
		p.freeze = false
		p.suppress_teleport_check = false
		_keys_down.clear()
		started = true
		if audio:
			audio.play_map_music(map_index)
		if hud:
			hud.set_loading(false)
		_reveal_map()


## Lift the black screen once the camera is on the player and the map
## around it has been drawn (two frames after the teleport finished).
func _reveal_map() -> void:
	_reveal_token += 1
	var token := _reveal_token
	await get_tree().process_frame
	await get_tree().process_frame
	if token == _reveal_token and map_status >= 2 and hud:
		hud.set_blackout(false)


func _init_player(died: bool) -> void:
	player.respawn(died)
	if hud:
		hud.set_target(null)


func _clear_entities() -> void:
	for e in entities.values():
		if e != player:
			e.queue_free()
	entities.clear()
	npcs.clear()
	bubbles.clear()
	if player:
		entities[player.id] = player


func _add_entity(e: Entity) -> void:
	e.world = self
	entities[e.id] = e
	if e.get_parent() == null:
		entity_layer.add_child(e)


func remove_entity(e) -> void:
	if e == null:
		return
	npcs.erase(e.id)
	if player and player.target == e:
		player.force_stop()
		player.clear_target()
		player.target_index = 0
		if hud:
			hud.set_target(null)
	bubbles.erase(e.id)
	if entities.get(e.id) == e:
		entities.erase(e.id)
	if e != player and is_instance_valid(e):
		e.queue_free()


func get_entity(id: int):
	return entities.get(id)


func get_entity_at(px: int, py: int):
	if current_map == null:
		return null
	var own = null
	for e in entities.values():
		if e == null or e.hidden_by_area:
			continue
		if e.is_over_position(px, py):
			# Prefer what lies under the local player (e.g. an item dropped
			# at its feet) over the player itself.
			if e == player:
				own = e
				continue
			return e
	if own != null:
		return own
	# Characters are drawn about a tile taller than their tile: let a click on
	# the head / upper body pick them too (the JS client only took the tile).
	for e in entities.values():
		if e == null or e == player or e.hidden_by_area or not (e is Character):
			continue
		if absi(px - e.x) <= (TS >> 1) and py < e.y - (TS >> 1) and py >= e.y - TS - (TS >> 1):
			return e
	return null


func get_entities_near(px: int, py: int, dist: int) -> Array:
	var out: Array = []
	for e in entities.values():
		if absi(e.x - px) <= dist and absi(e.y - py) <= dist:
			out.append(e)
	return out


func visible_rect(extra_tiles: int = 0) -> Rect2:
	var view := get_viewport_rect().size / game_scale
	var r := Rect2(camera.position - view / 2.0, view)
	return r.grow(extra_tiles * TS)


func is_visible_entity(e, extra_tiles: int = 0) -> bool:
	return visible_rect(extra_tiles).has_point(Vector2(e.x, e.y))


func entities_in_screen(origin) -> Array:
	var out: Array = []
	var r := visible_rect()
	for e in entities.values():
		if e == origin or e.hidden_by_area:
			continue
		if r.has_point(Vector2(e.x, e.y)):
			out.append(e)
	return out


func _remove_obsolete_entities() -> void:
	var ids: Array = []
	for e in entities.values():
		if e == player:
			continue
		if not is_visible_entity(e, 64):
			ids.append(e.id)
	ids = ids.slice(0, 32)
	for id in ids:
		remove_entity(entities.get(id))
	if not ids.is_empty():
		client.send_who(ids)


func _send_screen_config() -> void:
	if client == null:
		return
	var size := get_viewport_rect().size
	var tsgs := TS * game_scale
	var gw := int(ceil(size.x / tsgs))
	var gh := int(ceil(size.y / tsgs))
	gw += gw % 2
	gh += gh % 2
	client.send_config([["screenWidth", gw + 2], ["screenHeight", gh + 2]])


# ======================================================================
# Local player callbacks (game/gamecallbacks.js addPlayerCallbacks)
# ======================================================================

func _add_local_player_callbacks() -> void:
	var p := player
	p.key_move_cb = func(sent_move: int):
		if sent_move == 0 and not p.freeze:
			_check_teleport()
		p.send_move(sent_move)
	p.movestop_cb = func():
		if p.key_move:
			return
		if p.has_target() and p.can_reach_target():
			p.look_at_entity(p.target)
	p.abort_pathing_cb = func(_path, _x, _y):
		client.send_move_entity(p, 2)
	p.stop_pathing_cb = func(_x, _y):
		if p.is_dead:
			return
		_check_teleport()
		if p.has_target():
			p.look_at_entity(p.target)
			make_player_interact_next_to()
		if p.has_target() and p.target is Npc:
			make_npc_talk(p.target)
		elif p.has_target() and p.target is StaticEntity and p.target.kind == Types.NODE_CHEST_KIND:
			make_player_harvest_entity(p.target)
	p.request_path_cb = func(px: int, py: int):
		var path := find_path(p, px, py)
		if path.size() > 1:
			p.set_orientation(Types.orientation_between(p.x, p.y, int(path[1][0]), int(path[1][1])))
			client.send_move_path(p, path)
			return path
		return null
	p.death_cb = func():
		p.force_stop()
		var death = GameData.get_sprite("death")
		if death:
			p.set_sprite(death)
		p.current_anim = null
		p.set_animation("death", 150, 1, func():
			p.is_dead = true
			Game.after(1000, func():
				p.dead()
				if hud:
					hud.show_died()))
		if audio:
			audio.fade_out_music()
			audio.play_sound("death")
	p.settarget_cb = func(c, _b):
		if hud:
			hud.set_target(c)
	p.removetarget_cb = func(_id):
		if hud:
			hud.set_target(null)


func _check_teleport() -> void:
	var p := player
	if p.suppress_teleport_check or current_map == null:
		return
	var dest = current_map.get_door(p.x, p.y)
	if dest == null:
		return
	if dest.minLevel > 0 and p.level < dest.minLevel:
		bubble(p, "I must be Level %d or more to proceed." % dest.minLevel)
		if hud:
			hud.add_game_notification("Notification", "You must be Level %d or more to proceed." % dest.minLevel)
		return
	p.set_orientation(dest.orientation)
	p.freeze = true
	p.suppress_teleport_check = true
	p.stop_key_move = false
	teleport_maps(dest.tmap, dest.tx, dest.ty, dest.id)


func respawn_player() -> void:
	player.revive()
	_init_player(true)
	started = true
	client.send_player_revive()
	if hud:
		hud.update_bars(player)


# ======================================================================
# Interaction (game/gameinteraction*.js)
# ======================================================================

func make_player_attack(e) -> bool:
	var p := player
	var res := p.make_attack(e)
	match res:
		"attack_ok":
			client.send_attack(p, p.target, p.attack_skill)
			p.attack_skill = -1
			if audio:
				audio.play_sound("hit%d" % randi_range(1, 2))
			p.attack_cooldown.duration = 1000
			p.attack_cooldown.last_time = current_time
			_schedule_attack_retry(Types.ATTACK_MAX)
			return true
		"attack_outoftime":
			_schedule_attack_retry(p.attack_cooldown.duration - (current_time - p.attack_cooldown.last_time))
			return false
		"attack_toofar", "attack_aborted":
			if p.has_target():
				_schedule_attack_retry(Types.ATTACK_MAX)
			return false
	return false


func _schedule_attack_retry(delay: int) -> void:
	var p := player
	p.cancel_attack_delay()
	p.attack_delay = Game.after(maxi(0, delay) + 16, func():
		if p.is_dead or p.is_dying:
			return
		if _try_interact_faced_entity():
			return
		if p.has_target():
			make_player_attack(p.target))


func make_player_interact_next_to() -> void:
	var p := player
	if p.is_dying or p.is_dead:
		return
	if _try_show_dialogue():
		return
	if _try_interact_faced_entity():
		return
	if _try_interact_adjacent_entity():
		return
	if _try_interact_harvest_tiles():
		return
	if _try_interact_existing_target():
		return
	_try_interact_closest_entity()


func _try_interact_faced_entity() -> bool:
	var p := player
	var pos := p.next_tile()
	var e = get_entity_at(pos.x, pos.y)
	if e == null or e == p or e.is_dying or e.is_dead:
		return false
	if not (p.is_adjacent_entity(e) and p.is_facing_entity(e)):
		return false
	p.set_target(e)
	p.look_at_entity(e)
	return _process_target()


func _process_target() -> bool:
	var p := player
	if p.has_target() and (p.target.is_dying or p.target.is_dead):
		p.clear_target()
		return false
	var pos := p.next_tile()
	process_input(pos.x, pos.y, false)
	return true


func _try_show_dialogue() -> bool:
	var e = player.dialogue_entity
	if e != null and is_instance_valid(e) and player.is_next_too_entity(e) and player.is_facing_entity(e):
		show_dialogue()
		return true
	return false


func _try_interact_adjacent_entity() -> bool:
	var p := player
	var cands: Array = entities_in_screen(p).filter(func(e): return not e.is_dying and not e.is_dead and p.is_in_reach(e.x, e.y))
	if cands.is_empty():
		return false
	cands.sort_custom(func(a, b): return Types.real_distance(p.x, p.y, a.x, a.y) < Types.real_distance(p.x, p.y, b.x, b.y))
	p.set_target(cands[0])
	p.look_at_entity(cands[0])
	return _process_target()


func _try_interact_existing_target() -> bool:
	var p := player
	if not p.has_target():
		return false
	if not is_visible_entity(p.target):
		p.clear_target()
		return false
	if p.can_reach_target():
		if not p.is_moving():
			p.look_at_entity(p.target)
		return _process_target()
	return false


func _try_interact_closest_entity() -> bool:
	var p := player
	var prev = p.target
	p.target_index = 0
	player_target_closest_entity(0)
	if prev != p.target and not p.can_reach_target():
		return false
	return _process_target()


func player_target_closest_entity(inc: int) -> bool:
	var p := player
	var exclude := [Types.EntityType.NODE, Types.EntityType.PLAYER]
	if current_map and current_map.map_index != 0:
		exclude += [Types.EntityType.NPCMOVE, Types.EntityType.NPCSTATIC]
	var list: Array = entities_in_screen(p).filter(func(e): return not (e.type in exclude or e.is_dying or e.is_dead or e is ItemEntity))
	if list.is_empty():
		p.target_index = 0
		return false
	list.sort_custom(func(a, b): return Types.real_distance(p.x, p.y, a.x, a.y) < Types.real_distance(p.x, p.y, b.x, b.y))
	var index := posmod(p.target_index, list.size())
	p.target_index = posmod(index + inc, list.size())
	p.set_target(list[index])
	return true


## game.click(): mouse click on world position (pixels).
func click(px: int, py: int) -> void:
	var p := player
	if p == null or map_status < 2 or not started:
		return
	if p.dialogue_entity != null and _try_show_dialogue():
		return
	if p.movement.in_progress:
		return
	var e = get_entity_at(px, py)
	if e == p:
		e = null
	if e != null:
		p.set_target(e)
		if p is EntityMoving:
			p.look_at_entity(e)
		process_input(px, py, false)
		return
	p.clear_target()
	if hud:
		hud.set_target(null)
	process_input(px, py, true)


func process_input(px: int, py: int, click_move: bool) -> void:
	var p := player
	if not started or p == null or p.is_dead:
		return
	px = clampi(px, 0, (current_map.width - 1) * TS)
	py = clampi(py, 0, (current_map.height - 1) * TS)
	var e = p.target if p.has_target() else get_entity_at(px, py)
	if e != null and not e.is_dying:
		player_interact(e)
		return
	var wtype = data.weapon_type()
	if current_map.is_colliding(px, py) and wtype != null \
			and current_map.is_harvest_tile(px >> 4, py >> 4, str(wtype)) and p.is_next_too_tile(px, py):
		make_player_harvest(px, py)
		return
	if click_move:
		click_move_to(px, py)


func player_interact(e) -> void:
	var p := player
	if e == null:
		return
	if not p.has_target() and not e.is_dying:
		p.set_target(e)
	if p.is_next_too_entity(e) and not p.movement.in_progress:
		p.look_at_entity(e)
	if e is StaticEntity and e.type == Types.EntityType.BLOCK:
		if p.is_next_too_entity(e) and p.is_facing_entity(e):
			if p.holding_block == e:
				place_block(e)
			else:
				pickup_block(e)
		else:
			p.follow(e)
		return
	if e is ItemEntity:
		_make_player_go_to_item(e)
	elif e is Npc:
		make_npc_talk(e)
	elif e is Mob or (e is Player and e != p):
		make_player_attack(e)
	elif e is StaticEntity and e.type == Types.EntityType.NODE:
		make_player_harvest_entity(e)


func _make_player_go_to_item(item) -> void:
	if not player.is_next_too_entity(item):
		player.follow(item)
	else:
		client.send_loot_move(item)


func make_npc_talk(npc) -> void:
	var p := player
	if npc == null:
		return
	if not p.is_next_too_entity(npc):
		p.follow(npc)
		return
	# The server checks the distance with its own (slightly delayed) copy of
	# our position, so give it one round trip to catch up after walking.
	var talk := func():
		if is_instance_valid(npc):
			client.send_talk_to_npc(npc.type, npc.id)
	if npc.type == Types.EntityType.NPCMOVE:
		Game.after(Types.G_ROUNDTRIP, talk)
		p.remove_target()
		return
	var t: String = npc.title()
	if t in ["Craft", "Beginner shop", "Bank", "Enchant", "Repair", "Auction", "Looks"] and hud and hud.windows.size() > 0:
		match t:
			"Craft": hud.open_window("craft")
			"Beginner shop": hud.window("store").open_levels(1, 100)
			"Bank": hud.open_window("bank")
			"Enchant": hud.window("inventory").open_mode(ItemActions.Mode.ENCHANT)
			"Repair": hud.window("inventory").open_mode(ItemActions.Mode.REPAIR)
			"Auction": hud.open_window("auction")
			"Looks": hud.open_window("looks")
	else:
		bubbles.erase(npc.id)
		Game.after(Types.G_ROUNDTRIP, talk)
	p.remove_target()


func make_player_harvest_entity(e) -> void:
	var p := player
	if not p.is_next_too_entity(e):
		p.follow(e)
		return
	if not data.has_harvest_weapon(e.weapon_type if str(e.weapon_type) != "" else "any"):
		hud.add_notification(GameData.tr_lang("HARVEST_WRONG_TYPE", [e.weapon_type]))
		return
	p.look_at_entity(e)
	p.harvest_on(str(e.weapon_type))
	if e.kind == Types.NODE_CHEST_KIND and audio:
		audio.play_sound("chest")
	client.send_harvest_entity(e)


# ======================================================================
# Dialogue (game/gamedialogue.js)
# ======================================================================

func show_dialogue() -> void:
	var p := player
	var e = p.dialogue_entity
	if _dialogue_delay:
		_dialogue_delay.cancel()
	# hasFinished()
	if hud:
		hud.hide_dialogue()
	if e != null and is_instance_valid(e):
		var prev_i: int = e.dialogue_index - 1
		if prev_i >= 0 and prev_i < e.dialogue.size():
			var line = e.dialogue[prev_i]
			if line is Array and line.size() == 3 and str(line[2]) == "QUEST":
				client.send_quest(e.id, int(e.quest_id), 1)
		if prev_i >= 0 and audio:
			audio.play_sound("npc-end")
		bubbles.erase(e.id)
		bubbles.erase(p.id)
		if e.dialogue_index >= e.dialogue.size():
			# questhandler.handleQuest(entity.quest): "Quest Found/Completed".
			if e.get("quest") != null and hud:
				_quest_alarm(e.quest)
				e.quest = null
			e.dialogue_index = 0
			p.dialogue_entity = null
			return
	else:
		p.dialogue_entity = null
		return
	# createMessage()
	var line = e.dialogue[e.dialogue_index]
	var speaker = e if int(line[0]) == 0 else p
	var text := str(line[1])
	bubble(speaker, text)
	if audio:
		audio.play_sound("npc")
	if hud:
		var who: String = ("[NPC] " + speaker.ename) if speaker == e else p.ename
		hud.add_chat(who, text, Color(1, 1, 0))
		hud.show_dialogue(speaker.ename, text, speaker)
	e.dialogue_index += 1
	_dialogue_delay = Game.after(5000, show_dialogue)


# ======================================================================
# Bubbles & floating info (bubble.js / infomanager.js)
# ======================================================================

func bubble(e, text: String) -> void:
	if e == null or text == "":
		return
	bubbles[e.id] = {"entity": e, "text": text, "until": Time.get_ticks_msec() + 5000}


func add_info(text: String, px: int, py: int, kind: String, duration: int = 1000) -> void:
	var style := {
		"levelUp": [Color(0, 1, 1), 10, 100, 0],
		"minorLevelUp": [Color(0, 1, 1), 8, 100, 0],
		"inflicted": [Color(1, 0.25, 0.25), 6, 25, 1],
		"received": [Color(1, 0.25, 0.25), 6, 25, 1],
		"healed": [Color(0.38, 1, 0.38), 6, 25, 1],
		"health": [Color(1, 1, 1), 6, 25, 1],
		"crit": [Color(1, 1, 0), 6, 25, 1],
		"experience": [Color(0, 1, 1), 6, 50, 0],
	}
	var st: Array = style.get(kind, style["health"])
	_info_id += 1
	infos.append({
		"id": _info_id, "text": text, "x": float(px), "y": float(py),
		"color": st[0], "size": st[1], "speed": st[2], "effect": st[3],
		"angle": deg_to_rad(randi_range(20, 160)), "opacity": 1.0,
		"start": Time.get_ticks_msec(), "last": 0, "duration": duration,
	})


func _update_infos() -> void:
	var t := Time.get_ticks_msec()
	var keep: Array = []
	for info in infos:
		if t - info.last > info.speed:
			var dt: int = (t - info.last) if info.last != 0 else 0
			info.last = t
			if info.effect == 0:
				info.y -= 1
			else:
				var sp: float = info.speed / 100.0
				info.y -= sp * sin(info.angle)
				info.x -= sp * cos(info.angle)
			info.opacity -= float(dt) / info.duration
		if t - info.start <= info.duration:
			keep.append(info)
	infos = keep
	for id in bubbles.keys():
		var b: Dictionary = bubbles[id]
		if t > b.until or not is_instance_valid(b.entity):
			bubbles.erase(id)


# ======================================================================
# Network handlers (clientcallback/*.js)
# ======================================================================

func _register_handlers() -> void:
	var M := Types.Messages
	client.on(M.WC_VERSION, _on_version)
	client.on(M.WC_PLAYER, _on_player)
	client.on(M.WC_TELEPORT_MAP, _on_teleport_map)
	client.on(M.WC_SPAWN, _on_spawn)
	client.on(M.WC_DESPAWN, _on_despawn)
	client.on(M.WC_MOVE, _on_entity_move)
	client.on(M.WC_MOVEPATH, _on_entity_move_path)
	client.on(M.WC_DAMAGE, _on_damage)
	client.on(M.WC_CHANGEPOINTS, _on_change_points)
	client.on(M.WC_STAT, _on_stat)
	client.on(M.WC_STATINFO, _on_stat_info)
	client.on(M.WC_LEVELUP, _on_level_up)
	client.on(M.WC_ITEMLEVELUP, _on_item_level_up)
	client.on(M.WC_CHAT, _on_chat)
	client.on(M.WC_NOTIFY, _on_notify)
	client.on(M.WC_SPEECH, _on_speech)
	client.on(M.WC_DIALOGUE, _on_dialogue)
	client.on(M.WC_QUEST, _on_quest)
	client.on(M.WC_GOLD, _on_gold)
	client.on(M.WC_ITEMSLOT, _on_item_slot)
	client.on(M.WC_SET_SPRITE, _on_set_sprite)
	client.on(M.WC_ACHIEVEMENT, func(d):
		data.set_achievement(d)
		audio.play_sound("achievement"))
	client.on(M.WC_APPEARANCE, func(d): data.apply_appearances(d))
	client.on(M.WC_AUCTIONOPEN, func(d): data.apply_auction(d))
	client.on(M.WC_PARTY, func(d): data.apply_party(_party_names(d)))
	client.on(M.WC_SKILLLOAD, func(d): data.set_skill_exp(Types.to_int(d[0]), Types.to_int(d[1])))
	client.on(M.WC_SKILL_XP, _on_skill_xp)
	client.on(M.WC_PLAYERINFO, _on_player_info)
	client.on(M.WC_HARVEST, _on_harvest)
	client.on(M.WC_BLOCK_MODIFY, _on_block_modify)
	for ignored in [M.WC_SKILLEFFECTS, M.WC_SET_ANIMATION]:
		client.on(ignored, func(_d): pass)


func _on_disconnected(message: String) -> void:
	started = false
	_show_error(message)
	disconnected.emit(message)


func _show_error(message: String) -> void:
	if hud:
		hud.show_error(message)


func _on_version(d: Array) -> void:
	var v := Types.to_int(d[0])
	if v != Config.get_version():
		_show_error("Please download the new version of Land Of Mana.\n(client %d, server %d)" % [Config.get_version(), v])


func _on_player(pkt: Array) -> void:
	var d := pkt.duplicate()
	d.pop_front()
	d.pop_front()
	var p := player
	p.id = Types.to_int(d.pop_front())
	p.ename = str(d.pop_front())
	p.map_index = Types.to_int(d.pop_front())
	p.orientation = Types.Orientation.DOWN
	var px := Types.to_int(d.pop_front())
	var py := Types.to_int(d.pop_front())
	p.set_pos_spawn(px, py)
	p.set_hp_max(Types.to_int(d.pop_front()))
	p.set_ep_max(Types.to_int(d.pop_front()))
	var xp := {}
	for k in ["base", "attack", "defense", "move", "sword", "bow", "hammer", "axe", "logging", "mining"]:
		xp[k] = Types.to_int(d.pop_front())
	p.stats["exp"] = xp
	p.level = Types.get_level(xp.base)
	p.colors = [Types.to_int(d.pop_front()), Types.to_int(d.pop_front())]
	p.gold = [Types.to_int(d.pop_front()), Types.to_int(d.pop_front())]
	p.gems = Types.to_int(d.pop_front())
	data.set_gold(p.gold[0], p.gold[1], p.gems)
	p.set_move_rate(500)
	for k in ["attack", "defense", "health", "energy", "luck", "free"]:
		p.stats[k] = Types.to_int(d.pop_front())
	# equipment
	var count := Types.to_int(d.pop_front())
	data.read_rooms(PlayerData.Store.EQUIPMENT, d, count, true)
	_update_weapon()
	var aid := Types.to_int(d.pop_front())
	var wid := Types.to_int(d.pop_front())
	p.set_sprite_by_index(0, aid)
	p.set_sprite_by_index(1, wid)
	# inventory + bank
	count = Types.to_int(d.pop_front())
	data.read_rooms(PlayerData.Store.INVENTORY, d, count, true)
	p.set_range()
	count = Types.to_int(d.pop_front())
	data.read_rooms(PlayerData.Store.BANK, d, count, true)
	# quests (13 fields each)
	count = Types.to_int(d.pop_front())
	data.quests.clear()
	for i in range(count):
		var q: Array = []
		for j in range(13):
			q.append(d.pop_front())
		data.set_quest(q)
	# achievements (7 fields each)
	count = Types.to_int(d.pop_front())
	data.achievements.clear()
	for i in range(count):
		var a: Array = []
		for j in range(7):
			a.append(d.pop_front())
		data.achievements.append(Quest.achievement_from(a))
	data.achievements_changed.emit()
	# skills (one exp per skill)
	count = Types.to_int(d.pop_front())
	data.skill_exps.clear()
	for i in range(count):
		data.skill_exps.append(Types.to_int(d.pop_front()))
	data.skills_changed.emit()
	# shortcuts (slot, type, id)
	count = Types.to_int(d.pop_front())
	for i in range(count):
		var slot := Types.to_int(d.pop_front())
		var t := Types.to_int(d.pop_front())
		var id := Types.to_int(d.pop_front())
		data.set_shortcut(slot, t, id)
	_on_player_load()


func _read_item_room(d: Array) -> Dictionary:
	return {
		"slot": Types.to_int(d.pop_front()), "kind": Types.to_int(d.pop_front()),
		"number": Types.to_int(d.pop_front()), "dur": Types.to_int(d.pop_front()),
		"durMax": Types.to_int(d.pop_front()), "exp": Types.to_int(d.pop_front()),
	}


func _update_weapon() -> void:
	player.weapon_kind = data.weapon_kind()
	player.set_range()


func _on_player_load() -> void:
	if hud:
		hud.on_player_loaded(player)
		hud.update_bars(player)
	teleport_maps(1)
	player.idle(player.orientation)
	if player.level <= 1 and hud:
		for i in range(1, 6):
			var key := "TUTORIAL_%d" % i
			Game.after(12500 * i, func():
				if hud and is_instance_valid(hud):
					hud.add_game_notification("[" + GameData.tr_lang("TUTORIAL") + "]", GameData.tr_lang(key)))


# ------------------------------------------------------------ spawning

func _on_spawn(pkt: Array) -> void:
	var id := Types.to_int(pkt[0])
	var type := Types.to_int(pkt[1])
	var kind := Types.to_int(pkt[2])
	var ename := str(pkt[3]) if pkt[3] != null else ""
	var midx := Types.to_int(pkt[4])
	var px := Types.to_int(pkt[5])
	var py := Types.to_int(pkt[6])
	if current_map == null or not current_map.loaded or current_map.map_index != midx or id == player.id:
		return
	if entities.has(id):
		remove_entity(entities[id])
	if type == Types.EntityType.ITEM or type == Types.EntityType.ITEMLOOT:
		var item := ItemEntity.new()
		item.id = id
		item.type = type
		item.kind = kind
		item.map_index = midx
		item.orientation = Types.to_int(pkt[7]) if pkt.size() > 7 else 0
		item.count = Types.to_int(pkt[8]) if pkt.size() > 8 else 1
		item.set_pos(px, py)
		_add_entity(item)
		item.setup_item()
		return
	var e: Entity = null
	match type:
		Types.EntityType.PLAYER:
			e = Player.new()
		Types.EntityType.MOB:
			e = Mob.new()
		Types.EntityType.NPCSTATIC, Types.EntityType.NPCMOVE:
			e = Npc.new()
		Types.EntityType.NODE, Types.EntityType.BLOCK, Types.EntityType.TRAP:
			e = StaticEntity.new()
		_:
			return
	e.id = id
	e.type = type
	e.kind = kind
	e.map_index = midx
	e.ename = ename
	e.world = self
	_spawn_entity(pkt, e)


func _spawn_entity(pkt: Array, e) -> void:
	e.set_pos(Types.to_int(pkt[5]), Types.to_int(pkt[6]))
	var o := Types.to_int(pkt[7]) if pkt.size() > 7 else 2
	e.level = Types.to_int(pkt[8]) if pkt.size() > 8 else 0
	if e is Mob:
		e.setup_kind(e.kind, e.level)
	if pkt.size() > 10 and e is Character:
		e.set_hp_max(Types.to_int(pkt[10]))
		e.set_hp(Types.to_int(pkt[9]))
	_add_entity(e)
	if e is Player:
		e.set_sprite_by_index(0, Types.to_int(pkt[12]) if pkt.size() > 12 else 0)
		e.set_sprite_by_index(1, Types.to_int(pkt[13]) if pkt.size() > 13 else 0)
	elif e is Mob:
		e.set_sprite(GameData.get_sprite(e.get_sprite_name()))
	elif e is Npc:
		e.set_sprite(GameData.get_sprite(e.get_sprite_name()))
		e.npc_quest_id = Types.to_int(pkt[8]) if pkt.size() > 8 else 0
		if e.ename == "" and e.type == Types.EntityType.NPCSTATIC:
			e.ename = e.title()
		npcs[e.id] = e
	elif e is StaticEntity:
		match e.type:
			Types.EntityType.NODE:
				e.set_sprite(GameData.get_sprite(str(pkt[9]) if pkt.size() > 9 else ""))
				e.weapon_type = str(pkt[11]) if pkt.size() > 11 else ""
				e.idle_speed = 150 + randi_range(0, 150)
				e.animate(str(pkt[10]) if pkt.size() > 10 else "idle", e.idle_speed)
			Types.EntityType.BLOCK:
				e.set_sprite(GameData.get_sprite("block-%d" % e.kind))
				var parts: PackedStringArray = str(e.ename).split("-")
				e.animate(parts[1] if parts.size() > 1 else "idle", e.idle_speed)
			Types.EntityType.TRAP:
				e.set_sprite(GameData.get_sprite("trap-%d" % e.kind))
				e.animate("on", e.idle_speed)
	if e is EntityMoving:
		e.set_orientation(o)
		e.idle(o)
	if e is Character:
		var c: Character = e
		c.request_path_cb = func(px: int, py: int):
			var p2 := find_path(c, px, py)
			return p2 if p2.size() > 1 else null
		c.death_cb = func(): _on_entity_death(c)


func _on_entity_death(c) -> void:
	if c == player:
		return
	if player.target == c:
		player.disengage()
		player.cancel_attack_delay()
		player.target_index = 0
	c.is_dying = true
	c.force_stop()
	c.freeze = true
	var death = GameData.get_sprite("death")
	if death:
		c.set_sprite(death)
		c.current_anim = null
		c.set_animation("death", 150, 1, func():
			c.is_dead = true
			remove_entity(c))
	else:
		remove_entity(c)
	if is_visible_entity(c) and audio:
		audio.play_sound("kill%d" % randi_range(1, 2))


func _on_despawn(d: Array) -> void:
	if d.size() > 1 and map_index != Types.to_int(d[1]):
		return
	var e = entities.get(Types.to_int(d[0]))
	if e == null or e == player:
		return
	if e is Character:
		if not e.is_dying and not e.is_dead:
			e.die()
	else:
		remove_entity(e)
	e.clean()


# ------------------------------------------------------------- movement

func _on_entity_move(d: Array) -> void:
	var time := Types.to_int(d[0])
	var m := Types.to_int(d[1])
	var id := Types.to_int(d[2])
	var o := Types.to_int(d[3])
	var state := Types.to_int(d[4])
	var speed := Types.to_int(d[5])
	var px := Types.to_int(d[6])
	var py := Types.to_int(d[7])
	if map_status < 2 or map_index != m or m != player.map_index:
		return
	var e = entities.get(id)
	if e == null or e.is_dying or e.is_dead or not (e is EntityMoving):
		return
	if e == player:
		if not (player.x == px and player.y == py):
			player.reset_position(px, py)
			player.set_freeze(Types.G_ROUNDTRIP)
			client.send_sync_time(Game.unix_ms())
		return
	e.set_move_rate(speed)
	e.server_move(time, o, state, px, py)


func _on_entity_move_path(pkt: Array) -> void:
	var d := pkt.duplicate()
	var time := Types.to_int(d.pop_front())
	var m := Types.to_int(d.pop_front())
	var id := Types.to_int(d.pop_front())
	d.pop_front() # orientation
	d.pop_front() # interrupted
	var speed := Types.to_int(d.pop_front())
	var path: Array = []
	for n in d:
		if n is Array and n.size() >= 2:
			path.append([Types.to_int(n[0]), Types.to_int(n[1])])
	if map_status < 2 or map_index != m or m != player.map_index or path.is_empty():
		return
	var e = entities.get(id)
	if e == null or e == player or e.is_dying or e.is_dead or not (e is EntityMoving):
		return
	var lock := Types.G_LATENCY - (Game.world_time() - time) + Types.G_UPDATE_INTERVAL
	lock = clampi(lock, 0, Types.G_LATENCY)
	e.force_stop()
	e.set_pos(path[0][0], path[0][1])
	var fn := func():
		if not is_instance_valid(e) or e.is_dying or e.is_dead:
			return
		if path.size() < 2:
			return
		if speed > 0:
			e.set_move_rate(speed)
		e.move_along(path)
	if lock == 0:
		fn.call()
	else:
		Game.after(lock, fn)


# --------------------------------------------------------------- combat

func _on_damage(d: Array) -> void:
	var s = entities.get(Types.to_int(d[0]))
	var t = entities.get(Types.to_int(d[1]))
	if s == null or t == null:
		return
	var o := Types.to_int(d[2])
	var hp_mod := Types.to_int(d[3])
	_on_change_points([t.id, d[4], d[5], hp_mod, d[7], d[8], d[6], Types.to_int(d[9]) if d.size() > 9 else 0])
	if hp_mod < 0 and s != player and s is Character and is_instance_valid(s):
		s.hit(o)


func _on_change_points(d: Array) -> void:
	var id := Types.to_int(d[0])
	var hp := Types.to_int(d[1])
	var hp_max := Types.to_int(d[2])
	var hp_mod := Types.to_int(d[3])
	var ep := Types.to_int(d[4])
	var ep_max := Types.to_int(d[5])
	var crit := Types.to_int(d[7]) if d.size() > 7 else 0
	if id <= 0:
		return
	var e = entities.get(id)
	if e == null or not (e is Character):
		return
	# damage info (clientcallbackscombat.js showDamageInfo)
	if hp_mod == 0:
		add_info("miss", e.x, e.y - 15, "health")
	elif hp_mod < 0:
		add_info(str(-hp_mod), e.x, e.y - 15, "crit" if crit > 0 else "inflicted", 1500 if crit > 0 else 1000)
		if is_visible_entity(e) and audio:
			audio.play_sound("hurt")
	else:
		add_info(str(hp_mod), e.x, e.y - 15, "healed")
	e.stats.hpMax = hp_max
	e.stats.epMax = ep_max
	e.stats.ep = clampi(ep, 0, ep_max)
	e.stats.hp = clampi(hp, 0, hp_max)
	if e.stats.hp == 0 and not e.is_dying and not e.is_dead:
		e.die()
	if e == player:
		if hud:
			hud.update_bars(player)
	elif hud and player.target == e:
		hud.set_target(e)


func _on_stat(d: Array) -> void:
	var stat_type := str(d[0])
	var value := Types.to_int(d[1])
	var change := Types.to_int(d[2])
	var parts := stat_type.split(".")
	if parts.size() == 2:
		if not player.stats.has(parts[0]) or not (player.stats[parts[0]] is Dictionary):
			player.stats[parts[0]] = {}
		player.stats[parts[0]][parts[1]] = value
	else:
		player.stats[stat_type] = value
	if stat_type == "exp.base":
		player.level = Types.get_level(value)
		if change > 0:
			add_info("+%d exp" % change, player.x, player.y, "experience", 3000)
		if hud:
			hud.update_bars(player)


func _on_stat_info(d: Array) -> void:
	var keys := ["attack", "defense", "health", "energy", "luck", "free", "hp", "hpMax", "ep", "epMax"]
	for i in range(mini(keys.size(), d.size())):
		player.stats[keys[i]] = Types.to_int(d[i])
	data.stats_changed.emit()
	if hud:
		hud.update_bars(player)


func _on_level_up(d: Array) -> void:
	var t := str(d[0])
	var lvl := Types.to_int(d[1])
	if t == "base":
		if player.level != lvl:
			add_info("Level %d" % lvl, player.x, player.y, "levelUp", 5000)
			player.level = lvl
			if hud:
				hud.update_bars(player)
	else:
		add_info("%s Level %d" % [t.capitalize(), lvl], player.x, player.y, "minorLevelUp", 3500)
		if player.stats.exp is Dictionary and d.size() > 2:
			player.stats.exp[t] = Types.to_int(d[2])


func _on_item_level_up(d: Array) -> void:
	var t := Types.to_int(d[0])
	var lvl := Types.to_int(d[1])
	add_info(("Armor Level %d" if t == 0 else "Weapon Level %d") % lvl, player.x, player.y, "minorLevelUp", 3500)


# ----------------------------------------------------------- social etc

func _on_chat(d: Array) -> void:
	var id := Types.to_int(d[0])
	var msg := str(d[2]) if d.size() > 2 else ""
	if msg.begins_with("/") and hud:
		# ChatHandler.processRecievers()
		if msg.begins_with("/rn "):
			hud.add_chat("", msg.substr(4), Color(1, 1, 0))
			return
		if msg.begins_with("/1 "):
			hud.add_chat("", msg.substr(3), Color.WHITE)
			return
		if msg.begins_with("// "):
			hud.add_chat("", msg.substr(3), Color("#00BFFF"))
			return
		if msg.begins_with("///"):
			hud.add_chat("", msg.substr(3).strip_edges(), Color("#FFA500"))
			return
	var e = entities.get(id)
	if e != null:
		if is_visible_entity(e):
			bubble(e, msg)
		if hud:
			hud.add_chat(e.ename, msg, Color(1, 1, 0))
	elif hud:
		hud.add_chat(str(d[1]), msg, Color(0.65, 1, 0.98))
	if audio:
		audio.play_sound("chat")


func _on_notify(pkt: Array) -> void:
	var d := pkt.duplicate()
	var group := str(d.pop_front())
	var text := str(d.pop_front())
	var msg := GameData.tr_lang(text)
	if not d.is_empty():
		msg = Types.format(msg, d)
	if group.begins_with("GLOBAL"):
		if hud:
			hud.announce(text, 10000)
		return
	if group.begins_with("NOTICE"):
		if hud:
			hud.announce(msg, 10000)
		return
	if hud:
		if (group.begins_with("SHOP") or group.begins_with("INVENTORY")) and hud.shop_window_open():
			hud.notify(msg)
		hud.add_notification(msg)


func _on_speech(d: Array) -> void:
	var e = entities.get(Types.to_int(d[0]))
	if e == null:
		return
	var key := str(d[1])
	var msg := ""
	if GameData.lang.has(key):
		msg = Types.format(str(GameData.lang[key]), d[2] if d.size() > 2 else [])
	bubble(e, msg)


func _on_dialogue(pkt: Array) -> void:
	var d := pkt.duplicate()
	var npc = entities.get(Types.to_int(d.pop_front()))
	var code := str(d.pop_front())
	if npc == null or not (npc is Npc):
		return
	var message = null
	# Only QUESTS_<number> is a quest offer; QUESTS_NONE, QUESTS_NONE_2 and
	# QUESTS_REWARD are ordinary lang entries (JS: /^QUESTS_[0-9]+$/).
	if code.begins_with("QUESTS_") and code.substr(7).is_valid_int():
		var qid := code.substr(7)
		npc.quest_id = int(qid)
		var q = GameData.lang.get("QUESTS", {}).get(qid)
		if q is Array and not q.is_empty():
			message = q[0].duplicate(true)
	else:
		var v = GameData.lang.get(code)
		message = v.duplicate(true) if v is Array else v
	if message == null:
		return
	if message is String:
		message = [[0, message]]
	elif message is Array and not message.is_empty() and not (message[0] is Array):
		message = [message]
	if not d.is_empty():
		for line in message:
			line[1] = Types.format(str(line[1]), d)
	npc.dialogue = message
	npc.dialogue_index = 0
	player.dialogue_entity = npc
	show_dialogue()


func _quest_alarm(q) -> void:
	if q == null or hud == null:
		return
	if q.status == 0:
		hud.alarm("Quest Found\n%s" % q.summary, 0, "quest")
	elif q.status == 2:
		hud.alarm("Quest Completed\n%s" % q.summary, 0, "quest")


## clientcallbacksquest.js onQuest + questSpeech
func _on_quest(d: Array) -> void:
	var q: Quest = data.set_quest(d)
	var npc = null
	for n in npcs.values():
		if n.npc_quest_id == q.npc_quest_id:
			npc = n
	if npc != null:
		bubbles.erase(npc.id)
	if npc != null and player.can_interact(npc) and not q.desc.is_empty():
		npc.dialogue = q.desc.duplicate(true)
		npc.dialogue_index = 0
		npc.quest = q
		player.dialogue_entity = npc
		show_dialogue()
	elif hud:
		var states := ["Quest started", "Quest updated", "Quest complete"]
		hud.add_notification("%s: %s (%s)" % [states[clampi(q.status, 0, 2)], q.summary, q.progress_text()])
		_quest_alarm(q)


func _on_gold(d: Array) -> void:
	var before := int(player.gold[0]) + int(player.gold[1])
	player.gold = [Types.to_int(d[0]), Types.to_int(d[1])]
	# Gold gained (not just moved between inventory and bank).
	if int(player.gold[0]) + int(player.gold[1]) > before and audio:
		audio.play_sound("gold")
	player.gems = Types.to_int(d[2]) if d.size() > 2 else player.gems
	data.set_gold(player.gold[0], player.gold[1], player.gems)
	if hud:
		hud.update_bars(player)


func _on_item_slot(d: Array) -> void:
	data.apply_item_slot(d)
	if Types.to_int(d[0]) == PlayerData.Store.EQUIPMENT:
		_update_weapon()


func _on_set_sprite(d: Array) -> void:
	var e = entities.get(Types.to_int(d[0]))
	if e == null:
		return
	if e is Player:
		e.set_sprite_by_index(0, Types.to_int(d[1]))
		e.set_sprite_by_index(1, Types.to_int(d[2]))
	else:
		var def = GameData.get_sprite(GameData.get_appearance_sprite(Types.to_int(d[1])))
		if def:
			e.set_sprite(def)


# ======================================================================
# Input
# ======================================================================

func say(text: String) -> void:
	text = text.strip_edges()
	if text == "":
		return
	if _chat_command(text):
		return
	client.send_chat(text.left(256))


## ChatHandler.processSenders(): client side chat commands.
func _chat_command(message: String) -> bool:
	var parts := message.split(" ", false, 5)
	var arg := parts[1] if parts.size() > 1 else ""
	match parts[0]:
		"/warp":
			warp_to_town()
			return true
		"/party", "/invite":
			client.send([Types.Messages.CW_PARTY, 1, arg, 0])
			return true
		"/leader":
			client.send([Types.Messages.CW_PARTY, 3, arg, 0])
			return true
		"/leave":
			client.send([Types.Messages.CW_PARTY, 4, null, 0])
			return true
		"/kick":
			client.send([Types.Messages.CW_PARTY, 2, arg, 0])
			return true
		"/autopotion":
			auto_potion = int(arg)
			hud.add_notification("Auto potion at %d%% health." % auto_potion if auto_potion > 0 else "Auto potion off.")
			return true
		"/id":
			var e = _hover
			if e:
				hud.add_notification("entity name: %s, id: %d, kind: %d, x: %d, y: %d" % [e.ename, e.id, e.kind, e.x, e.y])
			return true
	if message.begins_with("/guild") or message.begins_with("/g "):
		hud.add_notification("Guilds are not available on this server.")
		return true
	var pattern := message.substr(0, 3)
	match pattern:
		"/w ":
			var n := player.ename
			client.send_chat("/s " + n + ": " + message.substr(3))
			return true
		"// ":
			client.send_chat("// " + player.ename + ": " + message.substr(3))
			return true
		"///":
			client.send_chat("/// " + player.ename + ": " + message.substr(3))
			return true
	return false


func screen_to_world(screen: Vector2) -> Vector2:
	return get_canvas_transform().affine_inverse() * screen


func _unhandled_input(event: InputEvent) -> void:
	if player == null or not started or map_status < 2:
		return
	if event is InputEventMouseMotion:
		_update_hover(event.position)
		return
	if event is InputEventJoypadButton or event is InputEventJoypadMotion:
		if _gamepad_input(event):
			get_viewport().set_input_as_handled()
		return
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_RIGHT:
		var rp := screen_to_world(event.position)
		var e = get_entity_at(int(rp.x), int(rp.y))
		if e is Player and e != player and hud:
			hud.show_player_menu(e)
			get_viewport().set_input_as_handled()
		return
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		var wp := screen_to_world(event.position)
		click(int(wp.x), int(wp.y))
		get_viewport().set_input_as_handled()
		return
	if not (event is InputEventKey):
		return
	if event.is_echo():
		return
	var dirs := {
		"move_up": Types.Orientation.UP, "move_down": Types.Orientation.DOWN,
		"move_left": Types.Orientation.LEFT, "move_right": Types.Orientation.RIGHT,
	}
	for action in dirs:
		if event.is_action(action):
			var down: bool = event.is_pressed()
			if down and not _keys_down.get(action, false):
				_keys_down[action] = true
				player.key_input(dirs[action], true)
			elif not down and _keys_down.get(action, false):
				_keys_down[action] = false
				player.key_input(dirs[action], false)
			get_viewport().set_input_as_handled()
			return
	if not event.is_pressed():
		return
	if event.is_action("interact"):
		make_player_interact_next_to()
	elif event.is_action("target_next"):
		player_target_closest_entity(1)
	elif event.is_action("target_prev"):
		player_target_closest_entity(-1)
	elif event.is_action("toggle_music") and audio:
		audio.toggle_music(map_index)
	elif event.is_action("toggle_debug") and hud:
		hud.toggle_debug()
	else:
		return
	get_viewport().set_input_as_handled()


func release_keys() -> void:
	for action in _keys_down.keys():
		if _keys_down[action]:
			_keys_down[action] = false
	if player:
		player.key_input(player.orientation, false)



# ======================================================================
# Harvesting, blocks, misc packets (rest of the JS client)
# ======================================================================

## game.makePlayerHarvest(): use an axe/hammer on a tree / rock tile.
func make_player_harvest(px: int, py: int) -> void:
	var p := player
	if not data.has_harvest_weapon():
		hud.add_notification(GameData.tr_lang("HARVEST_NO_WEAPON"))
		return
	var t = data.weapon_type()
	if t == null or not current_map.is_harvest_tile(px >> 4, py >> 4, str(t)):
		hud.add_notification(GameData.tr_lang("HARVEST_WRONG_TYPE", [t]))
		return
	p.look_at_tile(px, py)
	p.harvest_on(str(t))
	client.send_harvest(px, py)


func _try_interact_harvest_tiles() -> bool:
	var p := player
	if p.has_target():
		return false
	var t = data.weapon_type()
	if t == null:
		return false
	var pos := p.next_tile()
	if current_map.is_harvest_tile(pos.x >> 4, pos.y >> 4, str(t)):
		make_player_harvest(pos.x, pos.y)
		return true
	for spot in p.get_spots_around(p.x, p.y, 1):
		if spot.x == pos.x and spot.y == pos.y:
			continue
		if current_map.is_harvest_tile(int(spot.x) >> 4, int(spot.y) >> 4, str(t)):
			make_player_harvest(spot.x, spot.y)
			return true
	return false


## WC_HARVEST: [entityId, action (1 start, 2 stop), gx, gy, duration?]
func _on_harvest(d: Array) -> void:
	var e = entities.get(Types.to_int(d[0]))
	if e == null or not (e is Player):
		return
	var action := Types.to_int(d[1])
	if action == 1:
		if e.fsm != "HARVEST":
			e.look_at_tile(Types.to_int(d[2]), Types.to_int(d[3]))
			e.harvest_on("")
		if e == player and d.size() > 4:
			player.harvest_duration = Types.to_int(d[4])
	elif action == 2:
		e.force_stop()


## Block.pickup() / Block.place()
func pickup_block(b) -> void:
	player.holding_block = b
	client.send([Types.Messages.CW_BLOCK_MODIFY, 0, b.id, b.x, b.y])


func place_block(b) -> void:
	var pos := player.next_tile()
	var x := int(round(pos.x / float(TS)) * TS)
	var y := int(round(pos.y / float(TS)) * TS)
	if current_map.is_colliding(x, y):
		return
	b.set_pos(x, y)
	player.holding_block = null
	client.send([Types.Messages.CW_BLOCK_MODIFY, 1, b.id, b.x, b.y])


## WC_BLOCK_MODIFY: [entityId, type (0 pickup, 1 place), blockId]
func _on_block_modify(d: Array) -> void:
	var e = entities.get(Types.to_int(d[0]))
	var b = entities.get(Types.to_int(d[2]))
	if e == null or b == null or not (e is Player):
		return
	if Types.to_int(d[1]) == 0:
		e.holding_block = b
	else:
		e.holding_block = null


func _party_names(d: Array) -> Array:
	# WC_PARTY type 2 carries the inviter's entity id - turn it into a name.
	if d.size() > 1 and Types.to_int(d[0]) == 2:
		var e = entities.get(Types.to_int(d[1]))
		return [2, e.ename if e != null else str(d[1])]
	return d


func _on_skill_xp(d: Array) -> void:
	var n := Types.to_int(d[0])
	for i in range(n):
		if d.size() > 2 + i * 2:
			data.set_skill_exp(Types.to_int(d[1 + i * 2]), Types.to_int(d[2 + i * 2]))


## WC_PLAYERINFO (stat dialog): exp values.
func _on_player_info(d: Array) -> void:
	var keys := ["base", "attack", "defense", "sword", "bow", "hammer", "axe", "logging", "mining"]
	if not (player.stats.get("exp") is Dictionary):
		player.stats["exp"] = {}
	for i in range(mini(keys.size(), d.size())):
		player.stats.exp[keys[i]] = Types.to_int(d[i])
	data.player_info_changed.emit()


## TOWN button / "/warp" (app.toggleWarp).
func warp_to_town() -> void:
	if started and map_status >= 2:
		teleport_maps(0)


func set_zoom(z: float) -> void:
	game_scale = BASE_SCALE / maxf(z, 0.1)
	camera.zoom = Vector2(game_scale, game_scale)
	map_renderer.clear_all()
	_send_screen_config()


## On-screen joystick direction (0 = released).
func joystick_direction(o: int) -> void:
	if player == null or not started:
		return
	if _joy_dir != 0 and _joy_dir != o:
		player.key_input(_joy_dir, false)
	_joy_dir = o
	if o != 0:
		player.key_input(o, true)


func _check_auto_potion() -> void:
	if auto_potion <= 0 or player == null or player.is_dead:
		return
	var hp := int(player.stats.get("hp", 0))
	var mx := maxi(1, int(player.stats.get("hpMax", 1)))
	if hp * 100 / mx >= auto_potion or actions.item_cooldown_left() > 0:
		return
	for r in data.inventory:
		if r != null and ItemTypes.is_healing_item(int(r.kind)):
			actions.use_item(0, int(r.slot))
			return


## Mouse hover: cursor shape and target preview (game/gamecursor.js).
func _update_hover(screen_pos: Vector2) -> void:
	var wp := screen_to_world(screen_pos)
	var e = get_entity_at(int(wp.x), int(wp.y))
	if e == player:
		e = null
	if e == _hover:
		return
	_hover = e
	var shape := "hand"
	if e is Mob or (e is Player and player.pvp_target == e):
		shape = "sword"
	elif e is Npc:
		shape = "talk"
	elif e is ItemEntity or (e is StaticEntity and e.type == Types.EntityType.NODE):
		shape = "loot"
	Cursors.set_shape(shape)
	if hud and not player.has_target():
		hud.set_target(e)


## Gamepad (gamepad/*.js): D-pad / left stick move, A interact,
## X target, B cancel, Y menu, L1/R1 + face buttons = shortcuts 1-6.
func _gamepad_input(event: InputEvent) -> bool:
	if event is InputEventJoypadMotion:
		if event.axis != JOY_AXIS_LEFT_X and event.axis != JOY_AXIS_LEFT_Y:
			return false
		var v := Vector2(Input.get_joy_axis(event.device, JOY_AXIS_LEFT_X), Input.get_joy_axis(event.device, JOY_AXIS_LEFT_Y))
		var o := 0
		if v.length() > 0.5:
			if absf(v.x) > absf(v.y):
				o = Types.Orientation.RIGHT if v.x > 0 else Types.Orientation.LEFT
			else:
				o = Types.Orientation.DOWN if v.y > 0 else Types.Orientation.UP
		if o != _pad_dir:
			if _pad_dir != 0:
				player.key_input(_pad_dir, false)
			_pad_dir = o
			if o != 0:
				player.key_input(o, true)
		return true
	if not (event is InputEventJoypadButton):
		return false
	var dpad := {JOY_BUTTON_DPAD_UP: Types.Orientation.UP, JOY_BUTTON_DPAD_DOWN: Types.Orientation.DOWN,
		JOY_BUTTON_DPAD_LEFT: Types.Orientation.LEFT, JOY_BUTTON_DPAD_RIGHT: Types.Orientation.RIGHT}
	if dpad.has(event.button_index):
		player.key_input(dpad[event.button_index], event.pressed)
		return true
	if not event.pressed:
		return false
	var l1 := Input.is_joy_button_pressed(event.device, JOY_BUTTON_LEFT_SHOULDER)
	var r1 := Input.is_joy_button_pressed(event.device, JOY_BUTTON_RIGHT_SHOULDER)
	var face := {JOY_BUTTON_A: 0, JOY_BUTTON_B: 1, JOY_BUTTON_X: 2, JOY_BUTTON_Y: 3}
	if (l1 or r1) and face.has(event.button_index):
		var slot: int = face[event.button_index] + (0 if l1 else 3)
		if slot < PlayerData.SHORTCUT_COUNT:
			actions.exec_shortcut(slot)
		return true
	match event.button_index:
		JOY_BUTTON_A:
			make_player_interact_next_to()
		JOY_BUTTON_X:
			player_target_closest_entity(1)
		JOY_BUTTON_Y:
			if hud:
				hud.toggle_window("inventory")
		JOY_BUTTON_START:
			if hud:
				hud.toggle_window("settings")
		JOY_BUTTON_BACK:
			if hud:
				hud.toggle_window("stats")
		_:
			return false
	return true
