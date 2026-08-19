// Converted from AMD (define) + Class.extend to a native ES6 module/class.
/* global _ */

import Detect from './detect.js';
import Area from './area.js';

export default class AudioManager {
    constructor(game) {
        if (game.isMobile || typeof Native !== 'undefined')
            this.enabled = false;
        else this.enabled = true;
        this.extension = 'ogg';
        this.sounds = {};
        this.game = game;
        this.currentMusic = null;
        this.areas = [];
        this.loadedMusic = {
            map0: false,
            map1: false,
            map2: false,
            map3: false
        };

        this.loadedSound = {
            loot: false,
            hit1: false,
            hit2: false,
            hurt: false,
            heal: false,
            chat: false,
            revive: false,
            death: false,
            firefox: false,
            achievement: false,
            kill1: false,
            kill2: false,
            noloot: false,
            teleport: false,
            chest: false,
            npc: false,
            'npc-end': false
        };

        if (Detect.isSafari() && Detect.isWindows()) {
            this.enabled = false; // Disable audio on Safari Windows
        }
    }

    toggle(enabled) {
        this.enabled = enabled;
        if (this.enabled) {
            if (this.currentMusic) {
                this.resetMusic(this.currentMusic);
            }
        } else {
            this.stopMusic(this.currentMusic);
        }
        return this.enabled;
    }

    load(basePath, name, loaded_callback, channels) {
        const path = basePath + name + '.' + this.extension,
            sound = document.createElement('audio'),
            self = this;

        // FIX: arguments.callee is forbidden in strict mode (ES modules are always strict),
        // which threw "'caller', 'callee', and 'arguments' properties may not be accessed on
        // strict mode functions..." as soon as a sound/music file finished loading. Named the
        // function expression and referenced it by name instead of arguments.callee.
        sound.addEventListener(
            'canplaythrough',
            function onCanPlayThrough(e) {
                this.removeEventListener(
                    'canplaythrough',
                    onCanPlayThrough,
                    false
                );
                log.debug(path + ' is ready to play.');
                if (loaded_callback) {
                    loaded_callback();
                }
            },
            false
        );
        sound.addEventListener(
            'error',
            function (e) {
                log.error('Error: ' + path + ' could not be loaded.');
                self.sounds[name] = null;
            },
            false
        );

        sound.preload = 'auto';
        sound.autobuffer = true;
        sound.src = path;
        sound.load();

        this.sounds[name] = [sound];
        _.times(channels - 1, function () {
            self.sounds[name].push(sound.cloneNode(true));
        });
    }

    loadSound(name, handleLoaded) {
        this.load('audio/sounds/', name, handleLoaded, 4);
    }

    loadMusic(name, handleLoaded) {
        this.load('audio/music/', name, handleLoaded, 1);
        const music = this.sounds[name][0];
        music.loop = true;
        music.addEventListener(
            'ended',
            function () {
                music.play();
            },
            false
        );
    }

    getSound(name) {
        if (!this.sounds[name]) {
            return null;
        }
        let sound = _.detect(this.sounds[name], function (sound) {
            return sound.ended || sound.paused;
        });
        if (sound && sound.ended) {
            sound.currentTime = 0;
        } else {
            sound = this.sounds[name][0];
        }
        return sound;
    }

    playSound(name) {
        if (this.enabled) {
            if (name in this.loadedSound && this.loadedSound[name] === false) {
                this.loadSound(name);
                this.loadedSound[name] = true;
            }
            const sound = this.getSound(name);
            if (sound) {
                sound.play();
            }
        }
    }

    addArea(x, y, width, height, musicName) {
        const area = new Area(x, y, width, height);
        area.musicName = musicName;
        this.areas.push(area);
    }

