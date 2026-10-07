extends "res://tests/npc_dialogue_test.gd"
## Health bars slide to new values (default 500 ms): the player HP bar, the
## target frame bar and the bars over entities' heads.
## Run: godot --headless res://tests/health_bar_test.tscn


func _ready() -> void:
	user = "hpbar1"
	pw = "secret1"
	super._ready()


func run() -> void:
	check("enter world", await until(func(): return world.started and world.map_status >= 2, 15000))
	var p: Player = world.player
	Config.set_setting("ui", "healthbarms", 500)
	await wait(1200)   # initial fill at login
	var bar: SmoothBar = hud._hp_bar
	var hp_max: int = int(p.stats.hpMax)
	check("player bar starts full", is_equal_approx(bar.value, hp_max), "%s / %d" % [bar.value, hp_max])
	# --------------------------------------------------- player HP bar
	var real_hp: int = int(p.stats.hp)
	p.stats.hp = hp_max / 2
	hud.update_bars(p)
	await wait(200)
	var mid := bar.value
	check("player bar mid-slide after 200 ms", mid < hp_max - 1 and mid > hp_max / 2 + 1, str(mid))
	await wait(450)
	check("player bar arrives by ~500 ms", absf(bar.value - hp_max / 2) < 0.5, str(bar.value))
	p.stats.hp = real_hp
	hud.update_bars(p)
	await wait(600)
	# --------------------------------------------------- target bar
	var mob = null
	for e in world.entities.values():
		if e is Mob:
			mob = e
			break
	check("found a mob", mob != null)
	if mob:
		var mmax: int = maxi(1, int(mob.stats.get("hpMax", 1)))
		mob.stats.hpMax = mmax
		mob.stats.hp = mmax
		hud.set_target(mob)
		check("new target snaps to its health", is_equal_approx(hud._target_bar.value, mmax), str(hud._target_bar.value))
		mob.stats.hp = mmax / 4
		hud.update_debug(world)
		await wait(200)
		var tv: float = hud._target_bar.value
		check("target bar mid-slide", tv < mmax and tv > mmax / 4.0, str(tv))
		await wait(450)
		check("target bar arrives", absf(hud._target_bar.value - int(mob.stats.hp)) < 0.5, str(hud._target_bar.value))
		# ----------------------------------------------- overhead bar
		var ov: Overlay = world.overlay
		ov._bars.erase(mob.id)
		var r0 := ov._smooth_ratio(mob.id, 1.0)
		var r1 := ov._smooth_ratio(mob.id, 0.25)
		await wait(200)
		var r2 := ov._smooth_ratio(mob.id, 0.25)
		await wait(450)
		var r3 := ov._smooth_ratio(mob.id, 0.25)
		check("overhead bar slides", r0 == 1.0 and r1 == 1.0 and r2 < 1.0 and r2 > 0.25 and absf(r3 - 0.25) < 0.001,
			"%.2f %.2f %.2f %.2f" % [r0, r1, r2, r3])
		mob.stats.hp = mmax
	# --------------------------------------------------- instant setting
	Config.set_setting("ui", "healthbarms", 0)
	p.stats.hp = hp_max / 2
	hud.update_bars(p)
	check("instant setting jumps", absf(bar.value - hp_max / 2) < 0.5, str(bar.value))
	p.stats.hp = real_hp
	hud.update_bars(p)
	Config.set_setting("ui", "healthbarms", 500)
	_report()
