#!/bin/bash
# Copies the art, audio, maps and data of the JS client into godot-client/assets.
# Run again whenever client/ or shared/data changes.
set -e
cd "$(dirname "$0")"
SRC=../client
SH=../shared
mkdir -p assets/img assets/fonts assets/maps assets/data/shared assets/config
cp -r "$SRC/img/2" "$SRC/img/3" "$SRC/img/common" assets/img/
cp -r "$SRC/audio" assets/
cp "$SRC"/fonts/*.ttf "$SRC"/fonts/*.otf assets/fonts/
# every map folder in shared/maps (map0/map0.json, ..., and sectional maps' folders such as
# map4/map4_0_0.json ...) plus the map list
for d in "$SH"/maps/*/; do
    m=$(basename "$d")
    ls "$d"*.json >/dev/null 2>&1 || continue
    mkdir -p "assets/maps/$m"
    cp "$d"*.json "assets/maps/$m/"
done
[ -f "$SH/maps/maplist.json" ] && cp "$SH/maps/maplist.json" assets/maps/
cp "$SRC/data/sprites/sprites.json" assets/data/sprites.json
cp "$SRC/data/staticsheet.json" assets/data/
cp "$SH"/data/*.json assets/data/shared/
# the shared hash of those files and the maps (ClientData compares it with the game server's)
[ -f "$SH/manifest.json" ] && cp "$SH/manifest.json" assets/data/shared_manifest.json
cp "$SRC/config/config_build.json" assets/config/
echo "Assets copied into $(pwd)/assets"
