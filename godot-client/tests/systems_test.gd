extends Node
## End-to-end test of the ported game systems against running servers:
## shops, inventory, equipment, drop/loot, bank, gold, enchant, repair,
## auction, craft, looks, stats, skills, shortcuts, quests, achievements,
## settings. The account needs some gold (see README "Tests").
## Run: godot --headless res://tests/systems_test.tscn -- --user=NAME --pass=PW [--shots=DIR]

var uc: UserClient
var world: World
var hud: Hud
var user := "systest1"
var pw := "pw12345"
var shots := ""
var results: Array = []
var failures := 0


func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--user="): user = a.substr(7)
		if a.begins_with("--pass="): pw = a.substr(7)
		if a.begins_with("--shots="): shots = a.substr(8)
	get_tree().create_timer(240).timeout.connect(func():
		print("TIMEOUT")
		_report())
	uc = UserClient.new()
	add_child(uc)
	uc.ready_for_login.connect(func(): uc.send_login_user(user, pw))
	uc.info.connect(func(c):
		if c == "invalidlogin":
			uc.send_create_user(user, pw))
	uc.players_received.connect(func(p):
		if p.is_empty(): uc.send_create_player(0, user.capitalize().replace(" ", ""))
		else: uc.send_login_player(0, p[0].index))
	uc.world_ready.connect(_enter)
	uc.connect_to_server()


func _enter(info: Dictionary) -> void:
	world = World.new()
	add_child(world)
	var layer := CanvasLayer.new()
	add_child(layer)
	var ov := Overlay.new()
	ov.world = world
	layer.add_child(ov)
	world.overlay = ov
	hud = Hud.new()
	hud.world = world
	add_child(hud)
	world.hud = hud
	world.start(info)
	run()


func check(name: String, ok: bool, detail := "") -> void:
	results.append([name, ok, detail])
	print(("PASS " if ok else "FAIL ") + name + ("  " + detail if detail != "" else ""))
	if not ok:
		failures += 1


func until(cond: Callable, ms := 5000) -> bool:
	var t := Time.get_ticks_msec()
	while Time.get_ticks_msec() - t < ms:
		if cond.call():
			return true
		await get_tree().process_frame
	return cond.call()


func wait(ms: int) -> void:
	await get_tree().create_timer(ms / 1000.0).timeout


## Dismiss server notifications (shop messages pop up as modals) so the
## next modal the test expects is not queued behind them.
func drain_notices() -> void:
	await wait(300)
	while hud.modals.is_open() and hud.modals._kind == "notify":
		print("  notice: ", hud.modals._text.text)
		hud.modals._finish(true)


func confirm_modal() -> void:
	await until(func(): return hud.modals.is_open(), 2000)
	hud.modals._finish(true)


func shot(n: String) -> void:
	if shots == "":
		return
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(shots + "/" + n + ".png")


func npc_named(title: String):
	for n in world.npcs.values():
		if n.title() == title:
			return n
	return null


func talk_to(title: String, window_name: String) -> bool:
	var npc = npc_named(title)
	if npc == null:
		return false
	world.click(npc.x, npc.y)
	return await until(func(): return hud.window(window_name).visible, 8000)


func inv_kind(kind: int):
	for r in world.data.inventory:
		if r != null and int(r.kind) == kind:
			return r
	return null


