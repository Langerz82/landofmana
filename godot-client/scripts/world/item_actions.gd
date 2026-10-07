class_name ItemActions
extends RefCounted
## Player actions on items, shortcuts and skills. Port of the behaviour in
## inventoryhandler.js, inventorydialog/*.js (activateItem), equipmenthandler.js,
## bankdialog/bankframe.js, shortcut/*.js and skillhandler.js.

signal mode_changed(mode: int)
signal cooldowns_changed

enum Mode { NORMAL = 0, SELL = 1, REPAIR = 2, ENCHANT = 3, BANK = 4, AUCTION = 5 }

var world = null
var data: PlayerData
var mode := Mode.NORMAL
var item_cooldown_until := 0          # global consumable cooldown (ms ticks)
var skill_cooldown_until: Dictionary = {}  # skill index -> ms ticks


func _init(w, d: PlayerData) -> void:
	world = w
	data = d


func client() -> GameClient:
	return world.client


func hud():
	return world.hud


func now() -> int:
	return Time.get_ticks_msec()


func set_mode(m: int) -> void:
	mode = m
	mode_changed.emit(m)


func notify_lang(key: String, args = null) -> void:
	if hud():
		hud().add_notification(GameData.tr_lang(key, args))


# ------------------------------------------------------------ cooldowns

func item_cooldown_left() -> int:
	return maxi(0, item_cooldown_until - now())


func skill_cooldown_left(index: int) -> int:
	return maxi(0, int(skill_cooldown_until.get(index, 0)) - now())


func cooldown_left(type: int, id: int) -> int:
	if type == 1:
		return item_cooldown_left()
	if type == 2:
		return skill_cooldown_left(id)
	return 0


# ----------------------------------------------------------------- items

## InventoryHandler.useItem(): eat a consumable or (un)equip.
func use_item(store_type: int, slot: int) -> bool:
	var r = data.get_room(store_type, slot)
	if r == null:
		return false
	var p = world.player
	var kind := int(r.kind)
	if ItemTypes.is_consumable(kind):
		if store_type != PlayerData.Store.INVENTORY or item_cooldown_left() > 0:
			return false
		var healing := ItemTypes.is_healing_item(kind)
		if healing and not (int(p.stats.hp) < int(p.stats.hpMax) and int(p.stats.hp) > 0):
			return false
		data.dec_inventory(slot)
		item_cooldown_until = now() + ItemTypes.cooldown_of(kind) * 1000
		cooldowns_changed.emit()
		client().send_item_slot([0, 0, slot, 1])
		if world.audio:
			world.audio.play_sound("heal")
		return true
	if ItemTypes.is_equippable(kind):
		if store_type == PlayerData.Store.EQUIPMENT:
			client().send_item_slot([1, 2, slot, 0, 0, -1])
		else:
			var eslot := ItemTypes.get_equipment_slot(kind)
			if eslot > -1:
				client().send_item_slot([1, store_type, slot, 0, 2, eslot])
		return true
	return false


func is_stack(r, max_stack := false) -> bool:
	if r == null:
		return false
	return ItemTypes.is_stacked_item(int(r.kind)) and int(r.number) > 1 \
		and (not max_stack or int(r.number) < 100)


## Drag & drop between slots (InventoryHandler.splitItem/moveItem).
## dst_slot -1 = "first free slot" (bank/inventory) as in the JS client.
func move_item(src_type: int, src_slot: int, dst_type: int, dst_slot: int) -> void:
	var r = data.get_room(src_type, src_slot)
	if r == null:
		return
	if src_type == dst_type and src_slot == dst_slot:
		return
	var r2 = data.get_room(dst_type, dst_slot) if dst_slot >= 0 else null
	var can_split := dst_type != PlayerData.Store.EQUIPMENT and \
		((is_stack(r) and r2 == null and dst_slot >= 0) or (is_stack(r, true) and r2 != null and is_stack(r2, true)))
	if can_split and hud():
		hud().ask_count("Move how many?", int(r.number), int(r.number), func(count: int):
			_send_move(src_type, src_slot, mini(count, int(r.number)), dst_type, dst_slot))
		return
	_send_move(src_type, src_slot, int(r.number), dst_type, dst_slot)


