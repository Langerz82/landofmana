extends "res://tests/npc_dialogue_test.gd"
## Colours, font size and UI scale live in their own "UI Settings" window,
## opened with the "UI Settings" button in Settings (real mouse clicks).
## Run: godot res://tests/ui_settings_window_test.tscn [-- --shots=DIR]


func button(w: Node, text: String) -> Button:
	for b in w.find_children("*", "Button", true, false):
		if b.text == text:
			return b
	return null


func run() -> void:
	check("enter world", await until(func(): return world.started and world.map_status >= 2, 15000))
	await wait(500)
	var sw: GameWindow = hud.window("settings")
	var uw: GameWindow = hud.window("uisettings")
	check("UI Settings window exists", uw != null and uw is UiSettingsWindow)
	sw.open()
	await wait(300)
	check("settings has no colour pickers", sw.find_children("*", "ColorPickerButton", true, false).is_empty())
	check("settings has no font size / UI scale", sw.find_children("*", "SpinBox", true, false).is_empty())
	check("settings still has zoom and shortcuts, no health bars", sw.find_children("*", "OptionButton", true, false).size() == 2)
	var b := button(sw, "UI Settings")
	check("settings has a UI Settings button", b != null)
	await shot("settings_window")
	await mouse_click(b.get_global_rect().get_center())
	await wait(300)
	check("click opens UI Settings", uw.visible)
	check("settings closes", not sw.visible)
	check("title", uw._title_label.text == "UI SETTINGS", uw._title_label.text)
	check("4 colour pickers", uw.find_children("*", "ColorPickerButton", true, false).size() == 4)
	var spins := uw.find_children("*", "SpinBox", true, false)
	check("font size and UI scale", spins.size() == 2 and spins[0].tooltip_text.begins_with("1 = normal size") and spins[1].tooltip_text.begins_with("Size of the whole"))
	check("reset colours button", button(uw, "Reset colours") != null)
	var hbo: Array = uw.find_children("*", "OptionButton", true, false)
	check("health bars in UI Settings", hbo.size() == 1 and hbo[0].get_item_text(0) == "Instant")
	var order: Array = []
	for r in uw.content.get_children():
		if r is HBoxContainer:
			order.append(r.get_child(0).text)
	check("order: font size, UI scale, health bars, then colours at the bottom", order == ["Font size", "UI scale", "Health bars", "Menu color", "Button color", "Panel border", "Panel background"], str(order))
	var hs := int(Config.get_setting("ui", "healthbarms", 500))
	hbo[0].select(3)
	hbo[0].item_selected.emit(3)
	check("health bar speed saved from here", SmoothBar.duration_ms() == 1000)
	Config.set_setting("ui", "healthbarms", hs)
	var vp := get_viewport().get_visible_rect().size
	var c := uw.get_global_rect().get_center()
	check("UI Settings centred", absf(c.x - vp.x / 2) < 2, str(uw.get_global_rect()))
	await shot("ui_settings_window")
	# A change still applies right away.
	var old_fs := UiStyle.font_scale
	spins[0].value = 1.5
	await wait(200)
	check("font size works from here", is_equal_approx(UiStyle.font_scale, 1.5))
	spins[0].value = old_fs
	await wait(200)
	await mouse_click(button(uw, "Back to Settings").get_global_rect().get_center())
	await wait(300)
	check("Back returns to Settings", sw.visible and not uw.visible)
	sw.close()
	_report()
