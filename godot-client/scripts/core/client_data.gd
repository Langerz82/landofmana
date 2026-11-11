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
## Shared data and map updates pushed by the game server (gameserver/js/
## clientdata.js has the protocol). Port of client/js/clientdata.js.
##
## The files are the shared folder's data/ and maps/ json files ("data/lang.json",
## "maps/maplist.json", "maps/map2/map2_0_0.json"), identified as a set by their
## shared hash (gameserver/js/lib/shareddata.js). This build's own copies are
## res://assets/data/shared/ and res://assets/maps/, and their hash is in
## res://assets/data/shared_manifest.json (shared/manifest.json, copied by the
## sync-assets scripts).
##
## GameClient sends the hash of the files in use in a hello just before its login.
## When the game server's files hash differently it pushes every one of them in one
## zip, written to
## user://clientdata/<path>; GameData, MapData and World read through
## shared_path() / map_path() / maplist_path(). If the zip can't be used, the
## data files and the map list that need it are asked for one by one straight
## away, and each map file only when that map is about to load (ensure_map()).
## shared_data_changed fires once the data files / map list in use have changed:
## GameData reloads itself and World its map list.

signal shared_data_changed
signal _file_settled(path: String)

const ROOT := "user://clientdata/"
const META := ROOT + "meta.json"
const RES_DATA := "res://assets/data/shared/"
const RES_MAPS := "res://assets/maps/"
const RES_MANIFEST := "res://assets/data/shared_manifest.json"
const REQUEST_TIMEOUT := 60.0

## {hash, files: {path: sha1} (the server's list), have: {path: sha1} (written to user://)}, or null
var _meta = null
var _client = null                  # the GameClient, once connected
var _requests: Dictionary = {}      # path -> {done, ok, text}
var _pushing := false               # a pushed update still being stored


func _ready() -> void:
	_meta = _read_meta()


# -------------------------------------------------------------------- hashes

var _builtin_hash = null

## The shared hash of this build's own files ("" if the manifest is missing, or the packed
## files don't match it: the game server then pushes its files).
func builtin_hash() -> String:
	if _builtin_hash == null:
		_builtin_hash = ""
		if FileAccess.file_exists(RES_MANIFEST):
			var m = JSON.parse_string(FileAccess.get_file_as_string(RES_MANIFEST))
			if m is Dictionary and m.get("hash") is String:
				# Only claim the manifest's hash if the packed files really are the ones it lists. The
				# game server only pushes its files when the hash we send differs from its own, so a
				# build whose manifest is newer than its packed maps/data (a partial asset sync, an
				# export made before the maps were copied in, line endings changed by git) would
				# otherwise play on stale files -- e.g. an old map whose door leads somewhere the
				# server refuses ("Teleport door does not lead to requested map"). With no hash
				# claimed, the server pushes its files and those are used instead.
				var stale := _stale_builtin_files(m.get("files") if m.get("files") is Dictionary else {})
				if stale.is_empty():
					_builtin_hash = m["hash"]
				else:
					push_warning("ClientData: built-in files differ from the built-in manifest (%s): using the game server's files." % ", ".join(stale.slice(0, 5)))
	return _builtin_hash


## The manifest's files ({"maps/map0/map0.json": sha1, ...}) whose packed copy (res://assets/...) is
## missing or has a different sha1.
func _stale_builtin_files(files: Dictionary) -> PackedStringArray:
	var stale := PackedStringArray()
	if files.is_empty():
		stale.append("no file list")
		return stale
	for p in files:
		var path := str(p)
		var res := ""
		if path.begins_with("data/"):
			res = RES_DATA + path.trim_prefix("data/")
		elif path.begins_with("maps/"):
			res = RES_MAPS + path.trim_prefix("maps/")
		if res == "" or not FileAccess.file_exists(res) or _sha1(FileAccess.get_file_as_bytes(res)) != str(files[p]):
			stale.append(path)
	return stale


