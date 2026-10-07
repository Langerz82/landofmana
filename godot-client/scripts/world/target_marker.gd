class_name TargetMarker
extends Node2D
## The green square around the player's target (rendererdrawentities.js
## drawEntityTile). Drawn in world space on the ground, above the map's
## background layers (z -20..-15) and below every entity (z 0), so the
## target's sprite covers it instead of the square being painted on top.

const TS := Types.G_TILESIZE
const COLOR := Color(0, 1, 0, 0.6)

var world = null


func _init() -> void:
	z_index = -1
	name = "TargetMarker"


func _draw() -> void:
	if world == null or world.player == null:
		return
	var p = world.player
	if not (p.has_target() and is_instance_valid(p.target)) or p.target.hidden_by_area or p.target.is_dead:
		return
	var t = p.target
	var half := TS * 0.5
	# 2 screen pixels wide whatever the zoom, like the old overlay version.
	var width := 2.0 / maxf(world.game_scale, 0.01)
	draw_rect(Rect2(Vector2(t.x, t.y) - Vector2(half, half), Vector2(TS, TS)), COLOR, false, width)
