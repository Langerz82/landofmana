@echo off
rem Copies the art, audio, maps and data of the JS client into godot-client\assets.
rem Run again whenever client\ or shared\data changes.
cd /d "%~dp0"
for %%d in (assets\img assets\fonts assets\data\shared assets\config assets\maps\map0 assets\maps\map1 assets\maps\map2) do if not exist %%d mkdir %%d
xcopy /E /I /Y /Q ..\client\img\2 assets\img\2
xcopy /E /I /Y /Q ..\client\img\3 assets\img\3
xcopy /E /I /Y /Q ..\client\img\common assets\img\common
xcopy /E /I /Y /Q ..\client\audio assets\audio
copy /Y ..\client\fonts\*.ttf assets\fonts\ >nul
copy /Y ..\client\fonts\*.otf assets\fonts\ >nul
for %%m in (map0 map1 map2) do copy /Y ..\client\maps\%%m\%%m.json assets\maps\%%m\ >nul
copy /Y ..\client\data\staticsheet.json assets\data\ >nul
copy /Y ..\client\data\sprites\sprites.json assets\data\sprites.json >nul
copy /Y ..\shared\data\*.json assets\data\shared\ >nul
copy /Y ..\client\config\config_build.json assets\config\ >nul
echo Assets copied.
