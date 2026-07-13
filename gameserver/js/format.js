// ============================================================================
// MIGRATION NOTE: this file used to implement its own small positional-array
// "DSL" for describing message shapes (tags like 'n'/'s'/'ns'/'no'/'so'/
// 'array' packed into arrays like ['n',0,99]), plus a hand-rolled recursive
// checker (isTypeValid / _isTypeValid / checkFormatData / checkFormat) to
// walk it. That approach caused several real bugs that shipped silently
// because the DSL itself was never type-checked and its recursion rules were
// easy to get subtly wrong:
//   - `_.isNumber(Number(msg))` is true for ANY input (Number("abc") is NaN,
//     and NaN's typeof is still 'number'), so every 'n'/'ns'/'no'/'nso' field
//     accepted objects, arrays, and garbage strings no matter what.
//   - A nested array-of-tuples (e.g. CW_CONFIG's ["key", value] pairs,
//     CW_MOVEPATH's [x,y] waypoints) needed an extra, easy-to-forget
//     wrapping level to be read correctly; without it the checker misread
//     the tuple's own min/max numbers as message fields and failed (or,
//     combined with the bug above, silently passed) every real payload.
//   - `ignoreLength: true` was used almost everywhere, so fields past what a
//     format described were never checked at all.
//
// Rather than keep patching one-off bugs in a bespoke validator, this file
// now uses Zod (https://zod.dev) to describe every message shape. Each
// schema below is commented with the old DSL tag it replaces so this is
// reviewable line-by-line against the previous version. Zod handles the
// things the old DSL got wrong for free: real number/NaN checking,
// exact-length tuples, and clear per-field error paths from `safeParse`.
//
// REQUIRES: `npm install zod` in this project (gameserver). I don't have
// access to package.json from here to install it myself -- please run that
// before deploying this.
// ============================================================================

import { Types } from './common.js';
import { z } from 'zod';

const itemKindMax = 999;
const itemNumberMax = 100;
const itemDurabilityMax = 1000;
const itemExperienceMax = 9999999;
const itemPriceMax = 99999999;
const itemStoreMax = 96;
const itemInventoryMax = 50;
const itemBankMax = 96;
const itemEquipmentMax = 5;
const itemStoreTypeMax = 2;

const craftIdMax = 99;
const craftItemCount = 100;

const auctionEntriesMax = 9999;
const auctionActionMax = 3;

const achievementIndexMax = 99;
const achievementRankMax = 10;
const achievementCountMax = 999999;

const skillsXPMax = 999999999;
const mapsCountMax = 10;
const mapCoordsMax = 16384;
const mapIndexMax = 9;
const orientationsMax = 4;
const entityIdMax = 99999;
const mapStatusMax = 3;

// NOTE: the original code declared `questCountMax` twice (999, then 99).
// var's redeclare-and-overwrite behavior meant 99 was the value actually in
// effect at runtime, so that's the value kept here (const disallows the
// duplicate declaration outright).
const questCountMax = 99;
const questIdMax = 999999999999999;
const questTypeMax = 9;
const questNpcIdMax = 100;
const questStatusMax = 5;
const questStrDataLen = 32;

const questObjectTypeMax = 9;
const questObjectKindMax = 999;
const questObjectCountMax = 999;
const questObjectChanceMax = 2000;
const questObjectLevelMax = 999;

const entityTypeNPCMin = 5;
const entityTypeNPCMax = 6;

const shortcutIndexMax = 6;
const shortcutTypeMax = 2;
const shortcutTypeIdMax = 999;

const usernameLenMin = 2;
const usernameLenMax = 16;
const userHashLenMin = 120;
const userHashLenMax = 120;
const playerHashLenMax = 128;

const playerNameLenMin = 2;
const playerNameLenMax = 16;
const playerColorsMaxLen = 6;
const playerSpritesMax = 999;
const playerPVPStatsMax = 999999;
const playerXpMax = 999999999;
const playerSkillXpMax = 999999999;
const playerStatPointsMax = 1000;
const playerStatFreePointsMax = 6000;
const playerGoldMax = 999999999;
const playerGemMax = 99999;
const playerLooksTotal = 177;
const playerLooksTotalCost = 10000;
const playerStatMax = 5;
const playerSkillMax = 50;
const playerPartyMax = 6;
const playerShortcutsMax = 7;
const playerShortcutsType = 2;

const worldNameLenMin = 2;
const worldNameLenMax = 16;
const worldUsersCountMin = 2;
const worldUsersCountMax = 1000;
const userServerPasswordLenMin = 10;
const userServerPasswordLenMax = 128;
const maxWorldCount = 10;
const maxPlayersPerUser = 20;
const worldKeyLenMin = 2;
const worldKeyLenMax = 16;

