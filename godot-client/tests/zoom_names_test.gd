extends "res://tests/npc_dialogue_test.gd"
## Entity names over the world scale with the Zoom setting, in proportion to
## the sprites (normal size at the "Normal" zoom), picked through Settings.
## Run: godot res://tests/zoom_names_test.tscn [-- --shots=DIR]


## The pixels of the player's name over the world.
func name_pixels() -> Image:
	await RenderingServer.frame_post_draw
	var p = world.player
	var sp: Vector2 = world.get_canvas_transform() * Vector2(p.x, p.y)
	var y: float = sp.y - Types.G_TILESIZE * world.game_scale
	var h: int = world.overlay.name_size()
	var img := get_viewport().get_texture().get_image()
	return img.get_region(Rect2i(int(sp.x) - 60, int(y) - h, 120, int(h * 1.6)))


func run() -> void:
	check("enter world", await until(func(): return world.started and world.map_status >= 2, 15000))
	await wait(600)
	var ov = world.overlay
	var saved = Config.get_setting("ui", "gamezoom", World.DEFAULT_ZOOM)
	var sw = hud.window("settings")
	sw.open()
	await wait(200)
	var zoom_opt: OptionButton = null
	for c in sw.find_children("*", "OptionButton", true, false):
		if c.get_item_text(0) == "Closest":
			zoom_opt = c
	check("zoom option in settings", zoom_opt != null)
	sw.close()
	var normal := -1
	for i in range(SettingsWindow.ZOOMS.size()):
		zoom_opt.select(i)
		zoom_opt.item_selected.emit(i)
		await wait(400)
		var z: float = SettingsWindow.ZOOMS[i][1]
		var expect := maxi(ov.NAME_MIN_SIZE, roundi(UiStyle.fs(ov.NAME_SIZE) * World.DEFAULT_ZOOM / z))
		check("zoom %s (%.1f): name size %d" % [SettingsWindow.ZOOMS[i][0], z, ov.name_size()], ov.name_size() == expect, "expected %d" % expect)
		if is_equal_approx(z, World.DEFAULT_ZOOM):
			normal = ov.name_size()
		await shot("zoom_names_%s" % SettingsWindow.ZOOMS[i][0])
	check("Normal zoom keeps the normal size", normal == UiStyle.fs(ov.NAME_SIZE), str(normal))
	# Proportion: name size / world scale is the same at every zoom (until the minimum).
	var ratios := []
	for z in [0.4, 0.6, 0.8]:
		world.set_zoom(z)
		await get_tree().process_frame
		ratios.append(ov.name_size() / world.game_scale)
	check("names in proportion to the sprites", absf(ratios[0] - ratios[2]) < 0.35 and absf(ratios[1] - ratios[2]) < 0.35, str(ratios))
	check("default zoom matches Settings' Normal", is_equal_approx(World.DEFAULT_ZOOM, 0.8))
	# Zooming out and back must not corrupt the name text (glyph caches):
	# the player's name looks exactly the same before and after.
	check("world text uses its own MSDF font", ov.KOMIKA is FontFile and ov.KOMIKA.multichannel_signed_distance_field and ov.KOMIKA != load("res://assets/fonts/KOMIKAH.ttf"))
	var hk = UiStyle.hud_font(load("res://assets/fonts/KOMIKAH.ttf"))
	check("HUD font copy has its own glyph cache", hk != ov.KOMIKA and hk is FontFile and hk.get_cache_count() != -1)
	UiStyle.ui_scale = 1.25
	hud.apply_ui_scale()
	world.set_zoom(World.DEFAULT_ZOOM)
	await wait(500)
	var before := await name_pixels()
	for z in [1.2, 1.0, 0.6, 0.4, 0.8, 1.2, 1.0]:
		world.set_zoom(z)
		await wait(250)
	world.set_zoom(World.DEFAULT_ZOOM)
	await wait(500)
	var same := false
	for attempt in range(4):   # a wandering mob can cross the name: retry
		var after := await name_pixels()
		if after.get_data() == before.get_data():
			same = true
			break
		before = after if attempt == 1 else before
		await wait(700)
	check("player name unchanged after zooming out and back", same)
	await shot("zoom_names_after_cycle")
	UiStyle.ui_scale = 1.0
	hud.apply_ui_scale()
	Config.set_setting("ui", "gamezoom", saved)
	world.set_zoom(float(saved))
	_report()
