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

class_name GameWindow
extends PanelContainer
## Base for the in-game windows (dialog/dialog.js + the HTML ".frame"
## markup): a title bar you can drag, a close button and a content box.

## Space kept free under a window for the bottom bar (HUD units).
const BOTTOM_MARGIN := 70.0
## Size every window opens at (HUD units, i.e. before the UI scale, so windows
## get bigger on screen at higher UI scales), across and down. Content past
## this scrolls; on a screen too small for it the window is smaller still (see
## max_size()).
const MAX_SIZE := Vector2(420, 420)
## Smallest height a flex_scroll list is squeezed to.
const FLEX_MIN_HEIGHT := 80.0
const BODY_SEPARATION := 6

signal opened
signal closed

var title := ""
var content: VBoxContainer
var _title_label: Label
var _title_bar: PanelContainer
var _dragging := false
var _drag_offset := Vector2.ZERO
var _user_moved := false   # dragged by the player: keep its spot instead of centring
var _placing := false
var hud = null
var world = null
## Optional main list (a ScrollContainer inside `content`) that takes the
## height left over by the rest of the window, so the window fits MAX_SIZE
## without the whole body scrolling. flex_height: no longer used (windows
## are always MAX_SIZE tall now); kept so subclasses that set it still work.
var flex_scroll: ScrollContainer = null
var flex_height := 0.0
var _body: ScrollContainer        # scrolls `content` when it is bigger than MAX_SIZE
var _content_root: VBoxContainer  # the real content box (subclasses may repoint `content`)
var _fit_queued := false


## min_size is kept for the subclasses' calls but no longer used: every window
## is MAX_SIZE (fit_content()), shrunk only to fit a small screen.
func _init(t := "", _min_size := Vector2(300, 200)) -> void:
	title = t
	visible = false
	mouse_filter = Control.MOUSE_FILTER_STOP


func _ready() -> void:
	add_theme_stylebox_override("panel", UiStyle.panel())
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", BODY_SEPARATION)
	add_child(v)
	var bar := PanelContainer.new()
	bar.add_theme_stylebox_override("panel", UiStyle.title_bar())
	_title_bar = bar
	bar.mouse_filter = Control.MOUSE_FILTER_STOP
	bar.gui_input.connect(_on_bar_input)
	v.add_child(bar)
	var h := HBoxContainer.new()
	bar.add_child(h)
	_title_label = UiStyle.label(title, 16, Color.WHITE, UiStyle.KOMIKA)
	_title_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_title_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	h.add_child(_title_label)
	var x := Button.new()
	x.text = " X "
	x.focus_mode = Control.FOCUS_NONE
	UiStyle.style_button(x)
	x.pressed.connect(close)
	h.add_child(x)
	_body = ScrollContainer.new()
	_body.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_body.follow_focus = true
	v.add_child(_body)
	content = VBoxContainer.new()
	content.add_theme_constant_override("separation", 6)
	content.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	content.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_body.add_child(content)
	_content_root = content
	build()
	fit_content(false)
	# Content that changes size while open (an item's info text and the
	# SELL / REPAIR / ENCHANT button appearing on selection, a mode line...)
	# re-fits flex_scroll so the rest stays inside the fixed-size window.
	_content_root.minimum_size_changed.connect(_queue_fit)
	# Content / font / UI scale changes resize the window: re-centre it.
	resized.connect(func():
		if visible and not _placing and not _user_moved:
			_place.call_deferred())


## Re-apply the title bar colour (Settings -> Menu color).
func restyle_title() -> void:
	if _title_bar:
		_title_bar.add_theme_stylebox_override("panel", UiStyle.title_bar())


## Override to add controls to `content`.
func build() -> void:
	pass


## Override to refresh contents when shown.
func refresh() -> void:
	pass


func set_title(t: String) -> void:
	title = t
	if _title_label:
		_title_label.text = t


func open() -> void:
	visible = true
	move_to_front()
	refresh()
	_place.call_deferred()
	_focus_first()
	opened.emit()


## Centre the window on screen (again whenever its size, the font size or the
## UI scale changes), unless the player dragged it somewhere: then just keep
## it on screen. Either way it stays above the bottom bar when there is room.
func _place() -> void:
	_placing = true
	fit_content()
	reset_size()
	var vp := get_parent_area_size()   # HUD units (the HUD may be scaled)
	if not _user_moved:
		position = ((vp - size) / 2.0).round()
	position.x = clampf(position.x, 0, maxf(0, vp.x - size.x))
	position.y = clampf(position.y, 0, maxf(0, vp.y - BOTTOM_MARGIN - size.y))
	_placing = false


