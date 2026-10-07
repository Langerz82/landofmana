class_name AchievementWindow
extends GameWindow
## Achievements log (achievementhandler.js).

var data: PlayerData
var _list: VBoxContainer


func _init() -> void:
	super._init("ACHIEVEMENTS", Vector2(420, 0))


func build() -> void:
	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(410, 260)
	content.add_child(scroll)
	_list = VBoxContainer.new()
	_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(_list)


func bind(d: PlayerData) -> void:
	data = d
	d.achievements_changed.connect(func():
		if visible:
			refresh())


func refresh() -> void:
	for c in _list.get_children():
		c.queue_free()
	for a in data.achievements:
		var row := HBoxContainer.new()
		var l := UiStyle.label(str(a.summary), 14)
		l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(l)
		var pct := 0
		if int(a.objectCount) > 0:
			pct = int(float(a.count) / float(a.objectCount) * 100)
		row.add_child(UiStyle.label("%d%%" % pct, 14, Color(0.6, 1, 0.6) if pct >= 100 else Color.WHITE))
		_list.add_child(row)
	if data.achievements.is_empty():
		_list.add_child(UiStyle.label("No achievements yet.", 14, Color(1, 1, 1, 0.7)))
