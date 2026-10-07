class_name GameClient
extends Node
## Port of client/js/gameclient/*.js - talks to the game (world) server.
## Incoming actions are dispatched to Callables registered with on().

signal connected
signal disconnected(reason: String)
signal server_error(text: String)

var sio: SocketIOClient
var handlers: Dictionary = {}   # action id -> Callable(data: Array)
var _login: Array = []
var disconnect_reason := ""
var listening := true


func _ready() -> void:
	sio = SocketIOClient.new()
	sio.name = "GameSocket"
	add_child(sio)
	sio.connected.connect(_on_connected)
	sio.disconnected.connect(_on_disconnected)
	sio.connect_error.connect(func(r): disconnected.emit("Could not connect to the game server (%s)" % r))
	sio.message_received.connect(_on_message)
	on(Types.Messages.BI_SYNCTIME, func(d): Game.set_world_time(Types.to_int(d[0]), Types.to_int(d[1])))
	on(Types.Messages.WC_ERROR, _on_server_error)


func on(action: int, callable: Callable) -> void:
	handlers[action] = callable


func connect_to_server(url: String, playername: String, player_hash: String) -> void:
	_login = [playername, player_hash]
	sio.connect_to(url)


func close() -> void:
	listening = false
	sio.disconnect_from_server()


func send(packet: Array) -> void:
	if not sio.is_connected_to_server():
		return
	if Config.log_packets:
		print("[game] send ", JSON.stringify(packet))
	sio.send_message(PacketCodec.encode(packet))


func _on_connected() -> void:
	send_login_player(_login[0], _login[1])
	send_sync_time(Game.unix_ms())
	connected.emit()


func _on_disconnected(reason: String) -> void:
	if disconnect_reason != "":
		var r := disconnect_reason
		disconnect_reason = ""
		disconnected.emit(r)
		return
	disconnected.emit(Types.format(GameData.tr_lang("DISCONNECT_SERVER_REASON"), [reason]))


func _on_server_error(data: Array) -> void:
	var code := str(data[0]) if data.size() > 0 else ""
	var msg := GameData.tr_lang(code)
	disconnect_reason = msg
	server_error.emit(msg)


func _on_message(data: String) -> void:
	if not listening:
		return
	if Config.log_packets:
		print("[game] recv ", data.left(300))
	for action in PacketCodec.decode(data):
		_receive_action(action)


func _receive_action(data: Array) -> void:
	if data.is_empty():
		return
	var action := Types.to_int(data.pop_front())
	var h: Callable = handlers.get(action, Callable())
	if h.is_valid():
		h.call(data)
	elif Config.log_packets:
		print("[game] unhandled action ", action)


# ------------------------------------------------------------------ senders
# Port of gameclient/gameclientsend.js (only what the core client needs,
# plus a few simple extras so future UI passes can reuse them).

func send_sync_time(date: int) -> void:
	send([Types.Messages.BI_SYNCTIME, date])


func send_login_player(playername: String, player_hash: String) -> void:
	send([Types.Messages.CW_LOGIN_PLAYER, playername, player_hash])


func send_move_entity(entity, action: int) -> void:
	send([Types.Messages.CW_MOVE, Game.world_time(), entity.id, action,
		entity.orientation, entity.x, entity.y])


func send_move_path(entity, path: Array) -> void:
	var simple: Array = []
	for n in path:
		simple.append([int(n[0]), int(n[1])])
	send([Types.Messages.CW_MOVEPATH, Game.world_time(), entity.id,
		Types.orientation_between(path[0][0], path[0][1], path[1][0], path[1][1]),
		1 if entity.interrupted else 0, simple])


func send_attack(player, target, skill_id: int) -> void:
	send([Types.Messages.CW_ATTACK, Game.world_time(), target.id, player.orientation, skill_id])


func send_chat(text: String) -> void:
	send([Types.Messages.CW_CHAT, text])


func send_teleport_map(map_id: int, status: int, x: int, y: int, portal_id: int) -> void:
	send([Types.Messages.CW_TELEPORT_MAP, map_id, status, x, y, portal_id])


func send_who(ids: Array) -> void:
	send([Types.Messages.CW_WHO, ids])


func send_who_request() -> void:
	send([Types.Messages.CW_REQUEST, 3])


func send_player_revive() -> void:
	send([Types.Messages.CW_REQUEST, 1])


func send_talk_to_npc(type: int, npc_id: int) -> void:
	send([Types.Messages.CW_TALKTONPC, type, npc_id])


func send_quest(entity_id: int, quest_id: int, status: int) -> void:
	send([Types.Messages.CW_QUEST, entity_id, quest_id, status])


func send_loot_move(item) -> void:
	send([Types.Messages.CW_LOOT, item.id, item.x, item.y])


func send_harvest(x: int, y: int) -> void:
	send([Types.Messages.CW_HARVEST, x, y])


func send_harvest_entity(entity) -> void:
	send([Types.Messages.CW_USE_NODE, entity.id])


func send_config(arr: Array) -> void:
	send([Types.Messages.CW_CONFIG, arr])


func send_item_slot(data: Array) -> void:
	send([Types.Messages.CW_ITEMSLOT] + data)


func send_add_stat(stat_type: int, points: int) -> void:
	send([Types.Messages.CW_STATADD, stat_type, points])
