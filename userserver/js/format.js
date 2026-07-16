// ============================================================================
// MIGRATION NOTE: this file used to implement its own small positional-array
// "DSL" for describing message shapes (tags like 'n'/'s'/'no'/'so'/'array'/
// 'object' packed into arrays like ['n',0,99]), plus a hand-rolled recursive
// checker (isTypeValid / _isTypeValid / checkFormat / checkFormatData) to
// walk it -- the same approach gameserver/js/format.js used to use, and this
// file is converted the same way and for the same reasons (see that file's
// migration note for the full rationale). The bugs that motivated this were:
//   - `_.isNumber(Number(msg))` is true for ANY input (Number("abc") is NaN,
//     and NaN's typeof is still 'number'), so every 'n'/'no' field accepted
//     objects, arrays, and garbage strings no matter what.
//   - A nested object-of-records (completeQuests: { "<questId>": {npcid} },
//     shortcuts: { "<index>": [n,n,n] }) needed the checker to recurse
//     correctly through 'object' -> per-value shape, which it never did
//     right -- this is the root of the reported "complete quests format
//     failed" bug. (A first Zod pass fixed that recursion but still
//     mis-modeled completeQuests' value as an [npcId,questId] tuple instead
//     of the real {npcid} object -- see the FIX note at that schema.)
//   - `ignoreLength: true` was used almost everywhere, so fields past what a
//     format described were never checked (the 19-field quest record case
//     below only ever validated 13 of its fields).
//   - Several `this.xxx` constants referenced in the old WU_SAVE_PLAYER_DATA
//     branch (this.playerNameMin/Max, this.usernameMin/Max) were never
//     assigned anywhere on the class, so those checks ran against
//     `undefined` bounds.
//
// This file now uses Zod (https://zod.dev) to describe every message shape,
// with the same field-builder helpers as gameserver/js/format.js
// (numberField, stringField, etc.) so the two files read the same way, plus
// a few userserver-specific helpers (recordField, parseCsvFields,
// parseCsvChunks) for the CSV-string and dynamic-key-object shapes that only
// show up in player-save data.
//
// REQUIRES: `npm install zod` in this project (userserver). I don't have
// access to package.json from here to install it myself -- please run that
// before deploying this.
// ============================================================================

import { z } from 'zod';
// FIX: this file uses `Types.UserMessages.*` throughout (the constructor
// below, plus the WU_SAVE_PLAYER_DATA/WU_SAVE_PLAYER_AUCTIONS/
// WU_SAVE_USER_BANS special cases in check()) but never imported `Types` --
// unlike gameserver/js/format.js, which does `import { Types } from
// './common.js'`. It only worked by accident: userserver/js/main.js's very
// first import is `./common.js`, which does `global.Types = Types` as a
// side effect, and since this module's own `const checker = new
// FormatChecker()` (bottom of this file) runs at import time, it happened
// to always execute after that global was already set, given main.js's
// current import order (common.js, then user.js/worldhandler.js, which
// import this file). Reorder those imports, or load this file from any
// entry point that doesn't happen to pull in common.js first (a test file,
// a script, a future refactor), and every `Types.UserMessages.X` reference
// throws `ReferenceError: Types is not defined` before the module finishes
// loading. Importing it directly here removes that hidden load-order
// dependency, matching the gameserver file's pattern.
import { Types } from './common.js';

const itemKindMax = 2000;
const itemNumberMax = 100;
const itemDurabilityMax = 1000;
const itemExperienceMax = 9999999;
const itemPriceMax = 99999999;

const auctionEntriesMax = 9999;

const achievementIndexMax = 99;
const achievementRankMax = 10;
const achievementCountMax = 999999;

const skillsXPMax = 999999999;
const mapsCountMax = 10;
const mapCoordsMax = 16384;
const orientationsMax = 4;

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

const shortcutIndexMax = 8;
const shortcutTypeMax = 2;
const shortcutTypeIdMax = 999;

const usernameLenMin = 2;
const usernameLenMax = 16;
const userHashLenMin = 120;
const userHashLenMax = 120;

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
const serverAddressLenMax = 99;
const serverPortMin = 1024;
const serverPortMax = 65535;
const serverProtocolLenMin = 2;
const serverProtocolLenMax = 5;

const playerLooksTotal = 177;
const playerLooksTotalCost = 10000;

const userBansTotal = 1000;
const banDateMin = 1730000000000;
const banDateMax = 3000000000000;

