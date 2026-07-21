// Extracted from shortcuthandler.js: Cooldown (tracks/ticks down a shared cooldown timer across
// every shortcut slot bound to the same item/skill). Previously one of three classes
// (Shortcut/Cooldown/ShortcutHandler) declared in that one file. Same split pattern used for
// dialog/appearancedialog.js.

export default class Cooldown {
    constructor(shortcut) {
        this.shortcut = shortcut;
        this.children = shortcut.parent.getSameShortcuts(shortcut);
    }

    start(time) {
        const self = this;

        this.cooltimeCounter = time;

        const funcCooldown = function () {
            if (self.cooltimeCounter >= 0) {
                self.tick();
                self.cooltimeCounter -= 1;
            } else {
                self.done();
            }
        };

        clearInterval(this.cooltimeTickHandle);
        this.cooltimeTickHandle = setInterval(funcCooldown, 1000);

        funcCooldown();

        for (let sc of this.children) {
            sc.isCoolingDown = true;
            sc.jqCooldown.show();
        }
    }

    tick() {
        this.children = this.shortcut.parent.getSameShortcuts(this.shortcut);

        if (this.cooltimeCounter === 0) {
            this.done();
            return;
        }

        this.show();
    }

    show() {
        for (let sc of this.children) {
            sc.jqCooldown.show();
            sc.jqCooldown.html(this.cooltimeCounter);
        }
    }

    done() {
        clearInterval(this.cooltimeTickHandle);
        this.cooltimeTickHandle = null;
        this.cooltimeCounter = 0;

        for (let sc of this.children) {
            sc.isCoolingDown = false;
            sc.jqCooldown.hide();
            sc.cooldown = null;
        }
        this.cooldown = null;
        this.shortcut.cooldown = null;
        // FIX: `delete this;` is a no-op (delete cannot remove a local/this binding); removed dead code, cleanup is already handled above
    }
}
