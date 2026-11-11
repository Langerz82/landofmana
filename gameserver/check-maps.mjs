// Checks that a game server's maps are consistent, e.g. after copying files to a live server:
//
//     cd gameserver && node check-maps.mjs
//
// The game server checks doors against its own maps (maps/...), but sends clients the maps in
// shared/maps/... (built into shared.zip at startup). If the two disagree -- one folder updated,
// the other not -- the client asks for the map its copy of a door leads to and the server refuses
// it ("Teleport door does not lead to requested map."). Exit code 1 if anything is wrong.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const GS = process.argv[2] || '.';
const SHARED = path.join(GS, 'shared');
let problems = 0;
const bad = (msg) => { problems++; console.log('  PROBLEM: ' + msg); };
const ok = (msg) => console.log('  ok: ' + msg);
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const exists = (p) => fs.existsSync(p);

console.log('Game server folder: ' + path.resolve(GS));

// 1. the code understands the grouped map list
console.log('\n1. code');
const mm = path.join(GS, 'js/map/mapmanager.js');
if (!exists(mm)) bad(mm + ' is missing');
else if (!fs.readFileSync(mm, 'utf8').includes('flattenMapList'))
    bad('js/map/mapmanager.js is old: it can\'t read the grouped maplist.json (copy the new gameserver/js)');
else ok('js/map/mapmanager.js reads the grouped map list');
const pp = path.join(GS, 'js/entity/player/playerpersistence.js');
if (exists(pp) && !fs.readFileSync(pp, 'utf8').includes('getStartMap')) bad('js/entity/player/playerpersistence.js is old (players with old saved map indices crash on login)');

// 2. the map lists
console.log('\n2. map lists');
const listPath = path.join(GS, 'maps/maplist.json');
const sharedListPath = path.join(SHARED, 'maps/maplist.json');
let list = null;
if (!exists(listPath)) bad(listPath + ' is missing');
else list = readJson(listPath);
if (list && Array.isArray(list.maps)) bad('maps/maplist.json is the old flat list (copy the new gameserver/maps)');
const idx = {};
if (list && list.maps && !Array.isArray(list.maps)) {
    for (const g in list.maps) {
        const m = /^map(\d+)$/.exec(g);
        if (!m) { bad('map list group "' + g + '" is not map<number>'); continue; }
        list.maps[g].forEach((n, i) => { idx[Number(m[1]) * 100 + i] = n; });
    }
    ok(Object.keys(idx).length + ' map files: ' + Object.entries(idx).map(([i, n]) => i + '=' + n).join(', '));
}
if (!exists(SHARED)) bad(SHARED + ' is missing (the files clients are sent)');
else if (!exists(sharedListPath)) bad(sharedListPath + ' is missing');
else if (list && JSON.stringify(readJson(sharedListPath).maps) !== JSON.stringify(list.maps))
    bad('shared/maps/maplist.json differs from maps/maplist.json (copy the repo\'s shared/ folder into gameserver/shared)');
else ok('shared/maps/maplist.json matches');

// 3. every map: on both sides, same doors, doors lead to listed maps
console.log('\n3. maps and doors');
const sharedFile = (n) => path.join(SHARED, 'maps', n.includes('/') ? n + '.json' : n + '/' + n + '.json');
for (const [i, n] of Object.entries(idx)) {
    const sp = path.join(GS, 'maps', n + '.json'), cp = sharedFile(n);
    if (!exists(sp)) { bad(n + ': server map ' + sp + ' is missing'); continue; }
    if (!exists(cp)) { bad(n + ': client map ' + cp + ' is missing'); continue; }
    const sd = (readJson(sp).doors || []).map((d) => d.tmap);
    const cd = (readJson(cp).doors || []).map((d) => d.tmap);
    const wrong = sd.filter((t) => t !== undefined && t !== null && !(t in idx));
    if (wrong.length) bad(n + ' (' + i + '): doors lead to maps that are not listed: ' + [...new Set(wrong)].join(', '));
    if (JSON.stringify(sd) !== JSON.stringify(cd))
        bad(n + ' (' + i + '): the server\'s doors and the client\'s doors differ -- server leads to [' + [...new Set(sd)].join(',') +
            '], client to [' + [...new Set(cd)].join(',') + ']');
}
if (Object.keys(idx).length) ok('checked ' + Object.keys(idx).length + ' maps');
const m0 = path.join(GS, 'maps/map0.json');
if (exists(m0)) console.log('  map0 door leads to: ' + (readJson(m0).doors || []).map((d) => d.tmap + ' (' + (idx[d.tmap] || 'not listed') + ')').join(', '));

// 4. leftovers from before the maps were renamed
console.log('\n4. leftovers');
const listed = new Set(Object.values(idx));
const leftovers = [];
const walk = (dir, rel) => {
    if (!exists(dir)) return;
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
        const r = rel ? rel + '/' + f.name : f.name;
        if (f.isDirectory()) walk(path.join(dir, f.name), r);
        else if (f.name.endsWith('.json') && f.name !== 'maplist.json' && !listed.has(r.replace(/\.json$/, ''))) leftovers.push('maps/' + r);
    }
};
walk(path.join(GS, 'maps'), '');
if (leftovers.length) console.log('  not in the map list (unused, safe to delete): ' + leftovers.join(', '));
else ok('no unused map files');

// 5. NPC data for every map file
console.log('\n5. NPC/mob data');
let ents = 0;
for (const n of listed) if (exists(path.join(GS, 'data/maps', n, 'entity.json'))) ents++;
ok(ents + ' map files have NPCs (data/maps/<map>/entity.json)');
for (const old of ['map4', 'map5']) if (exists(path.join(GS, 'data/maps', old))) console.log('  data/maps/' + old + ' is left over from before the rename (unused)');

// 6. start map
console.log('\n6. start map');
try {
    const cfg = readJson(path.join(GS, 'config.json'));
    const s = cfg.start_map;
    if (s === undefined) console.log('  config.json has no start_map: players start on map0');
    else {
        const hit = Object.entries(idx).find(([i, n]) => String(i) === String(s) || n === s || n.split('/').pop() === s) ||
            (list.warps || []).filter((w) => w.startsWith(s + '/')).map((w) => Object.entries(idx).find(([, n]) => n === w))[0];
        if (hit) ok('start_map "' + s + '" -> ' + hit[0] + ' (' + hit[1] + ')');
        else bad('start_map "' + s + '" is not a listed map');
    }
} catch (e) {
    bad('config.json: ' + e.message);
}

// 7. shared manifest (rebuilt by the server at startup; a stale one is fine before a restart)
console.log('\n7. shared manifest');
const manPath = path.join(SHARED, 'manifest.json');
if (exists(manPath)) {
    const man = readJson(manPath);
    const stale = Object.entries(man.files || {}).filter(([p, sha]) =>
        !exists(path.join(SHARED, p)) || crypto.createHash('sha1').update(fs.readFileSync(path.join(SHARED, p))).digest('hex') !== sha);
    if (stale.length) console.log('  manifest.json is out of date for ' + stale.length + ' file(s) -- the server rewrites it (and shared.zip) when it starts');
    else ok('manifest.json matches the shared files (hash ' + man.hash + ')');
}

console.log('\n' + (problems ? problems + ' problem(s) found.' : 'All good.') + ' Restart the game server after fixing files.');
process.exit(problems ? 1 : 0);
