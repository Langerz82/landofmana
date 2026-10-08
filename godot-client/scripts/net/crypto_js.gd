class_name CryptoJSCompat
## Reproduces the two crypto calls the JS client makes when logging in:
##   jsSHA(username + password).getHash('SHA-1', 'HEX')
##   CryptoJS.AES.encrypt(JSON.stringify(sha1hex), challenge).toString()
## CryptoJS's passphrase mode is OpenSSL-compatible: "Salted__" + salt +
## AES-256-CBC(PKCS#7) with key/iv derived by EVP_BytesToKey(MD5).


static func sha1_hex(text: String) -> String:
	return text.sha1_text()


static func _md5(data: PackedByteArray) -> PackedByteArray:
	var ctx := HashingContext.new()
	ctx.start(HashingContext.HASH_MD5)
	ctx.update(data)
	return ctx.finish()


## OpenSSL EVP_BytesToKey with MD5, one iteration (what CryptoJS uses).
static func _evp_bytes_to_key(password: PackedByteArray, salt: PackedByteArray, total: int) -> PackedByteArray:
	var out := PackedByteArray()
	var prev := PackedByteArray()
	while out.size() < total:
		var block := PackedByteArray()
		block.append_array(prev)
		block.append_array(password)
		block.append_array(salt)
		prev = _md5(block)
		out.append_array(prev)
	return out.slice(0, total)


## CryptoJS.AES.encrypt(plaintext, passphrase).toString()
static func aes_encrypt(plaintext: String, passphrase: String) -> String:
	var crypto := Crypto.new()
	var salt := crypto.generate_random_bytes(8)
	var key_iv := _evp_bytes_to_key(passphrase.to_utf8_buffer(), salt, 48)
	var key := key_iv.slice(0, 32)
	var iv := key_iv.slice(32, 48)
	var data := plaintext.to_utf8_buffer()
	var pad := 16 - (data.size() % 16)
	for i in range(pad):
		data.append(pad)
	var aes := AESContext.new()
	aes.start(AESContext.MODE_CBC_ENCRYPT, key, iv)
	var cipher := aes.update(data)
	aes.finish()
	var blob := "Salted__".to_ascii_buffer()
	blob.append_array(salt)
	blob.append_array(cipher)
	return Marshalls.raw_to_base64(blob)


## CryptoJS.AES.decrypt(...).toString(Utf8) - used only by the self test.
static func aes_decrypt(b64: String, passphrase: String) -> String:
	var blob := Marshalls.base64_to_raw(b64)
	if blob.size() < 32:
		return ""
	var salt := blob.slice(8, 16)
	var cipher := blob.slice(16)
	var key_iv := _evp_bytes_to_key(passphrase.to_utf8_buffer(), salt, 48)
	var aes := AESContext.new()
	aes.start(AESContext.MODE_CBC_DECRYPT, key_iv.slice(0, 32), key_iv.slice(32, 48))
	var plain := aes.update(cipher)
	aes.finish()
	var pad := plain[plain.size() - 1]
	return plain.slice(0, plain.size() - pad).get_string_from_utf8()


## The value the JS User class sends as `hash`: btoa(AES(JSON(sha1(user+pw)))).
static func make_login_hash(username: String, password: String, challenge: String) -> String:
	var sha := sha1_hex(username.to_lower() + password)
	var enc := aes_encrypt(JSON.stringify(sha), challenge)
	return Marshalls.utf8_to_base64(enc)
