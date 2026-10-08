extends Node
## Static game data shared with the servers (shared/data/*.json) plus sprite
## definitions (client/data/sprites/sprites.json). Port of client/js/data/*.js.

const SHARED := "res://assets/data/shared/"
const SPRITE_ROOT := "res://assets/img/2/sprites/"
const SPRITE_SCALE := 2  # sprite sheets are stored at 2x the logical size

var lang: Dictionary = {}
var mob_kinds: Dictionary = {}       # kind(int) -> Dictionary
var npc_kinds: Array = []            # index = kind
var appearances: Array = []          # index = appearance id
var item_kinds: Dictionary = {}      # kind(int) -> Dictionary
var item_loot: Array = []            # index = kind - 1000
var sprite_defs: Dictionary = {}     # id -> SpriteDef
var static_sheets: Array = []        # client/data/staticsheet.json (item icon sheets)
var crafts: Array = []               # shared/data/craft.json, "id" = index
var skills: Array = []               # shared/data/skills2.json (SkillData.Data)

var _textures: Dictionary = {}


class SpriteDef:
	var id: String
	var file: String
	var width: int
	var height: int
	var offset_x: int
	var offset_y: int
	var animations: Dictionary = {}   # name -> {length, col, row}
	var texture: Texture2D

	func has_anim(anim_name: String) -> bool:
		return animations.has(anim_name)


func _ready() -> void:
	_load_lang()
	_load_mobs()
	npc_kinds = _json(SHARED + "npcs.json", [])
	for npc in npc_kinds:
		if npc is Dictionary:
			npc["title"] = npc.get("name", npc.get("uid", ""))
	appearances = _json(SHARED + "appearance.json", [])
	item_loot = _json(SHARED + "itemloot.json", [])
	static_sheets = _json("res://assets/data/staticsheet.json", [])
	crafts = _json(SHARED + "craft.json", [])
	for i in range(crafts.size()):
		crafts[i]["id"] = i
	_load_items()
	_load_skills()
	_load_sprites()


func _json(path: String, fallback):
	var text := FileAccess.get_file_as_string(path)
	if text == "":
		push_error("GameData: missing %s" % path)
		return fallback
	var data = JSON.parse_string(text)
	if data == null:
		push_error("GameData: invalid JSON in %s" % path)
		return fallback
	return data


func _load_lang() -> void:
	var all = _json(SHARED + "lang.json", {})
	lang = all.get("EN", {}) if all is Dictionary else {}


func _load_mobs() -> void:
	var parsed = _json(SHARED + "mobs.json", {})
	for key in parsed:
		var v: Dictionary = parsed[key]
		var mob := {
			"key": str(key).to_lower(),
			"kind": int(v.get("kind", 0)),
			"name": str(key),
			"level": int(v.get("level", 0)),
			"attackRange": int(v.get("attackRange", 1)),
			"isAggressive": int(v.get("isAggressive", 0)) == 1,
			"moveSpeed": int(300 + 200 * float(v["moveSpeedMod"])) if v.has("moveSpeedMod") and v["moveSpeedMod"] else 500,
			"idleSpeed": int(float(v["idleSpeedMod"]) * 1000) if v.has("idleSpeedMod") and v["idleSpeedMod"] else 1000,
			"attackRate": int(float(v["attackRateMod"]) * 1000) if v.has("attackRateMod") and v["attackRateMod"] else 1000,
			"hp": int(float(v["hpMod"]) * 200) if v.has("hpMod") and v["hpMod"] else 200,
			"spriteName": str(v.get("spriteName", "")),
		}
		mob_kinds[mob.kind] = mob


## Port of client/js/data/items.js (kindData).
func _load_items() -> void:
	var parsed = _json(SHARED + "items2.json", [])
	for v in parsed:
		var kind := int(v.get("id", 0))
		var craft_list: Array = []
		for c in crafts:
			if int(c.get("o", -1)) == kind:
				craft_list.append(c)
		var d := {
			"name": str(v.get("name", "")),
			"type": str(v.get("type", "object")),
			"typemod": str(v.get("typemod", "none")),
			"modifier": int(v.get("modifier", 0)) if v.get("modifier") else 0,
			"sprite": str(v.get("sprite", "")) if v.get("sprite") else "",
			"spriteName": str(v.get("spriteName", "")) if v.get("spriteName") else "",
			"offset": v.get("offset", [0, 0]) if v.get("offset") else [0, 0],
			"buy": int(v.get("buy", 0)) if v.get("buy") else 0,
			"buyCount": int(v.get("buyCount", 1)) if v.get("buyCount") else 1,
			"staticsheet": int(v.get("staticsheet", 0)) if v.get("staticsheet") else 0,
			"legacy": int(v.get("legacy", 0)) if v.get("legacy") else 0,
			"craft": craft_list,
		}
		d["level"] = int(v["level"]) if v.get("level") else d.modifier
		if d.type == "object":
			d["cooldown"] = int(v.get("cooldown", 10)) if v.get("cooldown") else 10
		item_kinds[kind] = d