## Largest this window may be right now: MAX_SIZE, or less when the screen
## (HUD units, so after the UI scale) is smaller -- keeping the bottom bar
## clear when there is reasonable room. on_screen = false: just MAX_SIZE.
func max_size(on_screen := true) -> Vector2:
	if not on_screen or not is_inside_tree():
		return MAX_SIZE
	var vp := get_parent_area_size()
	var h := vp.y - BOTTOM_MARGIN
	if h < MAX_SIZE.y * 0.6:
		h = vp.y
	return Vector2(minf(MAX_SIZE.x, vp.x), minf(MAX_SIZE.y, h))


## Space the frame takes around the content: panel margins, title bar, gap.
func chrome_size() -> Vector2:
	var sb := get_theme_stylebox("panel")
	var m: Vector2 = sb.get_minimum_size() if sb else Vector2.ZERO
	var t := _title_bar.get_combined_minimum_size().y if _title_bar else 0.0
	return m + Vector2(0, t + BODY_SEPARATION)


## Largest the content can be shown without the whole body scrolling.
func content_limit(on_screen := true) -> Vector2:
	return (max_size(on_screen) - chrome_size()).max(Vector2(60, 60))


## Size the body (and flex_scroll, if any) so the window is exactly
## max_size(on_screen) -- MAX_SIZE, or less on a small screen; anything bigger
## scrolls. flex_scroll takes all the height the rest of the window leaves.
func fit_content(on_screen := true) -> void:
	if _body == null:
		return
	var lim := content_limit(on_screen)
	if flex_scroll and flex_scroll.get_child_count() > 0:
		var others := _content_root.get_combined_minimum_size().y - flex_scroll.get_combined_minimum_size().y
		var full := (flex_scroll.get_child(0) as Control).get_combined_minimum_size().y
		flex_scroll.custom_minimum_size.y = maxf(lim.y - others, minf(full, FLEX_MIN_HEIGHT))
	_body.custom_minimum_size = lim


func _queue_fit() -> void:
	if _fit_queued:
		return
	_fit_queued = true
	_deferred_fit.call_deferred()


func _deferred_fit() -> void:
	_fit_queued = false
	if visible and not _placing:
		fit_content()


## Forget a dragged position so the window is centred again.
func recenter() -> void:
	_user_moved = false
	if visible:
		_place()


func close() -> void:
	if not visible:
		return
	visible = false
	closed.emit()


func toggle() -> void:
	if visible:
		close()
	else:
		open()


func _focus_first() -> void:
	# Gamepad navigation (gamepad.js selectFirstItem): focus the first button.
	var f := _find_focusable(content)
	if f:
		f.grab_focus.call_deferred()


func _find_focusable(n: Node) -> Control:
	for c in n.get_children():
		if c is Control and c.visible:
			if c.focus_mode == Control.FOCUS_ALL and (c is BaseButton or c is ItemSlot):
				return c
			var r := _find_focusable(c)
			if r:
				return r
	return null


func _on_bar_input(e: InputEvent) -> void:
	if e is InputEventMouseButton and e.button_index == MOUSE_BUTTON_LEFT:
		_dragging = e.pressed
		_drag_offset = _to_parent(e.global_position) - position
		if e.pressed:
			move_to_front()
	elif e is InputEventMouseMotion and _dragging:
		var vp := get_parent_area_size()
		var p := _to_parent(e.global_position) - _drag_offset
		_user_moved = true
		position = Vector2(clampf(p.x, -size.x + 60, vp.x - 60), clampf(p.y, 0, vp.y - 30))


## A screen (viewport) position in the parent's coordinates, so dragging
## follows the pointer 1:1 with a scaled HUD.
func _to_parent(screen_pos: Vector2) -> Vector2:
	var pc := get_parent_control()
	return pc.get_global_transform_with_canvas().affine_inverse() * screen_pos if pc else screen_pos


func _gui_input(e: InputEvent) -> void:
	if e is InputEventMouseButton and e.pressed:
		move_to_front()


func _unhandled_input(e: InputEvent) -> void:
	if visible and (e.is_action_pressed("ui_cancel")) and has_focus_inside():
		close()
		get_viewport().set_input_as_handled()


func has_focus_inside() -> bool:
	var f := get_viewport().gui_get_focus_owner()
	return f != null and is_ancestor_of(f)


## Small helper: HBox row of buttons.
func button_row(buttons: Array) -> HBoxContainer:
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 6)
	for b in buttons:
		h.add_child(b)
	return h
