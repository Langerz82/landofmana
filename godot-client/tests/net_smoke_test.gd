extends Node
## Headless integration test: register/login a user, create/login a player and
## enter the world on a running userserver + gameserver.
## Run: godot --headless res://tests/net_smoke_test.tscn -- --user=NAME --pass=PW

var uc: UserClient
var gc: GameClient
var user := "godottest"
var pw := "secretpass1"
var created_user := false
var got_player := false
var teleport_states: Array = []
var spawns := 0


func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--user="): user = a.substr(7)
		if a.begins_with("--pass="): pw = a.substr(7)
	# Crypto self test (round trip)
	var enc := CryptoJSCompat.aes_encrypt("\"abc\"", "challenge")
	assert(CryptoJSCompat.aes_decrypt(enc, "challenge") == "\"abc\"")
	print("crypto roundtrip ok: ", enc)
	print("login hash len: ", CryptoJSCompat.make_login_hash("a", "b", "c").length())
	uc = UserClient.new()
	add_child(uc)
	uc.status.connect(func(t): print("[status] ", t))
	uc.error.connect(func(t): print("[ERROR] ", t); _finish(1))
	uc.info.connect(_on_info)
	uc.ready_for_login.connect(func(): uc.send_login_user(user, pw))
	uc.worlds_received.connect(func(w): print("[worlds] ", w))
	uc.players_received.connect(_on_players)
	uc.world_ready.connect(_on_world_ready)
	uc.connect_to_server()
	get_tree().create_timer(25.0).timeout.connect(func(): print("TIMEOUT"); _finish(2))


func _on_info(code: String) -> void:
	print("[info] ", code)
	if code == "invalidlogin" and not created_user:
		created_user = true
		uc.send_create_user(user, pw)


func _on_players(players: Array) -> void:
	print("[players] ", players)
	if players.is_empty():
		uc.send_create_player(0, user.capitalize().replace(" ", ""))
	else:
		uc.send_login_player(0, players[0].index)


func _on_world_ready(info: Dictionary) -> void:
	print("[world_ready] ", info)
	gc = GameClient.new()
	add_child(gc)
	gc.disconnected.connect(func(r): print("[game disconnected] ", r))
	gc.on(Types.Messages.WC_PLAYER, func(d):
		got_player = true
		print("[WC_PLAYER] id=", d[2], " name=", d[3], " map=", d[4], " pos=", d[5], ",", d[6])
		gc.send_teleport_map(1, 0, -1, -1, -1))
	gc.on(Types.Messages.WC_TELEPORT_MAP, func(d):
		print("[WC_TELEPORT_MAP] ", d)
		teleport_states.append(int(d[1]))
		if int(d[1]) == 1:
			gc.send_teleport_map(int(d[0]), 1, int(d[2]), int(d[3]), -1)
		elif int(d[1]) == 2:
			get_tree().create_timer(2.0).timeout.connect(func(): _finish(0)))
	gc.on(Types.Messages.WC_SPAWN, func(d): spawns += 1)
	gc.connect_to_server(info.url, info.playername, info.hash)


func _finish(code: int) -> void:
	print("RESULT got_player=", got_player, " teleport=", teleport_states, " spawns=", spawns)
	get_tree().quit(code)