const serverAddressLenMin = 7;
const serverAddressLenMax = 15;
const serverPortMin = 1024;
const serverPortMax = 65535;
const serverProtocolLenMin = 2;
const serverProtocolLenMax = 2;

const userBansTotal = 1000;
const banDateMin = 1730000000000;
const banDateMax = 1800000000000;

const serverDateMin = 1730000000000;
const serverDateMax = 1800000000000;

const maxChatLength = 256;

// ----------------------------------------------------------------------------
// Field builders. Each one is a direct replacement for an old DSL tag; the
// tag it replaces is noted alongside every use below so the mapping from the
// old format.js to this one is easy to check.
// ----------------------------------------------------------------------------

// 'n': a real number in [min,max]. z.number() rejects non-numbers (including
// NaN) outright -- unlike the old `_.isNumber(Number(msg))` check, which was
// always true no matter what was sent (see migration note above). This is
// the first time these fields are genuinely validated.
const numberField = (min, max) => z.number().min(min).max(max);

// 'no': same as 'n', but the value may legitimately be null (e.g. CW_PARTY's
// third field).
const optionalNumberField = (min, max) => z.union([z.null(), numberField(min, max)]);

// 's': a string with length in [min,max].
const stringField = (min, max) => z.string().min(min).max(max);

// 'so': same as 's', but may be null.
const optionalStringField = (min, max) => z.union([z.null(), stringField(min, max)]);

// 'ns'/'nso': accepts EITHER a real number (checked against [numMin,numMax])
// OR a string (checked against [strMin,strMax] length) -- e.g. a CW_CONFIG
// value that might be 1920 (a screen width) or "dark" (a theme name).
const numberOrStringField = (numMin, numMax, strMin, strMax) =>
  z.union([numberField(numMin, numMax), stringField(strMin, strMax)]);
const optionalNumberOrStringField = (numMin, numMax, strMin, strMax) =>
  z.union([z.null(), numberOrStringField(numMin, numMax, strMin, strMax)]);

// 'array' (homogeneous): every element of the array must match `element`,
// and the array itself must have between min and max items.
const arrayField = (element, min, max) => z.array(element).min(min).max(max);

// 'array' (fixed-shape tuple), e.g. a CW_CONFIG entry ["screenWidth", 1920]
// or a CW_MOVEPATH waypoint [x,y]. z.tuple() enforces the exact length
// itself -- there's no need to separately track a min/max count the way the
// old DSL had to, and no need for the "is fmt[3] one descriptor applied to
// every element, or several positional ones" guesswork that the old
// checkFormatData had to do (see the FIX comment that used to live there).
const tupleField = (schemas) => z.tuple(schemas);

