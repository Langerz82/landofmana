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

class_name Gamepad
extends CanvasLayer
## Gamepad support (client/js/gamepad/*.js), created by the HUD once the game
## UI is built.
##
##   Left stick / D-pad   walk; in a window, menu or modal: move the selection
##                        (held: repeats every NAV_REPEAT_MS, like the JS
##                        client's 200 ms navigation interval)
##   Right stick          move the cursor
##   A                    interact / attack next to the player; in a window
##                        or modal: press the selected button / slot
##   B                    target the closest enemy; with something open:
##                        close the top window (inventory / bank: deselect the
##                        item first), cancel a modal, close chat, leave the
##                        menu bar; died / error panel: its button
##   X                    mouse click at the cursor (GUI first, then the
##                        world); on a selected item slot: its secondary
##                        action (item_slot.gd)
##   Y (hold)             cursor mode while held: the left stick moves the
##                        cursor instead of the player (gamepad.js navMouse)
##   Select (Back)        select the menu bar / shortcut bar (gamepad.js
##                        mainButtonsActive); Select or B again to leave
##   Start                settings
##   L1 + A / B / X / Y   shortcuts 1-4,  R1 + A / B  shortcuts 5-6
##   L1 / R1              in the store / craft / auction / looks windows:
##                        previous / next tab
##
## Dropdowns (OptionButton): A opens it; while its list is open the stick /
## D-pad moves through the items, A picks the highlighted item and B closes
## the list without changing anything.
## Number text fields (SpinBox): A starts editing (green frame), then up /
## down increase / decrease the value by its step; B (or A) stops editing.
## Whole-number fields that go to 100 or more (drop / move counts, gold,
## auction prices) are edited digit by digit instead: the number shows with
## leading zeros and one digit selected, left / right pick the digit, up /
## down change it (carrying over, kept within the field's min / max). Not
## editing, the stick / D-pad just moves between fields.
## Sliders: left / right decrease / increase the value (ui_left / ui_right).
## Chat: while chat is open and the gamepad is the input in use, an on-screen
## keyboard shows (OnScreenKeyboard) -- never for keyboard / mouse players,
## and real keyboard / mouse input hides it again. A types the selected key or
## quick phrase, B deletes (on an empty line: closes chat), X space, Y shift,
## L1 / R1 letters / symbols, Start sends, Select closes; the stick stays on it.
## Popups (confirm / notify / "how many?"): while one is open the gamepad
## stays inside it -- the stick only moves between its controls, L1 / R1,
## Select and Start do nothing -- until it's confirmed or cancelled.
## Window scroll bars: the stick can select them (right from the content);
## a selected vertical bar scrolls with up / down (horizontal: left / right),
## faster while held; the other direction moves back into the content.
## Colour picker (ColorPickerButton): while its popup is open the stick /
## D-pad moves between its controls. A on a slider, number box, the colour
## square or the hue strip starts editing it (green frame): the stick changes
## it (faster while held; square: left / right saturation, up / down
## brightness; hue strip: up / down), A again keeps the change, B cancels it
## (back to the colour from before editing). A presses its buttons (RGB / HSV
## modes, eyedropper, swatches) and opens its menus, where A picks and B
## closes. B while not editing closes the picker.
##
## Joypad events are taken here in _input (before the GUI) while in game, and
## the sticks and D-pad are polled in _process, so the GUI never navigates on
## its own from stick noise. A blue frame (gamepad.js setSelectedItem) marks
## the focused control while the gamepad is in use.

const DEADZONE := 0.25         # gamepad.js ignorezone
const NAV_REPEAT_MS := 200     # gamepad.js resetNavInterval(200)
const CURSOR_SPEED := 600.0    # screen px / s at full stick deflection
const HIGHLIGHT := Color(0, 0, 1)
const HIGHLIGHT_EDIT := Color(0, 0.8, 0)   # a SpinBox being changed with up / down
const HIGHLIGHT_WIDTH := 3.0
## Face button -> shortcut slot with L1 held; R1 adds 4 (only A / B fit).
const FACE := {JOY_BUTTON_A: 0, JOY_BUTTON_B: 1, JOY_BUTTON_X: 2, JOY_BUTTON_Y: 3}
const DPAD := [JOY_BUTTON_DPAD_UP, JOY_BUTTON_DPAD_DOWN, JOY_BUTTON_DPAD_LEFT, JOY_BUTTON_DPAD_RIGHT]
const UI_ACTIONS := {
	Types.Orientation.UP: "ui_up", Types.Orientation.DOWN: "ui_down",
	Types.Orientation.LEFT: "ui_left", Types.Orientation.RIGHT: "ui_right",
}
const SHOP_WINDOWS := ["store", "craft", "auction", "looks"]

var hud = null
var world = null
## Cursor mode (gamepad.js navMouse), on while Y is held: the left stick moves
## the cursor (X clicks).
var nav_mouse := false
## Menu bar / shortcut bar selected (gamepad.js mainButtonsActive).
var bar_mode := false

