class_name PacketCodec
## Message framing shared by the user server and the game server
## (see server ws/wsbase.js send() and the client's onMessage()):
##   "1" + JSON           plain JSON
##   "2" + base64(gzip)   JSON compressed with gzip (payloads >= 2048 bytes)
##   anything else        legacy comma separated values


static func encode(packet: Array) -> String:
	return "1" + JSON.stringify(packet)


## Returns an Array of actions (each action is an Array whose [0] is the id).
static func decode(data: String) -> Array:
	if data.is_empty():
		return []
	var method := data[0]
	var parsed = null
	if method == "2":
		var raw := Marshalls.base64_to_raw(data.substr(1))
		var inflated := raw.decompress_dynamic(-1, FileAccess.COMPRESSION_GZIP)
		parsed = JSON.parse_string(inflated.get_string_from_utf8())
	elif method == "1":
		parsed = JSON.parse_string(data.substr(1))
	else:
		parsed = Array(data.split(","))
	if not (parsed is Array) or parsed.is_empty():
		return []
	if parsed[0] is Array:
		return parsed
	return [parsed]
