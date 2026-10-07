class_name Modals
extends Control
## Modal dialogs: confirm (dialog/confirmdialog.js), notify
## (dialog/notifydialog.js), count/price input (#dropDialog,
## #auctionSellDialog) and yes/no questions (#socialconfirm).

var _dim: ColorRect
var _panel: PanelContainer
var _text: Label
var _spin: SpinBox
var _ok: Button
var _cancel: Button
var _cb: Callable = Callable()
var _kind := ""
var _queue: Array = []
var _timeout = null
var _typed := false


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_dim = ColorRect.new()
	_dim.color = Color(0, 0, 0, 0.45)
	_dim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_dim.visible = false
	_dim.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(_dim)
	var center := CenterContainer.new()
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	center.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(center)
	_panel = PanelContainer.new()
	_panel.add_theme_stylebox_override("panel", UiStyle.panel(0.97))
	_panel.custom_minimum_size = Vector2(360, 0)
	_panel.visible = false
	center.add_child(_panel)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 10)
	_panel.add_child(v)
	_text = UiStyle.label("", 16)
	_text.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_text.custom_minimum_size = Vector2(340, 0)
	_text.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(_text)
	_spin = SpinBox.new()
	_spin.min_value = 0
	_spin.rounded = true
	_spin.allow_greater = false
	_spin.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	_spin.custom_minimum_size = Vector2(180, 0)
	_spin.get_line_edit().text_submitted.connect(func(_t):
		_typed = true
		_finish(true))
	_spin.get_line_edit().text_changed.connect(func(_t): _typed = true)
	v.add_child(_spin)
	var h := HBoxContainer.new()
	h.alignment = BoxContainer.ALIGNMENT_CENTER
	h.add_theme_constant_override("separation", 16)
	v.add_child(h)
	_ok = UiStyle.button("OK", func(): _finish(true), 100)
	_cancel = UiStyle.button("Cancel", func(): _finish(false), 100)
	h.add_child(_ok)
	h.add_child(_cancel)


func is_open() -> bool:
	return _panel.visible


func confirm(message: String, cb: Callable) -> void:
	_show("confirm", message, cb, "Yes", "No")


func notify(message: String, cb: Callable = Callable()) -> void:
	_show("notify", message, cb, "OK", "")


func ask_count(message: String, default_value: int, max_value: int, cb: Callable) -> void:
	_show("count", message, cb, "OK", "Cancel", default_value, max_value)


## Yes/no that answers "no" by itself after timeout_ms (party invites).
func ask_yes_no(message: String, cb: Callable, timeout_ms := 10000) -> void:
	_show("yesno", message, cb, "Yes", "No", 0, 0, timeout_ms)


func _show(kind: String, message: String, cb: Callable, ok_text: String, cancel_text: String,
		default_value := 0, max_value := 0, timeout_ms := 0) -> void:
	if _panel.visible:
		_queue.append([kind, message, cb, ok_text, cancel_text, default_value, max_value, timeout_ms])
		return
	_kind = kind
	_cb = cb
	_text.text = message
	_ok.text = ok_text
	_cancel.text = cancel_text
	_cancel.visible = cancel_text != ""
	_spin.visible = kind == "count"
	if kind == "count":
		_spin.max_value = maxi(max_value, 1)
		_spin.value = clampi(default_value, 0, maxi(max_value, 1))
		_spin.get_line_edit().text = str(int(_spin.value))
		_typed = false
	_dim.visible = true
	_panel.visible = true
	if timeout_ms > 0:
		_timeout = Game.after(timeout_ms, func(): _finish(false))
	if kind == "count":
		_spin.get_line_edit().grab_focus.call_deferred()
		_spin.get_line_edit().select_all.call_deferred()
	else:
		_ok.grab_focus.call_deferred()


func _finish(ok: bool) -> void:
	if not _panel.visible:
		return
	if _timeout:
		_timeout.cancel()
		_timeout = null
	_panel.visible = false
	_dim.visible = false
	var cb := _cb
	_cb = Callable()
	if cb.is_valid():
		match _kind:
			"count":
				# SpinBox does not refresh the text of a focused LineEdit when
				# the value is set from code, so only parse what the user typed.
				if _typed:
					_spin.apply()
				cb.call(int(_spin.value) if ok else 0)
			"notify":
				cb.call()
			_:
				cb.call(ok)
	if not _queue.is_empty():
		var q: Array = _queue.pop_front()
		_show(q[0], q[1], q[2], q[3], q[4], q[5], q[6], q[7])


func _unhandled_input(e: InputEvent) -> void:
	if not _panel.visible:
		return
	if e.is_action_pressed("ui_cancel"):
		_finish(false)
		get_viewport().set_input_as_handled()
