extends Node
## Port of client/js/audio.js: one-shot sound effects plus per-map music.
## (The JS client currently has map music disabled; here it is on by default
## and toggled with M. The choice is saved in user://settings.cfg.)

const SOUND_DIR := "res://assets/audio/sounds/"
const MUSIC_DIR := "res://assets/audio/music/"
const MAX_VOICES := 8

var sfx_on := true
var music_on := true
var _voices: Array = []
var _music: AudioStreamPlayer
var _current_music := ""
var _tween: Tween


func _ready() -> void:
	sfx_on = bool(Config.get_setting("audio", "sfx", true))
	music_on = bool(Config.get_setting("audio", "music", true))
	for i in range(MAX_VOICES):
		var p := AudioStreamPlayer.new()
		p.volume_db = -6.0
		add_child(p)
		_voices.append(p)
	_music = AudioStreamPlayer.new()
	_music.volume_db = -10.0
	add_child(_music)
	_music.finished.connect(_on_music_finished)


func play_sound(sound_name: String) -> void:
	if not sfx_on:
		return
	var stream: AudioStream = GameData.get_resource(SOUND_DIR + sound_name + ".ogg")
	if stream == null:
		return
	for v in _voices:
		if not v.playing:
			v.stream = stream
			v.play()
			return


func play_map_music(index: int) -> void:
	var track := "map%d" % index
	if not music_on:
		_current_music = track
		return
	if track == _current_music and _music.playing:
		return
	_current_music = track
	var stream: AudioStream = GameData.get_resource(MUSIC_DIR + track + ".ogg")
	if stream == null:
		_music.stop()
		return
	if _tween:
		_tween.kill()
	_music.stream = stream
	_music.volume_db = -10.0
	_music.play()


func fade_out_music() -> void:
	if not _music.playing:
		return
	if _tween:
		_tween.kill()
	_tween = create_tween()
	_tween.tween_property(_music, "volume_db", -60.0, 1.5)
	_tween.tween_callback(_music.stop)


func toggle_music(index: int) -> void:
	music_on = not music_on
	Config.set_setting("audio", "music", music_on)
	if music_on:
		_current_music = ""
		play_map_music(index)
	else:
		_music.stop()


func _on_music_finished() -> void:
	if music_on and _music.stream != null:
		_music.play()
