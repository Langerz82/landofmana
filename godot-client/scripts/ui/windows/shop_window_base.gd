class_name ShopWindowBase
extends GameWindow
## Shared layout of the store / craft / auction / looks windows
## (dialog/*/*frame.js + *page.js + *rack.js): tab buttons, a scrolling list
## of "racks" (icon, description, price, action button) and a gold line.

var data: PlayerData
var actions: ItemActions
var inventory_window: InventoryWindow
var tab := 0
var _tabs: HBoxContainer
var _tab_buttons: Array = []
var _list: VBoxContainer
var list_scroll: ScrollContainer
var _gold: Label
var _footer: HBoxContainer


func build() -> void:
	_tabs = HBoxContainer.new()
	_tabs.add_theme_constant_override("separation", 6)
	content.add_child(_tabs)
	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(560, 300)
	list_scroll = scroll
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	content.add_child(scroll)
	_list = VBoxContainer.new()
	_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_list.add_theme_constant_override("separation", 4)
	scroll.add_child(_list)
	_footer = HBoxContainer.new()
	_footer.add_theme_constant_override("separation", 10)
	content.add_child(_footer)
	_gold = UiStyle.label("", 15, Color(1, 0.85, 0.3))
	_gold.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_footer.add_child(_gold)


func bind(d: PlayerData, a: ItemActions, inv: InventoryWindow) -> void:
	data = d
	actions = a
	inventory_window = inv
	d.gold_changed.connect(_refresh_gold)
	d.inventory_changed.connect(func():
		if visible:
			_rebuild())


func set_tabs(names: Array) -> void:
	for c in _tabs.get_children():
		c.queue_free()
	_tab_buttons.clear()
	for i in range(names.size()):
		var b := UiStyle.button(str(names[i]), _on_tab.bind(i), 90)
		b.toggle_mode = true
		_tabs.add_child(b)
		_tab_buttons.append(b)


func add_footer_button(text: String, cb: Callable) -> Button:
	var b := UiStyle.button(text, cb, 90)
	_footer.add_child(b)
	return b


func _on_tab(i: int) -> void:
	tab = i
	for j in range(_tab_buttons.size()):
		_tab_buttons[j].set_pressed_no_signal(j == i)
	tab_changed(i)
	_rebuild()


## Override: called when the tab changes (e.g. to request data).
func tab_changed(_i: int) -> void:
	pass


## Override: fill the list with add_row().
func rows() -> void:
	pass


func refresh() -> void:
	_on_tab(tab)
	_refresh_gold()


func _refresh_gold() -> void:
	if data:
		_gold.text = "Gold: %s    Gems: %d" % [ItemTypes.short_number(int(data.gold[0])), data.gems]


func _rebuild() -> void:
	for c in _list.get_children():
		c.queue_free()
	rows()


func add_row(icon: Texture2D, title: String, detail: String, price: String, button_text: String,
		cb: Callable, extra: Control = null, tooltip := "") -> HBoxContainer:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	var s := ItemSlot.new()
	s.draggable = false
	s.set_item(icon)
	s.tooltip_text = tooltip if tooltip != "" else title
	s.focus_mode = Control.FOCUS_NONE
	row.add_child(s)
	var v := VBoxContainer.new()
	v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	v.add_child(UiStyle.label(title, 14))
	if detail != "":
		var dl := UiStyle.label(detail, 11, Color(0.85, 0.85, 1))
		dl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		v.add_child(dl)
	if extra:
		v.add_child(extra)
	row.add_child(v)
	var pl := UiStyle.label(price, 14, Color(1, 0.85, 0.3))
	pl.custom_minimum_size = Vector2(80, 0)
	pl.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	row.add_child(pl)
	if button_text != "":
		var b := UiStyle.button(button_text, cb, 80)
		row.add_child(b)
	_list.add_child(row)
	return row


func add_info(text: String) -> void:
	var l := UiStyle.label(text, 13, Color(1, 1, 1, 0.7))
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_list.add_child(l)
