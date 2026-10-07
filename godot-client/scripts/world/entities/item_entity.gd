class_name ItemEntity
extends Entity
## Port of client/js/entity/item.js - an item lying on the ground.

var count := 1
var _frame := Vector2i.ZERO
var _half := false


func setup_item() -> void:
	var def = null
	var offset = [0, 0]
	if GameData.is_loot_item(kind):
		def = GameData.get_sprite("itemloot")
		offset = GameData.get_loot(kind).get("offset", [0, 0])
		_half = true
	else:
		var d := GameData.get_item(kind)
		def = GameData.get_sprite(str(d.get("spriteName", "")))
		offset = d.get("offset", [0, 0])
		_half = GameData.is_craft_item(kind)
	if def == null:
		def = GameData.get_sprite("items")
	_frame = Vector2i(int(offset[0]), int(offset[1]))
	if def != null:
		set_sprite(def, 0)


func display_name() -> String:
	if GameData.is_equipment(kind):
		return "%d+%d" % [int(GameData.get_item(kind).get("level", 0)), count]
	var n := GameData.item_name(kind)
	return ("%dx " % count + n) if count > 1 else n


func sync_view() -> void:
	position = Vector2(x, y)
	if _views.is_empty():
		return
	var view: Sprite2D = _views[0]
	var def = sprites[0]
	if def == null or def.texture == null or hidden_by_area:
		view.visible = false
		return
	var s := GameData.SPRITE_SCALE
	view.region_rect = Rect2(_frame.x * def.width * s, _frame.y * def.height * s, def.width * s, def.height * s)
	view.scale = Vector2.ONE / s * (0.5 if _half else 1.0)
	view.visible = true