const getItemSlots = function (type) {
  if (type==0) return 50;
  if (type==1) return 96;
  if (type==2) return 5;
  return 0;
};

// ----------------------------------------------------------------------------
// Field builders. Same names/semantics as gameserver/js/format.js so both
// files read the same way; the old DSL tag each one replaces is noted
// alongside every use below.
// ----------------------------------------------------------------------------

// 'n': a real number in [min,max]. z.number() rejects non-numbers (including
// NaN) outright -- unlike the old `_.isNumber(Number(msg))` check, which was
// always true no matter what was sent (see migration note above).
const numberField = (min, max) => z.number().min(min).max(max);

// 'no': same as 'n', but the value may legitimately be null (e.g. a quest's
// npcQuestId when the quest has no associated NPC).
const optionalNumberField = (min, max) => z.union([z.null(), numberField(min, max)]);

// 's': a string with length in [min,max].
const stringField = (min, max) => z.string().min(min).max(max);

// 'so': same as 's', but may be null.
const optionalStringField = (min, max) => z.union([z.null(), stringField(min, max)]);

// A handful of player-save fields arrive as a comma-separated string of
// numbers rather than real JSON numbers (see parseCsvFields below), so
// unlike numberField() this one legitimately needs to coerce a string like
// "1500" into 1500 before range-checking it. z.coerce.number() still rejects
// non-numeric strings ("abc" fails), so this doesn't reintroduce the old
// isNumber(Number(x)) bug.
const csvNumberField = (min, max) => z.coerce.number().min(min).max(max);

// 'array' (homogeneous): every element of the array must match `element`,
// and the array itself must have between min and max items.
const arrayField = (element, min, max) => z.array(element).min(min).max(max);

// 'array' (fixed-shape tuple), e.g. a completeQuests pair [npcId, questId]
// or an item record [slot, kind, count, durability, durabilityMax,
// experience]. z.tuple() enforces the exact length itself.
const tupleField = (schemas) => z.tuple(schemas);

// Turns a failed safeParse()'s ZodError into a readable "which field, and
// why" string, e.g. "0.npcid: Number must be less than or equal to 100" for
// a bad completeQuests entry. `issue.path` is the exact location within the
// value (array indices / object keys) that failed -- without this, a format
// failure just logs a bare `false` and you're left guessing which field of
// the message was actually bad.
const describeZodError = (error) =>
  error.issues
    .map((issue) => `${issue.path.length ? issue.path.join('.') : '(root)'}: ${issue.message}`)
    .join('; ');

// 'object' with dynamic keys all mapping to the same shaped value (e.g.
// shortcuts keyed by slot index, or completeQuests keyed by quest slot).
// This is the shape the old DSL's 'object' handling never correctly
// validated -- that's the root of the reported "complete quests format
// failed" bug. z.record() + a key-count refinement replaces it directly.
const recordField = (valueSchema, maxKeys) =>
  z.record(z.string(), valueSchema).refine(
    (obj) => Object.keys(obj).length <= maxKeys,
    (obj) => ({ message: `too many keys: ${Object.keys(obj).length} > ${maxKeys}` })
  );

// Splits a CSV string into exactly `schemas.length` fields and validates
// each one positionally. Returns { success, data|error }. This replaces
// checkFormatCSV, keeping its "wrong field count fails immediately" check
// (the one part of the old code that already enforced length correctly).
const parseCsvFields = (csv, schemas) => {
  if (typeof csv !== 'string') {
    return { success: false, error: 'not a string' };
  }
  const parts = csv.split(',');
  if (parts.length !== schemas.length) {
    return { success: false, error: `expected ${schemas.length} fields, got ${parts.length}` };
  }
  const data = [];
  for (let i = 0; i < schemas.length; i += 1) {
    const res = schemas[i].safeParse(parts[i]);
    if (!res.success) {
      return { success: false, error: `field ${i}: ${res.error.issues.map((iss) => iss.message).join('; ')}` };
    }
    data.push(res.data);
  }
  return { success: true, data };
};

