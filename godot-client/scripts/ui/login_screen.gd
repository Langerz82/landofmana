class_name LoginScreen
extends Control
## Login / registration / character selection. Replaces the HTML user window,
## player window and app/*.js validation of the JS client.

signal enter_world(info: Dictionary)

const KOMIKA := preload("res://assets/fonts/KOMIKAH.ttf")
const LOGO := preload("res://assets/img/common/landofmana.png")

const INFO_KEYS := {
	"timeout": "TIMEOUT_CONNECT",
	"invalidlogin": "LOGIN_INVALID",
	"userexists": "USERNAME_TAKEN",
	"playerexists": "PLAYERNAME_TAKEN",
	"invalidusername": "USERNAME_INVALID_CHARS",
	"invalidname": "PLAYERNAME_ALPHANUMERIC",
	"loggedin": "USER_ALREADY_LOGGEDIN",
	"ban": "USER_BANNED",
	"full": "SERVERS_FULL",
	"noserver": "NOSERVER",
	"passwordChanged": "PASSWORD_CHANGED",
}

var uc: UserClient
var _host: LineEdit
var _port: LineEdit
var _user: LineEdit
var _pass: LineEdit
var _remember: CheckBox
var _login_btn: Button
var _register_btn: Button
var _connect_btn: Button
var _status: Label
var _login_box: VBoxContainer
var _player_box: VBoxContainer
var _world_select: OptionButton
var _player_list: ItemList
var _new_name: LineEdit
var _play_btn: Button
var _create_btn: Button
var _ready_for_login := false


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var bg := ColorRect.new()
	bg.color = Color(0.06, 0.05, 0.1)
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(bg)
	var center := CenterContainer.new()
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(center)
	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", Hud.panel_style(0.9))
	panel.custom_minimum_size = Vector2(420, 0)
	center.add_child(panel)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 8)
	panel.add_child(v)
	var logo := TextureRect.new()
	logo.texture = LOGO
	logo.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	logo.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	logo.custom_minimum_size = Vector2(400, 140)
	v.add_child(logo)
	_login_box = VBoxContainer.new()
	_login_box.add_theme_constant_override("separation", 6)
	v.add_child(_login_box)
	_player_box = VBoxContainer.new()
	_player_box.add_theme_constant_override("separation", 6)
	_player_box.visible = false
	v.add_child(_player_box)
	_status = Label.new()
	_status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_status.custom_minimum_size = Vector2(400, 0)
	_status.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_status.add_theme_color_override("font_color", Color(1, 0.85, 0.4))
	v.add_child(_status)
	_build_login()
	_build_players()
	var version := Label.new()
	version.text = "Godot client %s  -  protocol v%d" % [ProjectSettings.get_setting("application/config/version", "0"), Config.get_version()]
	version.add_theme_font_size_override("font_size", 10)
	version.add_theme_color_override("font_color", Color(1, 1, 1, 0.4))
	version.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(version)
	connect_user_server()


func _field(parent: Control, label: String, secret := false) -> LineEdit:
	var h := HBoxContainer.new()
	var l := Label.new()
	l.text = label
	l.custom_minimum_size = Vector2(90, 0)
	h.add_child(l)
	var e := LineEdit.new()
	e.secret = secret
	e.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	h.add_child(e)
	parent.add_child(h)
	return e


func _build_login() -> void:
	var server_row := HBoxContainer.new()
	var sl := Label.new()
	sl.text = "Server"
	sl.custom_minimum_size = Vector2(90, 0)
	server_row.add_child(sl)
	_host = LineEdit.new()
	_host.text = Config.get_host()
	_host.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	server_row.add_child(_host)
	_port = LineEdit.new()
	_port.text = str(Config.get_port())
	_port.custom_minimum_size = Vector2(70, 0)
	server_row.add_child(_port)
	_connect_btn = Button.new()
	_connect_btn.text = "Connect"
	_connect_btn.pressed.connect(func():
		Config.set_server(_host.text.strip_edges(), int(_port.text))
		connect_user_server())
	server_row.add_child(_connect_btn)
	_login_box.add_child(server_row)
	_user = _field(_login_box, "Username")
	_pass = _field(_login_box, "Password", true)
	_user.text = str(Config.get_setting("login", "username", ""))
	_pass.text_submitted.connect(func(_t): _try_login(false))
	_remember = CheckBox.new()
	_remember.text = "Remember username"
	_remember.button_pressed = _user.text != ""
	_login_box.add_child(_remember)
	var buttons := HBoxContainer.new()
	buttons.alignment = BoxContainer.ALIGNMENT_CENTER
	buttons.add_theme_constant_override("separation", 12)
	_login_btn = Button.new()
	_login_btn.text = "Login"
	_login_btn.custom_minimum_size = Vector2(140, 34)
	_login_btn.pressed.connect(func(): _try_login(false))
	buttons.add_child(_login_btn)
	_register_btn = Button.new()
	_register_btn.text = "Create account"
	_register_btn.custom_minimum_size = Vector2(140, 34)
	_register_btn.pressed.connect(func(): _try_login(true))
	buttons.add_child(_register_btn)
	_login_box.add_child(buttons)
	_set_login_enabled(false)


