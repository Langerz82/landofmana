class_name GTimer
extends RefCounted
## Port of client/js/timer.js. NOTE: is_over() restarts the timer when it
## returns true, exactly like the JS version (callers rely on that).

var duration := 0
var last_time := 0


func _init(d: int = 0, start_time: int = 0) -> void:
	duration = d
	restart(start_time)


static func now() -> int:
	return Time.get_ticks_msec()


func restart(start_time: int = 0) -> void:
	last_time = start_time if start_time != 0 else now()


func is_over(time: int = 0) -> bool:
	if time == 0:
		time = now()
	if last_time == 0 or time - last_time > duration:
		last_time = time
		return true
	return false


func get_ratio(time: int) -> float:
	return minf(float(time - last_time) / maxf(duration, 1), 1.0)
