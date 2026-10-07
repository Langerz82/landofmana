class_name QuestWindow
extends GameWindow
## Quest log (questhandler.js): active quests with an icon, summary and progress.

var data: PlayerData
var _list: VBoxContainer


func _init() -> void:
	super._init("QUESTS", Vector2(480, 0))


func build() -> void:
	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(470, 280)
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	content.add_child(scroll)
	_list = VBoxContainer.new()
	_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(_list)


func bind(d: PlayerData) -> void:
	data = d
	d.quests_changed.connect(func():
		if visible:
			refresh())


func refresh() -> void:
	for c in _list.get_children():
		c.queue_free()
	var n := 0
	for q in data.quests.values():
		if q.status == Quest.Status.COMPLETE:
			continue
		n += 1
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 8)
		var icon := TextureRect.new()
		icon.custom_minimum_size = Vector2(40, 40)
		icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		icon.texture = _icon(q)
		row.add_child(icon)
		var l := UiStyle.label(q.summary if q.summary != "" else "Quest %d" % q.id, 14)
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(l)
		row.add_child(UiStyle.label(q.progress_text(), 14, Color(0.6, 1, 0.6)))
		_list.add_child(row)
	if n == 0:
		_list.add_child(UiStyle.label("No active quests. Talk to the NPCs!", 14, Color(1, 1, 1, 0.7)))


func _icon(q: Quest) -> Texture2D:
	match q.type:
		Quest.QuestType.GETITEMKIND:
			if q.object2 != null:
				return ItemTypes.icon(1000 + int(q.object2.kind))
		Quest.QuestType.KILLMOBKIND:
			if q.object != null:
				return UiStyle.sprite_frame(str(GameData.get_mob(int(q.object.kind)).get("spriteName", "")))
		Quest.QuestType.USENODE:
			if q.object != null:
				return UiStyle.sprite_frame("nodeset%d" % int(q.object.kind), "node%d" % q.data1)
	return null
