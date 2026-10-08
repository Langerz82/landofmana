extends Node
## Port of client/js/audio.js: one-shot sound effects plus per-map music.
## (The JS client currently has map music disabled; here it is on by default
## and toggled with M. The choice is saved in user://settings.cfg.)

const SOUND_DIR := "res://assets/audio/sounds/"
const MUSIC_DIR := "res://assets/audio/music/"
const MAX_VOICES := 8

# ----------------------------------------------------------------------
# Sound effect volumes (dB, 0 = the file as recorded, -6 = about half as
# loud, +6 = about twice as loud). Edit these to balance the effects.
# Anything not listed uses DEFAULT_SFX_DB.
# ----------------------------------------------------------------------
const DEFAULT_SFX_DB := -12.0
const SFX_VOLUME_DB := {
	"gold": DEFAULT_SFX_DB,         # gold added (loot, selling, quest rewards)
	"loot": DEFAULT_SFX_DB,          # item picked up
	"chat": DEFAULT_SFX_DB,
	"npc": DEFAULT_SFX_DB,
	"npc-end": DEFAULT_SFX_DB,
	"hit1": DEFAULT_SFX_DB,
	"hit2": DEFAULT_SFX_DB,
	"kill1": DEFAULT_SFX_DB,
	"kill2": DEFAULT_SFX_DB,
	"hurt": DEFAULT_SFX_DB,
	"heal": DEFAULT_SFX_DB,
	"death": DEFAULT_SFX_DB,
	"revive": DEFAULT_SFX_DB,
	"teleport": DEFAULT_SFX_DB,
	"chest": DEFAULT_SFX_DB,
	"achievement": DEFAULT_SFX_DB,
}
# Optional: make an effect play another effect's file, e.g. {"gold": "loot"}.
# Empty by default, so every effect plays SOUND_DIR + <name>.ogg; an effect
# whose file does not exist (e.g. gold.ogg) is simply silent.
const SFX_FILE := {}
const MUSIC_DB := -10.0

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
		p.volume_db = DEFAULT_SFX_DB
		add_child(p)
		_voices.append(p)
	_music = AudioStreamPlayer.new()
	_music.volume_db = MUSIC_DB
	add_child(_music)
	_music.finished.connect(_on_music_finished)


func play_sound(sound_name: String) -> void:
	if not sfx_on:
		return
	var file: String = SFX_FILE.get(sound_name, sound_name)
	var stream: AudioStream = GameData.get_resource(SOUND_DIR + file + ".ogg")
	if stream == null:
		return
	for v in _voices:
		if not v.playing:
			v.stream = stream
			v.volume_db = sound_volume_db(sound_name)
			print("sound_name: ", sound_name)
			print("volume_db: ", v.volume_db)
			v.play()
			return


## Volume of one effect (see SFX_VOLUME_DB above).
static func sound_volume_db(sound_name: String) -> float:
	return float(SFX_VOLUME_DB.get(sound_name, DEFAULT_SFX_DB))


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
	_music.volume_db = MUSIC_DB
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
