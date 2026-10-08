class_name BankWindow
extends GameWindow
## Bank (dialog/bank/*.js, bankhandler.js): 96 slots, gold transfer and the
## "STORE" button that opens the inventory in bank mode.

var data: PlayerData
var actions: ItemActions
var inventory_window: InventoryWindow
var slots: Array = []
var selected := -1
var _gold: Label


func _init() -> void:
	super._init("BANK", Vector2(660, 0))


func build() -> void:
	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(650, 330)
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	content.add_child(scroll)
	var grid := GridContainer.new()
	grid.columns = 12
	grid.add_theme_constant_override("h_separation", 2)
	grid.add_theme_constant_override("v_separation", 2)
	scroll.add_child(grid)
	for i in range(PlayerData.BANK_SIZE):
		var s := ItemSlot.new()
		s.store_type = PlayerData.Store.BANK
		s.index = i
		s.accepts = ["item"]
		s.pressed.connect(_on_pressed)
		s.activated.connect(func(sl: ItemSlot): _retrieve(sl.index))
		s.secondary.connect(func(sl: ItemSlot): _retrieve(sl.index))
		s.dropped.connect(_on_dropped)
		grid.add_child(s)
		slots.append(s)
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 10)
	content.add_child(h)
	_gold = UiStyle.label("Bank gold: 0", 15, Color(1, 0.85, 0.3))
	_gold.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	h.add_child(_gold)
	h.add_child(UiStyle.button("Withdraw gold", func(): actions.transfer_gold(true)))
	h.add_child(UiStyle.button("Deposit gold", func(): actions.transfer_gold(false)))
	h.add_child(UiStyle.button("STORE ITEMS", func():
		inventory_window.open_mode(ItemActions.Mode.BANK, self)
		close()))
	content.add_child(UiStyle.label("Click an item twice (or double click / drag it to the inventory) to take it out.", 11, Color(1, 1, 1, 0.7)))


func bind(d: PlayerData, a: ItemActions, inv: InventoryWindow) -> void:
	data = d
	actions = a
	inventory_window = inv
	d.bank_changed.connect(refresh)
	d.gold_changed.connect(refresh)


func refresh() -> void:
	if data == null:
		return
	_select(-1)
	for i in range(slots.size()):
		var s: ItemSlot = slots[i]
		var r = data.bank[i]
		if r == null:
			s.clear()
		else:
			s.set_item(ItemTypes.icon(int(r.kind)), ItemTypes.slot_label(r), ItemTypes.durability_percent(r))
			s.tooltip_text = ItemTypes.info_text(r)
			s.payload = r
	_gold.text = "Bank gold: %s   (carried: %s)" % [ItemTypes.short_number(int(data.gold[1])), ItemTypes.short_number(int(data.gold[0]))]


func _select(i: int) -> void:
	if selected >= 0:
		slots[selected].set_selected(false)
	selected = i
	if i >= 0:
		slots[i].set_selected(true)


func _on_pressed(s: ItemSlot) -> void:
	if data.bank[s.index] == null:
		_select(-1)
		return
	if selected == s.index:
		_select(-1)
		_retrieve(s.index)
	else:
		_select(s.index)


func _retrieve(i: int) -> void:
	actions.retrieve_from_bank(i)


func _on_dropped(s: ItemSlot, d: Dictionary) -> void:
	var t := int(d.store)
	if t == PlayerData.Store.EQUIPMENT:
		return
	actions.move_item(t, int(d.slot), PlayerData.Store.BANK, s.index)
