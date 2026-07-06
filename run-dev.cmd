@echo off
rem 给预览/外部启动器用:先把便携版 Node 注入 PATH,再起 dev(端口 3100)
set "PATH=C:\Users\Rain\AppData\Local\Programs\nodejs;%PATH%"
set "NEXT_TELEMETRY_DISABLED=1"
cd /d "%~dp0"
call "C:\Users\Rain\AppData\Local\Programs\nodejs\npm.cmd" run dev
