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
for m in map0 map1 map2; do
    mkdir -p "assets/maps/$m"
    cp "$SRC/maps/$m/$m.json" "assets/maps/$m/"
done
cp "$SRC/data/sprites/sprites.json" assets/data/sprites.json
cp "$SRC/data/staticsheet.json" assets/data/
cp "$SH"/data/*.json assets/data/shared/
cp "$SRC/config/config_build.json" assets/config/
echo "Assets copied into $(pwd)/assets"
