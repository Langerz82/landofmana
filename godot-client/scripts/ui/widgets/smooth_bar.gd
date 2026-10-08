class_name SmoothBar
extends ProgressBar
## ProgressBar whose fill slides to a new value instead of jumping
## (health bars). Duration: Settings -> "Health bar speed", default 500 ms.

const DEFAULT_MS := 500

var target_value := 0.0
var _tween: Tween


func _init() -> void:
	step = 0.0   # no rounding, so the slide is smooth even for small maxima


## Animation length in ms from the settings (0 = instant).
static func duration_ms() -> int:
	return int(Config.get_setting("ui", "healthbarms", DEFAULT_MS))


## Slide to `v` (out of `max_v`). `snap` jumps straight there, e.g. when the
## bar starts showing a different entity.
func set_smooth(v: float, max_v: float, snap := false) -> void:
	v = clampf(v, 0.0, max_v)
	var max_changed := not is_equal_approx(max_v, max_value)
	if max_changed:
		# Keep the visible fill ratio when the maximum changes (level up).
		var ratio := value / maxf(max_value, 1.0)
		max_value = max_v
		value = ratio * max_v
	if is_equal_approx(v, target_value) and not snap and not max_changed:
		return
	target_value = v
	if _tween:
		_tween.kill()
		_tween = null
	var ms := duration_ms()
	if snap or ms <= 0 or not is_inside_tree() or not is_visible_in_tree():
		value = v
		return
	_tween = create_tween()
	_tween.tween_property(self, "value", v, ms / 1000.0) \
		.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