var _move_dir := 0     # direction the gamepad is walking the player (0 = none)
var _nav_dir := 0      # held UI navigation direction
var _nav_next := 0     # ms tick of the next repeat
var _used := false     # gamepad is the last input used: show the focus frame
var _eaten := {}       # button_index -> its press was handled here, so eat the release too
var _held := {}        # button_index -> ui_* action it pressed (released with the button)
var _synth := false    # pushing our own mouse events
var _cursor := Vector2(-1, -1)
var _cursor_shown := false
## Desktop: move the real mouse. Web / mobile can't warp it, so a cursor is
## drawn here and mouse-motion events are sent instead.
var _warp := OS.has_feature("pc") and not OS.has_feature("web")
var _overlay: Control
var _kb: OnScreenKeyboard = null   # chat on-screen keyboard (made on first use)
var _spin_edit: SpinBox = null   # SpinBox in edit mode (A on it; B / A end it)
var _digit := 0                  # digit-by-digit editing: selected digit, 0 = ones
var _prev_a := false   # A / B held last frame (dropdown lists are polled)
var _prev_b := false
## Joypad events taken out of the ui_* actions while in game (restored on exit).
var _stripped: Dictionary = {}


func _ready() -> void:
	layer = 100
	_overlay = Control.new()
	_overlay.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_overlay.draw.connect(_draw_overlay)
	add_child(_overlay)
	Input.joy_connection_changed.connect(func(_d, _c): _stop_move())
	_strip_ui_joypad()


func _exit_tree() -> void:
	for action in _stripped:
		for ev in _stripped[action]:
			InputMap.action_add_event(action, ev)
	_stripped.clear()


## In game every gamepad UI move goes through here (_navigate pushes ui_*
## actions; A / B push ui_accept / ui_cancel). Godot's own joypad entries in
## the ui_* actions would act a second time -- an open dropdown list gets the
## raw D-pad / stick before any script can stop it (double steps, stick noise
## scrolling it) -- so they are taken out while this node exists.
func _strip_ui_joypad() -> void:
	for action in InputMap.get_actions():
		if not str(action).begins_with("ui_"):
			continue
		var removed: Array = []
		for ev in InputMap.action_get_events(action):
			if ev is InputEventJoypadButton or ev is InputEventJoypadMotion:
				removed.append(ev)
				InputMap.action_erase_event(action, ev)
		if not removed.is_empty():
			_stripped[action] = removed


func is_active() -> bool:
	return not Input.get_connected_joypads().is_empty()


func _game_ready() -> bool:
	return world != null and world.player != null and world.started and world.map_status >= 2 \
		and hud != null and hud.modals != null


# ---------------------------------------------------------------- input

func _input(e: InputEvent) -> void:
	if not (e is InputEventJoypadButton or e is InputEventJoypadMotion):
		# Mouse / keyboard / touch again: hide the focus frame.
		if _used and not _synth and (e is InputEventMouseButton or e is InputEventKey or e is InputEventScreenTouch):
			_used = false
			_cursor_shown = false
			_overlay.queue_redraw()
		return
	if not _game_ready():
		return   # login screen etc.: Godot's own ui_* joypad navigation
	_used = true
	var vp := get_viewport()
	if e is InputEventJoypadMotion:
		vp.set_input_as_handled()   # sticks are polled in _process
		return
	var b: int = e.button_index
	if b == JOY_BUTTON_A:
		_prev_a = e.pressed   # seen here: not a new press for _poll_dropdown
	elif b == JOY_BUTTON_B:
		_prev_b = e.pressed
	if b in DPAD:
		vp.set_input_as_handled()   # polled in _process too
		return
	if not e.pressed:
		if b == JOY_BUTTON_Y:
			set_nav_mouse(false)   # cursor mode only while Y is held
		if _eaten.get(b, false):
			_eaten[b] = false
			vp.set_input_as_handled()
			if _held.has(b):
				_action(_held[b], false)
				_held.erase(b)
		return
	if _press(b, e.device):
		_eaten[b] = true
		vp.set_input_as_handled()


## Godot's default ui_accept / ui_cancel have no gamepad buttons, so A / B
## send the actions themselves: pressed now, released with the button.
func _hold(b: int, action: String) -> void:
	_held[b] = action
	_action(action, true)


func _action(action: String, pressed: bool) -> void:
	var a := InputEventAction.new()
	a.action = action
	a.pressed = pressed
	get_viewport().push_input(a)


