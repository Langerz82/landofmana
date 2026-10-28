var Logger = function(level) {
    this.level = level;
    // The real level comes from config_build.json's "debug" key, which
    // config.js fetches asynchronously -- after many modules have already
    // logged during startup. Until setLevel() is called, info/debug messages
    // are held here (capped) and then printed or dropped according to the
    // level that arrives. null once the level has been set.
    this.pending = [];
};

Logger.PENDING_MAX = 1000;

// Called by config.js once config_build.json has loaded: "debug" when its
// "debug" key is set, else "error". Flushes anything held before then.
Logger.prototype.setLevel = function(level) {
    this.level = level;
    var pending = this.pending;
    this.pending = null;
    if (pending) {
        for (var i = 0; i < pending.length; i++) {
            this[pending[i][0]](pending[i][1]);
        }
    }
};

// true if the message was held because the level isn't known yet.
Logger.prototype._hold = function(method, message) {
    if (!this.pending) return false;
    if (this.pending.length < Logger.PENDING_MAX) this.pending.push([method, message]);
    return true;
};

Logger.prototype.info = function() {};
Logger.prototype.debug = function() {};
Logger.prototype.error = function() {};

//>>excludeStart("prodHost", pragmas.prodHost);
Logger.prototype.info = function(message) {
    if (this._hold('info', message)) return;
    if(this.level === "debug" || this.level === "info") {
        if(window.console) {
            console.info(message);
        }
    }
};

Logger.prototype.debug = function(message) {
    if (this._hold('debug', message)) return;
    if(this.level === "debug") {
        if(window.console) {
            console.log(message);
        }
    }
};

Logger.prototype.error = function(message, stacktrace) {
    if(window.console) {
        console.error(message);
        if(stacktrace !== undefined && stacktrace === true) {
            var trace = printStackTrace();
            console.error(trace.join('\n\n'));
            console.error('-----------------------------');
        }
    }
};
//>>excludeEnd("prodHost");

// FIX: this used to be `new Logger("debug")`, permanently pinning log.level
// to "debug" with nothing anywhere in the codebase ever changing it. The
// `//>>excludeStart("prodHost", ...)/excludeEnd` pragmas above are RequireJS/
// r.js optimizer directives -- they only strip the full Logger implementation
// (leaving just the no-op stubs at the top of this file) when r.js itself
// processes this module during a build. This file is loaded today as a plain
// classic <script> (see client/index.html), and the actual production build
// (package.json's "build-es" script, esbuild bundling into js/compress.js --
// the file index.html's <script type="module"> tag really loads) doesn't
// understand these pragmas at all; they're inert comments to it. So the
// pragma-based prod/dev split never actually happens, and "debug" was live
// in every build. Numerous FIX comments elsewhere in this codebase (e.g.
// gameclient.js's onMessage/recv logging) explicitly assumed log.debug()/
// log.info() calls were "silent outside debug builds" because of this level
// check -- they weren't. That left ~230 log.debug()/log.info() call sites
// across the client (including gameclient.js's per-packet recv/send logging,
// the single hottest path in the client network layer) firing unconditionally
// in production. Defaulting to "error" keeps log.error() visible (still
// unconditional, same as before) while making log.debug()/log.info() silent
// by default, matching what those FIX comments already believed was
// happening -- the client-side equivalent of the server's G_DEBUG flag
// (gameserver/js/main.js), just actually wired up now.
//
// "error" is only the starting level: config.js calls log.setLevel() with
// "debug" when config_build.json has "debug": 1 (all log.debug()/log.info()
// output, including per-packet send/recv logging, then shows in the
// console), or "error" otherwise. Startup messages logged before the config
// arrives are held and flushed at that point (see the constructor).
log = new Logger("error");