    // TODO fix.
    //
    // NOTE (investigated, not implemented): this isn't just a stubbed lookup
    // -- `this.areas` (populated only via addArea() above) has no live
    // callers anywhere in the codebase (verified via search; the only other
    // reference is compress.js, a bundled copy of this same source, not a
    // separate caller), so `this.areas` is always empty regardless of what
    // this function does with it. Area-based music switching needs the
    // missing half of this feature first -- something that actually calls
    // addArea() with real per-map area/music data -- before a real
    // "find which area `entity` is standing in and return its musicName"
    // implementation here would ever return anything but null anyway. Not
    // guessing at where that data should come from (map JSON? a per-map
    // config alongside loaddata.js?) without knowing the intended source.
    getSurroundingMusic(entity) {
        return null; // TEMP
    }

    updateMusic() {
        if (this.enabled) {
            const music = this.getSurroundingMusic(this.game.player);

            if (music) {
                if (!this.isCurrentMusic(music)) {
                    if (this.currentMusic) {
                        this.fadeOutCurrentMusic();
                    }
                    this.playMusic(music);
                }
            } else {
                this.fadeOutCurrentMusic();
            }
        } else {
            this.fadeOutCurrentMusic();
        }
    }

    isCurrentMusic(music) {
        return this.currentMusic && music.name === this.currentMusic.name;
    }

    playMusic(music) {
        if (
            music.name in this.loadedMusic &&
            this.loadedMusic[music.name] === false
        ) {
            this.loadMusic(music.name);
            // FIX: was setting a property on the `loadMusic` function itself instead of the `loadedMusic` tracking
            // map (compare playSound's correct `this.loadedSound[name] = true`), so this track was reloaded from
            // scratch every time playMusic() ran for it instead of just once.
            this.loadedMusic[music.name] = true;
        }
        if (this.enabled && music && music.sound) {
            if (music.sound.fadingOut) {
                this.fadeInMusic(music);
            } else {
                music.sound.volume = 0.75;
                music.sound.play();
            }
            this.currentMusic = music;
        }
    }

    resetMusic(music) {
        if (music && music.sound && music.sound.readyState > 0) {
            music.sound.pause();
            music.sound.currentTime = 0;
            music.sound.play();
        }
    }

    stopMusic(music) {
        if (music && music.sound && music.sound.readyState > 0) {
            music.sound.pause();
            music.sound.currentTime = 0;
        }
    }

    fadeOutMusic(music, ended_callback) {
        const self = this;
        if (music && !music.sound.fadingOut) {
            this.clearFadeIn(music);
            music.sound.fadingOut = setInterval(function () {
                const step = 0.02;
                const volume = music.sound.volume - step; // FIX: missing var, was an implicit global

                if (self.enabled && volume >= step) {
                    music.sound.volume = volume;
                } else {
                    music.sound.volume = 0;
                    self.clearFadeOut(music);
                    ended_callback(music);
                }
            }, 50);
        }
    }

    fadeInMusic(music) {
        const self = this;
        if (music && !music.sound.fadingIn) {
            this.clearFadeOut(music);
            music.sound.fadingIn = setInterval(function () {
                const step = 0.01;
                const volume = music.sound.volume + step; // FIX: missing var, was an implicit global

                if (self.enabled && volume < 0.75 - step) {
                    music.sound.volume = volume;
                } else {
                    music.sound.volume = 0.75;
                    self.clearFadeIn(music);
                }
            }, 30);
        }
    }

    clearFadeOut(music) {
        if (music.sound.fadingOut) {
            clearInterval(music.sound.fadingOut);
            music.sound.fadingOut = null;
        }
    }

    clearFadeIn(music) {
        if (music.sound.fadingIn) {
            clearInterval(music.sound.fadingIn);
            music.sound.fadingIn = null;
        }
    }

    fadeOutCurrentMusic() {
        const self = this;
        if (this.currentMusic) {
            this.fadeOutMusic(this.currentMusic, function (music) {
                self.resetMusic(music);
            });
            this.currentMusic = null;
        }
    }
}