## A button went down. True = handled here (the GUI doesn't see it).
func _press(b: int, device: int) -> bool:
	if _kb_open():
		_kb_press(b)
		return true
	_check_spin_edit()
	var shoulder := Input.is_joy_button_pressed(device, JOY_BUTTON_LEFT_SHOULDER) \
		or Input.is_joy_button_pressed(device, JOY_BUTTON_RIGHT_SHOULDER)
	if _modal_open() and not _spin_edit:
		# Nothing behind the popup reacts: no shortcuts, shop tabs, menu bar,
		# settings; A / B act inside it (focus put back there if it got out).
		if shoulder or b in [JOY_BUTTON_LEFT_SHOULDER, JOY_BUTTON_RIGHT_SHOULDER, JOY_BUTTON_BACK, JOY_BUTTON_START]:
			return true
		if (b == JOY_BUTTON_A or b == JOY_BUTTON_B) and not _in_modal(_focus()):
			hud.modals.focus_default()
			return true
	if shoulder:
		pass   # L1 / R1 + face button: shortcuts (below)
	elif _spin_edit:
		if b == JOY_BUTTON_B or b == JOY_BUTTON_A:
			_end_spin_edit()   # stop editing, keep the number
			return true
	elif b == JOY_BUTTON_A and _focus() != null and _spin_box(_focus()) != null:
		_start_spin_edit(_spin_box(_focus()))   # up / down change it
		return true
	if b == JOY_BUTTON_LEFT_SHOULDER or b == JOY_BUTTON_RIGHT_SHOULDER:
		var w = _shop_window()
		if w:
			w.pad_page(-1 if b == JOY_BUTTON_LEFT_SHOULDER else 1)
		return true
	var l1 := Input.is_joy_button_pressed(device, JOY_BUTTON_LEFT_SHOULDER)
	var r1 := Input.is_joy_button_pressed(device, JOY_BUTTON_RIGHT_SHOULDER)
	if (l1 or r1) and FACE.has(b):
		if _shop_window() == null:
			var slot: int = FACE[b] + (0 if l1 else 4)
			if slot < PlayerData.SHORTCUT_COUNT and hud.shortcut_bar:
				hud.shortcut_bar.press(slot)   # assigns a selected skill / item, else runs it
		return true
	match b:
		JOY_BUTTON_A:
			if not _accept():
				_hold(b, "ui_accept")   # press the focused button / slot
			return true
		JOY_BUTTON_B:
			if not _cancel():
				_hold(b, "ui_cancel")   # Modals closes on ui_cancel
			return true
		JOY_BUTTON_X:
			return _secondary()
		JOY_BUTTON_Y:
			set_nav_mouse(true)   # until Y is released (_input / _process)
			return true
		JOY_BUTTON_BACK:
			if bar_mode:
				exit_bar()
			else:
				enter_bar()
			return true
		JOY_BUTTON_START:
			hud.toggle_window("settings")
			return true
	return false


func _accept() -> bool:
	var pb: Button = hud.pad_panel_button()
	if pb:
		pb.pressed.emit()
		return true
	var f := _focus()
	if f is OptionButton:
		f.show_popup()   # its list then takes A = pick, B = close (_poll_dropdown)
		return true
	if hud.modals.is_open() or f != null:
		return false   # -> ui_accept: its focused button / slot
	if _ui_context():
		_focus_default()
		return true
	world.make_player_interact_next_to()
	return true


func _cancel() -> bool:
	var pb: Button = hud.pad_panel_button()
	if pb:
		pb.pressed.emit()
		return true
	if hud.modals.is_open():
		return false   # -> ui_cancel
	if hud.is_chat_open():
		hud.open_chat(false)
		return true
	if bar_mode:
		exit_bar()
		return true
	var w = _top_window()
	if w:
		if not w.pad_cancel():
			w.close()
			_focus_default.call_deferred()   # the next window down, if any
		return true
	var f := _focus()
	if f:
		f.release_focus()   # something outside a window had the focus: drop it
		return true
	world.player_target_closest_entity(1)
	return true


func _secondary() -> bool:
	if _focus() is ItemSlot and not nav_mouse:
		return false   # item_slot.gd: X = secondary action
	_click()
	return true


# -------------------------------------------------------------- polling

func _process(delta: float) -> void:
	var pads := Input.get_connected_joypads()
	_update_keyboard(not pads.is_empty() and _game_ready())
	if pads.is_empty() or not _game_ready():
		_stop_move()
		_nav_dir = 0
		return
	var ed := _edges(pads)
	if nav_mouse and not pads.any(func(d): return Input.is_joy_button_pressed(d, JOY_BUTTON_Y)):
		set_nav_mouse(false)   # Y let go without us seeing the release
	var dpad := _dpad(pads)
	var left := dpad if dpad != Vector2.ZERO else _stick(pads, JOY_AXIS_LEFT_X, JOY_AXIS_LEFT_Y)
	var right := _stick(pads, JOY_AXIS_RIGHT_X, JOY_AXIS_RIGHT_Y)
	var cur := right + (left if nav_mouse else Vector2.ZERO)
	if cur != Vector2.ZERO:
		_used = true
		_move_cursor(cur.limit_length(1.0) * CURSOR_SPEED * delta)
	var dir := 0 if nav_mouse else _to_dir(left)
	if _poll_color_picker(ed, dir):
		_stop_move()
		return
	_handle_dropdown(ed)
	if bar_mode:
		_check_bar()
	if _ui_context():
		_stop_move()
		_navigate(dir)
	else:
		_nav_dir = 0
		_set_move(dir)
	if _used or _cursor_shown:
		_overlay.queue_redraw()


func _stick(pads: Array, ax: int, ay: int) -> Vector2:
	var v := Vector2.ZERO
	for d in pads:
		var s := Vector2(Input.get_joy_axis(d, ax), Input.get_joy_axis(d, ay))
		if s.length() > v.length():
			v = s
	return v if v.length() > DEADZONE else Vector2.ZERO


func _dpad(pads: Array) -> Vector2:
	var v := Vector2.ZERO
	for d in pads:
		if Input.is_joy_button_pressed(d, JOY_BUTTON_DPAD_LEFT):
			v.x = -1
		elif Input.is_joy_button_pressed(d, JOY_BUTTON_DPAD_RIGHT):
			v.x = 1
		if Input.is_joy_button_pressed(d, JOY_BUTTON_DPAD_UP):
			v.y = -1
		elif Input.is_joy_button_pressed(d, JOY_BUTTON_DPAD_DOWN):
			v.y = 1
	return v


static func _to_dir(v: Vector2) -> int:
	if v == Vector2.ZERO:
		return 0
	if absf(v.x) > absf(v.y):
		return Types.Orientation.RIGHT if v.x > 0 else Types.Orientation.LEFT
	return Types.Orientation.DOWN if v.y > 0 else Types.Orientation.UP


