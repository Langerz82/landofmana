class_name CraftWindow
extends ShopWindowBase
## Craft NPC (dialog/craft/*.js): every recipe from shared/data/craft.json,
## split into misc / armor / weapon tabs, with the required items shown.

func _init() -> void:
	super._init("CRAFT", Vector2(620, 0))


func build() -> void:
	super.build()
	set_tabs(["MISC", "ARMOR", "WEAPON"])


func rows() -> void:
	var count := 0
	for c in GameData.crafts:
		var kind := int(c.get("o", 0))
		var d := ItemTypes.data(kind)
		if d.is_empty() or int(d.legacy) == 1:
			continue
		var cat := 1 if ItemTypes.is_armor(kind) else (2 if ItemTypes.is_weapon(kind) else 0)
		if cat != tab:
			continue
		count += 1
		var reqs := HBoxContainer.new()
		reqs.add_theme_constant_override("separation", 4)
		reqs.add_child(UiStyle.label("Needs:", 12))
		var ok := true
		for it in c.get("i", []):
			var k := int(it[0])
			var need := int(it[1])
			var have := data.item_total_count(k)
			if have < need:
				ok = false
			var icon := TextureRect.new()
			icon.texture = ItemTypes.icon(k)
			icon.custom_minimum_size = Vector2(24, 24)
			icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
			icon.tooltip_text = ItemTypes.name_of(k)
			reqs.add_child(icon)
			reqs.add_child(UiStyle.label("%d/%d" % [have, need], 12, Color(0.5, 1, 0.5) if have >= need else Color(1, 0.5, 0.5)))
		var room := PlayerData.make_room(0, kind, 1, 900, 900, 0)
		var row := add_row(ItemTypes.icon(kind), ItemTypes.name_of(kind), "", ItemTypes.short_number(ItemTypes.get_craft_price(kind)),
			"Craft", actions.craft.bind(c), reqs, ItemTypes.info_text(room))
		if not ok:
			row.modulate = Color(1, 1, 1, 0.75)
	if count == 0:
		add_info("No recipes in this category.")
