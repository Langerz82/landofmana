class_name UserClient
extends Node
## Port of client/js/userclient/*.js - talks to the user (login) server.
## Flow: connect -> UC_VERSION(hash challenge) + UC_WORLDS -> login/register
## -> UC_PLAYER_SUM -> login/create player -> UC_WORLD_READY(game server info).

signal status(text: String)
signal error(text: String)
signal ready_for_login
signal worlds_received(worlds: Array)        # [{index, name, count, max}]
signal players_received(players: Array)      # [{index, name, exp, level, colors, sprites}]
signal world_ready(info: Dictionary)         # {username, playername, hash, url}
signal info(code: String)                    # UC_ERROR codes shown inline

var sio: SocketIOClient
var intentional_disconnect := false
var version_checked := false
var players: Array = []
var worlds: Array = []


func _ready() -> void:
	sio = SocketIOClient.new()
	sio.name = "UserSocket"
	add_child(sio)
	sio.connected.connect(_on_connected)
	sio.disconnected.connect(_on_disconnected)
	sio.connect_error.connect(_on_connect_error)
	sio.message_received.connect(_on_message)


func connect_to_server() -> void:
	var url := Config.user_server_url()
	status.emit("Connecting to %s ..." % url)
	sio.connect_to(url)


func close() -> void:
	intentional_disconnect = true
	sio.disconnect_from_server()


func send(packet: Array) -> void:
	if Config.log_packets:
		print("[user] send ", JSON.stringify(packet))
	sio.send_message(PacketCodec.encode(packet))


# ---------------------------------------------------------------- sending

func send_login_user(username: String, password: String) -> void:
	Game.username = username.to_lower()
	send([Types.UserMessages.CU_LOGIN_USER, Game.username,
		CryptoJSCompat.make_login_hash(Game.username, password, Game.hash_challenge)])


func send_create_user(username: String, password: String) -> void:
	Game.username = username.to_lower()
	send([Types.UserMessages.CU_CREATE_USER, Game.username,
		CryptoJSCompat.make_login_hash(Game.username, password, Game.hash_challenge)])


func send_login_player(world_index: int, player_index: int) -> void:
	send([Types.UserMessages.CU_LOGIN_PLAYER, world_index, player_index])


func send_create_player(world_index: int, player_name: String) -> void:
	send([Types.UserMessages.CU_CREATE_PLAYER, world_index, player_name])


# ---------------------------------------------------------------- receiving

func _on_connected() -> void:
	status.emit("Connected. Handshaking...")
	send([Types.UserMessages.CU_CONNECT_USER])


func _on_connect_error(reason: String) -> void:
	error.emit(GameData.tr_lang("CONNECT_ERROR") + "\n(" + reason + ")")


func _on_disconnected(reason: String) -> void:
	if intentional_disconnect:
		return
	error.emit(Types.format(GameData.tr_lang("DISCONNECT_SERVER_REASON"), [reason]))


func _on_message(data: String) -> void:
	if Config.log_packets:
		print("[user] recv ", data.left(300))
	for action in PacketCodec.decode(data):
		_receive_action(action)


func _receive_action(data: Array) -> void:
	var action := Types.to_int(data.pop_front())
	match action:
		Types.UserMessages.UC_VERSION:
			_on_version(data)
		Types.UserMessages.UC_WORLDS:
			_on_worlds(data)
		Types.UserMessages.UC_PLAYER_SUM:
			_on_player_summary(data)
		Types.UserMessages.UC_WORLD_READY:
			_on_world_ready(data)
		Types.UserMessages.UC_ERROR:
			_on_error(data)
		Types.Messages.BI_SYNCTIME:
			Game.set_world_time(Types.to_int(data[0]), Types.to_int(data[1]))
		_:
			push_warning("UserClient: unknown action %d" % action)


func _on_version(data: Array) -> void:
	version_checked = true
	var server_version := Types.to_int(data[0])
	Game.hash_challenge = str(data[1])
	if server_version != Config.get_version():
		error.emit("Client version %d does not match server version %d.\nPlease update the client." % [Config.get_version(), server_version])
		return
	status.emit("Ready.")
	ready_for_login.emit()


func _on_worlds(data: Array) -> void:
	worlds.clear()
	var i := 0
	while i + 3 < data.size():
		worlds.append({
			"index": Types.to_int(data[i]),
			"name": str(data[i + 1]),
			"count": Types.to_int(data[i + 2]),
			"max": Types.to_int(data[i + 3]),
		})
		i += 4
	worlds_received.emit(worlds)


func _on_player_summary(data: Array) -> void:
	players.clear()
	var count := Types.to_int(data[0])
	for i in range(count):
		var j := 1 + i * 7
		if j + 6 >= data.size():
			break
		var xp := Types.to_int(data[j + 2])
		players.append({
			"index": Types.to_int(data[j]),
			"name": str(data[j + 1]),
			"exp": xp,
			"level": Types.get_level(xp),
			"colors": [data[j + 3], data[j + 4]],
			"sprites": [Types.to_int(data[j + 5]), Types.to_int(data[j + 6])],
		})
	players_received.emit(players)


func _on_world_ready(data: Array) -> void:
	var info_d := {
		"username": str(data[0]),
		"playername": str(data[1]),
		"hash": str(data[2]),
		"url": "%s://%s:%s/" % [str(data[3]), str(data[4]), Types.to_str(data[5])],
	}
	intentional_disconnect = true
	sio.disconnect_from_server()
	world_ready.emit(info_d)


func _on_error(data: Array) -> void:
	var code := str(data[0]) if data.size() > 0 else "unknown"
	match code:
		"full", "noserver", "invalidlogin", "userexists", "playerexists", \
		"loggedin", "invalidusername", "invalidname", "ban", "passwordChanged", "timeout":
			info.emit(code)
		_:
			error.emit(GameData.tr_lang(code))