## A window, modal, panel or the menu bar wants the stick (gamepad.js isDialogOpen).
func _ui_context() -> bool:
	if _open_dropdown() != null:
		return true
	if bar_mode or hud.modals.is_open() or hud.any_window_open() or hud.is_chat_open():
		return true
	if hud.pad_panel_button() != null:
		return true
	return _focus() != null


func _focus() -> Control:
	var f := get_viewport().gui_get_focus_owner()
	return f if f != null and f.is_visible_in_tree() else null


# ------------------------------------------------------------- movement

func _set_move(dir: int) -> void:
	if dir == _move_dir:
		return
	var p = world.player if world else null
	if p and _move_dir != 0:
		p.key_input(_move_dir, false)
	_move_dir = dir
	if p and dir != 0:
		p.key_input(dir, true)


func _stop_move() -> void:
	if _move_dir == 0:
		return
	if world and world.player:
		world.player.key_input(_move_dir, false)
	_move_dir = 0


# ----------------------------------------------------------- navigation

func _navigate(dir: int) -> void:
	if dir == 0:
		_nav_dir = 0
		_sb_dir = 0
		return
	var sb := _focus() as ScrollBar
	if sb and _scrolls_along(sb, dir):
		_scroll_bar(sb, dir)
		return
	_sb_dir = 0
	_prepare_scroll_bars(dir)
	var now := Time.get_ticks_msec()
	if dir != _nav_dir:
		_nav_dir = dir
	elif now < _nav_next:
		return
	_nav_next = now + NAV_REPEAT_MS
	if _open_dropdown() != null:
		_action(UI_ACTIONS[dir], true)   # forwarded to the open list
		_action(UI_ACTIONS[dir], false)
		return
	if _kb_open():
		var kf := _focus()
		if kf == null or not _kb.is_ancestor_of(kf):
			_kb.first_key().grab_focus()
			return
		var kn := _neighbor_in(_kb, kf, dir)
		if kn:
			kn.grab_focus()
		return
	var f := _focus()
	if f == null:
		_focus_default()
		return
	var spin := _spin_box(f)
	if spin:
		_check_spin_edit()
		if _spin_edit == spin:
			if _digit_mode(spin):
				_edit_digit(spin, dir)
			elif dir == Types.Orientation.UP or dir == Types.Orientation.DOWN:
				_step_spin(spin, 1 if dir == Types.Orientation.UP else -1)
			return
	if _modal_open():
		# Only between the popup's own controls (Godot's neighbour search
		# would happily move onto a window behind it).
		if not _in_modal(f):
			hud.modals.focus_default()
			return
		var n := _neighbor_in(hud.modals.panel(), f, dir)
		if n:
			n.grab_focus()
		return
	if spin:
		# Not editing: move to the next field (the SpinBox would change its
		# value on ui_up / ui_down and its LineEdit move the caret on
		# ui_left / ui_right).
		var sides := {Types.Orientation.UP: SIDE_TOP, Types.Orientation.DOWN: SIDE_BOTTOM,
			Types.Orientation.LEFT: SIDE_LEFT, Types.Orientation.RIGHT: SIDE_RIGHT}
		var n := f.find_valid_focus_neighbor(sides[dir])
		if n:
			n.grab_focus()
		return
	# ui_* actions: focus neighbours, sliders (left / right change the value),
	# scroll follow...
	_action(UI_ACTIONS[dir], true)
	_action(UI_ACTIONS[dir], false)


# ------------------------------------------------------------ scroll bars

const SB_REPEAT_MS := 60
var _sb_dir := 0
var _sb_next := 0
var _sb_since := 0


## The scroll bars of the window the gamepad is in become selectable (Godot
## leaves them out of focus navigation) -- only once the gamepad is used, so
## mouse clicks on a scroll bar don't take the focus otherwise. Only across
## them: a vertical bar is reached moving left / right, a horizontal one
## moving up / down (else going down a list could jump onto the bar beside it).
func _prepare_scroll_bars(dir: int) -> void:
	var w = _top_window()
	if w == null:
		return
	var sideways := dir == Types.Orientation.LEFT or dir == Types.Orientation.RIGHT
	for sc in w.find_children("*", "ScrollContainer", true, false):
		var vb: ScrollBar = sc.get_v_scroll_bar()
		var hb: ScrollBar = sc.get_h_scroll_bar()
		vb.focus_mode = Control.FOCUS_ALL if sideways else Control.FOCUS_NONE
		hb.focus_mode = Control.FOCUS_NONE if sideways else Control.FOCUS_ALL


func _scrolls_along(sb: ScrollBar, dir: int) -> bool:
	if sb is VScrollBar:
		return dir == Types.Orientation.UP or dir == Types.Orientation.DOWN
	return dir == Types.Orientation.LEFT or dir == Types.Orientation.RIGHT


func _scroll_bar(sb: ScrollBar, dir: int) -> void:
	var now := Time.get_ticks_msec()
	if dir != _sb_dir:
		_sb_dir = dir
		_sb_since = now
		_sb_next = now + NAV_REPEAT_MS   # one step, then repeat after a pause
	elif now < _sb_next:
		return
	else:
		_sb_next = now + SB_REPEAT_MS
	var held := now - _sb_since
	var mult := 1.0 if held < 800 else 3.0
	var step := sb.custom_step if sb.custom_step > 0 else maxf(sb.page * 0.15, 16.0)
	var sgn := 1.0 if dir == Types.Orientation.DOWN or dir == Types.Orientation.RIGHT else -1.0
	sb.value = clampf(sb.value + step * mult * sgn, sb.min_value, sb.max_value - sb.page)


