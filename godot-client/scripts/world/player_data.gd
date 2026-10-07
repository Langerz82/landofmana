class_name PlayerData
extends RefCounted
## Everything the server tells the client about the local player beyond the
## world entity itself: inventory, bank, equipment, gold, quests,
## achievements, skills, shortcuts, appearances, party and auction lists.
## Port of the data side of inventoryhandler.js, bankhandler.js,
## equipmenthandler.js, questhandler.js, achievementhandler.js,
## skillhandler.js, shortcuthandler.js, socialhandler.js and the
## clientcallbacks* parsers. UI windows listen to the signals.

signal inventory_changed
signal bank_changed
signal equipment_changed
signal gold_changed
signal quests_changed
signal achievements_changed
signal achievement_completed(a: Dictionary)
signal skills_changed
signal shortcuts_changed
signal appearances_changed
signal party_changed
signal party_invite(player_name: String)
signal auction_changed(type: int)
signal player_info_changed
signal stats_changed

enum Store { INVENTORY = 0, BANK = 1, EQUIPMENT = 2 }
const INVENTORY_SIZE := 50
const BANK_SIZE := 96
const EQUIPMENT_SIZE := 5
const WEAPON_SLOT := 4
const SHORTCUT_COUNT := 6

var inventory: Array = []
var bank: Array = []
var equipment: Array = []
var gold: Array = [0, 0]      # [inventory, bank]
var gems := 0
var quests: Dictionary = {}   # id -> Quest
var achievements: Array = []  # Dictionaries (Quest.achievement_from)
var skill_exps: Array = []
var shortcuts: Array = []     # {type: 0 none/1 item/2 skill, id}
var appearances := PackedByteArray()
var appearance_prices: Array = []
var party: Array = []         # member names, [0] = leader
var auctions: Dictionary = {} # type -> Array of {index, player, price, room}


func _init() -> void:
	inventory.resize(INVENTORY_SIZE)
	bank.resize(BANK_SIZE)
	equipment.resize(EQUIPMENT_SIZE)
	for i in range(SHORTCUT_COUNT):
		shortcuts.append({"type": 0, "id": -1})


func store(t: int) -> Array:
	match t:
		Store.BANK: return bank
		Store.EQUIPMENT: return equipment
	return inventory


func get_room(t: int, slot: int):
	var s := store(t)
	if slot < 0 or slot >= s.size():
		return null
	return s[slot]


static func make_room(slot: int, kind: int, number: int, dur: int, dur_max: int, xp: int) -> Dictionary:
	return {"slot": slot, "kind": kind, "number": number, "dur": dur, "durMax": dur_max, "exp": xp}


## Reads `count` six-field rooms from d (consumed) into store t.
func read_rooms(t: int, d: Array, count: int, clear_first := false) -> void:
	var s := store(t)
	if clear_first:
		for i in range(s.size()):
			s[i] = null
	for _i in range(count):
		var r := make_room(Types.to_int(d.pop_front()), Types.to_int(d.pop_front()),
			Types.to_int(d.pop_front()), Types.to_int(d.pop_front()),
			Types.to_int(d.pop_front()), Types.to_int(d.pop_front()))
		if r.slot >= 0 and r.slot < s.size():
			s[r.slot] = r
	_emit_store(t)


## WC_ITEMSLOT: [type, count, (slot, kind [, number, dur, durMax, exp])...]
func apply_item_slot(data: Array) -> void:
	var d := data.duplicate()
	var t := Types.to_int(d.pop_front())
	var count := Types.to_int(d.pop_front())
	var s := store(t)
	for _i in range(count):
		var slot := Types.to_int(d.pop_front())
		var kind := Types.to_int(d.pop_front())
		if kind == -1:
			if slot >= 0 and slot < s.size():
				s[slot] = null
			continue
		var r := make_room(slot, kind, Types.to_int(d.pop_front()), Types.to_int(d.pop_front()),
			Types.to_int(d.pop_front()), Types.to_int(d.pop_front()))
		if slot >= 0 and slot < s.size():
			s[slot] = r
	_emit_store(t)


func _emit_store(t: int) -> void:
	match t:
		Store.INVENTORY:
			inventory_changed.emit()
			shortcuts_changed.emit()
		Store.BANK: bank_changed.emit()
		Store.EQUIPMENT: equipment_changed.emit()


# ------------------------------------------------------------ inventory

func weapon():
	return equipment[WEAPON_SLOT]


func weapon_kind() -> int:
	var w = weapon()
	return int(w.kind) if w != null else 0


func weapon_type():
	var k := weapon_kind()
	return ItemTypes.type_of(k) if k > 0 else null


func has_harvest_weapon(t = null) -> bool:
	if t == "any":
		return true
	var k := weapon_kind()
	if k == 0:
		return false
	if t != null and str(t) != "":
		return ItemTypes.type_of(k) == str(t)
	return ItemTypes.is_harvest_weapon(k)


func is_inventory_full() -> bool:
	for r in inventory:
		if r == null:
			return false
	return true


func is_bank_full() -> bool:
	for r in bank:
		if r == null:
			return false
	return true


