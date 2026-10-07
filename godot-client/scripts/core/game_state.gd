extends Node
## Global session state (autoload "Game"). Holds references shared by the
## networking layer, the world and the UI, plus time helpers that mirror
## Utils.getTime()/getWorldTime() from the JS client.

signal log_message(text: String)

var user_client = null        # UserClient
var game_client = null        # GameClient
var world = null              # World node (scripts/world/world.gd)
var main = null               # Main scene controller

var username := ""
var hash_challenge := ""

var _world_time := 0
var _local_time := 0


## Milliseconds since the Unix epoch (Date.now()).
func unix_ms() -> int:
	return int(Time.get_unix_time_from_system() * 1000.0)


## Port of Utils.setWorldTime(localTime, remoteTime).
func set_world_time(local_time: int, remote_time: int) -> void:
	var diff := int((unix_ms() - local_time) / 2)
	_world_time = remote_time
	_local_time = local_time + diff


## Port of Utils.getWorldTime(). Falls back to local time before the first sync.
func world_time() -> int:
	if _world_time == 0:
		return unix_ms()
	return _world_time + (unix_ms() - _local_time)


## A cancellable setTimeout(). Returns a Delay whose cancel() stops the call.
func after(ms: int, callable: Callable) -> Delay:
	var d := Delay.new()
	d.callable = callable
	var t := get_tree().create_timer(maxf(ms, 0) / 1000.0, true, false, true)
	# NOTE: connect a lambda (it holds a reference to d); connecting d._fire
	# directly would not keep the RefCounted Delay alive.
	t.timeout.connect(func(): d._fire())
	return d


func log_debug(text: String) -> void:
	if Config.is_debug():
		print(text)
	log_message.emit(text)


class Delay:
	extends RefCounted
	var callable: Callable
	var cancelled := false

	func cancel() -> void:
		cancelled = true

	func _fire() -> void:
		if not cancelled and callable.is_valid():
			callable.call()
