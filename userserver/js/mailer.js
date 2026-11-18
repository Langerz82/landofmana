// This file is part of Land of Mana (https://github.com/Langerz82/landofmana).
// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2023-2026 Joshua Langley and contributors
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, version 3 of the License.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program. See the LICENSE file in the project root,
// or <https://www.gnu.org/licenses/>.

// Outgoing e-mail (currently only the forgot-password window's temporary
// password -- user.js handleForgotPassword), sent over SMTP with nodemailer.
//
// Configured in config.json:
//   smtp_host      SMTP server, e.g. "smtp.example.com" -- blank turns e-mail off
//   smtp_port      587 (STARTTLS) or 465 (TLS)
//   smtp_secure    true for port 465, false for 587
//   smtp_user      login for the SMTP server (blank = no login)
//   smtp_password
//   mail_from      sender, e.g. "Land of Mana <noreply@example.com>"
//
// nodemailer is loaded with require() inside try/catch (same pattern as
// productionconfig.js) so a server whose node_modules predates it still starts
// -- e-mail just reports as unavailable until `npm install` is run.

/* global MainConfig */

import { createRequire } from 'module';

const require = createRequire(import.meta.url);

let nodemailer = null;
try {
    nodemailer = require('nodemailer');
} catch (err) {
    nodemailer = null;
}

let transport = null;
let transportKey = '';

const config = () =>
    typeof MainConfig !== 'undefined' && MainConfig ? MainConfig : {};

// True when e-mail can be sent: nodemailer installed and smtp_host/mail_from set.
export function mailConfigured() {
    const c = config();
    return !!(nodemailer && c.smtp_host && c.mail_from);
}

function getTransport() {
    const c = config();
    const key = [c.smtp_host, c.smtp_port, c.smtp_secure, c.smtp_user].join('|');
    if (!transport || key !== transportKey) {
        transport = nodemailer.createTransport({
            host: c.smtp_host,
            port: Number(c.smtp_port) || 587,
            secure: !!c.smtp_secure,
            auth: c.smtp_user
                ? { user: c.smtp_user, pass: c.smtp_password || '' }
                : undefined
        });
        transportKey = key;
    }
    return transport;
}

// Sends a plain-text e-mail. callback(ok) -- never throws.
export function sendMail(to, subject, text, callback) {
    if (!mailConfigured()) {
        if (!nodemailer)
            console.error('mailer: nodemailer is not installed (run npm install in userserver)');
        else console.error('mailer: smtp_host / mail_from not set in config.json');
        callback(false);
        return;
    }
    getTransport().sendMail(
        { from: config().mail_from, to, subject, text },
        (err) => {
            if (err) {
                console.error('mailer: send failed: ' + err.message);
                callback(false);
                return;
            }
            callback(true);
        }
    );
}

export default { mailConfigured, sendMail };
