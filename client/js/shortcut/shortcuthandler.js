// Converted from AMD (define) + Class.extend to a native ES6 module/class.
// FIX (maintainability): this file used to declare three classes (Shortcut/Cooldown/
// ShortcutHandler) together; split into sibling files (shortcut.js/cooldown.js), same pattern
// used for dialog/appearancedialog.js. This file now keeps only the ShortcutHandler class.
import Shortcut from './shortcut.js';
import Cooldown from './cooldown.js';

export default class ShortcutHandler {
    constructor() {
        this.shortcuts = [];
        this.shortcutCount = 6;

        let shortcut;
        for (let i = 0; i < this.shortcutCount; ++i) {
            shortcut = new Shortcut(this, i, 0);
            shortcut.clear();
            this.shortcuts.push(shortcut);
        }
    }

    installAll(arr) {
        for (let sc of arr) {
            if (sc) {
                if (sc[0] >= this.shortcutCount) continue;
                this.shortcuts[sc[0]].install(sc[0], sc[1], sc[2]);
            }
        }
    }

    install(slot, type, shortcutId) {
        if (slot >= this.shortcutCount) return;

        if (this.shortcuts[slot])
            this.shortcuts[slot].install(slot, type, shortcutId);

        // This is a little hacky to apply the cooldown immediately if shortcut installed.
        // Considering it's not much overhead re-showing all child cooldowns it's fine.
        for (let sc of this.shortcuts) {
            if (
                sc &&
                type === sc.type &&
                shortcutId === sc.shortcutId &&
                sc.cooldown
            ) {
                sc.cooldown.show();
                break;
            }
        }
    }

    cooldownStart(type, shortcutId) {
        for (let slot of this.shortcuts) {
            if (!slot) continue;

            if (slot.type === type && slot.shortcutId === shortcutId) {
                slot.cooldownStart(slot.cooldownTime);
            }
        }
    }

    cooldownItems() {
        for (let slot of this.shortcuts) {
            if (slot.type === 1) {
                const cooldown = new Cooldown(slot);
                cooldown.start(slot.cooldownTime);
                break;
            }
        }
    }

    exec(slot) {
        if (this.shortcuts[slot]) this.shortcuts[slot].exec();
    }

    refresh() {
        for (let sc of this.shortcuts) {
            sc.display();
        }
    }

    getSameShortcuts(shortcut) {
        const shortcuts = [];
        // FIX: the type-1 (item) branch used to match on type alone, grouping every item shortcut
        // in the bar together regardless of shortcutId. That's inconsistent with cooldownStart()
        // (below), which is the actual source of truth for which shortcuts share a cooldown and
        // requires both type AND shortcutId to match - so using one consumable's cooldown was
        // visually shown on every item shortcut, not just the one that was used. Now requiring
        // shortcutId here too, the old type-1-only branch is a strict subset of the general
        // type+shortcutId match below, so the two have been collapsed into one check.
        for (let sc of this.shortcuts) {
            if (
                sc.type === shortcut.type &&
                sc.shortcutId === shortcut.shortcutId
            ) {
                shortcuts.push(sc);
            }
        }
        return shortcuts;
    }
}
