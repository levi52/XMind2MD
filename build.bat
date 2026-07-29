@echo off
REM 把 XMind->Markdown 转换工具打包成单个 exe（Windows）
REM 依赖：pip install pyinstaller flask markdown
REM 用法：双击本文件，或在 activated 的 venv 中执行 python -m PyInstaller ...
python -m PyInstaller --onefile --windowed --name XMind2MD --icon "assets/icon.ico" --add-data "templates;templates" --hidden-import=markdown.extensions.tables --hidden-import=markdown.extensions.fenced_code --hidden-import=markdown.extensions.toc --hidden-import=markdown.extensions.sane_lists app.py
echo.
echo 构建完成，exe 位于 dist\XMind2MD.exe
pause