func item_total_count(kind: int) -> int:
	var total := 0
	for r in inventory:
		if r != null and int(r.kind) == kind:
			total += int(r.number)
	return total


func has_items(kind: int, count: int) -> bool:
	return item_total_count(kind) >= count


func find_item(kind: int):
	for r in inventory:
		if r != null and int(r.kind) == kind:
			return r
	return null


func dec_inventory(slot: int) -> void:
	var r = inventory[slot]
	if r == null:
		return
	r.number = int(r.number) - 1
	if r.number <= 0:
		inventory[slot] = null
	inventory_changed.emit()
	shortcuts_changed.emit()


func set_gold(inv: int, bnk: int, gem_count: int) -> void:
	gold = [inv, bnk]
	gems = gem_count
	gold_changed.emit()


# --------------------------------------------------------------- quests

func set_quest(arr: Array) -> Quest:
	var qid := Types.to_int(arr[0])
	var q: Quest = quests.get(qid)
	if q == null:
		q = Quest.from_array(arr)
		quests[qid] = q
	else:
		q.update(arr)
	quests_changed.emit()
	return q


func set_achievement(arr: Array) -> void:
	var a := Quest.achievement_from(arr)
	var found := false
	for i in range(achievements.size()):
		if achievements[i].index == a.index:
			achievements[i] = a
			found = true
	if not found:
		achievements.append(a)
	achievements_changed.emit()
	if a.count >= a.objectCount and a.objectCount > 0:
		achievement_completed.emit(a)


# --------------------------------------------------------------- skills

static func skill_exp_table() -> Array:
	Types._ensure_tables()
	var out: Array = [0]
	for i in range(1, 50):
		out.append(int(int(floor(i * 300 * pow(1.5, i / 5.0))) / 1.5))
	return out


## Types.getSkillLevel(exp)
static func skill_level(xp: int) -> int:
	if xp == 0:
		return 1
	var t := skill_exp_table()
	for i in range(1, 10):
		if xp < t[i]:
			return i
	return 20


func set_skill_exp(index: int, xp: int) -> void:
	while skill_exps.size() <= index:
		skill_exps.append(0)
	skill_exps[index] = xp
	skills_changed.emit()


func skill_level_of(index: int) -> int:
	if index < 0 or index >= skill_exps.size():
		return 0
	return skill_level(int(skill_exps[index]))


# ------------------------------------------------------------ shortcuts

func set_shortcut(slot: int, type: int, id: int) -> void:
	if slot < 0 or slot >= SHORTCUT_COUNT:
		return
	shortcuts[slot] = {"type": type, "id": id}
	shortcuts_changed.emit()


# ---------------------------------------------------------- appearances

## WC_APPEARANCE: [base64 bit-packed unlocked flags, price per appearance...]
func apply_appearances(data: Array) -> void:
	var d := data.duplicate()
	var b64 := str(d.pop_front()).strip_edges()
	while b64.length() % 4 != 0:      # server omits '=' padding
		b64 += "="
	var packed := Marshalls.base64_to_raw(b64) if b64 != "" else PackedByteArray()
	var n := GameData.appearances.size()
	appearances.resize(n)
	for i in range(n):
		var b := (i >> 3)
		appearances[i] = ((packed[b] >> (i & 7)) & 1) if b < packed.size() else 0
	appearance_prices = []
	for i in range(n):
		appearance_prices.append(Types.to_int(d.pop_front()) if not d.is_empty() else 0)
	appearances_changed.emit()


func has_appearance(i: int) -> bool:
	return i == 0 or (i >= 0 and i < appearances.size() and appearances[i] == 1)


# --------------------------------------------------------------- social

func apply_party(data: Array) -> void:
	var d := data.duplicate()
	var t := Types.to_int(d.pop_front())
	if t == 1:
		party = []
		for n in d:
			party.append(str(n))
		party_changed.emit()
	elif t == 2 and not d.is_empty():
		party_invite.emit(str(d[0]))


func is_party_leader(n: String) -> bool:
	return not party.is_empty() and party[0] == n


func is_party_member(n: String) -> bool:
	return party.has(n)


# -------------------------------------------------------------- auction

## WC_AUCTIONOPEN: [type, count, (index, player, price, slot, kind, number, dur, durMax, exp)...]
func apply_auction(data: Array) -> void:
	var d := data.duplicate()
	var t := Types.to_int(d.pop_front())
	var count := Types.to_int(d.pop_front())
	var list: Array = []
	for _i in range(count):
		if d.size() < 9:
			break
		var e := {"index": Types.to_int(d.pop_front()), "player": str(d.pop_front()),
			"price": Types.to_int(d.pop_front())}
		e["room"] = make_room(Types.to_int(d.pop_front()), Types.to_int(d.pop_front()),
			Types.to_int(d.pop_front()), Types.to_int(d.pop_front()),
			Types.to_int(d.pop_front()), Types.to_int(d.pop_front()))
		list.append(e)
	list.sort_custom(func(a, b):
		if a.room.kind != b.room.kind:
			return a.room.kind < b.room.kind
		return a.price < b.price)
	auctions[t] = list
	auction_changed.emit(t)
