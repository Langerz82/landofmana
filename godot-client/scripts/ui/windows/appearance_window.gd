class_name AppearanceWindow
extends ShopWindowBase
## Looks NPC (dialog/appearance/*.js): switch between unlocked armor looks
## and unlock new ones with gems.

var preview: SpritePreview
var _owned: Array = []
var _owned_i := 0
var _look_name: Label
var _preview_index := -1
var _unlock_btn: Button


func _init() -> void:
	super._init("LOOKS", Vector2(620, 0))


func build() -> void:
	var top := HBoxContainer.new()
	top.add_theme_constant_override("separation", 10)
	content.add_child(top)
	preview = SpritePreview.new()
	preview.custom_minimum_size = Vector2(130, 130)
	top.add_child(preview)
	var v := VBoxContainer.new()
	v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	top.add_child(v)
	_look_name = UiStyle.label("", 16, Color(1, 1, 0.6), UiStyle.KOMIKA)
	v.add_child(_look_name)
	v.add_child(UiStyle.label("Your looks:", 13))
	v.add_child(button_row([UiStyle.button("< Prev", func(): _cycle(-1)), UiStyle.button("Next >", func(): _cycle(1))]))
	_unlock_btn = UiStyle.button("Unlock this look", _unlock_previewed)
	_unlock_btn.visible = false
	v.add_child(_unlock_btn)
	super.build()
	list_scroll.custom_minimum_size.y = 230
	set_tabs(["LOCKED LOOKS"])


func bind(d: PlayerData, a: ItemActions, inv: InventoryWindow) -> void:
	super.bind(d, a, inv)
	d.appearances_changed.connect(func():
		_collect_owned()
		if visible:
			_rebuild())


func open() -> void:
	super.open()
	actions.client().send([Types.Messages.CW_REQUEST, 0])
	_collect_owned()
	_show_current()


func _category() -> String:
	return "armorarcher" if world.player.is_archer() else "armor"


func _collect_owned() -> void:
	_owned.clear()
	var cat := _category()
	for i in range(GameData.appearances.size()):
		if str(GameData.appearances[i].get("type", "")) == cat and data.has_appearance(i):
			_owned.append(i)


func _show_current() -> void:
	var p = world.player
	var armor = p.get_sprite(0)
	var weapon = p.get_sprite(1)
	preview.set_sprites(armor.id if armor else "", weapon.id if weapon else "")
	_look_name.text = armor.id if armor else ""
	_unlock_btn.visible = false
	_preview_index = -1
	for j in range(_owned.size()):
		if GameData.get_appearance_sprite(_owned[j]) == (armor.id if armor else ""):
			_owned_i = j
			_look_name.text = str(GameData.appearances[_owned[j]].get("name", ""))


## AppearanceDialog.changeLookArmor()
func _cycle(step: int) -> void:
	if _owned.is_empty():
		return
	_owned_i = posmod(_owned_i + step, _owned.size())
	var id: int = _owned[_owned_i]
	world.player.set_sprite_by_index(0, id)
	actions.client().send([Types.Messages.CW_LOOKUPDATE, 0, id])
	_show_current()


func rows() -> void:
	var cat := _category()
	var n := 0
	for i in range(GameData.appearances.size()):
		var ap: Dictionary = GameData.appearances[i]
		var price: int = int(data.appearance_prices[i]) if i < data.appearance_prices.size() else 0
		if str(ap.get("type", "")) != cat or data.has_appearance(i) or price <= 0:
			continue
		n += 1
		add_row(UiStyle.sprite_frame(str(ap.get("sprite", ""))), str(ap.get("name", "")), "",
			"%d gems" % price, "Preview", _preview.bind(i))
	if n == 0:
		add_info("Loading..." if data.appearance_prices.is_empty() else "You own every look.")


func _preview(i: int) -> void:
	var w = world.player.get_sprite(1)
	preview.set_sprites(GameData.get_appearance_sprite(i), w.id if w else "")
	_look_name.text = str(GameData.appearances[i].get("name", ""))
	_preview_index = i
	_unlock_btn.visible = true


func _unlock_previewed() -> void:
	var i := _preview_index
	if i < 0:
		return
	var price: int = int(data.appearance_prices[i])
	hud.confirm(GameData.tr_lang("SHOP_UNLOCK_CONFIRM", [price]), func(ok: bool):
		if ok:
			actions.client().send([Types.Messages.CW_APPEARANCEUNLOCK, i, price]))
