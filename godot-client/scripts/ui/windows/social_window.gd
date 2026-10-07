class_name SocialWindow
extends GameWindow
## Social / party (socialhandler.js, chathandlercommands.js party commands).
## Guilds exist in the JS UI but not on the server, so they are not shown.

var data: PlayerData
var actions: ItemActions
var _list: VBoxContainer
var _name: LineEdit
var _leave: Button


func _init() -> void:
	super._init("SOCIAL", Vector2(360, 0))


func build() -> void:
	content.add_child(UiStyle.label("Party", 16, Color(1, 1, 0.6), UiStyle.KOMIKA))
	_list = VBoxContainer.new()
	content.add_child(_list)
	_leave = UiStyle.button("Leave Party", func(): actions.client().send([Types.Messages.CW_PARTY, 4, null, 0]))
	content.add_child(_leave)
	content.add_child(HSeparator.new())
	var h := HBoxContainer.new()
	_name = LineEdit.new()
	_name.placeholder_text = "Player name"
	_name.max_length = 16
	_name.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	h.add_child(_name)
	h.add_child(UiStyle.button("Invite", func():
		var n := _name.text.strip_edges()
		if n.length() >= 2:
			invite(n)
			_name.text = ""))
	content.add_child(h)
	content.add_child(UiStyle.label("Chat: /invite name, /kick name, /leader name, /leave", 11, Color(1, 1, 1, 0.6)))


func bind(d: PlayerData, a: ItemActions) -> void:
	data = d
	actions = a
	d.party_changed.connect(func():
		if visible:
			refresh())


func invite(n: String) -> void:
	actions.client().send([Types.Messages.CW_PARTY, 1, n, 0])


func kick(n: String) -> void:
	actions.client().send([Types.Messages.CW_PARTY, 2, n, 0])


func make_leader(n: String) -> void:
	actions.client().send([Types.Messages.CW_PARTY, 3, n, 0])


func refresh() -> void:
	for c in _list.get_children():
		c.queue_free()
	if data.party.size() <= 1:
		_list.add_child(UiStyle.label("No party.", 14, Color(1, 1, 1, 0.7)))
		_leave.visible = false
		return
	_leave.visible = true
	var me: String = world.player.ename
	var leader := data.is_party_leader(me)
	for i in range(data.party.size()):
		var n: String = data.party[i]
		var h := HBoxContainer.new()
		var l := UiStyle.label(n + ("  (leader)" if i == 0 else ""), 14, Color(1, 1, 0) if i == 0 else Color.WHITE)
		l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		h.add_child(l)
		if leader and n != me:
			h.add_child(UiStyle.button("Leader", make_leader.bind(n)))
			h.add_child(UiStyle.button("Kick", kick.bind(n)))
		_list.add_child(h)
