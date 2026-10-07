extends "res://tests/play_test.gd"
## Exercises the local death -> "You have died" -> respawn code path
## (the death is simulated client side; the server ignores the revive).

func _process(_d: float) -> void:
	if world == null or world.map_status < 2 or not world.started:
		return
	var p := world.player
	var now := Time.get_ticks_msec()
	match phase:
		0:
			world._on_change_points([p.id, 0, p.stats.hpMax, -p.stats.hpMax, 0, p.stats.epMax, 0, 0])
			print("dying=", p.is_dying, " anim=", p.current_anim.anim_name if p.current_anim else "")
			t0 = now
			phase = 1
		1:
			if hud._died_panel.visible:
				print("died window shown after ", now - t0, "ms; is_dead=", p.is_dead)
				hud._died_panel.visible = false
				world.respawn_player()
				t0 = now
				phase = 2
			elif now - t0 > 5000:
				_fail("died window never shown")
		2:
			if now - t0 > 500:
				print("after respawn: dead=", p.is_dead, " dying=", p.is_dying, " hp=", p.stats.hp, " sprite=", p.sprites[0].id, " anim=", p.current_anim.anim_name)
				p.key_input(Types.Orientation.LEFT, true)
				t0 = now
				phase = 3
		3:
			if now - t0 > 400:
				p.key_input(Types.Orientation.LEFT, false)
				print("can still move: pos=", p.x, ",", p.y)
				print("DEATH TEST DONE")
				get_tree().quit(0)