# ------------------------------------------------------- value fields

## Edit mode ends when the SpinBox loses the focus.
func _check_spin_edit() -> void:
	if _spin_edit == null:
		return
	var f := _focus()
	if not is_instance_valid(_spin_edit) or f == null or _spin_box(f) != _spin_edit:
		_end_spin_edit()


func _start_spin_edit(spin: SpinBox) -> void:
	_spin_edit = spin
	if _digit_mode(spin):
		_digit = 0
		_show_digits(spin)
	_overlay.queue_redraw()


func _end_spin_edit() -> void:
	var spin := _spin_edit
	_spin_edit = null
	if spin and is_instance_valid(spin) and _digit_mode(spin):
		var le := spin.get_line_edit()
		le.text = str(int(spin.value))   # back to the plain number
		le.deselect()
		le.caret_column = le.text.length()
	_overlay.queue_redraw()


## Whole numbers going to 100 or more: edited digit by digit.
func _digit_mode(spin: SpinBox) -> bool:
	return spin.step >= 1.0 and spin.max_value >= 100.0


func _digit_count(spin: SpinBox) -> int:
	return str(int(spin.max_value)).length()


func _edit_digit(spin: SpinBox, dir: int) -> void:
	var n := _digit_count(spin)
	match dir:
		Types.Orientation.LEFT:
			_digit = mini(_digit + 1, n - 1)
		Types.Orientation.RIGHT:
			_digit = maxi(_digit - 1, 0)
		Types.Orientation.UP, Types.Orientation.DOWN:
			var delta := int(pow(10, _digit)) * (1 if dir == Types.Orientation.UP else -1)
			spin.value = clampf(int(spin.value) + delta, spin.min_value, spin.max_value)
			# The SpinBox rewrites its text after a value change (deferred):
			# put the digits / selection back after that.
			_show_digits.call_deferred(spin)
	_show_digits(spin)


## The number with leading zeros, the edited digit selected (highlighted).
func _show_digits(spin: SpinBox) -> void:
	if spin != _spin_edit or not is_instance_valid(spin):
		return   # editing ended before this (deferred) call
	var n := _digit_count(spin)
	var le := spin.get_line_edit()
	le.text = str(int(spin.value)).pad_zeros(n)
	var i := n - 1 - _digit
	le.select(i, i + 1)
	le.caret_column = i + 1


func _spin_box(f: Control) -> SpinBox:
	if f is SpinBox:
		return f
	if f is LineEdit and f.get_parent() is SpinBox:
		return f.get_parent()
	return null


func _step_spin(spin: SpinBox, dir_sign: int) -> void:
	var step := spin.step if spin.step > 0 else 1.0
	spin.value = spin.value + step * dir_sign   # clamped to min / max by the Range
	# Make sure the text being edited shows the new value (an older SpinBox
	# didn't refresh a focused LineEdit -- modals.gd -- and apply() would
	# parse the old text back). While editing it shows just the number, no
	# prefix / suffix.
	_spin_text(spin)


func _spin_text(spin: SpinBox) -> void:
	var step := spin.step if spin.step > 0 else 1.0
	var t := String.num(spin.value, _decimals(step))
	spin.get_line_edit().text = t
	spin.get_line_edit().caret_column = t.length()


static func _decimals(step: float) -> int:
	var d := 0
	var s := step
	while d < 6 and absf(s - roundf(s)) > 0.000001:
		s *= 10.0
		d += 1
	return d


# ------------------------------------------------------------ dropdowns

## The open list of a dropdown (OptionButton), if any.
func _open_dropdown() -> PopupMenu:
	for w in get_viewport().get_embedded_subwindows():
		if w is PopupMenu and w.visible and w.get_parent() is OptionButton:
			return w
	return null


## New A / B presses this frame, [a, b] (polled: an open list / popup gets
## the gamepad events itself, not _input).
func _edges(pads: Array) -> Array:
	var a := false
	var b := false
	for d in pads:
		a = a or Input.is_joy_button_pressed(d, JOY_BUTTON_A)
		b = b or Input.is_joy_button_pressed(d, JOY_BUTTON_B)
	var out := [a and not _prev_a, b and not _prev_b]
	_prev_a = a
	_prev_b = b
	return out


func _poll_dropdown(pads: Array) -> void:
	_handle_dropdown(_edges(pads))


## Open dropdown list: A picks the highlighted item, B closes it unchanged.
func _handle_dropdown(ed: Array) -> void:
	var pop := _open_dropdown()
	if pop:
		_used = true
		if ed[0]:
			_dropdown_pick(pop)
		elif ed[1]:
			_dropdown_close(pop)


func _dropdown_pick(pop: PopupMenu) -> void:
	var ob: OptionButton = pop.get_parent()
	var i := pop.get_focused_item()
	if i >= 0 and i < ob.item_count and not ob.is_item_disabled(i) and not ob.is_item_separator(i) \
			and i != ob.selected:
		ob.select(i)
		ob.item_selected.emit(i)
	_dropdown_close(pop)


func _dropdown_close(pop: PopupMenu) -> void:
	var ob: OptionButton = pop.get_parent()
	pop.hide()
	ob.grab_focus.call_deferred()