class FormatChecker {
  constructor() {
    this.formats = {};

    this.formats[Types.Messages.BI_SYNCTIME] = tupleField([numberField(serverDateMin, serverDateMax)]);

    // USER LOGIN PACKETS
    this.formats[Types.Messages.CW_CREATE_USER] = tupleField([
      stringField(usernameLenMin, usernameLenMax),
      stringField(userHashLenMin, userHashLenMax),
    ]);
    this.formats[Types.Messages.CW_LOGIN_USER] = tupleField([
      stringField(usernameLenMin, usernameLenMax),
      stringField(userHashLenMin, userHashLenMax),
    ]);
    this.formats[Types.Messages.CW_REMOVE_USER] = tupleField([
      stringField(usernameLenMin, usernameLenMax),
      stringField(userHashLenMin, userHashLenMax),
    ]);
    this.formats[Types.Messages.CW_CREATE_PLAYER] = tupleField([
      numberField(0, maxPlayersPerUser),
      stringField(playerNameLenMin, playerNameLenMax),
    ]);
    this.formats[Types.Messages.CW_LOGIN_PLAYER] = tupleField([
      stringField(playerNameLenMin, playerNameLenMax),
      stringField(0, playerHashLenMax),
    ]);
    // END USER LOGIN PACKETS

    this.formats[Types.Messages.CW_APPEARANCEUNLOCK] = tupleField([
      numberField(0, playerLooksTotal),
      numberField(0, playerGemMax),
    ]);
    this.formats[Types.Messages.CW_ATTACK] = tupleField([
      numberField(serverDateMin, serverDateMax),
      numberField(0, entityIdMax),
      numberField(0, orientationsMax),
      numberField(-1, playerSkillMax),
    ]);
    this.formats[Types.Messages.CW_AUCTIONBUY] = tupleField([
      numberField(0, auctionEntriesMax),
      numberField(0, auctionActionMax),
    ]);
    this.formats[Types.Messages.CW_AUCTIONDELETE] = tupleField([
      numberField(0, auctionEntriesMax),
      numberField(0, auctionActionMax),
    ]);
    this.formats[Types.Messages.CW_AUCTIONOPEN] = tupleField([numberField(0, auctionActionMax)]);
    this.formats[Types.Messages.CW_AUCTIONSELL] = tupleField([
      numberField(0, itemInventoryMax),
      numberField(0, itemPriceMax),
    ]);
    this.formats[Types.Messages.CW_BANKRETRIEVE] = tupleField([numberField(0, itemBankMax)]);
    this.formats[Types.Messages.CW_BANKSTORE] = tupleField([numberField(0, itemInventoryMax)]);
    this.formats[Types.Messages.CW_CHAT] = tupleField([stringField(1, maxChatLength)]);
    this.formats[Types.Messages.CW_COLOR_TINT] = tupleField([
      numberField(0, 1),
      stringField(playerColorsMaxLen, playerColorsMaxLen),
    ]);
    this.formats[Types.Messages.CW_BLOCK_MODIFY] = tupleField([
      numberField(0, 1), // type pickup/place
      numberField(0, entityIdMax),
      numberField(0, mapCoordsMax),
      numberField(0, mapCoordsMax),
    ]);
    this.formats[Types.Messages.CW_LOOKUPDATE] = tupleField([
      numberField(0, 1), // type
      numberField(0, playerSpritesMax),
    ]);
    this.formats[Types.Messages.CW_LOOT] = tupleField([
      numberField(0, entityIdMax),
      numberField(0, mapCoordsMax),
      numberField(0, mapCoordsMax),
    ]);
    this.formats[Types.Messages.CW_MOVE] = tupleField([
      numberField(serverDateMin, serverDateMax),
      numberField(0, entityIdMax),
      numberField(0, 2), // move type
      numberField(0, orientationsMax),
      numberField(0, mapCoordsMax),
      numberField(0, mapCoordsMax),
    ]);
    this.formats[Types.Messages.CW_GOLD] = tupleField([
      numberField(0, 1), // type (inventory,bank)
      numberField(0, playerGoldMax),
      numberField(0, 1), // type2 (inventory,bank)
    ]);
    this.formats[Types.Messages.CW_STATADD] = tupleField([
      numberField(1, playerStatMax),
      numberField(1, 1), // stat point add
    ]);
    this.formats[Types.Messages.CW_STOREBUY] = tupleField([
      numberField(1, 3), // item type
      numberField(0, itemKindMax),
      numberField(0, itemNumberMax),
    ]);
    this.formats[Types.Messages.CW_CRAFT] = tupleField([
      numberField(0, craftIdMax),
      numberField(0, craftItemCount),
    ]);
    this.formats[Types.Messages.CW_STORE_MODITEM] = tupleField([
      numberField(0, 2), // modType
      numberField(0, 2), // type
      numberField(0, itemInventoryMax),
    ]);
    this.formats[Types.Messages.CW_STORESELL] = tupleField([
      numberField(0, itemStoreTypeMax),
      numberField(0, itemInventoryMax),
    ]);
    this.formats[Types.Messages.CW_TALKTONPC] = tupleField([
      numberField(entityTypeNPCMin, entityTypeNPCMax), // npc type but not used?
      numberField(0, entityIdMax),
    ]);
    this.formats[Types.Messages.CW_TELEPORT_MAP] = tupleField([
      numberField(0, mapStatusMax),
      numberField(0, 1),
      numberField(-1, mapCoordsMax),
      numberField(-1, mapCoordsMax),
      numberField(-1, mapIndexMax),
    ]);
    this.formats[Types.Messages.CW_SKILL] = tupleField([
      numberField(0, playerSkillMax),
      numberField(0, entityIdMax),
    ]);
    this.formats[Types.Messages.CW_SHORTCUT] = tupleField([
      numberField(0, playerShortcutsMax),
      numberField(0, playerShortcutsType),
      numberField(0, itemKindMax),
    ]);
    this.formats[Types.Messages.CW_PARTY] = tupleField([
      numberField(0, 4),
      optionalStringField(0, playerPartyMax),
      optionalNumberField(0, 3),
    ]);
    this.formats[Types.Messages.CW_HARVEST] = tupleField([
      numberField(0, mapCoordsMax),
      numberField(0, mapCoordsMax),
    ]);
    this.formats[Types.Messages.CW_USE_NODE] = tupleField([numberField(0, entityIdMax)]);
    this.formats[Types.Messages.CW_QUEST] = tupleField([
      numberField(0, entityIdMax),
      numberField(0, questIdMax),
      numberField(0, questTypeMax),
    ]);
    this.formats[Types.Messages.CW_MOVEPATH] = tupleField([
      numberField(serverDateMin, serverDateMax),
      numberField(0, entityIdMax),
      numberField(0, orientationsMax),
      numberField(0, 1),
      // Each waypoint is an [x,y] tuple; the path itself has 2-16 waypoints.
      arrayField(tupleField([numberField(0, mapCoordsMax), numberField(0, mapCoordsMax)]), 2, 16),
    ]);
    this.formats[Types.Messages.CW_WHO] = tupleField([arrayField(numberField(0, entityIdMax), 0, 999)]);
    this.formats[Types.Messages.CW_CONFIG] = tupleField([
      // Each entry is a ["key", value] pair, where value can be a number or
      // a string; 0-10 entries per message.
      //
      // FIX: the old DSL entry used ['ns',0,99,0,99] here -- a numeric range
      // of 0-99 for the VALUE, which is almost certainly a copy-paste of the
      // adjacent string-length bound rather than an intentional limit. That
      // range check was dead code in the old checker (see migration note),
      // so it never actually rejected anything -- but camera.js's real
      // sendConfig() call sends screenWidth/screenHeight values like 1920
      // and 1080, both well over 99. Now that the numeric range genuinely
      // gets enforced, it needs a bound that fits real config values; using
      // mapCoordsMax (16384) here since these are still screen/pixel-scale
      // numbers, well short of anything that indicates abuse.
      arrayField(tupleField([stringField(0, 99), numberOrStringField(0, mapCoordsMax, 0, 99)]), 0, 10),
    ]);

    // CW_ITEMSLOT is handled specially in check() below (see the comment
    // there) because its shape varies: 4 fields normally, 6 when the client
    // is also specifying a second (destination) slot for a swap.

    // NOTE - The following need no parameters so they are grouped into 1 packet type.
    // CW_APPEARANCELIST
    // CW_PLAYER_REVIVE
    // CW_PLAYERINFO
    // CW_WHO REQUEST
    this.formats[Types.Messages.CW_REQUEST] = tupleField([numberField(0, 3)]);
  }

