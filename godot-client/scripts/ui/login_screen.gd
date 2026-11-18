# This file is part of Land of Mana (https://github.com/Langerz82/landofmana).
# SPDX-License-Identifier: GPL-3.0-only
# Copyright (C) 2023-2026 Joshua Langley and contributors
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, version 3 of the License.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program. See the LICENSE file in the project root,
# or <https://www.gnu.org/licenses/>.

class_name LoginScreen
extends Control
## Login / registration / password change / character selection. Replaces the
## HTML user window, create-account and change-password windows, player window
## and app/*.js validation of the JS client.

signal enter_world(info: Dictionary)

const KOMIKA := preload("res://assets/fonts/KOMIKAH.ttf")
const LOGO := preload("res://assets/img/common/landofmana.png")
## Narrowest the login / character panel is laid out at (before scaling).
const PANEL_WIDTH := 450.0
## Desktop: widest the panel appears on screen, in screen pixels -- the UI
## scale does not change it; on narrower screens it spans the full width.
## Mobile: the panel is laid out PANEL_MAX_WIDTH wide and scaled so it fills
## the full screen width.
const PANEL_MAX_WIDTH := 450.0
## Space kept free above + below the panel (screen pixels).
const PANEL_V_MARGIN := 16.0

const INFO_KEYS := {
	"timeout": "TIMEOUT_CONNECT",
	"invalidlogin": "LOGIN_INVALID",
	"userexists": "USERNAME_TAKEN",
	"playerexists": "PLAYERNAME_TAKEN",
	"invalidusername": "USERNAME_INVALID_CHARS",
	"invalidemail": "EMAIL_INVALID",
	"passwordfail": "PASSWORD_CHANGE_FAILED",
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
var _update_btn: Button     # shown when the server runs a newer client version
var _login_box: VBoxContainer
## Create-account window: opened by "Create account" on the login box, in its
## place (see _show_register / _try_register).
var _register_box: VBoxContainer
var _reg_user: LineEdit
var _reg_pass: LineEdit
var _reg_pass2: LineEdit
var _reg_email: LineEdit
var _reg_create_btn: Button
## Change-password window, once logged in: opened by "Change password" on the
## character list (see _show_change_password / _try_change_password). Only the
## new password is asked for -- the account is the logged-in one.
var _password_box: VBoxContainer
var _cp_new: LineEdit
var _cp_new2: LineEdit
var _cp_btn: Button
var _player_box: VBoxContainer
var _world_select: OptionButton
var _player_list: ItemList
var _new_name: LineEdit
var _play_btn: Button
var _create_btn: Button
var _ready_for_login := false
var _panel: PanelContainer


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
	panel.custom_minimum_size = Vector2(PANEL_WIDTH, 0)
	center.add_child(panel)
	_panel = panel
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
	_register_box = VBoxContainer.new()
	_register_box.add_theme_constant_override("separation", 6)
	_register_box.visible = false
	v.add_child(_register_box)
	_password_box = VBoxContainer.new()
	_password_box.add_theme_constant_override("separation", 6)
	_password_box.visible = false
	v.add_child(_password_box)
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
	_update_btn = Button.new()
	_update_btn.text = "Update"
	_update_btn.visible = false
	_update_btn.pressed.connect(func():
		if not Config.open_update_page():
			_status.text = "Could not open the update page.")
	v.add_child(_update_btn)
	_build_login()
	_build_register()
	_build_change_password()
	_build_players()
	var version := Label.new()
	version.text = "Godot client %s  -  protocol v%d" % [ProjectSettings.get_setting("application/config/version", "0"), Config.get_version()]
	version.add_theme_font_size_override("font_size", 10)
	version.add_theme_color_override("font_color", Color(1, 1, 1, 0.4))
	version.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(version)
	# Settings -> UI scale applies here too (same crisp-font setup as the HUD).
	UiStyle.set_hud_root(self)
	apply_ui_scale()
	get_viewport().size_changed.connect(apply_ui_scale)
	panel.minimum_size_changed.connect(apply_ui_scale, CONNECT_DEFERRED)
	connect_user_server()


## Desktop: the login / character panel spans the full screen width, up to
## PANEL_MAX_WIDTH screen pixels whatever the UI scale (centred). The screen
## is laid out at screen size / scale and drawn scaled (like the HUD); the scale is the biggest at
## which the panel's natural size (PANEL_WIDTH wide, or its content if wider)
## fits that width and, with PANEL_V_MARGIN, the screen height. When the
## height is what limits it (landscape phones) the panel is laid out wider so
## it still reaches that width.
##
## Mobile: as wide as the screen's width or height, whichever is smaller
## (the full width in portrait) -- the panel is laid out PANEL_MAX_WIDTH wide
## and scaled by that size / PANEL_MAX_WIDTH (or, if that would make it taller
## than the screen, scaled to fit the height and laid out wider so it still
## reaches that width).
func apply_ui_scale() -> void:
	var vp := get_viewport().get_visible_rect().size
	var s := UiStyle.ui_scale
	var mobile := UiStyle.is_mobile()
	var target_w := minf(vp.x, vp.y) if mobile else minf(vp.x, PANEL_MAX_WIDTH)
	if _panel:
		var need := _natural_panel_size(PANEL_MAX_WIDTH if mobile else PANEL_WIDTH)
		s = minf(target_w / need.x, maxf(vp.y - PANEL_V_MARGIN, 1.0) / need.y)
		s = clampf(s, UiStyle.UI_SCALE_MIN, UiStyle.UI_SCALE_MAX)
	set_anchors_and_offsets_preset(Control.PRESET_TOP_LEFT)
	position = Vector2.ZERO
	scale = Vector2(s, s)
	size = vp / s
	if _panel:
		_panel.custom_minimum_size.x = target_w / s


## The panel's size without the full-width stretch: its content plus the
## panel margins, at least min_width across.
func _natural_panel_size(min_width: float) -> Vector2:
	var inner := (_panel.get_child(0) as Control).get_combined_minimum_size()
	var sb := _panel.get_theme_stylebox("panel")
	var n := inner + (sb.get_minimum_size() if sb else Vector2.ZERO)
	n.x = maxf(n.x, min_width)
	return n


func _field(parent: Control, label: String, secret := false, label_width := 90.0) -> LineEdit:
	var h := HBoxContainer.new()
	var l := Label.new()
	l.text = label
	l.custom_minimum_size = Vector2(label_width, 0)
	h.add_child(l)
	var e := LineEdit.new()
	e.secret = secret
	if secret:
		e.secret_character = "*"
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
	_pass.text_submitted.connect(func(_t): _try_login())
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
	_login_btn.pressed.connect(func(): _try_login())
	buttons.add_child(_login_btn)
	_register_btn = Button.new()
	_register_btn.text = "Create account"
	_register_btn.custom_minimum_size = Vector2(140, 34)
	_register_btn.pressed.connect(_show_register)
	buttons.add_child(_register_btn)
	_login_box.add_child(buttons)
	_set_login_enabled(false)


func _build_register() -> void:
	var title := Label.new()
	title.text = "Create account"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", 20)
	_register_box.add_child(title)
	_reg_user = _field(_register_box, "Username")
	_reg_user.max_length = 16
	_reg_pass = _field(_register_box, "Password", true)
	_reg_pass.max_length = 32
	_reg_pass2 = _field(_register_box, "Confirm", true)
	_reg_pass2.max_length = 32
	_reg_email = _field(_register_box, "E-mail")
	_reg_email.max_length = 254
	_reg_email.placeholder_text = "optional"
	_reg_email.virtual_keyboard_type = LineEdit.KEYBOARD_TYPE_EMAIL_ADDRESS
	for e: LineEdit in [_reg_user, _reg_pass, _reg_pass2, _reg_email]:
		e.text_submitted.connect(func(_t): _try_register())
	var buttons := HBoxContainer.new()
	buttons.alignment = BoxContainer.ALIGNMENT_CENTER
	buttons.add_theme_constant_override("separation", 12)
	var back := Button.new()
	back.text = "Back"
	back.custom_minimum_size = Vector2(140, 34)
	back.pressed.connect(_show_login)
	buttons.add_child(back)
	_reg_create_btn = Button.new()
	_reg_create_btn.text = "Create"
	_reg_create_btn.custom_minimum_size = Vector2(140, 34)
	_reg_create_btn.pressed.connect(_try_register)
	buttons.add_child(_reg_create_btn)
	_register_box.add_child(buttons)


func _build_change_password() -> void:
	var title := Label.new()
	title.text = "Change password"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", 20)
	_password_box.add_child(title)
	_cp_new = _field(_password_box, "New password", true, 150.0)
	_cp_new.max_length = 32
	_cp_new2 = _field(_password_box, "Confirm password", true, 150.0)
	_cp_new2.max_length = 32
	for e: LineEdit in [_cp_new, _cp_new2]:
		e.text_submitted.connect(func(_t): _try_change_password())
	var buttons := HBoxContainer.new()
	buttons.alignment = BoxContainer.ALIGNMENT_CENTER
	buttons.add_theme_constant_override("separation", 12)
	var back := Button.new()
	back.text = "Back"
	back.custom_minimum_size = Vector2(140, 34)
	back.pressed.connect(_show_players)
	buttons.add_child(back)
	_cp_btn = Button.new()
	_cp_btn.text = "Change"
	_cp_btn.custom_minimum_size = Vector2(140, 34)
	_cp_btn.pressed.connect(_try_change_password)
	buttons.add_child(_cp_btn)
	_password_box.add_child(buttons)


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
	_player_box.add_child(HSeparator.new())
	var change_pw := Button.new()
	change_pw.text = "Change password"
	change_pw.flat = true
	change_pw.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	change_pw.pressed.connect(_show_change_password)
	_player_box.add_child(change_pw)


# ------------------------------------------------------------- user server

func connect_user_server() -> void:
	if uc:
		uc.close()
		uc.queue_free()
	_ready_for_login = false
	_set_login_enabled(false)
	_login_box.visible = true
	_register_box.visible = false
	_password_box.visible = false
	_player_box.visible = false
	uc = UserClient.new()
	uc.name = "UserClient"
	add_child(uc)
	Game.user_client = uc
	uc.status.connect(func(t): _status.text = t)
	uc.error.connect(_on_error)
	_update_btn.visible = false
	uc.update_required.connect(func(): _update_btn.visible = Config.get_update_page() != "")
	uc.info.connect(_on_info)
	uc.ready_for_login.connect(func():
		_ready_for_login = true
		_set_login_enabled(true)
		# Nothing is focused automatically (no on-screen keyboard popping up);
		# the player clicks the username / password box.
		_status.text = "Connected to %s:%d" % [Config.get_host(), Config.get_port()])
	uc.worlds_received.connect(_on_worlds)
	uc.players_received.connect(_on_players)
	uc.world_ready.connect(func(info):
		_status.text = "Entering the world..."
		enter_world.emit(info))
	uc.connect_to_server()


func _set_login_enabled(on: bool) -> void:
	_login_btn.disabled = not on
	_register_btn.disabled = not on
	if _reg_create_btn:  # null while _build_login runs (built after it)
		_reg_create_btn.disabled = not on
	if _cp_btn:
		_cp_btn.disabled = not on


func _try_login() -> void:
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
	_status.text = "Logging in..."
	uc.send_login_user(name_t, pw)


## Opens the create-account window in place of the login box, carrying over
## the username typed there.
func _show_register() -> void:
	_reg_user.text = _user.text.strip_edges()
	_reg_pass.text = ""
	_reg_pass2.text = ""
	_login_box.visible = false
	_register_box.visible = true
	_status.text = "Choose a username and password. The e-mail is optional."


## Back to the login box from the create-account window, keeping the username
## typed there.
func _show_login() -> void:
	if _reg_user.text.strip_edges() != "":
		_user.text = _reg_user.text.strip_edges()
	_reg_pass.text = ""
	_reg_pass2.text = ""
	_register_box.visible = false
	_login_box.visible = true
	_status.text = ""


## Opens the change-password window over the character list (logged in).
func _show_change_password() -> void:
	_clear_password_fields()
	_player_box.visible = false
	_password_box.visible = true
	_status.text = "Choose a new password for %s." % Game.username
	_cp_new.grab_focus()


## Back to the character list from the change-password window.
func _show_players() -> void:
	_clear_password_fields()
	_password_box.visible = false
	_player_box.visible = true
	_status.text = ""


func _clear_password_fields() -> void:
	_cp_new.text = ""
	_cp_new2.text = ""


## Same rules as the JS client's validatePasswordForm (app/appvalidation.js):
## the new password follows the new-account rules and must match the confirm
## field. The user server changes the logged-in account's password.
func _try_change_password() -> void:
	if not _ready_for_login or Game.username == "":
		return
	var new_pw := _cp_new.text
	if new_pw.length() < 6 or new_pw.length() > 32:
		_status.text = GameData.tr_lang("PASSWORD_LENGTH")
		return
	if new_pw != _cp_new2.text:
		_status.text = GameData.tr_lang("PASSWORD_MISMATCH")
		return
	_set_login_enabled(false)
	_status.text = "Changing password..."
	uc.send_change_password(new_pw)


## Same rules as the JS client's validateRegisterForm (app/appvalidation.js);
## the e-mail check matches shared/js/utils.js Utils.checkInputEmail, which the
## user server applies again.
func _try_register() -> void:
	if not _ready_for_login:
		return
	var name_t := _reg_user.text.strip_edges()
	var pw := _reg_pass.text
	var email := _reg_email.text.strip_edges()
	var alnum := RegEx.create_from_string("^[A-Za-z0-9]+$")
	if name_t.length() < 2 or name_t.length() > 16:
		_status.text = GameData.tr_lang("USERNAME_LENGTH")
		return
	if alnum.search(name_t) == null:
		_status.text = GameData.tr_lang("USERNAME_ALPHANUMERIC")
		return
	if pw.length() < 6 or pw.length() > 32:
		_status.text = GameData.tr_lang("PASSWORD_LENGTH")
		return
	if pw != _reg_pass2.text:
		_status.text = GameData.tr_lang("PASSWORD_MISMATCH")
		return
	if email != "" and not _valid_email(email):
		_status.text = GameData.tr_lang("EMAIL_INVALID")
		return
	Config.set_setting("login", "username", name_t if _remember.button_pressed else "")
	_set_login_enabled(false)
	_status.text = "Creating account..."
	uc.send_create_user(name_t, pw, email)


static func _valid_email(email: String) -> bool:
	if email.length() < 6 or email.length() > 254:
		return false
	var re := RegEx.create_from_string(
		"^[A-Za-z0-9._%+\\-]+@[A-Za-z0-9\\-]+(\\.[A-Za-z0-9\\-]+)*\\.[A-Za-z]{2,}$")
	return re.search(email) != null


func _on_worlds(worlds: Array) -> void:
	_world_select.clear()
	for w in worlds:
		_world_select.add_item("%s  %d/%d" % [w.name, w.count, w.max], w.index)


func _on_players(players: Array) -> void:
	_login_box.visible = false
	_register_box.visible = false
	_password_box.visible = false
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
	if code == "passwordChanged":
		# Saved by the user server -- back to the character list, still logged in.
		_show_players()
	_status.text = msg


func _on_error(text: String) -> void:
	_ready_for_login = false
	_set_login_enabled(false)
	_play_btn.disabled = false
	_create_btn.disabled = false
	_login_box.visible = true
	_register_box.visible = false
	_password_box.visible = false
	_player_box.visible = false
	_status.text = text + "\nCheck the server address and press Connect."