// Splits a comma-separated list into chunks of `size` and validates each
// chunk against `tupleSchema`. Used for the achievements CSV field, which is
// a flat, repeating list of (index, rank, count) triples.
//
// FIX: the old code only ever validated the *first* triple -- its array
// format's inner descriptor list had 3 entries, which the checker's
// homogeneous-vs-tuple-shaped nesting rules mishandled, so the checker
// effectively treated the whole flat array as one 3-field record instead of
// a repeating sequence of them, and every triple after the first went
// unchecked. This validates every chunk.
const parseCsvChunks = (csv, size, tupleSchema) => {
  if (typeof csv !== 'string') {
    return { success: false, error: 'not a string' };
  }
  const parts = csv.split(',');
  if (parts.length % size !== 0) {
    return { success: false, error: `length ${parts.length} not a multiple of ${size}` };
  }
  const chunks = [];
  for (let i = 0; i < parts.length; i += size) {
    const chunk = parts.slice(i, i + size).map(Number);
    const res = tupleSchema.safeParse(chunk);
    if (!res.success) {
      return { success: false, error: `chunk ${i / size}: ${res.error.issues.map((iss) => iss.message).join('; ')}` };
    }
    chunks.push(res.data);
  }
  return { success: true, data: chunks };
};

class FormatChecker {
  constructor() {
    this.formats = {};

    this.formats[Types.UserMessages.CU_CREATE_USER] = tupleField([
      stringField(usernameLenMin, usernameLenMax),
      stringField(userHashLenMin, userHashLenMax),
    ]);
    this.formats[Types.UserMessages.CU_LOGIN_USER] = tupleField([
      stringField(usernameLenMin, usernameLenMax),
      stringField(userHashLenMin, userHashLenMax),
    ]);
    this.formats[Types.UserMessages.CU_LOGIN_PLAYER] = tupleField([
      numberField(0, maxWorldCount),
      numberField(0, maxPlayersPerUser),
    ]);
    this.formats[Types.UserMessages.CU_CREATE_PLAYER] = tupleField([
      numberField(0, maxWorldCount),
      stringField(playerNameLenMin, playerNameLenMax),
    ]);
    // FIX (pre-existing, kept): CU_REMOVE_USER had no entry here at all.
    // check()'s final `else` branch rejects and closes the connection for
    // any message type not present in `this.formats`, and user.js's
    // listener runs check() on every inbound message before dispatch -- so
    // every CU_REMOVE_USER packet failed validation and account deletion
    // never worked. Client sends [CU_REMOVE_USER, username, hash] (see
    // client/js/userclient.js sendRemoveUser), same shape as CU_LOGIN_USER.
    this.formats[Types.UserMessages.CU_REMOVE_USER] = tupleField([
      stringField(usernameLenMin, usernameLenMax),
      stringField(userHashLenMin, userHashLenMax),
    ]);

    this.formats[Types.UserMessages.WU_GAMESERVER_INFO] = tupleField([
      stringField(worldNameLenMin, worldNameLenMax),
      numberField(0, worldUsersCountMax),
      numberField(worldUsersCountMin, worldUsersCountMax),
      // FIX: this was `['s',serverAddressLenMin,serverAddressLenMin]` --
      // both bounds were the min, so any address longer than
      // serverAddressLenMin (7) chars (e.g. "192.168.1.100") would fail the
      // *intended* range check. That range check was dead code in the old
      // DSL (see migration note), so this typo never fired in practice --
      // but now that real range checks run, it needs to be the max,
      // matching WU_PLAYER_LOADED's identical field below.
      stringField(serverAddressLenMin, serverAddressLenMax),
      numberField(serverPortMin, serverPortMax),
      stringField(userServerPasswordLenMin, userServerPasswordLenMax),
      stringField(worldKeyLenMin, worldKeyLenMax),
    ]);
    this.formats[Types.UserMessages.WU_UPDATE_PLAYER_COUNT] = tupleField([
      numberField(0, worldUsersCountMax),
      numberField(1, worldUsersCountMax),
    ]);

    this.formats[Types.UserMessages.WU_PLAYER_LOGGED_IN] = tupleField([
      numberField(0, 1),
      stringField(usernameLenMin, usernameLenMax),
      stringField(playerNameLenMin, playerNameLenMax),
    ]);
    this.formats[Types.UserMessages.WU_SAVE_PLAYERS_LIST] = tupleField([
      arrayField(stringField(playerNameLenMin, playerNameLenMax), 0, worldUsersCountMax),
    ]);
    // FIX: added the leading playerName field to match the gameserver now
    // sending it (gameserver/js/user/userhandler.js's handleLoadPlayerData)
    // so worldhandler.js's handlePlayerLoaded can correlate this response
    // to the right pending login instead of guessing via shared state.
    this.formats[Types.UserMessages.WU_PLAYER_LOADED] = tupleField([
      stringField(playerNameLenMin, playerNameLenMax),
      stringField(serverProtocolLenMin, serverProtocolLenMax),
      stringField(serverAddressLenMin, serverAddressLenMax),
      numberField(serverPortMin, serverPortMax),
    ]);
    // WU_SAVE_PLAYER_LOOKS's *message* format isn't used through the normal
    // this.formats[type] dispatch -- check() special-cases this type below
    // because the payload arrives as a CSV string that has to be split
    // before it can be validated. Kept here only so `this.formats[type]`
    // resolves to something, matching what check() expects.
    this.formats[Types.UserMessages.WU_SAVE_PLAYER_LOOKS] = arrayField(
      csvNumberField(0, playerLooksTotalCost),
      0,
      playerLooksTotal
    );
    // WU_SAVE_USER_BANS's *message* format isn't used through the normal
    // this.formats[type] dispatch -- check() special-cases this type below
    // (same reason/pattern as WU_SAVE_PLAYER_AUCTIONS) because each entry
    // arrives as a CSV string, not a [username, banTime] tuple. See the FIX
    // note at that special case for the traced proof.
    this.formats[Types.UserMessages.WU_ADD_PLAYER_GOLD] = tupleField([
      stringField(playerNameLenMin, playerNameLenMax),
      numberField(0, playerGoldMax),
    ]);
  }