func _send_move(src_type: int, src_slot: int, count: int, dst_type: int, dst_slot: int) -> void:
	if count <= 0:
		return
	client().send_item_slot([1, src_type, src_slot, count, dst_type, dst_slot])


## InventoryHandler.dropItem(): drop on the ground (asks for a count for stacks).
func drop_item(store_type: int, slot: int) -> void:
	var r = data.get_room(store_type, slot)
	if r == null or store_type == PlayerData.Store.EQUIPMENT:
		return
	if is_stack(r) and hud():
		hud().ask_count("Drop how many?", int(r.number), int(r.number), func(count: int):
			if count > 0:
				client().send_item_slot([2, store_type, slot, mini(count, int(r.number))]))
	else:
		client().send_item_slot([2, store_type, slot, 1])


## InventoryDialog.activateItem(): what "use" means in the current mode.
func activate_item(store_type: int, slot: int, from_button := false) -> void:
	var r = data.get_room(store_type, slot)
	if r == null:
		return
	var kind := int(r.kind)
	match mode:
		Mode.AUCTION:
			if ItemTypes.is_loot_item(kind) or ItemTypes.is_consumable(kind) or store_type != 0:
				return
			var value := int(ItemTypes.get_enchant_sell_price(r) / 2)
			if hud():
				hud().ask_count("Auction price for %s (gold)" % ItemTypes.name_of(kind), value, 99999999, func(price: int):
					if price > 0:
						client().send([Types.Messages.CW_AUCTIONSELL, slot, price]))
		Mode.SELL:
			if ItemTypes.is_loot_item(kind) or ItemTypes.is_consumable(kind):
				return
			client().send([Types.Messages.CW_STORESELL, store_type, slot])
		Mode.REPAIR:
			if ItemTypes.is_equipment(kind):
				repair_item(store_type, slot)
		Mode.ENCHANT:
			if ItemTypes.is_equipment(kind):
				enchant_item(store_type, slot)
		Mode.BANK:
			if store_type == PlayerData.Store.INVENTORY and not data.is_bank_full():
				_send_move(0, slot, int(r.number), PlayerData.Store.BANK, -1)
		_:
			if from_button:
				drop_item(store_type, slot)
			else:
				use_item(store_type, slot)


## The price shown next to the action button for the selected item.
func mode_price(store_type: int, slot: int) -> int:
	var r = data.get_room(store_type, slot)
	if r == null:
		return -1
	match mode:
		Mode.AUCTION: return int(ItemTypes.get_enchant_sell_price(r) / 2)
		Mode.SELL: return ItemTypes.get_enchant_sell_price(r)
		Mode.REPAIR: return ItemTypes.get_repair_price(r)
		Mode.ENCHANT: return ItemTypes.get_enchant_price(r)
	return -1


## Whether an item can be picked in the current mode (selectInventory()).
func selectable_in_mode(r) -> bool:
	if r == null:
		return false
	var kind := int(r.kind)
	match mode:
		Mode.ENCHANT: return ItemTypes.is_equipment(kind)
		Mode.REPAIR: return ItemTypes.is_equipment(kind) and int(r.dur) != int(r.durMax)
		Mode.SELL, Mode.AUCTION: return not ItemTypes.is_loot_item(kind) and not ItemTypes.is_consumable(kind)
	return true


func repair_item(store_type: int, slot: int) -> void:
	var r = data.get_room(store_type, slot)
	if r == null:
		return
	var price := ItemTypes.get_repair_price(r)
	if price <= 0:
		return
	if price > int(data.gold[0]):
		notify_lang("SHOP_NOGOLD")
		return
	hud().confirm("Cost %d to Repair." % price, func(ok: bool):
		if ok:
			client().send([Types.Messages.CW_STORE_MODITEM, 0, store_type, slot]))


func enchant_item(store_type: int, slot: int) -> void:
	var r = data.get_room(store_type, slot)
	if r == null:
		return
	var price := ItemTypes.get_enchant_price(r)
	if price < 0:
		return
	if price > int(data.gold[0]):
		notify_lang("SHOP_NOGOLD")
		return
	hud().confirm("Cost %d to Enchant." % price, func(ok: bool):
		if ok:
			client().send([Types.Messages.CW_STORE_MODITEM, 1, store_type, slot]))


