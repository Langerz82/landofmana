class_name Transition
extends RefCounted
## Port of client/js/transition.js. Steps an entity one pixel at a time,
## |mod_value| times per game tick, until the update function returns true.

var in_progress := false
var mod_value := 0
var update_fn: Callable = Callable()
var stop_fn: Callable = Callable()
var obj = null


func _init(o = null) -> void:
	obj = o


func start(update_function: Callable, stop_function: Callable, value: int) -> void:
	update_fn = update_function
	stop_fn = stop_function
	mod_value = value
	in_progress = true


func step() -> void:
	if not in_progress or mod_value == 0 or not update_fn.is_valid():
		return
	var count := absi(mod_value)
	var m := 1 if mod_value > 0 else -1
	for _i in range(count):
		if not in_progress:
			stop()
			break
		if update_fn.call(obj, m):
			stop()
			break


func stop() -> void:
	if stop_fn.is_valid():
		stop_fn.call(obj)
	in_progress = false
