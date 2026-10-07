class_name ItemTypes
## Port of shared/js/itemtypes.js + the icon part of client/js/data/items.js.
## Item kind data lives in GameData.item_kinds (shared/data/items2.json).
## An item "room" (ItemRoom in the JS code) is a Dictionary:
##   {slot, kind, number, dur, durMax, exp}

static var item_exp_for_level: Array = []
static var _icon_cache: Dictionary = {}


static func data(kind: int) -> Dictionary:
	return GameData.item_kinds.get(kind, {})


static func type_of(kind: int) -> String:
	return str(data(kind).get("type", ""))


static func name_of(kind: int) -> String:
	return GameData.item_name(kind)


static func is_loot_item(kind: int) -> bool:
	return kind >= 1000 and kind < 2000


static func is_clothes(kind: int) -> bool:
	return type_of(kind) in ["helm", "chest", "gloves", "boots"]


static func is_armor(kind: int) -> bool:
	return is_clothes(kind)


static func is_melee_weapon(kind: int) -> bool:
	return type_of(kind) in ["sword", "hammer", "axe"]


static func is_archer_weapon(kind: int) -> bool:
	return type_of(kind) == "bow"


static func is_harvest_weapon(kind: int) -> bool:
	return type_of(kind) in ["hammer", "axe"]


static func is_weapon(kind: int) -> bool:
	return is_melee_weapon(kind) or is_archer_weapon(kind)


static func is_equipment(kind: int) -> bool:
	return is_weapon(kind) or is_armor(kind)


static func is_equippable(kind: int) -> bool:
	return is_equipment(kind)


static func is_consumable(kind: int) -> bool:
	return type_of(kind) == "object"


static func is_craft_item(kind: int) -> bool:
	return type_of(kind) == "craft"


static func is_healing_item(kind: int) -> bool:
	var d := data(kind)
	return str(d.get("type", "")) == "object" and str(d.get("typemod", "")) in ["health", "healthpercent"]


## Same as the JS version: kinds missing from KindData (loot items) are not
## considered stackable.
static func is_stacked_item(kind: int) -> bool:
	if data(kind).is_empty():
		return false
	return is_craft_item(kind) or is_consumable(kind)


static func get_level_by_kind(kind: int) -> int:
	if is_equipment(kind):
		return int(data(kind).get("level", 0))
	return 0


static func get_equipment_slot(kind: int) -> int:
	if is_weapon(kind):
		return 4
	match type_of(kind):
		"helm": return 0
		"chest": return 1
		"gloves": return 2
		"boots": return 3
	return -1


static func cooldown_of(kind: int) -> int:
	return int(data(kind).get("cooldown", 10))


# ------------------------------------------------------------------ prices

static func get_buy_price(kind: int) -> int:
	var d := data(kind)
	if d.is_empty():
		return 0
	var t := str(d.type)
	var m := float(d.modifier)
	if t == "bow" or t == "chest":
		return int(floor(m * m * 5))
	if is_armor(kind):
		return int(floor(m * m * 10))
	if is_weapon(kind):
		return int(floor(m * m * 5))
	if t == "object" and int(d.buy) > 0:
		return int(d.buy) * int(d.buyCount) if int(d.buyCount) > 1 else int(d.buy)
	return 0


static func get_craft_price(kind: int) -> int:
	var d := data(kind)
	if d.is_empty() or int(d.legacy) == 1:
		return 0
	if int(d.buy) > 0:
		return int(d.buy)
	return int(get_buy_price(kind) / 4)


static func _ensure_item_exp() -> void:
	if not item_exp_for_level.is_empty():
		return
	item_exp_for_level.append(0)
	for i in range(1, 30):
		item_exp_for_level.append(int(floor(i * 150 * pow(2, i / 10.0))))


## ItemTypes.getEnchantPrice(item, current). Returns -1 when not possible (NaN in JS).
static func get_enchant_price(room: Dictionary, current := false) -> int:
	_ensure_item_exp()
	var d := data(int(room.kind))
	if d.is_empty():
		return -1
	var lvl: int = int(room.number) if current else int(room.number) + 1
	if lvl >= 25 or lvl < 0:
		return -1
	var base := float(d.modifier)
	return int(floor(base * base * 10 * pow(2, lvl) * (1 - float(room.exp) / item_exp_for_level[lvl])))


static func get_enchant_sell_price(room: Dictionary) -> int:
	var value := get_buy_price(int(room.kind)) / 10.0
	if int(room.number) > 1:
		var ep := get_enchant_price(room)
		if ep >= 0:
			value += int(ep / 10)
	value *= float(room.durMax) / 900.0
	return int(floor(value))


static func get_repair_price(room: Dictionary) -> int:
	var value := get_buy_price(int(room.kind)) / 10.0
	if int(room.dur) == int(room.durMax):
		return 0
	if int(room.number) > 1:
		value = get_enchant_price(room, true) / 10.0
	var mp := (float(room.durMax) / 900.0) * (1.0 - float(room.dur) / maxf(1, float(room.durMax)))
	value *= clampf(mp, 0, 1)
	return 1 + int(value)


# ------------------------------------------------------------- store lists