## The shared hash of the files in use: the downloaded ones', else this build's.
func active_hash() -> String:
	return str(_meta["hash"]) if _meta != null else builtin_hash()


# --------------------------------------------------------------------- paths

## A file in use: the downloaded copy if it is the server's, else "".
func _local(path: String) -> String:
	if _meta == null:
		return ""
	var want = _meta.files.get(path)
	if want == null or _meta.have.get(path) != want:
		return ""
	return ROOT + path if FileAccess.file_exists(ROOT + path) else ""


## Where GameData reads a shared data file ("lang.json") from.
func shared_path(file_name: String) -> String:
	var p := _local("data/" + file_name)
	return p if p != "" else RES_DATA + file_name


## Where MapData reads a map file ("map2/map2_0_0.json") from.
func map_path(file: String) -> String:
	var p := _local("maps/" + file)
	return p if p != "" else RES_MAPS + file


func maplist_path() -> String:
	return map_path("maplist.json")


## The map file of a maplist name: "map2/map2_0_0" -> "map2/map2_0_0.json", "map1" -> "map1/map1.json".
static func map_file(map_name: String) -> String:
	return (map_name + ".json") if "/" in map_name else (map_name + "/" + map_name + ".json")


static func _is_startup_file(path: String) -> bool:
	return path.begins_with("data/") or path == "maps/maplist.json"


## What the data files / map list in use are (changes -> shared_data_changed).
func _startup_fingerprint() -> String:
	if _meta == null:
		return "built-in"
	var keys := PackedStringArray()
	for p in _meta.files:
		if _is_startup_file(str(p)) and _local(str(p)) != "":
			keys.append("%s=%s" % [p, _meta.files[p]])
	keys.sort()
	return "|".join(keys)


# ------------------------------------------------------- talking to the server

## The hello, sent by GameClient just before its login.
func send_hello(client) -> void:
	_client = client
	client.send([Types.Messages.CW_CLIENTDATA, 0, active_hash()])


## WC_CLIENTDATA from the game server (GameClient handler).
func on_message(data: Array) -> void:
	var type := Types.to_int(data[0]) if data.size() > 0 else -1
	match type:
		0:
			_apply_push(str(data[1]), data[2] if data[2] is Dictionary else {}, str(data[3]))
		1:
			_settle(str(data[2]), true, str(data[3]))
		2:
			_settle(str(data[2]), false, "")


## One file from the game server: {ok, text}.
func _request_file(path: String) -> Dictionary:
	if _client == null:
		return {"ok": false, "text": ""}
	if not _requests.has(path):
		_requests[path] = {"done": false, "ok": false, "text": ""}
		_client.send([Types.Messages.CW_CLIENTDATA, 1, path])
		get_tree().create_timer(REQUEST_TIMEOUT).timeout.connect(func(): _settle(path, false, ""))
	var r: Dictionary = _requests[path]
	while not r.done:
		var settled: String = await _file_settled
		if settled == path:
			break
	return {"ok": r.ok, "text": r.text}


func _settle(path: String, ok: bool, text: String) -> void:
	if not _requests.has(path):
		return
	var r: Dictionary = _requests[path]
	_requests.erase(path)
	r.done = true
	r.ok = ok
	r.text = text
	_file_settled.emit(path)


# ------------------------------------------------------------------- updates

