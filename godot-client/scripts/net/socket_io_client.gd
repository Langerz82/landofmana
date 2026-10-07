class_name SocketIOClient
extends Node
## Minimal Socket.IO v4 (Engine.IO v4) client over Godot's WebSocketPeer.
## Supports exactly what the Land of Mana servers use: the default namespace,
## the "message" event (socket.send / socket.on('message')), ping/pong.

signal connected
signal disconnected(reason: String)
signal connect_error(reason: String)
signal message_received(data: String)

const CONNECT_TIMEOUT_MS := 10000

var _ws := WebSocketPeer.new()
var _url := ""
var _open := false          # Engine.IO handshake received
var _sio_connected := false # Socket.IO namespace connected
var _closing := false
var _started_at := 0
var _active := false


func connect_to(http_url: String) -> Error:
	_url = http_url
	var ws_url := http_url
	if ws_url.begins_with("https://"):
		ws_url = "wss://" + ws_url.substr(8)
	elif ws_url.begins_with("http://"):
		ws_url = "ws://" + ws_url.substr(7)
	if not ws_url.ends_with("/"):
		ws_url += "/"
	ws_url += "socket.io/?EIO=4&transport=websocket"
	_ws = WebSocketPeer.new()
	_ws.inbound_buffer_size = 4 * 1024 * 1024
	_ws.outbound_buffer_size = 1024 * 1024
	_ws.max_queued_packets = 8192
	_open = false
	_sio_connected = false
	_closing = false
	_active = true
	_started_at = Time.get_ticks_msec()
	var err := _ws.connect_to_url(ws_url)
	if err != OK:
		_active = false
		connect_error.emit("Could not open %s (error %d)" % [ws_url, err])
	return err


func is_connected_to_server() -> bool:
	return _sio_connected


## Equivalent of socket.send(data) in the JS client.
func send_message(data: String) -> void:
	if not _sio_connected:
		return
	_ws.send_text("42" + JSON.stringify(["message", data]))


func disconnect_from_server() -> void:
	if not _active:
		return
	_closing = true
	if _ws.get_ready_state() == WebSocketPeer.STATE_OPEN:
		_ws.send_text("41")
		_ws.close(1000, "client disconnect")
	_sio_connected = false


func _process(_delta: float) -> void:
	if not _active:
		return
	_ws.poll()
	var state := _ws.get_ready_state()
	match state:
		WebSocketPeer.STATE_CONNECTING:
			if Time.get_ticks_msec() - _started_at > CONNECT_TIMEOUT_MS:
				_active = false
				_ws.close()
				connect_error.emit("timeout")
		WebSocketPeer.STATE_OPEN:
			while _ws.get_available_packet_count() > 0:
				var pkt := _ws.get_packet()
				_handle_packet(pkt.get_string_from_utf8())
		WebSocketPeer.STATE_CLOSED:
			_active = false
			var reason := _ws.get_close_reason()
			if reason == "":
				reason = "transport close"
			if _sio_connected or _open:
				_sio_connected = false
				disconnected.emit("io client disconnect" if _closing else reason)
			elif not _closing:
				connect_error.emit("connection failed (%d)" % _ws.get_close_code())


func _handle_packet(p: String) -> void:
	if p.is_empty():
		return
	var eio_type := p[0]
	match eio_type:
		"0": # open
			_open = true
			_ws.send_text("40")
		"1": # close
			_ws.close()
		"2": # ping -> pong
			_ws.send_text("3" + p.substr(1))
		"4": # message -> socket.io packet
			_handle_sio(p.substr(1))


func _handle_sio(p: String) -> void:
	if p.is_empty():
		return
	var sio_type := p[0]
	var rest := p.substr(1)
	match sio_type:
		"0": # CONNECT ack
			_sio_connected = true
			connected.emit()
		"1": # DISCONNECT
			_sio_connected = false
			_closing = true
			disconnected.emit("io server disconnect")
			_ws.close()
		"2": # EVENT
			# Optional namespace ("/nsp,") and ack id digits precede the JSON array.
			var i := 0
			if rest.begins_with("/"):
				i = rest.find(",") + 1
			while i < rest.length() and rest[i] >= "0" and rest[i] <= "9":
				i += 1
			var arr = JSON.parse_string(rest.substr(i))
			if arr is Array and arr.size() >= 2 and arr[0] == "message":
				message_received.emit(str(arr[1]))
		"4": # CONNECT_ERROR
			connect_error.emit(rest)