## ItemTypes.getItemListBy(itemType, min, max): 1 consumables, 2 armor,
## 3 weapons, 4 everything that is not armor/weapon (craft lists).
static func get_item_list(item_type: int, min_level: int, max_level: int) -> Array:
	var out: Array = []
	var kinds := GameData.item_kinds.keys()
	kinds.sort()
	for k in kinds:
		var d: Dictionary = GameData.item_kinds[k]
		if d.is_empty() or int(d.legacy) == 1:
			continue
		var entry := {
			"name": d.name, "kind": int(k), "type": d.type,
			"buyCount": int(d.buyCount), "buyPrice": int(d.buy),
			"craftPrice": get_craft_price(k), "craft": d.craft, "rank": 0,
		}
		var m := int(d.modifier)
		if item_type == 4 and not (is_armor(k) or is_weapon(k)):
			out.append(entry)
		if item_type == 1 and d.type == "object" and int(d.buy) > 0:
			out.append(entry)
		elif item_type == 2 and is_armor(k) and m >= min_level and m <= max_level:
			entry.buyPrice = get_buy_price(k)
			entry.rank = int(d.level)
			out.append(entry)
		elif item_type == 3 and is_weapon(k) and m >= min_level and m <= max_level:
			entry.buyPrice = get_buy_price(k)
			entry.rank = int(d.level)
			out.append(entry)
	if not out.is_empty() and int(out[0].rank) > 0:
		out.sort_custom(func(a, b): return a.rank < b.rank)
	return out


# ------------------------------------------------------------------- text

## Item.getInfoMsgEx(): one line description of an item room.
static func info_text(room: Dictionary) -> String:
	var kind := int(room.get("kind", 0))
	if is_equipment(kind):
		var n := int(room.get("number", 0))
		return "%s: Lv %d%s%s/%s" % [name_of(kind), get_level_by_kind(kind),
			("+%d " % n) if n > 0 else " ",
			Types.to_str(float(room.get("dur", 0)) / 10.0), Types.to_str(float(room.get("durMax", 0)) / 10.0)]
	return name_of(kind)


## Utils.getNumShortHand()
static func short_number(val: int, fixed := 2) -> String:
	if val <= 1000:
		return str(val)
	var fmt := "%." + str(fixed) + "f"
	if val <= 1000000:
		return (fmt % (val / 1000.0)) + "K"
	if val <= 1000000000:
		return (fmt % (val / 1000000.0)) + "M"
	return (fmt % (val / 1000000000.0)) + "B"


## Text shown on an item slot (jqShowItem's count/level label).
static func slot_label(room: Dictionary) -> String:
	var kind := int(room.get("kind", 0))
	var n := int(room.get("number", 0))
	if is_equippable(kind):
		return "%d+%d" % [get_level_by_kind(kind), n]
	return str(n) if n > 1 else ""


static func durability_percent(room: Dictionary) -> String:
	var kind := int(room.get("kind", 0))
	if not is_equippable(kind):
		return ""
	var dm := float(room.get("durMax", 0))
	if dm <= 0:
		return ""
	return "%d%%" % int(round(float(room.get("dur", 0)) / dm * 100))


# ------------------------------------------------------------------- icons

## Icon for an item kind (Items.jqShowItem). Loot items and kinds with a
## "staticsheet" use that sheet (img/2/sprites/<sheet>); the rest use the
## 48px item sprites in img/3.
static func icon(kind: int) -> Texture2D:
	if _icon_cache.has(kind):
		return _icon_cache[kind]
	var d: Dictionary = GameData.get_loot(kind) if is_loot_item(kind) else data(kind)
	if d.is_empty():
		_icon_cache[kind] = null
		return null
	var tex: Texture2D = null
	var region := Rect2()
	var offset = d.get("offset", [0, 0])
	if not (offset is Array) or offset.size() < 2:
		offset = [0, 0]
	var sheet_id := int(d.get("staticsheet", 0)) if d.get("staticsheet") else 0
	if sheet_id > 0 and sheet_id < GameData.static_sheets.size():
		var sh: Dictionary = GameData.static_sheets[sheet_id]
		tex = GameData.get_texture("res://assets/img/2/sprites/" + str(sh.sheet))
		if tex:
			var f := tex.get_width() / float(sh.width)
			var sw := float(sh.spritewidth) * f
			var shh := float(sh.spriteheight) * f
			region = Rect2(float(offset[0]) * sw, float(offset[1]) * shh, sw, shh)
	else:
		var file := str(d.get("sprite", ""))
		tex = GameData.get_texture("res://assets/img/3/" + file)
		if tex:
			region = Rect2(float(offset[0]) * 48, float(offset[1]) * 48, 48, 48)
	if tex == null:
		_icon_cache[kind] = null
		return null
	var at := AtlasTexture.new()
	at.atlas = tex
	at.region = region
	_icon_cache[kind] = at
	return at


## Skill icon (SkillData.jqShowSkill): 24px cells in img/3/misc/skillicons.png
## (stored at 3x, so 72px per cell).
static func skill_icon(index: int) -> Texture2D:
	var key := -1000 - index
	if _icon_cache.has(key):
		return _icon_cache[key]
	var s := GameData.get_skill(index)
	var tex := GameData.get_texture("res://assets/img/3/misc/skillicons.png")
	if s.is_empty() or tex == null:
		return null
	var off: Array = s.iconOffset
	var at := AtlasTexture.new()
	at.atlas = tex
	at.region = Rect2(float(off[0]) * 72, float(off[1]) * 72, 72, 72)
	_icon_cache[key] = at
	return at