  check(msg) {
    // Never mutate the caller's array -- packethandler.js/worldhandler.js
    // both still need the untouched `message` (including its leading type)
    // after this returns, so they can shift the type off themselves once
    // validation passes.
    const message = msg.slice(0);
    const type = message.shift();

    if (type === Types.Messages.CW_ITEMSLOT) {
      // slot: [action, slotType, slotIndex, slotCount], optionally followed
      // by a destination slot [slotType2, slotIndex2] when swapping between
      // two stores (see handleItemSlot in packethandler.js, which is the
      // authority on this shape and does its own per-store-type bounds
      // checking against the real inventory/equipment/bank sizes).
      //
      // FIX: the old code guarded the 6-field variant with
      // `message.len === 7` -- `.len` isn't a real Array property (it's
      // always undefined), and even ignoring that typo, handleItemSlot
      // checks `msg.length === 6`, not 7. So the extra 2 fields were never
      // actually validated; this checks the real, both-cases-correct shape.
      // It also replaces `this.inventoryMax`/`this.itemCountMax`, which were
      // never assigned anywhere on this class (always undefined) -- the
      // closest real constants are itemBankMax (the largest of the three
      // item stores, used here as a generous shared upper bound since the
      // handler re-validates the exact per-store-type size itself) and
      // itemNumberMax (the stack/magic-number bound used for item counts
      // elsewhere in this file).
      const baseSlot = [
        numberField(0, 2), // action: 0 eat, 1 swap, 2 drop
        numberField(0, 2), // slot type: 0 inventory, 1 equipment, 2 bank
        numberField(0, itemBankMax), // slot index
        numberField(0, itemNumberMax), // slot count
      ];
      const schema = z.union([
        tupleField(baseSlot),
        tupleField([
          ...baseSlot,
          numberField(0, 2), // destination slot type
          numberField(-1, itemBankMax), // destination slot index (-1 = unspecified)
        ]),
      ]);
      return schema.safeParse(message).success;
    }

    const format = this.formats[type];
    if (format) {
      return format.safeParse(message).success;
    }

    try {
      throw new Error();
    } catch (err) {
      console.info(err.stack);
    }
    console.error('Unknown message type: ' + type);
    console.warn('msg=' + JSON.stringify(msg));
    return false;
  }
}

const checker = new FormatChecker();

export const check = checker.check.bind(checker);