## BankFrame.select(): take an item out of the bank.
func retrieve_from_bank(slot: int) -> void:
	var r = data.bank[slot]
	if r == null:
		return
	if data.is_inventory_full():
		notify_lang("INVENTORY_FULL")
		return
	_send_move(PlayerData.Store.BANK, slot, int(r.number), PlayerData.Store.INVENTORY, -1)


## CW_GOLD: type (0 inventory, 1 bank) -> type2.
func transfer_gold(from_bank: bool) -> void:
	var avail := int(data.gold[1] if from_bank else data.gold[0])
	hud().ask_count("Move gold to the %s" % ("inventory" if from_bank else "bank"), avail, avail, func(count: int):
		count = mini(count, avail)
		if count > 0:
			client().send([Types.Messages.CW_GOLD, 1 if from_bank else 0, count, 0 if from_bank else 1]))


func buy(store_type: int, kind: int) -> void:
	if ItemTypes.get_buy_price(kind) > int(data.gold[0]):
		notify_lang("SHOP_NOGOLD")
		return
	client().send([Types.Messages.CW_STOREBUY, store_type, kind, 1])


func craft(craft_entry: Dictionary) -> void:
	var missing := false
	for it in craft_entry.i:
		if not data.has_items(int(it[0]), int(it[1])):
			notify_lang("SHOP_MISSINGITEMS", [int(it[1]), ItemTypes.name_of(int(it[0]))])
			missing = true
	if missing:
		notify_lang("SHOP_NOCRAFTITEMS")
		return
	if ItemTypes.get_craft_price(int(craft_entry.o)) > int(data.gold[0]):
		notify_lang("SHOP_NOGOLD")
		return
	client().send([Types.Messages.CW_CRAFT, int(craft_entry.id), 1])


# ------------------------------------------------------------- shortcuts

## Shortcut.setup(): put an inventory consumable (type 1) or skill (type 2) on a slot.
func install_shortcut(slot: int, type: int, id: int) -> void:
	if cooldown_left(int(data.shortcuts[slot].type), int(data.shortcuts[slot].id)) > 0:
		return
	data.set_shortcut(slot, type, id)
	if id > -1:
		client().send([Types.Messages.CW_SHORTCUT, slot, type, id])


func swap_shortcuts(a: int, b: int) -> void:
	var sa: Dictionary = data.shortcuts[a]
	var sb: Dictionary = data.shortcuts[b]
	data.set_shortcut(a, int(sb.type), int(sb.id))
	data.set_shortcut(b, int(sa.type), int(sa.id))
	if int(sb.id) > -1:
		client().send([Types.Messages.CW_SHORTCUT, a, int(sb.type), int(sb.id)])
	if int(sa.id) > -1:
		client().send([Types.Messages.CW_SHORTCUT, b, int(sa.type), int(sa.id)])


## Shortcut.exec()
func exec_shortcut(slot: int) -> bool:
	if slot < 0 or slot >= data.shortcuts.size():
		return false
	var sc: Dictionary = data.shortcuts[slot]
	var t := int(sc.type)
	var id := int(sc.id)
	if cooldown_left(t, id) > 0:
		return false
	if t == 1:
		var r = data.find_item(id)
		if r != null:
			return use_item(0, int(r.slot))
	elif t == 2:
		return execute_skill(id)
	return false


# ---------------------------------------------------------------- skills

## SkillActive.execute()
func execute_skill(index: int) -> bool:
	var s := GameData.get_skill(index)
	if s.is_empty() or data.skill_level_of(index) <= 0:
		return false
	if skill_cooldown_left(index) > 0:
		return false
	var p = world.player
	match str(s.skillType):
		"attack":
			p.attack_skill = index
			if p.attack_delay == null:
				world.make_player_interact_next_to()
		"target":
			if p.has_target() and p.target is Character:
				client().send([Types.Messages.CW_SKILL, index, p.target.id])
			else:
				world.make_player_interact_next_to()
				return false
		"self":
			client().send([Types.Messages.CW_SKILL, index, 0])
		_:
			return false
	skill_cooldown_until[index] = now() + maxi(int(s.recharge), 2000)
	cooldowns_changed.emit()
	return true
