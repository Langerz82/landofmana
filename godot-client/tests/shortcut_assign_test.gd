extends "res://tests/npc_dialogue_test.gd"
## Select a skill (skills window) or an item (inventory), then click a
## shortcut slot: the slot gets that skill / item type. Uses real mouse clicks.
## The character needs a consumable (it buys a Flask if it has 100+ gold).
## Run: godot res://tests/shortcut_assign_test.tscn [-- --user=NAME --pass=PW]


func click_ctrl(c: Control) -> void:
	await mouse_click(c.get_global_rect().get_center())
	await wait(150)


func consumable_slot() -> int:
	for i in range(world.data.inventory.size()):
		var r = world.data.inventory[i]
		if r != null and ItemTypes.is_consumable(int(r.kind)):
			return i
	return -1


func run() -> void:
	var data: PlayerData = world.data if world else null
	check("enter world", await until(func(): return world.started and world.map_status >= 2, 15000))
	data = world.data
	await wait(800)
	var bar: ShortcutBar = hud.shortcut_bar
	# --------------------------------------------- skill -> shortcut 3
	var sw: SkillsWindow = hud.window("skills")
	sw.open()
	await wait(300)
	var skill := -1
	for i in range(sw.slots.size()):
		if data.skill_level_of(i) > 0:
			skill = i
			break
	check("has a learned skill", skill >= 0)
	if skill >= 0:
		await click_ctrl(sw.slots[skill])
		check("skill selected", sw._selected == skill)
		await click_ctrl(bar.slots[2])
		var sc: Dictionary = data.shortcuts[2]
		check("skill assigned to shortcut 3", int(sc.type) == 2 and int(sc.id) == skill, str(sc))
		check("skill selection cleared", sw._selected == -1)
	sw.close()
	# --------------------------------------------- item -> shortcut 4
	if consumable_slot() < 0 and int(data.gold[0]) >= 100:
		world.actions.buy(1, 34)   # Flask +500 HP from the beginner shop list
		await until(func(): return consumable_slot() >= 0, 4000)
	var cs := consumable_slot()
	check("has a consumable", cs >= 0, "gold %d" % data.gold[0])
	var inv: InventoryWindow = hud.window("inventory")
	inv.open()
	await wait(300)
	if cs >= 0:
		var kind := int(data.inventory[cs].kind)
		await click_ctrl(inv.inv_slots[cs])
		check("item selected", inv.sel_slot == cs)
		await click_ctrl(bar.slots[3])
		var sc4: Dictionary = data.shortcuts[3]
		check("item type assigned to shortcut 4", int(sc4.type) == 1 and int(sc4.id) == kind, str(sc4))
		check("item selection cleared", inv.sel_slot == -1)
		check("item not used by the click", data.item_total_count(kind) > 0)
	# --------------------------------------------- non-consumable is refused
	var other := -1
	for i in range(data.inventory.size()):
		var r = data.inventory[i]
		if r != null and not ItemTypes.is_consumable(int(r.kind)):
			other = i
			break
	if other >= 0:
		var before: Dictionary = data.shortcuts[4].duplicate()
		await click_ctrl(inv.inv_slots[other])
		await click_ctrl(bar.slots[4])
		check("equipment not assigned", data.shortcuts[4] == before, str(data.shortcuts[4]))
	# --------------------------------------------- newest selection wins
	if skill >= 0 and cs >= 0:
		sw.open()
		await wait(200)
		await click_ctrl(inv.inv_slots[cs])
		await click_ctrl(sw.slots[skill])     # skill picked after the item
		await click_ctrl(bar.slots[5])
		check("most recent pick wins", int(data.shortcuts[5].type) == 2, str(data.shortcuts[5]))
		inv._deselect()
	# --------------------------------------------- plain click still runs it
	inv.close()
	sw.close()
	await wait(200)
	await click_ctrl(bar.slots[2])
	check("with nothing selected the click keeps the shortcut", int(data.shortcuts[2].type) == 2)
	await shot("shortcut_assign")
	_report()
