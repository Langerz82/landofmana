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
## Port of client/js/config.js. Loads res://assets/config/config_build.json and
## lets the player override host/port (saved to user://settings.cfg).

const BUILD_PATH := "res://assets/config/config_build.json"
const SETTINGS_PATH := "user://settings.cfg"

var build: Dictionary = {
	"host": "127.0.0.1",
	"port": 1340,
	"protocol": "http",
	"debug": 0,
	"version": 104,
}

var settings := ConfigFile.new()
var log_packets := false   # print every packet (--log-packets)


func _ready() -> void:
	var text := FileAccess.get_file_as_string(BUILD_PATH)
	if text != "":
		var parsed = JSON.parse_string(text)
		if parsed is Dictionary:
			build.merge(parsed, true)
	else:
		push_warning("Config: could not read %s, using defaults" % BUILD_PATH)
	settings.load(SETTINGS_PATH)
	# Command line override: --server=host:port
	for arg in OS.get_cmdline_user_args():
		if arg == "--log-packets":
			log_packets = true
		if arg.begins_with("--server="):
			var hp := arg.substr(9).split(":")
			# In-memory only (not saved) so it wins over saved settings.
			settings.set_value("server", "host", hp[0])
			if hp.size() > 1:
				settings.set_value("server", "port", int(hp[1]))


func get_host() -> String:
	return str(settings.get_value("server", "host", build.get("host", "127.0.0.1")))


func get_port() -> int:
	return int(settings.get_value("server", "port", build.get("port", 1340)))


func get_protocol() -> String:
	return str(build.get("protocol", "http"))


func get_version() -> int:
	return int(build.get("version", 0))


func is_debug() -> bool:
	return int(build.get("debug", 0)) != 0


func set_server(host: String, port: int) -> void:
	settings.set_value("server", "host", host)
	settings.set_value("server", "port", port)
	settings.save(SETTINGS_PATH)


func get_setting(section: String, key: String, default_value = null):
	return settings.get_value(section, key, default_value)


func set_setting(section: String, key: String, value) -> void:
	settings.set_value(section, key, value)
	settings.save(SETTINGS_PATH)


func user_server_url() -> String:
	return "%s://%s:%d/" % [get_protocol(), get_host(), get_port()]
