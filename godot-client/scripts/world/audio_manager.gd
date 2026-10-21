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
# The map tracks end with a 10-18 s fade-out to silence. Looping by
# replaying the track when it finished made the music fade away and then
# jump back to full volume every few minutes. Instead the next loop starts
# MUSIC_LOOP_OVERLAP seconds before the end and fades in over MUSIC_FADE_IN
# seconds while the old loop fades out.
const MUSIC_LOOP_OVERLAP := 10.0
const MUSIC_FADE_IN := 4.0

var sfx_on := true
var music_on := true
var sfx_volume := 1.0     # Sound Settings -> Sound volume: 0..1 (1 = 100%)
var music_volume := 1.0   # Sound Settings -> Music volume: 0..1 (1 = 100%)
var _voices: Array = []
var _music: AudioStreamPlayer       # the loop playing now
var _music_old: AudioStreamPlayer   # the previous loop, fading out
var _current_music := ""
var _tween: Tween                   # death fade-out
var _loop_tween: Tween              # loop crossfade
var _fading_out := false


func _ready() -> void:
	sfx_on = bool(Config.get_setting("audio", "sfx", true))
	music_on = bool(Config.get_setting("audio", "music", true))
	sfx_volume = clampf(float(Config.get_setting("audio", "sfxvolume", 1.0)), 0.0, 1.0)
	music_volume = clampf(float(Config.get_setting("audio", "musicvolume", 1.0)), 0.0, 1.0)
	for i in range(MAX_VOICES):
		var p := AudioStreamPlayer.new()
		p.volume_db = DEFAULT_SFX_DB
		add_child(p)
		_voices.append(p)
	_music = AudioStreamPlayer.new()
	_music_old = AudioStreamPlayer.new()
	for m in [_music, _music_old]:
		m.volume_db = music_db()
		add_child(m)
		m.finished.connect(_on_music_finished.bind(m))


func play_sound(sound_name: String) -> void:
	if not sfx_on or sfx_volume <= 0.0:
		return
	var file: String = SFX_FILE.get(sound_name, sound_name)
	var stream: AudioStream = GameData.get_resource(SOUND_DIR + file + ".ogg")
	if stream == null:
		return
	for v in _voices:
		if not v.playing:
			v.stream = stream
			v.volume_db = sound_volume_db(sound_name) + linear_to_db(sfx_volume)
			print("sound_name: ", sound_name)
			print("volume_db: ", v.volume_db)
			v.play()
			return


## Volume of one effect (see SFX_VOLUME_DB above), before the Sound volume setting.
static func sound_volume_db(sound_name: String) -> float:
	return float(SFX_VOLUME_DB.get(sound_name, DEFAULT_SFX_DB))


## Music level: MUSIC_DB with the Music volume setting applied.
func music_db() -> float:
	return MUSIC_DB + linear_to_db(maxf(music_volume, 0.0001))


## Sound Settings -> Sound volume (0..1). Saved; applies to the next effects.
func set_sfx_volume(v: float) -> void:
	sfx_volume = clampf(v, 0.0, 1.0)
	Config.set_setting("audio", "sfxvolume", snappedf(sfx_volume, 0.01))


## Sound Settings -> Music volume (0..1). Saved; the playing track changes at once.
func set_music_volume(v: float) -> void:
	music_volume = clampf(v, 0.0, 1.0)
	Config.set_setting("audio", "musicvolume", snappedf(music_volume, 0.01))
	if _fading_out:
		return
	if _loop_tween and _loop_tween.is_running():
		return   # mid-crossfade: the next loop picks the new level up
	if _music.playing:
		_music.volume_db = music_db()


func play_map_music(index: int) -> void:
	var track := "map%d" % index
	if not music_on:
		_current_music = track
		return
	if track == _current_music and _music.playing and not _fading_out:
		return
	_current_music = track
	_stop_music()
	var stream: AudioStream = GameData.get_resource(MUSIC_DIR + track + ".ogg")
	if stream == null:
		return
	_music.stream = stream
	_music.volume_db = music_db()
	_music.play()


func fade_out_music() -> void:
	if not _music.playing and not _music_old.playing:
		return
	_fading_out = true
	_kill_tweens()
	_tween = create_tween().set_parallel(true)
	for m in [_music, _music_old]:
		if m.playing:
			_tween.tween_property(m, "volume_db", -60.0, 1.5)
	_tween.chain().tween_callback(_stop_music)


func toggle_music(index: int) -> void:
	music_on = not music_on
	Config.set_setting("audio", "music", music_on)
	if music_on:
		_current_music = ""
		play_map_music(index)
	else:
		_stop_music()


func _process(_d: float) -> void:
	if not music_on or _fading_out or not _music.playing or _music.stream == null:
		return
	var length := _music.stream.get_length()
	if length > MUSIC_LOOP_OVERLAP * 2 and _music.get_playback_position() >= length - MUSIC_LOOP_OVERLAP:
		_start_next_loop()


## Crossfade into the next loop of the same track (see MUSIC_LOOP_OVERLAP).
func _start_next_loop() -> void:
	var old := _music
	_music = _music_old
	_music_old = old
	_music.stream = old.stream
	_music.volume_db = -40.0
	_music.play()
	if _loop_tween:
		_loop_tween.kill()
	_loop_tween = create_tween().set_parallel(true)
	_loop_tween.tween_property(_music, "volume_db", music_db(), MUSIC_FADE_IN)
	# The old loop's own fade-out carries on; this just makes sure it is
	# silent and stopped by its end.
	_loop_tween.tween_property(old, "volume_db", -60.0, MUSIC_LOOP_OVERLAP)
	_loop_tween.chain().tween_callback(old.stop)


func _stop_music() -> void:
	_kill_tweens()
	_fading_out = false
	for m in [_music, _music_old]:
		m.stop()
		m.volume_db = music_db()


func _kill_tweens() -> void:
	if _tween:
		_tween.kill()
		_tween = null
	if _loop_tween:
		_loop_tween.kill()
		_loop_tween = null


## Fallback for tracks too short to crossfade: replay when finished.
func _on_music_finished(m: AudioStreamPlayer) -> void:
	if m == _music and music_on and not _fading_out and _music.stream != null:
		_music.play()