# --------------------------------------------------------- colour picker

const CP_REPEAT_MS := 80        # value steps while a picker control is held
const CP_SHAPE_STEP := 0.01     # saturation / brightness / hue per step
const CP_EDIT_FRAME := Color(0, 0.8, 0)
var _cp_edit: Control = null    # picker control being edited (A); B cancels
var _cp_orig := Color()         # colour when editing started
var _cp_hsv := Vector3()        # h, s, v while editing the square / hue strip
var _cp_dir := 0
var _cp_next := 0
var _cp_since := 0              # ms the current direction has been held


## The open popup of a ColorPickerButton, if any.
func _open_color_popup() -> PopupPanel:
	for w in get_viewport().get_embedded_subwindows():
		if w is PopupPanel and w.visible and w.get_parent() is ColorPickerButton:
			return w
	return null


## An open menu list (shape / mode) inside the picker popup.
func _picker_list(pop: PopupPanel) -> PopupMenu:
	for w in get_viewport().get_embedded_subwindows():
		if w is PopupMenu and w.visible and pop.is_ancestor_of(w):
			return w
	return null


## While a colour picker is open the gamepad drives it (true = handled).
func _poll_color_picker(ed: Array, dir: int) -> bool:
	var pop := _open_color_popup()
	if pop == null:
		_cp_edit = null
		return false
	_used = true
	var button: ColorPickerButton = pop.get_parent()
	var picker := button.get_picker()
	_cp_prepare(pop, picker)
	var frame: Control = pop.get_meta("gamepad_frame")
	frame.queue_redraw()
	var pick: bool = ed[0]   # A: edit / press / pick / keep
	var back: bool = ed[1]   # B: cancel / close
	var list := _picker_list(pop)
	if list:
		_cp_edit = null
		if pick:
			_action("ui_accept", true)   # forwarded to the list: picks the item
			_action("ui_accept", false)
		elif back:
			list.hide()
		elif _nav_step(dir):
			_action(UI_ACTIONS[dir], true)
			_action(UI_ACTIONS[dir], false)
		return true
	var f := pop.gui_get_focus_owner()
	if f != null and not f.is_visible_in_tree():
		f = null
	if _cp_edit and (not is_instance_valid(_cp_edit) or f != _cp_edit):
		_cp_edit = null
	if f == null:
		var first := _first_focusable(picker)
		if first:
			first.grab_focus()
		return true
	if _cp_edit:
		if pick:
			_cp_edit = null   # done: keep the change
		elif back:
			picker.color = _cp_orig   # cancel: back to the colour from before
			picker.color_changed.emit(_cp_orig)
			_cp_edit = null
		else:
			_cp_adjust(picker, dir)
		return true
	if pick:
		_cp_activate(f, picker)
	elif back:
		pop.hide()   # close the picker
		button.grab_focus.call_deferred()
	elif _nav_step(dir):
		var n := _cp_neighbor(f, dir, picker)
		if n:
			n.grab_focus()
	return true


# ------------------------------------------------------- chat keyboard

func _kb_open() -> bool:
	return _kb != null and _kb.visible


## Shown while chat is open and the gamepad is the input in use; hidden as
## soon as a real keyboard / mouse is used (then the chat line gets the focus
## back for normal typing) or chat closes.
func _update_keyboard(active: bool) -> void:
	var want: bool = active and _used and hud != null and hud.has_method("is_chat_open") and hud.is_chat_open()
	if want:
		if _kb == null:
			_kb = OnScreenKeyboard.new()
			_kb.target = hud.chat_input()
			_kb.anchor_left = 0.5
			_kb.anchor_right = 0.5
			_kb.anchor_top = 1.0
			_kb.anchor_bottom = 1.0
			_kb.grow_horizontal = Control.GROW_DIRECTION_BOTH
			_kb.grow_vertical = Control.GROW_DIRECTION_BEGIN
			_kb.offset_bottom = -90   # above the shortcut bar
			_kb.send_requested.connect(func(): hud.submit_chat())
			_kb.close_requested.connect(func(): hud.open_chat(false))
			hud.add_ui(_kb)
		if not _kb.visible:
			_kb.visible = true
			_kb.first_key().grab_focus.call_deferred()
	elif _kb_open():
		_kb.visible = false
		if hud.is_chat_open():
			hud.chat_input().grab_focus()


func _kb_press(b: int) -> void:
	match b:
		JOY_BUTTON_A:
			var f := _focus()
			if f is BaseButton and _kb.is_ancestor_of(f):
				f.pressed.emit()
			else:
				_kb.first_key().grab_focus()
		JOY_BUTTON_B:
			if not _kb.backspace():
				hud.open_chat(false)   # nothing left to delete: close chat
		JOY_BUTTON_X:
			_kb.type_text(" ")
		JOY_BUTTON_Y:
			_kb.toggle_caps()
		JOY_BUTTON_LEFT_SHOULDER, JOY_BUTTON_RIGHT_SHOULDER:
			_kb.toggle_layer()
		JOY_BUTTON_START:
			hud.submit_chat()
		JOY_BUTTON_BACK:
			hud.open_chat(false)


func _modal_open() -> bool:
	return hud != null and hud.modals != null and hud.modals.is_open()


func _in_modal(c: Control) -> bool:
	return c != null and hud.modals.panel().is_ancestor_of(c)


