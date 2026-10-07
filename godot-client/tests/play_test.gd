extends Node
## Headless gameplay test against running servers: logs in, enters the world,
## walks with the keyboard and by clicking, targets and attacks a mob, chats.
## Run: godot --headless res://tests/play_test.tscn -- --user=NAME --pass=PW

var uc: UserClient
var world: World
var hud: Hud
var user := "godottest"
var pw := "secretpass1"
var created := false
var t0 := 0
var phase := 0
var log_lines: Array = []
var start_pos := Vector2i.ZERO
var screenshot_dir := ""


func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--user="): user = a.substr(7)
		if a.begins_with("--pass="): pw = a.substr(7)
		if a.begins_with("--shots="): screenshot_dir = a.substr(8)
	uc = UserClient.new()
	add_child(uc)
	uc.error.connect(func(t): _fail("user error: " + t))
	uc.info.connect(func(code):
		if code == "invalidlogin" and not created:
			created = true
			uc.send_create_user(user, pw)
		else:
			_fail("info " + code))
	uc.ready_for_login.connect(func(): uc.send_login_user(user, pw))
	uc.players_received.connect(func(p):
		if p.is_empty(): uc.send_create_player(0, user.capitalize().replace(" ", ""))
		else: uc.send_login_player(0, p[0].index))
	uc.world_ready.connect(_enter)
	uc.connect_to_server()
	get_tree().create_timer(60.0).timeout.connect(func(): _fail("timeout in phase %d" % phase))


func _enter(info: Dictionary) -> void:
	world = World.new()
	add_child(world)
	var layer := CanvasLayer.new()
	add_child(layer)
	var ov := Overlay.new()
	ov.world = world
	layer.add_child(ov)
	world.overlay = ov
	hud = Hud.new()
	hud.world = world
	add_child(hud)
	world.hud = hud
	world.start(info)
	print("entering world as ", info.playername)


func _process(_d: float) -> void:
	if world == null or world.map_status < 2 or not world.started:
		return
	var p := world.player
	var now := Time.get_ticks_msec()
	match phase:
		0:
			print("IN WORLD map=", world.map_index, " pos=", p.x, ",", p.y, " entities=", world.entities.size(), " hp=", p.stats.hp, "/", p.stats.hpMax)
			start_pos = Vector2i(p.x, p.y)
			_shot("01_spawn")
			# keyboard move: press right for 600ms
			p.key_input(Types.Orientation.RIGHT, true)
			t0 = now
			phase = 1
		1:
			if now - t0 > 600:
				p.key_input(Types.Orientation.RIGHT, false)
				t0 = now
				phase = 2
		2:
			if now - t0 > 800:
				print("after key move pos=", p.x, ",", p.y, " (start ", start_pos, ") moving=", p.is_moving())
				# click move: 3 tiles down/left
				var tx := p.x - 48
				var ty := p.y + 48
				world.click(tx, ty)
				print("clicked ", tx, ",", ty, " path=", p.move_path)
				t0 = now
				phase = 3
		3:
			if now - t0 > 2500:
				print("after click move pos=", p.x, ",", p.y, " path=", p.move_path)
				_shot("02_moved")
				world.say("Hello from the Godot client!")
				# find nearest mob
				var best = null
				for e in world.entities.values():
					if e is Mob and not e.is_dead:
						if best == null or Types.real_distance(p.x, p.y, e.x, e.y) < Types.real_distance(p.x, p.y, best.x, best.y):
							best = e
				if best:
					print("attacking mob id=", best.id, " kind=", best.kind, " at ", best.x, ",", best.y, " hp=", best.stats.hp)
					world.click(best.x, best.y)
				t0 = now
				phase = 4
		4:
			if now - t0 > 8000:
				var t = p.target
				print("after attack: target=", (t.id if t else null), " target hp=", (t.stats.hp if t else -1), " player hp=", p.stats.hp, " pos=", p.x, ",", p.y, " infos=", world.infos.size())
				_shot("03_combat")
				var mobs := 0
				var players := 0
				var npcs := 0
				var items := 0
				for e in world.entities.values():
					if e is Mob: mobs += 1
					elif e is Player: players += 1
					elif e is Npc: npcs += 1
					elif e is ItemEntity: items += 1
				print("entities: mobs=", mobs, " players=", players, " npcs=", npcs, " items=", items)
				print("chat log:\n", hud._chat_lines)
				print("PLAY TEST DONE")
				get_tree().quit(0)


func _shot(n: String) -> void:
	if screenshot_dir == "":
		return
	await RenderingServer.frame_post_draw
	var img := get_viewport().get_texture().get_image()
	img.save_png(screenshot_dir + "/" + n + ".png")


func _fail(msg: String) -> void:
	print("FAIL: ", msg)
	get_tree().quit(1)
