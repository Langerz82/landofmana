class_name AnimState
extends RefCounted
## Port of client/js/animation.js - frame stepping for one sprite animation.

var anim_name := ""
var length := 1
var col := 0
var row := 0
var width := 16
var height := 16
var speed := 100
var count := 0
var end_callback: Callable = Callable()
var last_time := 0
var index := 0


static func from_def(n: String, def: Dictionary, w: int, h: int) -> AnimState:
	var a := AnimState.new()
	a.anim_name = n
	a.length = maxi(1, int(def.get("length", 1)))
	a.col = int(def.get("col", 0))
	a.row = int(def.get("row", 0))
	a.width = w
	a.height = h
	return a


func reset() -> void:
	last_time = 0
	index = 0


func set_count(c: int, on_end: Callable) -> void:
	count = c
	end_callback = on_end


func tick() -> void:
	var i := (index + 1) % length
	if count > 0 and i == 0:
		count -= 1
		if count == 0:
			index = 0
			if end_callback.is_valid():
				end_callback.call()
			return
	index = i


func update(time: int) -> bool:
	if last_time == 0 and anim_name.begins_with("atk"):
		last_time = time
	if time - last_time > speed:
		last_time = time
		tick()
		return true
	return false


## Frame column in the sheet (animation col offset + current frame).
func frame_col() -> int:
	return col + index