  // Replaces checkPlayerItems: parses a JSON-string list of inventory/bank/
  // equipment items and validates it as an array of fixed-shape item
  // tuples.
  //
  // FIX: the old format here (['array',0,slots,[6 number descriptors]]) had
  // the same missing-nesting-level bug as completeQuests below -- the
  // 6-descriptor list described one item's shape, but needed its own
  // single-element wrapping list to be read as "apply to every element"
  // rather than as 6 positional message fields. Expressed correctly from
  // scratch here as an array of 6-tuples.
  checkPlayerItems(msg, type) {
    let arr = null;
    try {
      if (typeof msg !== 'string') {
        console.info('fnItems: items data not a string.');
        return false;
      }
      arr = JSON.parse(msg);
    } catch (err) {
      console.info('fnItems: items data JSON parse failed.');
      return false;
    }

    if (!arr) {
      console.info('fnItems: items data no data.');
    }

    const slots = getItemSlots(type);
    const itemTuple = tupleField([
      numberField(0, slots), // slot index
      numberField(0, itemKindMax), // kind
      numberField(0, itemNumberMax), // stack number / magic number
      numberField(0, itemDurabilityMax),
      numberField(0, itemDurabilityMax),
      numberField(0, itemExperienceMax),
    ]);
    const schema = arrayField(itemTuple, 0, slots);
    const res = schema.safeParse(arr);
    if (!res.success) {
      console.info('fnItems: item array not correct format.');
      console.info(describeZodError(res.error));
      console.info(JSON.stringify(arr));
      return false;
    }
    return true;
  }