func _build_players() -> void:
	var wl := HBoxContainer.new()
	var l := Label.new()
	l.text = "World"
	l.custom_minimum_size = Vector2(90, 0)
	wl.add_child(l)
	_world_select = OptionButton.new()
	_world_select.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	wl.add_child(_world_select)
	_player_box.add_child(wl)
	var pl := Label.new()
	pl.text = "Characters"
	_player_box.add_child(pl)
	_player_list = ItemList.new()
	_player_list.custom_minimum_size = Vector2(400, 120)
	_player_list.item_activated.connect(func(_i): _play())
	_player_box.add_child(_player_list)
	_play_btn = Button.new()
	_play_btn.text = "Play"
	_play_btn.custom_minimum_size = Vector2(160, 34)
	_play_btn.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	_play_btn.pressed.connect(_play)
	_player_box.add_child(_play_btn)
	_player_box.add_child(HSeparator.new())
	_new_name = _field(_player_box, "New hero")
	_new_name.max_length = 16
	_new_name.text_submitted.connect(func(_t): _create())
	_create_btn = Button.new()
	_create_btn.text = "Create character"
	_create_btn.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	_create_btn.pressed.connect(_create)
	_player_box.add_child(_create_btn)


# ------------------------------------------------------------- user server

func connect_user_server() -> void:
	if uc:
		uc.close()
		uc.queue_free()
	_ready_for_login = false
	_set_login_enabled(false)
	_login_box.visible = true
	_player_box.visible = false
	uc = UserClient.new()
	uc.name = "UserClient"
	add_child(uc)
	Game.user_client = uc
	uc.status.connect(func(t): _status.text = t)
	uc.error.connect(_on_error)
	uc.info.connect(_on_info)
	uc.ready_for_login.connect(func():
		_ready_for_login = true
		_set_login_enabled(true)
		_status.text = "Connected to %s:%d" % [Config.get_host(), Config.get_port()]
		if _user.text == "":
			_user.grab_focus()
		else:
			_pass.grab_focus())
	uc.worlds_received.connect(_on_worlds)
	uc.players_received.connect(_on_players)
	uc.world_ready.connect(func(info):
		_status.text = "Entering the world..."
		enter_world.emit(info))
	uc.connect_to_server()


func _set_login_enabled(on: bool) -> void:
	_login_btn.disabled = not on
	_register_btn.disabled = not on


func _try_login(register: bool) -> void:
	if not _ready_for_login:
		return
	var name_t := _user.text.strip_edges()
	var pw := _pass.text
	if name_t.length() < 2 or name_t.length() > 16:
		_status.text = "Username must be 2-16 characters."
		return
	if pw.length() < 1:
		_status.text = "Please enter a password."
		return
	Config.set_setting("login", "username", name_t if _remember.button_pressed else "")
	_set_login_enabled(false)
	_status.text = "Creating account..." if register else "Logging in..."
	if register:
		uc.send_create_user(name_t, pw)
	else:
		uc.send_login_user(name_t, pw)


func _on_worlds(worlds: Array) -> void:
	_world_select.clear()
	for w in worlds:
		_world_select.add_item("%s  %d/%d" % [w.name, w.count, w.max], w.index)


func _on_players(players: Array) -> void:
	_login_box.visible = false
	_player_box.visible = true
	_player_list.clear()
	for p in players:
		_player_list.add_item("%s   Lv %d" % [p.name, p.level])
	if players.is_empty():
		_status.text = "Create your first character."
		_new_name.grab_focus()
	else:
		_player_list.select(players.size() - 1)
		_status.text = "Choose a character."
		_play_btn.grab_focus()


func _world_index() -> int:
	if _world_select.item_count == 0:
		return 0
	return _world_select.get_selected_id()


func _play() -> void:
	var sel := _player_list.get_selected_items()
	if sel.is_empty():
		_status.text = "Select a character first."
		return
	_play_btn.disabled = true
	_status.text = "Loading character..."
	uc.send_login_player(_world_index(), uc.players[sel[0]].index)


func _create() -> void:
	var n := _new_name.text.strip_edges()
	if n.length() < 2 or n.length() > 16:
		_status.text = "Character names must be 2-16 characters."
		return
	_create_btn.disabled = true
	_status.text = "Creating character..."
	uc.send_create_player(_world_index(), n)


func _on_info(code: String) -> void:
	_set_login_enabled(_ready_for_login)
	_play_btn.disabled = false
	_create_btn.disabled = false
	var key: String = INFO_KEYS.get(code, "")
	var msg := GameData.tr_lang(key) if key != "" else code
	if msg == key:
		msg = code
	_status.text = msg


func _on_error(text: String) -> void:
	_ready_for_login = false
	_set_login_enabled(false)
	_play_btn.disabled = false
	_create_btn.disabled = false
	_login_box.visible = true
	_player_box.visible = false
	_status.text = text + "\nCheck the server address and press Connect."
