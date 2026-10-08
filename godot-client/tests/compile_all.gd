extends Node
## Loads every script in the project so parse/compile errors show up.
## Run: godot --headless res://tests/compile_all.tscn

func _ready() -> void:
	var bad := 0
	for f in _scan("res://scripts"):
		var s = load(f)
		if s == null or not (s is Script) or not s.can_instantiate():
			print("FAILED: ", f)
			bad += 1
	print("compile_all: %d failures" % bad)
	get_tree().quit(1 if bad > 0 else 0)


func _scan(dir: String) -> Array:
	var out: Array = []
	var d := DirAccess.open(dir)
	for f in d.get_files():
		if f.ends_with(".gd"):
			out.append(dir + "/" + f)
	for sub in d.get_directories():
		out += _scan(dir + "/" + sub)
	return out
