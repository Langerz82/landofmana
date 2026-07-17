var Logger = function(level) {
    this.level = level;
};

Logger.prototype.info = function() {};
Logger.prototype.debug = function() {};
Logger.prototype.error = function() {};

//>>excludeStart("prodHost", pragmas.prodHost);
Logger.prototype.info = function(message) {
    if(this.level === "debug" || this.level === "info") {
        if(window.console) {
            console.info(message);
        }
    }
};

Logger.prototype.debug = function(message) {
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
log = new Logger("error");