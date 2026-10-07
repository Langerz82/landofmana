class_name SkillsWindow
extends GameWindow
## Skills (dialog/skilldialog.js, skillhandler.js): learned skills with
## level, details, cooldown; click twice to use, drag onto the shortcut bar.

var data: PlayerData
var actions: ItemActions
var slots: Array = []
var _detail: Label
var _selected := -1
var select_time := 0      # ms tick of the last selection


func _init() -> void:
	super._init("SKILLS", Vector2(380, 0))


func build() -> void:
	var grid := GridContainer.new()
	grid.columns = 4
	grid.add_theme_constant_override("h_separation", 6)
	grid.add_theme_constant_override("v_separation", 6)
	content.add_child(grid)
	for i in range(GameData.skills.size()):
		var s := ItemSlot.new()
		s.index = i
		s.drag_kind = "skill"
		s.pressed.connect(_on_pressed)
		s.activated.connect(func(sl: ItemSlot): _use(sl.index))
		s.secondary.connect(func(sl: ItemSlot): _use(sl.index))
		grid.add_child(s)
		slots.append(s)
	_detail = UiStyle.label("Select a skill. Click it again to use it, or click a shortcut slot to put it there.", 13)
	_detail.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_detail.custom_minimum_size = Vector2(340, 60)
	content.add_child(_detail)


func bind(d: PlayerData, a: ItemActions) -> void:
	data = d
	actions = a
	d.skills_changed.connect(refresh)


func refresh() -> void:
	if data == null:
		return
	for i in range(slots.size()):
		var s: ItemSlot = slots[i]
		var lvl := data.skill_level_of(i) if i < data.skill_exps.size() else 0
		var sk := GameData.get_skill(i)
		s.visible = lvl > 0
		s.draggable = lvl > 0
		s.set_item(ItemTypes.skill_icon(i), "Lv %d" % lvl if lvl > 0 else "")
		s.tooltip_text = "%s Lv: %d" % [sk.get("name", ""), lvl]
		s.payload = {"skill": i}
		s.set_selected(i == _selected)


func _process(_d: float) -> void:
	if not visible or actions == null:
		return
	for i in range(slots.size()):
		slots[i].set_cooldown(int(ceil(actions.skill_cooldown_left(i) / 1000.0)))


func _on_pressed(s: ItemSlot) -> void:
	if _selected == s.index:
		_use(s.index)
		return
	_selected = s.index
	select_time = Time.get_ticks_msec()
	var sk := GameData.get_skill(s.index)
	var lvl := data.skill_level_of(s.index)
	_detail.text = str(sk.get("detail", "")).replace("[l]", str(lvl)).replace("[u]", str(lvl))
	refresh()


## The selected skill, for "click a skill, then a shortcut slot".
func shortcut_pick() -> Dictionary:
	if not visible or _selected < 0 or data == null or data.skill_level_of(_selected) <= 0:
		return {}
	return {"type": 2, "id": _selected}


func clear_shortcut_pick() -> void:
	_selected = -1
	_detail.text = "Select a skill. Click it again to use it, or click a shortcut slot to put it there."
	refresh()


func _use(i: int) -> void:
	actions.execute_skill(i)