  check(msg) {
    const message = msg.slice(0);
    const type = message.shift();

    if (type === Types.UserMessages.WU_SAVE_PLAYER_DATA) {
      console.info('WU_SAVE_PLAYER_DATA');

      let res, data, obj, arr;

      // message[0]: optional player name.
      // FIX: this used to read `this.playerNameMin`/`this.playerNameMax`,
      // which are never set anywhere on the class (always undefined). The
      // old range check was dead code anyway (see migration note) so this
      // never bit in practice, but the real constants are
      // playerNameLenMin/playerNameLenMax -- same ones CU_CREATE_PLAYER
      // uses above.
      if (message[0]) {
        res = stringField(playerNameLenMin, playerNameLenMax).safeParse(message[0]);
        if (!res.success) {
          console.info('message 0 (player name) failed: ' + describeZodError(res.error));
          return false;
        }
      }

      if (!Array.isArray(message[1])) {
        console.info('message 1 not an array.');
        return false;
      }
      if (message[1].length !== 7) {
        console.info('message 1 not length 7.');
        return false;
      }

      // message[1][0]: optional [username, sessionHash, n, s] record.
      // FIX: same `this.usernameMin`/`this.usernameMax` undefined-constant
      // issue as above -- use the real usernameLenMin/usernameLenMax.
      msg = message[1][0];
      if (msg) {
        const fmt = tupleField([
          stringField(usernameLenMin, usernameLenMax),
          optionalStringField(120, 120),
          numberField(0, 99999),
          stringField(0, 45),
        ]);
        res = fmt.safeParse(msg);
        if (!res.success) {
          console.info('message arr1-0 (username/hash record) failed: ' + describeZodError(res.error));
          return false;
        }
      }

      // message[1][1]: the main player-data record, exactly 12 fields.
      msg = message[1][1];
      if (!Array.isArray(msg)) {
        console.info('message 1-1 not an array.');
        return false;
      }
      if (msg.length !== 12) {
        console.info('message 1-1 not length 12.');
        return false;
      }

      // msg[0]: NOTE -- the original code never validated this field either
      // (it jumps straight to msg[1] below). Left unvalidated here too
      // rather than guessing at a constraint that might reject legitimate
      // existing saves; worth following up on to find out what this field
      // actually is and give it a real schema.

      // map data
      res = parseCsvFields(msg[1], [
        csvNumberField(0, mapsCountMax),
        csvNumberField(0, mapCoordsMax),
        csvNumberField(0, mapCoordsMax),
        csvNumberField(0, orientationsMax),
      ]);
      if (!res.success) {
        console.info('map data failed: ' + res.error);
        return false;
      }

      // stats data
      res = parseCsvFields(msg[2], [
        csvNumberField(0, playerStatPointsMax),
        csvNumberField(0, playerStatPointsMax),
        csvNumberField(0, playerStatPointsMax),
        csvNumberField(0, playerStatPointsMax),
        csvNumberField(0, playerStatPointsMax),
        csvNumberField(0, playerStatFreePointsMax),
      ]);
      if (!res.success) {
        console.info('stats data failed: ' + res.error);
        return false;
      }

      // exps data
      res = parseCsvFields(
        msg[3],
        Array.from({ length: 10 }, () => csvNumberField(0, playerXpMax))
      );
      if (!res.success) {
        console.info('exps data failed: ' + res.error);
        return false;
      }

      // gold data: two real number fields now (msg[4]=gold_0, msg[5]=gold_1)
      // -- not a CSV string, and not a nested [gold0, gold1] array either.
      // worldhandler.js (gameserver) sends player.items.gold[0]/[1] as two
      // separate top-level elements, matching the flat shape every other
      // field in this record already uses, and matching redis.js's raw
      // gold_0/gold_1 storage fields 1:1 -- see the REFACTOR comment on
      // AccountLogic.loadPlayerInfo()/savePlayerInfo() (accountlogic.js) for
      // the full trail.
      res = numberField(0, playerGoldMax).safeParse(msg[4]);
      if (!res.success) {
        console.info('gold_0 data failed: ' + describeZodError(res.error));
        return false;
      }
      res = numberField(0, playerGoldMax).safeParse(msg[5]);
      if (!res.success) {
        console.info('gold_1 data failed: ' + describeZodError(res.error));
        return false;
      }

      // skills xp data: CSV of per-skill XP values. worldhandler.js's
      // loadPlayerDataInfo builds this with
      // `for (i < player.skills.length) skillexps[i] = player.skills[i].skillXP`,
      // and player.skills.length mirrors SkillData.Skills.length (see
      // player.js: `for (i < SkillData.Skills.length) db_player.skills[i] = 0`
      // and skillhandler.js's setSkills) -- a count loaded at runtime from
      // data/shared/data/skills2.json, not a fixed constant. That data file
      // isn't reachable from this sandbox, so its exact length can't be
      // confirmed, but playerSkillMax=50 (the bound already used for skill
      // IDs in gameserver/js/format.js's CW_SKILL/CW_ATTACK) strongly implies
      // the roster isn't just 7. Hardcoding "exactly 7 fields" here
      // (Array.from({length:7}...)) would reject every real save the moment
      // the roster size differs from 7, so this validates every CSV field
      // against the XP bound without asserting a fixed count.
      if (typeof msg[6] !== 'string') {
        console.info('skills xp data not a string.');
        return false;
      }
      {
        const skillXpField = csvNumberField(0, playerSkillXpMax);
        const skillParts = msg[6].split(',');
        const bad = skillParts.find((part) => !skillXpField.safeParse(part).success);
        if (bad !== undefined) {
          console.info('skills xp data failed.');
          return false;
        }
      }

      // pvp stats data
      res = parseCsvFields(msg[7], [csvNumberField(0, playerPVPStatsMax), csvNumberField(0, playerPVPStatsMax)]);
      if (!res.success) {
        console.info('pvp stats data failed: ' + res.error);
        return false;
      }

      // sprites data
      res = parseCsvFields(
        msg[8],
        Array.from({ length: 4 }, () => csvNumberField(0, playerSpritesMax))
      );
      if (!res.success) {
        console.info('sprites data failed: ' + res.error);
        return false;
      }

      // colors data (mixed string + CSV number)
      res = parseCsvFields(msg[9], [stringField(0, playerColorsMaxLen), csvNumberField(0, playerColorsMaxLen)]);
      if (!res.success) {
        console.info('colors data failed: ' + res.error);
        return false;
      }

      // shortcuts data: JSON object keyed by shortcut index.
      data = msg[10];
      if (typeof data !== 'string') {
        console.info('shortcuts data not a string.');
        return false;
      }
      try {
        obj = JSON.parse(data);
      } catch {
        console.info('shortcuts data, json parse invalid.');
        return false;
      }
      if (typeof obj !== 'object' || obj === null) {
        console.info('shortcuts data, data not object.');
        return false;
      }
      {
        const shortcutSchema = recordField(
          tupleField([
            numberField(0, shortcutIndexMax),
            numberField(0, shortcutTypeMax),
            numberField(0, shortcutTypeIdMax),
          ]),
          shortcutIndexMax
        );
        res = shortcutSchema.safeParse(obj);
        if (!res.success) {
          console.info('shortcuts data, shortcut format failed.');
          console.info(describeZodError(res.error));
          console.info(JSON.stringify(obj));
          return false;
        }
      }

      // completeQuests data: JSON object keyed by quest id (the key IS the
      // quest id -- see PlayerQuests.completeQuest() in
      // gameserver/entity/components/playerquests.js:
      //   this.completeQuests[quest.id] = {"npcid": quest.npcQuestId};
      // and worldhandler.js's savePlayerData(), which sends
      // JSON.stringify(player.quests.completeQuests) as this field. So each
      // value is a single-property OBJECT `{npcid}`, not a [npcId, questId]
      // array pair.
      //
      // THIS IS THE REPORTED BUG, TWICE OVER. The old DSL's fmt guessed at
      // an ['array',2,2,[...]] pair shape here and never validated it
      // correctly regardless (its 'object' recursion was broken). My first
      // Zod pass fixed the recursion but kept that same wrong tuple-pair
      // guess, so it still failed against the real `{npcid}` object shape.
      // z.record() of z.object({npcid}) below matches what's actually sent.
      // Note quest.npcQuestId can be `undefined` (quests with no associated
      // NPC), and JSON.stringify() drops undefined object properties
      // entirely, so a value can legitimately be `{}` with no npcid key at
      // all -- npcid must be optional, not just nullable.
      data = msg[11];
      if (typeof data !== 'string') {
        console.info('complete quests data not a string.');
        return false;
      }
      try {
        arr = JSON.parse(data);
      } catch {
        console.info('complete quests JSON parse error :' + JSON.stringify(data));
        return false;
      }
      if (typeof arr !== 'object' || arr === null) {
        console.info('complete quests is not an object.');
        return false;
      }
      {
        const completeQuestsSchema = recordField(
          z.object({ npcid: numberField(0, questNpcIdMax).nullable().optional() }),
          questCountMax
        );
        res = completeQuestsSchema.safeParse(arr);
        if (!res.success) {
          console.info('complete quests format failed.');
          console.info(describeZodError(res.error));
          console.info(JSON.stringify(arr));
          return false;
        }
      }

      // quests data: array of up to 99 quest records. Each record is a CSV
      // STRING (not a raw array!) with 7 base fields, optionally followed by
      // one or two 6-field "reward object" blocks (13 or 19 fields total).
      //
      // FIX (real bug -- traced end to end, see chat): I originally modeled
      // each `rec` as a plain [id,type,...] array of numbers, matching the
      // old DSL's descriptor. That descriptor was wrong on two counts:
      //   1. gameserver's worldhandler.js builds this array with
      //      `quests.push(quest.toArray().join(','))` -- every record is a
      //      CSV string, exactly like the map/stats/exps/etc. fields above.
      //      userserver's own worldhandler.js persists it as-is via
      //      `DBH.saveQuests(playerName, JSON.stringify(data[2]), ...)`, and
      //      gameserver's userhandler.js reads it back with
      //      `dataJSON[i].split(',')` before reconstructing a Quest -- so
      //      "array of CSV strings" is the real, DB-persisted, load-bearing
      //      format across three separate places, not a mistake to "fix" on
      //      the sending side.
      //   2. data1/data2 are declared numeric in Quest.toArray()
      //      (`parseInt(this.data1, 10)`), and playerquests.js accumulates
      //      XP into `quest.data1` as a number -- they were never strings.
      // Also keeps the old code's 13-vs-19-field fix (two distinct field
      // sets so both reward blocks actually get validated).
      arr = message[1][2];
      if (!Array.isArray(arr)) {
        console.info('quests is not an array.');
        return false;
      }
      if (arr.length > 99) {
        console.info('quests is over 99.');
        return false;
      }

      const questBaseFields = () => [
        csvNumberField(0, questIdMax), // id
        csvNumberField(0, questTypeMax), // type
        csvNumberField(0, questNpcIdMax), // npcQuestId
        csvNumberField(0, questCountMax), // count
        csvNumberField(0, questStatusMax), // status
        // data1/data2: numeric quest progress data (e.g. playerquests.js
        // accumulates mob-kill XP into quest.data1), not the string the old
        // DSL assumed. There's no dedicated "max accumulated quest XP"
        // constant in this codebase; playerXpMax (a player's total XP cap)
        // is a generously large, self-documenting upper bound for a
        // per-quest XP accumulator that must stay well under it.
        csvNumberField(0, playerXpMax), // data1
        csvNumberField(0, playerXpMax), // data2
      ];
      const questRewardFields = () => [
        csvNumberField(0, questObjectTypeMax), // object type
        csvNumberField(0, questObjectKindMax), // object kind
        csvNumberField(0, questObjectCountMax), // object count
        csvNumberField(0, questObjectChanceMax), // object chance
        csvNumberField(0, questObjectLevelMax), // object level min
        csvNumberField(0, questObjectLevelMax), // object level max
      ];

      for (const rec of arr) {
        if (typeof rec !== 'string') {
          console.info('quests format failed: record is not a string.');
          console.info(JSON.stringify(rec));
          return false;
        }
        const fieldCount = rec.split(',').length;
        const schemaFields =
          fieldCount === 13
            ? [...questBaseFields(), ...questRewardFields()]
            : fieldCount === 19
            ? [...questBaseFields(), ...questRewardFields(), ...questRewardFields()]
            : questBaseFields();
        res = parseCsvFields(rec, schemaFields);
        if (!res.success) {
          console.info('quests format failed.');
          console.info(res.error);
          console.info(JSON.stringify(rec));
          return false;
        }
      }

      // achievements data: CSV string, flat list of (index, rank, count)
      // triples. See parseCsvChunks' comment for the "only checked the
      // first triple" bug this fixes.
      data = message[1][3];
      if (data) {
        if (typeof data !== 'string') {
          console.info('message arr1-3 is not a string.');
          return false;
        }
        const achievementTuple = tupleField([
          numberField(0, achievementIndexMax),
          numberField(0, achievementRankMax),
          numberField(0, achievementCountMax),
        ]);
        res = parseCsvChunks(data, 3, achievementTuple);
        if (!res.success) {
          console.info('message arr1-3 checkFormat failed: ' + res.error);
          return false;
        }
        if (res.data.length > achievementIndexMax) {
          console.info('message arr1-3 too many achievements.');
          return false;
        }
      }

      // inventory / bank / equipment data
      data = message[1][4];
      if (data && !this.checkPlayerItems(data, 0)) {
        console.info('inventory data msg1-4 format failed. ' + JSON.stringify(data));
        return false;
      }
      data = message[1][5];
      if (data && !this.checkPlayerItems(data, 1)) {
        console.info('bank data msg1-5 format failed. ' + JSON.stringify(data));
        return false;
      }
      data = message[1][6];
      if (data && !this.checkPlayerItems(data, 2)) {
        console.info('equipment data msg1-6 format failed. ' + JSON.stringify(data));
        return false;
      }

      data = parseInt(message[2]);
      if (!(data === 0 || data === 1)) {
        console.info('update not 0 or 1.');
        return false;
      }

      return true;
    }

    if (type === Types.UserMessages.WU_SAVE_PLAYER_AUCTIONS) {
      console.info('WU_SAVE_PLAYER_AUCTIONS');
      // FIX (real bug -- confirmed against gametypes.js: 504 ==
      // WU_SAVE_PLAYER_AUCTIONS): this modeled each entry as a raw
      // [playerName, price, ...] tuple, matching the old DSL's guess. But
      // AuctionRecord.save() (gameserver/world/auction.js) returns
      // `[playerName,price].join(',') + ',' + item.toArrayNoSlot().join(',')`
      // -- a single comma-joined STRING per auction -- and Auction.load()
      // reads it back with `rec.split(",")` before reconstructing an
      // AuctionRecord. So `message` is an array of CSV strings, exactly
      // like the quests array (see that fix's comment for the full
      // save/persist/load trail); it's not a raw-tuple array.
      if (!Array.isArray(message)) {
        console.error('WU_SAVE_PLAYER_AUCTIONS: message is not an array.');
        return false;
      }
      if (message.length > auctionEntriesMax) {
        console.error('WU_SAVE_PLAYER_AUCTIONS: too many entries.');
        return false;
      }
      const auctionFields = [
        stringField(0, playerNameLenMax), // playerName
        csvNumberField(0, itemPriceMax), // sell price
        csvNumberField(0, itemKindMax), // item kind
        csvNumberField(0, itemNumberMax), // count/magic number
        csvNumberField(0, itemDurabilityMax), // itemDurability
        csvNumberField(0, itemDurabilityMax), // itemDurabilityMax
        csvNumberField(0, itemExperienceMax), // itemExperience
      ];
      for (const rec of message) {
        const res = parseCsvFields(rec, auctionFields);
        if (!res.success) {
          console.error(`WU_SAVE_PLAYER_AUCTIONS format failed: ${res.error}`);
          console.warn('record=' + JSON.stringify(rec));
          return false;
        }
      }
      return true;
    }

    if (type === Types.UserMessages.WU_SAVE_USER_BANS) {
      console.info('WU_SAVE_USER_BANS');
      // FIX (real bug -- same CSV-string pattern as WU_SAVE_PLAYER_AUCTIONS
      // and the quests array): this modeled each entry as a raw
      // [username, banTime] tuple, matching what looked like the obvious
      // shape. But gameserver's world/banmanager.js builds each entry with
      // `const rec = username+","+banTime; data.push(rec);` -- a single
      // comma-joined STRING per ban -- and userserver's own worldhandler.js
      // (handleSaveUserBans) passes msg[0] straight through to
      // DBH.saveBans() without ever destructuring it into [username,
      // banTime] pairs, confirming it's stored/expected as an array of CSV
      // strings, not tuples. Every real ban-save message would have failed
      // this validation under the old tuple-array schema.
      const arr = message[0];
      if (!Array.isArray(arr)) {
        console.error('WU_SAVE_USER_BANS: message[0] is not an array.');
        return false;
      }
      if (arr.length > userBansTotal) {
        console.error('WU_SAVE_USER_BANS: too many entries.');
        return false;
      }
      const banFields = [stringField(usernameLenMin, usernameLenMax), csvNumberField(banDateMin, banDateMax)];
      for (const rec of arr) {
        const res = parseCsvFields(rec, banFields);
        if (!res.success) {
          console.error(`WU_SAVE_USER_BANS format failed: ${res.error}`);
          console.warn('record=' + JSON.stringify(rec));
          return false;
        }
      }
      return true;
    }

    if (type === Types.UserMessages.WU_SAVE_PLAYER_LOOKS) {
      console.info('WU_SAVE_PLAYER_LOOKS');
      const csv = message[0];
      if (typeof csv !== 'string') {
        console.info('message is not a string.');
        return false;
      }
      const arr = csv.split(',');
      const res = this.formats[type].safeParse(arr);
      if (!res.success) {
        console.error(`WU_SAVE_PLAYER_LOOKS format failed: ${describeZodError(res.error)}`);
        console.warn('message=' + JSON.stringify(arr));
      }
      return res.success;
    }

    if (this.formats[type]) {
      const res = this.formats[type].safeParse(message);
      if (!res.success) {
        console.error(`Message type ${type} format failed: ${describeZodError(res.error)}`);
        console.warn('message=' + JSON.stringify(message));
      }
      return res.success;
    }

    try {
      throw new Error();
    } catch (err) {
      console.info(err.stack);
    }
    console.error('Unknown message type: ' + type);
    console.warn('message=' + message);
    return false;
  }
}

const checker = new FormatChecker();

export default checker;