func _apply_push(server_hash: String, files: Dictionary, zip_b64: String) -> void:
	_pushing = true
	var before := _startup_fingerprint()
	if server_hash == builtin_hash():
		# the server is on this build's own files: drop any downloaded copy
		_clear()
	else:
		var old = _meta
		var meta := {"hash": server_hash, "files": files, "have": {}}
		_remove(META)   # never leave a list pointing at half-written files
		_meta = null
		if not _from_zip(zip_b64, files, meta):
			push_warning("ClientData: zip not used: downloading the files one by one.")
			# reuse what is already on disk, then ask for the data files and map list
			if old != null:
				for p in files:
					if old.have.get(p) == files[p] and FileAccess.file_exists(ROOT + str(p)):
						meta.have[p] = files[p]
			for p in files:
				var path := str(p)
				if not _is_startup_file(path) or meta.have.get(path) == files[path]:
					continue
				var r: Dictionary = await _request_file(path)
				var bytes: PackedByteArray = r.text.to_utf8_buffer()
				if r.ok and _sha1(bytes) == str(files[path]) and _write(ROOT + path, bytes):
					meta.have[path] = files[path]
				else:
					push_warning("ClientData: %s not downloaded: using the built-in one." % path)
		_meta = meta
		_save_meta()
		print("ClientData: updated to the game server's files (%s)." % server_hash)
	_pushing = false
	if _startup_fingerprint() != before:
		shared_data_changed.emit()


## Writes every file of the pushed zip that matches its sha1; false if the zip
## can't be read or any file is missing or doesn't match.
func _from_zip(zip_b64: String, files: Dictionary, meta: Dictionary) -> bool:
	if zip_b64 == "":
		return false
	var tmp := ROOT + "push.zip"
	DirAccess.make_dir_recursive_absolute(ROOT)
	if not _write(tmp, Marshalls.base64_to_raw(zip_b64)):
		return false
	var zr := ZIPReader.new()
	if zr.open(tmp) != OK:
		_remove(tmp)
		return false
	var names := zr.get_files()
	var ok := true
	for p in files:
		var path := str(p)
		if not names.has(path):
			ok = false
			break
		var bytes := zr.read_file(path)
		if _sha1(bytes) != str(files[p]) or not _write(ROOT + path, bytes):
			ok = false
			break
		meta.have[path] = files[p]
	zr.close()
	_remove(tmp)
	return ok


## Called just before a map is loaded (map_name as in maplist.json): when the
## game server's version of the files has this map but it isn't on disk yet (the
## zip couldn't be used), asks for it now. map_path() then returns it.
func ensure_map(map_name: String) -> void:
	while _pushing:
		await get_tree().process_frame
	if _meta == null:
		return
	var path := "maps/" + map_file(map_name)
	var want = _meta.files.get(path)
	if want == null or _local(path) != "":
		return
	var r: Dictionary = await _request_file(path)
	var bytes: PackedByteArray = r.text.to_utf8_buffer()
	if r.ok and _sha1(bytes) == str(want) and _write(ROOT + path, bytes):
		_meta.have[path] = want
		_save_meta()
	else:
		push_warning("ClientData: %s not downloaded: using the built-in one." % path)


# ------------------------------------------------------------------- helpers

func _read_meta():
	if not FileAccess.file_exists(META):
		return null
	var m = JSON.parse_string(FileAccess.get_file_as_string(META))
	if m is Dictionary and m.get("files") is Dictionary and m.get("have") is Dictionary and m.get("hash") is String:
		return m
	return null


func _save_meta() -> void:
	if _meta != null:
		_write(META, JSON.stringify(_meta).to_utf8_buffer())


func _clear() -> void:
	if _meta != null:
		for p in _meta.have:
			_remove(ROOT + str(p))
	_remove(META)
	_meta = null


static func _write(path: String, bytes: PackedByteArray) -> bool:
	DirAccess.make_dir_recursive_absolute(path.get_base_dir())
	var f := FileAccess.open(path, FileAccess.WRITE)
	if f == null:
		return false
	f.store_buffer(bytes)
	f.close()
	return true


static func _remove(path: String) -> void:
	if FileAccess.file_exists(path):
		DirAccess.remove_absolute(path)


static func _sha1(bytes: PackedByteArray) -> String:
	var ctx := HashingContext.new()
	ctx.start(HashingContext.HASH_SHA1)
	if bytes.size() > 0:
		ctx.update(bytes)
	return ctx.finish().hex_encode()