## Port of client/js/data/skilldata.js.
func _load_skills() -> void:
	for v in _json(SHARED + "skills2.json", []):
		skills.append({
			"name": str(v.get("name", "")),
			"iconOffset": v.get("iconOffset", [0, 0]),
			"detail": str(v.get("detail", "")),
			"skillType": str(v.get("skillType", "")),
			"targetType": v.get("targetType", 0),
			"duration": int(v.get("duration", 0)) if v.get("duration") else 0,
			"recharge": int(float(v.get("recharge", 0)) * 1000) if v.get("recharge") else 0,
			"aoe": int(v.get("aoe", 0)) if v.get("aoe") else 0,
		})


func _load_sprites() -> void:
	var parsed = _json("res://assets/data/sprites.json", [])
	for d in parsed:
		if not (d is Dictionary) or not d.has("animations"):
			continue
		var s := SpriteDef.new()
		s.id = str(d["id"])
		s.file = str(d.get("file", s.id + ".png"))
		s.width = int(d.get("width", 16))
		s.height = int(d.get("height", 16))
		s.offset_x = int(d.get("offset_x", -16))
		s.offset_y = int(d.get("offset_y", -16))
		for anim_name in d["animations"]:
			var a: Dictionary = d["animations"][anim_name]
			s.animations[anim_name] = {
				"length": int(a.get("length", 1)),
				"col": int(a.get("col", 0)),
				"row": int(a.get("row", 0)),
			}
		sprite_defs[s.id] = s


## Returns the sprite definition with its texture loaded (null if unknown).
func get_sprite(id: String) -> SpriteDef:
	var s: SpriteDef = sprite_defs.get(id)
	if s == null:
		return null
	if s.texture == null:
		s.texture = get_texture(SPRITE_ROOT + s.file)
		if s.texture == null:
			s.texture = get_texture("res://assets/img/2/" + s.file)
	return s


func get_texture(path: String) -> Texture2D:
	return get_resource(path) as Texture2D


## Cached load() that returns null instead of erroring for missing files.
func get_resource(path: String) -> Resource:
	if _textures.has(path):
		return _textures[path]
	var res: Resource = null
	if ResourceLoader.exists(path):
		res = load(path)
	_textures[path] = res
	return res


func get_mob(kind: int) -> Dictionary:
	return mob_kinds.get(kind, {})


func get_npc(kind: int) -> Dictionary:
	if kind >= 0 and kind < npc_kinds.size() and npc_kinds[kind] is Dictionary:
		return npc_kinds[kind]
	return {}


func get_appearance_sprite(index: int) -> String:
	if index >= 0 and index < appearances.size():
		return str(appearances[index].get("sprite", ""))
	return ""


func get_item(kind: int) -> Dictionary:
	return item_kinds.get(kind, {})


func is_loot_item(kind: int) -> bool:
	return kind >= 1000 and kind < 2000


func get_loot(kind: int) -> Dictionary:
	var i := kind - 1000
	if i >= 0 and i < item_loot.size():
		return item_loot[i]
	return {}


func item_name(kind: int) -> String:
	if is_loot_item(kind):
		return str(get_loot(kind).get("name", ""))
	return str(get_item(kind).get("name", ""))


func is_equipment(kind: int) -> bool:
	return ItemTypes.is_equipment(kind)


func is_archer_weapon(kind: int) -> bool:
	return ItemTypes.is_archer_weapon(kind)


func is_consumable(kind: int) -> bool:
	return ItemTypes.is_consumable(kind)


func is_craft_item(kind: int) -> bool:
	return ItemTypes.is_craft_item(kind)


func get_skill(index: int) -> Dictionary:
	return skills[index] if index >= 0 and index < skills.size() else {}


func tr_lang(key: String, args = null) -> String:
	var msg = lang.get(key)
	if msg == null:
		return key
	if not (msg is String):
		return str(msg)
	if args != null:
		return Types.format(msg, args)
	return msg
