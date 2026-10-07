extends "res://tests/npc_dialogue_test.gd"
## Records every rendered frame while the player walks and fights rats, and
## reports frames where an entity's sprite suddenly turns (mostly) white.
## Run with a display: godot res://tests/flash_capture_test.tscn -- --shots=DIR

var frames := 0
var flagged: Array = []
var death_frames := 0


func _ready() -> void:
	user = "flashcap1"
	pw = "secret1"
	super._ready()


func _white_ratio(img: Image, r: Rect2i) -> float:
	r = r.intersection(Rect2i(Vector2i.ZERO, img.get_size()))
	if r.size.x <= 0 or r.size.y <= 0:
		return 0.0
	var white := 0
	var total := 0
	for yy in range(r.position.y, r.end.y, 2):
		for xx in range(r.position.x, r.end.x, 2):
			var c := img.get_pixel(xx, yy)
			total += 1
			if c.r > 0.93 and c.g > 0.93 and c.b > 0.93:
				white += 1
	return float(white) / maxf(1, total)


func _scan() -> void:
	await RenderingServer.frame_post_draw
	var img := get_viewport().get_texture().get_image()
	frames += 1
	var s: float = world.game_scale
	for e in world.entities.values():
		if not (e is Character) or not is_instance_valid(e) or e.hidden_by_area:
			continue
		for v in e._views:
			if v.visible and v.texture:
				var tr := Rect2(Vector2.ZERO, v.texture.get_size())
				if not tr.encloses(v.region_rect):
					flagged.append("frame %d %s id=%d region %s outside texture %s (sprite %s anim %s)" % [frames, e.ename, e.id, v.region_rect, tr.size, e.sprites[0].id if e.sprites[0] else "-", e.current_anim.anim_name if e.current_anim else "-"])
		if e.is_dying:
			death_frames += 1
			continue   # the death puff is white smoke on purpose (death.png)
		var c := world_to_screen(e.x, e.y)
		var r := Rect2i(int(c.x - 10 * s), int(c.y - 14 * s), int(20 * s), int(20 * s))
		var w := _white_ratio(img, r)
		if w > 0.25:
			var anim: String = e.current_anim.anim_name if e.current_anim else "-"
			var idx: int = e.current_anim.index if e.current_anim else -1
			var sp: String = e.sprites[0].id if e.sprites[0] else "-"
			flagged.append("frame %d %s id=%d sprite=%s anim=%s idx=%d white=%.2f dying=%s" % [frames, e.ename, e.id, sp, anim, idx, w, e.is_dying])
			if shots != "" and flagged.size() < 40:
				img.save_png("%s/flash_%04d_%d.png" % [shots, frames, e.id])


func run() -> void:
	check("enter world", await until(func(): return world.started and world.map_status >= 2, 15000))
	var p: Player = world.player
	var t := Time.get_ticks_msec()
	var last_cmd := 0
	while Time.get_ticks_msec() - t < 15000:
		await _scan()
		if Time.get_ticks_msec() - last_cmd > 1500 and not p.is_dead:
			last_cmd = Time.get_ticks_msec()
			if p.has_target() and is_instance_valid(p.target) and not p.target.is_dead:
				world.make_player_attack(p.target)
			else:
				world.player_target_closest_entity(1)
				if p.has_target():
					world.make_player_attack(p.target)
		if p.is_dead:
			world.respawn_player()
	print("frames scanned: ", frames)
	for f in flagged:
		print("  ", f)
	check("saw deaths", death_frames > 0, "%d death-smoke frames" % death_frames)
	check("no white flashes", flagged.is_empty(), "%d flagged" % flagged.size())
	_report()