## The closest focusable picker control in `dir` (Godot's own neighbour search
## gets stuck in the picker's grid / button rows).
func _cp_neighbor(f: Control, dir: int, picker: ColorPicker) -> Control:
	return _neighbor_in(picker, f, dir)


## The closest focusable control under `root` in `dir` from `f`.
func _neighbor_in(root: Node, f: Control, dir: int) -> Control:
	var from := f.get_global_rect().get_center()
	var axis := Vector2(1, 0)
	match dir:
		Types.Orientation.LEFT: axis = Vector2(-1, 0)
		Types.Orientation.UP: axis = Vector2(0, -1)
		Types.Orientation.DOWN: axis = Vector2(0, 1)
	var best: Control = null
	var best_score := INF
	for c in root.find_children("*", "Control", true, false):
		if c == f or not c.is_visible_in_tree() or c.focus_mode != Control.FOCUS_ALL:
			continue
		var d: Vector2 = c.get_global_rect().get_center() - from
		var along := d.dot(axis)
		if along <= 1.0:
			continue
		var across := absf(d.dot(Vector2(axis.y, axis.x)))
		var score := along + across * 2.0
		if score < best_score:
			best_score = score
			best = c
	return best


## Once per popup: let the stick reach the sliders (Godot leaves them out of
## focus navigation) and draw the focus frame inside the popup (it is drawn
## above the game's canvas layers, so the frame from _overlay would be hidden).
func _cp_prepare(pop: PopupPanel, picker: ColorPicker) -> void:
	if pop.has_meta("gamepad_ready"):
		return
	pop.set_meta("gamepad_ready", true)
	for sl in picker.find_children("*", "HSlider", true, false):
		sl.focus_mode = Control.FOCUS_ALL
	var layer := CanvasLayer.new()
	layer.layer = 100
	var frame := Control.new()
	frame.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	frame.mouse_filter = Control.MOUSE_FILTER_IGNORE
	frame.draw.connect(func(): _draw_cp_frame(pop, frame))
	layer.add_child(frame)
	pop.add_child(layer, false, Node.INTERNAL_MODE_BACK)
	pop.set_meta("gamepad_frame", frame)


func _draw_cp_frame(pop: PopupPanel, frame: Control) -> void:
	var f := pop.gui_get_focus_owner()
	if f == null or not f.is_visible_in_tree():
		return
	var xf := f.get_global_transform_with_canvas()
	var r := Rect2(xf.origin, f.size * xf.get_scale()).grow(2)
	frame.draw_rect(r, CP_EDIT_FRAME if f == _cp_edit else HIGHLIGHT, false, HIGHLIGHT_WIDTH)


func _first_focusable(root: Node) -> Control:
	for c in root.find_children("*", "Control", true, false):
		if c.is_visible_in_tree() and c.focus_mode == Control.FOCUS_ALL:
			return c
	return null


## The colour square / wheel and the hue strip: plain Controls the picker
## draws itself (they don't react to ui_* actions).
func _cp_is_shape(f: Control, picker: ColorPicker) -> bool:
	return f.get_class() == "Control" and picker.is_ancestor_of(f)


func _cp_activate(f: Control, picker: ColorPicker) -> void:
	if f is Range or _spin_box(f) != null or _cp_is_shape(f, picker):
		_cp_edit = f
		_cp_orig = picker.color
		_cp_hsv = Vector3(picker.color.h, picker.color.s, picker.color.v)
		_cp_dir = 0
	elif f is MenuButton:
		f.show_popup()
	elif f is BaseButton:
		# Straight into the popup: through the main viewport the press would
		# also reach the ColorPickerButton behind it and close the picker.
		var pop := _open_color_popup()
		for pressed in [true, false]:
			var a := InputEventAction.new()
			a.action = "ui_accept"
			a.pressed = pressed
			pop.push_input(a)
	# The hex LineEdit needs a keyboard to type in: nothing to do with B.


func _cp_adjust(picker: ColorPicker, dir: int) -> void:
	if dir == 0:
		_cp_dir = 0
		return
	var now := Time.get_ticks_msec()
	if dir != _cp_dir:
		_cp_dir = dir
		_cp_since = now
		_cp_next = now + NAV_REPEAT_MS   # one step, then repeat after a pause
	elif now < _cp_next:
		return
	else:
		_cp_next = now + CP_REPEAT_MS
	var held := now - _cp_since
	var mult := 1.0 if held < 600 else (4.0 if held < 1500 else 12.0)
	var sgn := 1.0 if dir == Types.Orientation.RIGHT or dir == Types.Orientation.UP else -1.0
	var f := _cp_edit
	var r: Range = f if f is Range else _spin_box(f)
	if r:
		var base := maxf(r.step, (r.max_value - r.min_value) / 255.0)
		r.value = r.value + base * mult * sgn   # the picker follows (value_changed)
		if r is SpinBox:
			_spin_text(r)
		return
	var d := CP_SHAPE_STEP * mult * sgn
	if f.size.x < f.size.y * 0.5:   # narrow: the hue strip
		_cp_hsv.x = fposmod(_cp_hsv.x + d, 1.0)
	elif dir == Types.Orientation.LEFT or dir == Types.Orientation.RIGHT:
		_cp_hsv.y = clampf(_cp_hsv.y + d, 0.0, 1.0)
	else:
		_cp_hsv.z = clampf(_cp_hsv.z + d, 0.0, 1.0)
	var c := Color.from_hsv(_cp_hsv.x, _cp_hsv.y, _cp_hsv.z, picker.color.a)
	picker.color = c
	picker.color_changed.emit(c)   # the button (and the setting) follow


