extends "res://tests/play_test.gd"
## Logs every other player's position once per second (for multi-client checks).

var last_print := 0
var started_at := 0

func _process(_d: float) -> void:
	if world == null or world.map_status < 2 or not world.started:
		return
	var now := Time.get_ticks_msec()
	if started_at == 0:
		started_at = now
	if now - last_print > 1000:
		last_print = now
		for e in world.entities.values():
			if e is Player and e != world.player:
				print("OBS t=", Game.unix_ms() % 100000, " ", e.ename, " at ", e.x, ",", e.y, " key_move=", e.key_move, " moving=", e.is_moving(), " path=", e.move_path)
	if now - started_at > 16000:
		get_tree().quit(0)