func run() -> void:
	var data: PlayerData = world.data
	var actions: ItemActions = world.actions
	check("enter world", await until(func(): return world.started and world.map_status >= 2, 15000))
	check("player data parsed", data.skill_exps.size() > 0, "skills=%d gold=%d" % [data.skill_exps.size(), data.gold[0]])
	# ---------------------------------------------------------------- town
	world.warp_to_town()
	check("warp to town", await until(func(): return world.map_index == 0 and world.map_status >= 2, 8000))
	await until(func(): return npc_named("Beginner shop") != null, 5000)
	await wait(500)
	# ---------------------------------------------------------------- store
	check("store opens from NPC", await talk_to("Beginner shop", "store"))
	await wait(300)
	await shot("sys_01_store")
	var potion := 0
	for it in ItemTypes.get_item_list(1, 1, 100):
		potion = int(it.kind)
		break
	var gold0 := int(data.gold[0])
	actions.buy(1, potion)
	check("buy consumable", await until(func(): return inv_kind(potion) != null, 4000), ItemTypes.name_of(potion))
	check("gold spent", await until(func(): return int(data.gold[0]) < gold0, 3000), "%d -> %d" % [gold0, data.gold[0]])
	hud.window("store")._on_tab(1)
	var armor := 0
	for it in ItemTypes.get_item_list(2, 1, 100):
		armor = int(it.kind)
		break
	actions.buy(2, armor)
	check("buy armor", await until(func(): return inv_kind(armor) != null, 4000), ItemTypes.name_of(armor))
	hud.window("store")._on_tab(2)
	var weapon := 0
	for it in ItemTypes.get_item_list(3, 1, 100):
		if ItemTypes.is_melee_weapon(int(it.kind)):
			weapon = int(it.kind)
			break
	actions.buy(3, weapon)
	check("buy weapon", await until(func(): return inv_kind(weapon) != null, 4000), ItemTypes.name_of(weapon))
	hud.window("store").close()
	# ------------------------------------------------------------ equipment
	hud.open_window("inventory")
	await wait(200)
	var ar = inv_kind(armor)
	actions.use_item(0, int(ar.slot))
	var eslot := ItemTypes.get_equipment_slot(armor)
	check("equip armor", await until(func(): return data.equipment[eslot] != null and int(data.equipment[eslot].kind) == armor, 4000))
	var wr = inv_kind(weapon)
	actions.use_item(0, int(wr.slot))
	check("equip weapon", await until(func(): return world.data.weapon_kind() == weapon, 4000))
	check("player range/weapon updated", world.player.weapon_kind == weapon)
	await shot("sys_02_inventory")
	actions.use_item(2, eslot)
	check("unequip armor", await until(func(): return data.equipment[eslot] == null and inv_kind(armor) != null, 4000))
	# ------------------------------------------------------------- move/split
	await drain_notices()
	var pr = inv_kind(potion)
	var free_slot := data.inventory.find(null)
	hud.window("inventory")._move(0, int(pr.slot), 0, free_slot)
	await confirm_modal()
	check("move/split stack", await until(func(): return data.inventory[free_slot] != null, 4000))
	# ------------------------------------------------------------ sell mode
	hud.window("inventory").open_mode(ItemActions.Mode.SELL)
	var gold1 := int(data.gold[0])
	ar = inv_kind(armor)
	actions.activate_item(0, int(ar.slot))
	check("sell armor", await until(func(): return inv_kind(armor) == null and int(data.gold[0]) > gold1, 4000), "gold %d -> %d" % [gold1, data.gold[0]])
	hud.window("inventory").close()
	check("mode reset on close", actions.mode == ItemActions.Mode.NORMAL)
	# ------------------------------------------------------- drop and loot
	await drain_notices()
	pr = inv_kind(potion)
	var before := data.item_total_count(potion)
	actions.drop_item(0, int(pr.slot))
	if ItemTypes.is_stacked_item(potion) and int(pr.number) > 1:
		await until(func(): return hud.modals.is_open(), 2000)
		hud.modals._spin.value = 1
		hud.modals._finish(true)
	check("drop item", await until(func(): return data.item_total_count(potion) < before, 4000))
	var found: Array = []   # lambdas capture locals by value, so collect into an array
	await until(func():
		for e in world.entities.values():
			if e is ItemEntity and e.kind == potion:
				found.append(e)
				return true
		return false, 4000)
	var ground = found[0] if not found.is_empty() else null
	check("dropped item spawned", ground != null)
	if ground:
		world.click(ground.x, ground.y)
		check("loot item", await until(func(): return data.item_total_count(potion) == before, 6000))
	# ---------------------------------------------------------------- bank
	check("bank opens from NPC", await talk_to("Bank", "bank"))
	hud.window("bank").close()
	hud.window("inventory").open_mode(ItemActions.Mode.BANK, hud.window("bank"))
	pr = inv_kind(potion)
	actions.activate_item(0, int(pr.slot))
	check("deposit item", await until(func(): return data.bank.any(func(r): return r != null and int(r.kind) == potion), 4000))
	hud.window("inventory").close()
	check("bank reopened after store mode", hud.window("bank").visible)
	await shot("sys_03_bank")
	var bslot := -1
	for i in range(data.bank.size()):
		if data.bank[i] != null and int(data.bank[i].kind) == potion:
			bslot = i
	actions.retrieve_from_bank(bslot)
	check("withdraw item", await until(func(): return data.bank[bslot] == null and inv_kind(potion) != null, 4000))
	await drain_notices()
	var g0 := int(data.gold[0])
	actions.transfer_gold(false)
	await until(func(): return hud.modals.is_open(), 2000)
	hud.modals._spin.value = 100
	hud.modals._finish(true)
	check("deposit gold", await until(func(): return int(data.gold[1]) >= 100 and int(data.gold[0]) == g0 - 100, 4000), "inv %d bank %d" % data.gold)
	hud.window("bank").close()
	# ------------------------------------------------------------- enchant
	check("enchant opens from NPC", await talk_to("Enchant", "inventory"))
	check("enchant mode", actions.mode == ItemActions.Mode.ENCHANT)
	await drain_notices()
	var w0: Dictionary = data.equipment[4]
	var num0 := int(w0.number)
	actions.activate_item(2, 4)
	await confirm_modal()
	check("enchant weapon", await until(func(): return data.equipment[4] != null and int(data.equipment[4].number) == num0 + 1, 4000))
	hud.window("inventory").close()
	# -------------------------------------------------------------- repair
	check("repair opens from NPC", await talk_to("Repair", "inventory"))
	check("repair mode", actions.mode == ItemActions.Mode.REPAIR)
	hud.window("inventory").close()
	# ------------------------------------------------------------- auction
	check("auction opens from NPC", await talk_to("Auction", "auction"))
	check("auction list received", await until(func(): return data.auctions.has(0), 4000))
	hud.window("auction").close()
	hud.window("inventory").open_mode(ItemActions.Mode.AUCTION, hud.window("auction"))
	wr = data.equipment[4]
	actions.use_item(2, 4)   # unequip weapon first so it can be listed
	await until(func(): return inv_kind(weapon) != null, 4000)
	await drain_notices()
	wr = inv_kind(weapon)
	actions.activate_item(0, int(wr.slot))
	await until(func(): return hud.modals.is_open(), 2000)
	hud.modals._spin.value = 123
	hud.modals._finish(true)
	check("list on auction", await until(func(): return data.auctions.get(0, []).any(func(e): return int(e.room.kind) == weapon), 4000))
	hud.window("inventory").close()
	check("auction reopened", hud.window("auction").visible)
	hud.window("auction")._on_tab(0)
	await wait(500)
	await shot("sys_04_auction")
	var entry = null
	for e in data.auctions.get(0, []):
		if int(e.room.kind) == weapon:
			entry = e
	if entry:
		actions.client().send([Types.Messages.CW_AUCTIONDELETE, int(entry.index), 0])
		check("delete auction", await until(func(): return inv_kind(weapon) != null, 4000))
	hud.window("auction").close()
	# --------------------------------------------------------------- craft
	check("craft opens from NPC", await talk_to("Craft", "craft"))
	await wait(300)
	await shot("sys_05_craft")
	hud.window("craft").close()
	# --------------------------------------------------------------- looks
	check("looks opens from NPC", await talk_to("Looks", "looks"))
	check("appearance list received", await until(func(): return not data.appearance_prices.is_empty(), 4000))
	await wait(300)
	await shot("sys_06_looks")
	hud.window("looks").close()
	# --------------------------------------------------------------- stats
	hud.open_window("stats")
	var xp_before := int(world.player.stats.get("exp", {}).get("base", -1))
	check("player info received", await until(func(): return int(world.player.stats.exp.get("base", -1)) >= 0, 3000), str(xp_before))
	var free0 := int(world.player.stats.get("free", 0))
	if free0 > 0:
		actions.client().send_add_stat(1, 1)
		check("add stat point", await until(func(): return int(world.player.stats.get("free", 0)) == free0 - 1, 4000))
	await wait(300)
	await shot("sys_07_stats")
	hud.window("stats").close()
	# ------------------------------------------------- skills & shortcuts
	hud.open_window("skills")
	await wait(200)
	await shot("sys_08_skills")
	actions.install_shortcut(0, 1, potion)
	check("install item shortcut", int(data.shortcuts[0].id) == potion)
	actions.install_shortcut(1, 2, 0)
	check("install skill shortcut", int(data.shortcuts[1].type) == 2)
	check("execute self skill via shortcut", actions.exec_shortcut(1))
	check("skill cooldown running", actions.skill_cooldown_left(0) > 0)
	hud.window("skills").close()
	# ------------------------------------------------ other windows
	for n in ["quests", "achievements", "social", "settings", "gemshop"]:
		var w = hud.open_window(n)
		await wait(150)
		check("window " + n, w != null and w.visible)
		await shot("sys_09_" + n)
		w.close()
	world.set_zoom(1.2)
	await wait(200)
	world.set_zoom(1.0)
	check("zoom", is_equal_approx(world.game_scale, World.BASE_SCALE))
	_report()


func _report() -> void:
	print("SYSTEMS TEST: %d checks, %d failures" % [results.size(), failures])
	get_tree().quit(1 if failures > 0 else 0)