## Shared navigation repeat (first step at once, then every NAV_REPEAT_MS).
func _nav_step(dir: int) -> bool:
	if dir == 0:
		_nav_dir = 0
		return false
	var now := Time.get_ticks_msec()
	if dir != _nav_dir:
		_nav_dir = dir
	elif now < _nav_next:
		return false
	_nav_next = now + NAV_REPEAT_MS
	return true


## Focus something sensible: the menu bar in bar mode, else the top window's
## first button / slot (gamepad.js dialogOpen / selectFirstItem).
func _focus_default() -> void:
	if not _game_ready() or hud.modals.is_open():
		return
	if bar_mode:
		var bc: Array = _bar_controls()
		for c in bc:
			if c.is_visible_in_tree():
				c.grab_focus()
				return
		return
	var pb: Button = hud.pad_panel_button()
	if pb:
		pb.grab_focus()
		return
	var w = _top_window()
	if w:
		w.focus_first()


## Topmost open window: the one holding focus, else the frontmost.
func _top_window() -> GameWindow:
	var f := _focus()
	for w in hud.windows.values():
		if w.visible and f != null and w.is_ancestor_of(f):
			return w
	if hud.windows.is_empty():
		return null
	var layer: Node = hud.windows.values()[0].get_parent()
	for i in range(layer.get_child_count() - 1, -1, -1):
		var c := layer.get_child(i)
		if c is GameWindow and c.visible:
			return c
	return null


func _shop_window() -> ShopWindowBase:
	for n in SHOP_WINDOWS:
		var w = hud.window(n)
		if w is ShopWindowBase and w.visible:
			return w
	return null


# -------------------------------------------------------------- bar mode

func _bar_controls() -> Array:
	return hud.pad_bar_controls()


func enter_bar() -> void:
	bar_mode = true
	set_nav_mouse(false)
	for c in _bar_controls():
		c.focus_mode = Control.FOCUS_ALL
	_focus_default()


func exit_bar() -> void:
	bar_mode = false
	for c in _bar_controls():
		c.focus_mode = Control.FOCUS_NONE   # also drops the focus if it's there


## Leave bar mode once something else takes the focus (a window opened from
## the menu, the chat line...).
func _check_bar() -> void:
	var f := _focus()
	if f != null and not (f in _bar_controls()):
		exit_bar()


# ---------------------------------------------------------------- cursor

func set_nav_mouse(on: bool) -> void:
	if on == nav_mouse:
		return
	nav_mouse = on
	if on:
		_stop_move()
		if bar_mode:
			exit_bar()
		_init_cursor()
		_cursor_shown = not _warp
	_overlay.queue_redraw()


func _init_cursor() -> void:
	var vs := get_viewport().get_visible_rect().size
	if _warp:
		_cursor = get_viewport().get_mouse_position()
	elif _cursor.x < 0:
		_cursor = vs / 2.0
	_cursor = _cursor.clamp(Vector2.ZERO, vs - Vector2.ONE)


func _move_cursor(d: Vector2) -> void:
	var vs := get_viewport().get_visible_rect().size
	if _warp:
		_cursor = get_viewport().get_mouse_position()
	elif _cursor.x < 0:
		_init_cursor()
	_cursor = (_cursor + d).clamp(Vector2.ZERO, vs - Vector2.ONE)
	if _warp:
		get_viewport().warp_mouse(_cursor)
		return
	_cursor_shown = true
	var m := InputEventMouseMotion.new()
	m.position = _cursor
	m.global_position = _cursor
	m.relative = d
	_push(m)


## Left click at the cursor (gamepad.js game.click()): GUI first, then the world.
func _click() -> void:
	if _warp:
		_cursor = get_viewport().get_mouse_position()
	elif _cursor.x < 0:
		_init_cursor()
	for pressed in [true, false]:
		var m := InputEventMouseButton.new()
		m.button_index = MOUSE_BUTTON_LEFT
		m.pressed = pressed
		m.button_mask = MOUSE_BUTTON_MASK_LEFT if pressed else 0
		m.position = _cursor
		m.global_position = _cursor
		_push(m)


func _push(e: InputEvent) -> void:
	_synth = true
	get_viewport().push_input(e)
	_synth = false


# --------------------------------------------------------------- drawing

func _draw_overlay() -> void:
	if _used:
		var f := _focus()
		if f:
			var xf := f.get_global_transform_with_canvas()
			var r := Rect2(xf.origin, f.size * xf.get_scale()).grow(2)
			var editing := _spin_edit != null and _spin_box(f) == _spin_edit
			_overlay.draw_rect(r, HIGHLIGHT_EDIT if editing else HIGHLIGHT, false, HIGHLIGHT_WIDTH)
	if _cursor_shown and not _warp and _cursor.x >= 0:
		var p := _cursor
		var arrow := PackedVector2Array([p, p + Vector2(0, 18), p + Vector2(5, 13), p + Vector2(9, 21),
			p + Vector2(12, 20), p + Vector2(8, 12), p + Vector2(14, 12)])
		_overlay.draw_colored_polygon(arrow, Color.WHITE)
		arrow.append(p)
		_overlay.draw_polyline(arrow, Color.BLACK, 1.5)
