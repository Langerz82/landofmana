// Converted from AMD (define) + Class.extend to a native ES6 module/class.
/* global Utils */
// FIX (maintainability): the chat-command dispatchers (processSenders/processRecievers, the
// big "/command" switch/pattern-match blocks) and their small handleXxx() helpers moved to
// chathandlercommands.js as a mixin, same pattern used throughout this codebase (see
// entity/character.js, game/gameinteraction.js, etc.) - installed onto ChatHandler.prototype
// right after the class declaration below. This file now keeps the chat-log UI utilities
// (constructor, show, the two thin process*Message delegators, bumpOffLog, and the addXxx
// chat-log-rendering methods).
import { installChatHandlerCommands } from './chathandlercommands.js';

export default class ChatHandler {
    constructor(game) {
        const self = this;
        //this.game = game;
        //this.client = game.client;
        //this.kkhandler = kkhandler;
        this.chatLog = $('#chatLog');
        //handle global announcements server sided so
        //they're always synced.
        this.bumpOffDelay = 30000;
    }
    show() {
        $('#chatLog').css('display', 'flex');
    }
    processSendMessage(message) {
        return this.processSenders(null, message);
    }
    processReceiveMessage(entityId, message) {
        return this.processRecievers(entityId, message);
    }

    bumpOffLog(delay) {
        // FIX (var cleanup): was `var delay = delay || ...`, redeclaring the `delay` parameter
        // with var - let/const can't redeclare a parameter name, so this is just a reassignment.
        delay = delay || this.bumpOffDelay;
        const self = this;
        $(this.chatLog).scrollTop(999999);
        setTimeout(function () {
            // FIX: `this` inside a plain setTimeout callback is undefined (strict-mode ES module), so `this.chatLog` threw;
            // use the captured `self` instead, which was declared for this purpose but never used
            $(self.chatLog).find('p:first').remove();
        }, delay);
    }

    addToChatLog(message) {
        // FIX: message may be raw untrusted chat text (see call sites); callers now escape untrusted
        // content before calling this, since some callers intentionally wrap pre-built trusted HTML (e.g. <font> tags)
        const self = this;
        const el = $('<p style="color: white">' + message + '</p>');
        $(el).appendTo(this.chatLog);
        this.bumpOffLog();
    }
    addNotification(message) {
        const self = this;
        const el = $(
            '<p style="color: rgba(128, 255, 128, 1)">' + message + '</p>'
        );
        $(el).appendTo(this.chatLog);
        this.bumpOffLog();
    }
    addNormalChat(entity, message) {
        const self = this;
        if (!entity) return;
        // FIX: entity.name and message are untrusted/server-controlled; escape before inserting as HTML to prevent XSS
        const el = $(
            '<p style="color: rgba(255, 255, 0, 1)">' +
                Utils.escapeHtml(entity.name) +
                ': ' +
                Utils.escapeHtml(message) +
                '</p>'
        );
        $(el).appendTo(this.chatLog);
        this.bumpOffLog();
    }

    addGameNotification(notificationType, message) {
        const self = this;
        // FIX: message may be untrusted/server-controlled; escape before inserting as HTML to prevent XSS
        const el = $(
            '<p style="color: rgba(255, 255, 0, 1)">' +
                notificationType +
                ': ' +
                Utils.escapeHtml(message) +
                '</p>'
        );
        $(el).appendTo(this.chatLog);
        this.bumpOffLog();
    }

    addRatingNotification(message) {
        const self = this;
        // FIX: message is untrusted/server-controlled; escape before inserting as HTML to prevent XSS
        const el = $(
            '<p style="color: rgba(255, 255, 0, 1)">' +
                Utils.escapeHtml(message) +
                '</p>'
        );
        $(el).appendTo(this.chatLog);
        this.bumpOffLog();
    }
}

installChatHandlerCommands(ChatHandler.prototype);
