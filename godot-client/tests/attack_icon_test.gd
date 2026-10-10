extends "res://tests/npc_dialogue_test.gd"
## The shortcut bar's attack button shows the sword icon (img/3/misc/sword.png)
## and still attacks / interacts when clicked.
## Run: godot res://tests/attack_icon_test.tscn [-- --shots=DIR]


func run() -> void:
	check("enter world", await until(func(): return world.started and world.map_status >= 2, 15000))
	await wait(500)
	var b: ItemSlot = hud.shortcut_bar._attack
	var slot1: ItemSlot = hud.shortcut_bar.slots[0]
	check("attack button has the sword icon", b.icon != null and b.icon.resource_path.ends_with("img/3/misc/sword.png"), str(b.icon))
	check("same background as the shortcut slots", b.background is AtlasTexture and slot1.background is AtlasTexture and b.background.region == slot1.background.region, "%s %s" % [b.background.region, slot1.background.region])
	check("same size as a shortcut slot", b.size == slot1.size, "%s %s" % [b.size, slot1.size])
	check("sword drawn at its own size, centred", b.icon_native and b.icon.get_size().x <= b.size.x)
	check("plain slots use the empty cell (no sword watermark)", slot1.background.region == UiStyle.plain_slot_background().region and UiStyle.plain_slot_background().region.position != Vector2.ZERO)
	check("attack slot cannot be dragged", not b.draggable and b._get_drag_data(Vector2.ZERO) == null)
	for st in ["horizontal-asc", "vertical-asc"]:
		Config.set_setting("ui", "shortcutstyle", st)
		hud.apply_shortcut_style()
		await wait(200)
		check("%s: sword icon kept" % st, hud.shortcut_bar._attack.icon == b.icon)
		await shot("attack_icon_" + st)
	Config.set_setting("ui", "shortcutstyle", "horizontal-asc")
	hud.apply_shortcut_style()
	var called := [false]
	b.pressed.connect(func(_s): called[0] = true)
	await wait(200)
	await mouse_click(b.get_global_rect().get_center())
	await wait(100)
	check("clicking it still attacks / interacts", called[0])
	_report()
