// Converted from AMD (define) + Class.extend to a native ES6 module/class.
/* global Utils */

export default class SocialHandler {
    constructor(game) {
        const self = this;

        this.game = game;
        this.toggle = false;

        this.jqPartyLeave = $('#partyleave');
        this.jqPartyNames = $('#partynames');
        this.jqGuildLeave = $('#guildleave');
        this.jqGuildNames = $('#guildnames');
        this.jqSocialWindow = $('#socialwindow');
        this.jqSocialConfirmTitle = $('#socialconfirmtitle');
        this.jqSocialConfirm = $('#socialconfirm');
        this.jqSocialConfirmYes = $('#socialconfirmyes');
        this.jqSocialConfirmNo = $('#socialconfirmno');

        this.partymembers = [];
        this.jqPartyLeave.click(function (event) {
            self.game.client.sendPartyLeave();
            self.jqPartyNames.html('');
            self.show();
        });
        const jqPartyClose = $('#partyclose');
        jqPartyClose.click(function (e) {
            self.show();
        });

        this.guildmembers = [];
        this.jqGuildLeave.click(function (event) {
            self.game.client.sendLeaveGuild();
            self.jqGuildNames.html('');
            self.show();
        });
        const jqSocialClose = $('#socialclose');
        jqSocialClose.click(function (e) {
            self.show();
        });
    }

    inviteParty(invitee) {
        const self = this;

        // FIX: invitee.name is untrusted/server-controlled; escape before inserting as HTML to prevent XSS
        this.jqSocialConfirmTitle.html(
            'Party ' + Utils.escapeHtml(invitee.name) + '?'
        );

        this.jqSocialConfirm.show();
        // FIX: missing .off() before rebinding meant repeated party invites stacked duplicate click handlers on #socialconfirmyes,
        // sending sendPartyInvite() multiple times per click; unbind first like #socialconfirmno already does
        this.jqSocialConfirmYes.off().on('click', function (event) {
            self.game.client.sendPartyInvite(invitee.name, 1);
            self.jqSocialConfirm.hide();
        });
        this.jqSocialConfirmNo.off().on('click', function (event) {
            self.game.client.sendPartyInvite(invitee.name, 2);
            self.jqSocialConfirm.hide();
        });

        setTimeout(function () {
            self.jqSocialConfirm.hide();
        }, 10000);
    }

    inviteGuild(guildId, guildName, invitorName) {
        const self = this;

        // FIX: guildName is untrusted/server-controlled; escape before inserting as HTML to prevent XSS
        this.jqSocialConfirmTitle.html(
            'Join Guild ' + Utils.escapeHtml(guildName) + '?'
        );

        this.jqSocialConfirm.show();
        // FIX: missing .off() before rebinding meant repeated guild invites stacked duplicate click handlers,
        // sending sendGuildInviteReply() multiple times per click
        this.jqSocialConfirmYes.off().on('click', function (event) {
            self.game.client.sendGuildInviteReply(guildId, true);
            self.jqSocialConfirm.hide();
        });
        this.jqSocialConfirmNo.off().on('click', function (event) {
            self.game.client.sendGuildInviteReply(guildId, false);
            self.jqSocialConfirm.hide();
        });

        setTimeout(function () {
            self.jqSocialConfirm.hide();
        }, 10000);
    }

    show() {
        this.toggle = !this.toggle;
        if (this.toggle) {
            this.displayParty();
            this.displayGuild();
            this.jqSocialWindow.css('display', 'block');
        } else {
            this.jqSocialWindow.css('display', 'none');
        }
    }
    setPartyMembers(members) {
        this.partymembers = members;
        this.displayParty();
    }

    setGuildMembers(members) {
        this.guildmembers = members;
        this.displayGuild();
    }

    displayParty() {
        if (this.partymembers.length <= 1) {
            this.jqPartyNames.html('No party.');
            return;
        } else {
            this.jqPartyLeave.show();
        }

        // FIX: party member names are untrusted/server-controlled; escape before inserting as HTML to prevent XSS
        let htmlStr = '<table><tr><th>Name</th></tr>';
        htmlStr +=
            '<tr><td>' +
            Utils.escapeHtml(this.partymembers[0]) +
            ' (L)</td></tr>';
        for (let i = 1; i < this.partymembers.length; ++i) {
            htmlStr +=
                '<tr><td>' +
                Utils.escapeHtml(this.partymembers[i]) +
                '</td></tr>';
        }
        htmlStr += '</table>';
        this.jqPartyNames.html(htmlStr);
    }

    displayGuild() {
        if (this.guildmembers.length <= 0) {
            this.jqGuildNames.html('No guild.');
            return;
        } else {
            this.jqGuildLeave.show();
        }

        // FIX: guild member names are untrusted/server-controlled; escape before inserting as HTML to prevent XSS
        let htmlStr = '<table><tr><th>Name</th></tr>';
        htmlStr +=
            '<tr><td>' +
            Utils.escapeHtml(this.guildmembers[0]) +
            ' (L)</td></tr>';
        for (let i = 1; i < this.guildmembers.length; ++i) {
            htmlStr +=
                '<tr><td>' +
                Utils.escapeHtml(this.guildmembers[i]) +
                '</td></tr>';
        }
        htmlStr += '</table>';
        this.jqGuildNames.html(htmlStr);
    }

    isPartyLeader(name) {
        return name === this.partymembers[0];
    }

    isPartyMember(name) {
        return this.partymembers.indexOf(name) > -1;
    }

    isGuildLeader(name) {
        return name === this.guildmembers[0];
    }

    isGuildMember(name) {
        return this.guildmembers.indexOf(name) > -1;
    }
}
