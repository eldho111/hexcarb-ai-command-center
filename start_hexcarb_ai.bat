
@echo off
REM === Path to Anaconda installation ===
set CONDA_DIR=C:\Users\eldho\anaconda3

REM === 1: Start Ollama model ===
start "OLLAMA" cmd /k "ollama run gemma:2b"

REM === 2: Ask.py interactive window ===
start "ASK" cmd /k "call %CONDA_DIR%\Scripts\activate.bat hexcarb_ai && cd C:\Users\eldho\OneDrive\Documents\HexCarb_ai_command_center"

REM === 3: Warmup daemon ===
start "DAEMON" cmd /k "call %CONDA_DIR%\Scripts\activate.bat hexcarb_ai && cd C:\Users\eldho\OneDrive\Documents\HexCarb_ai_command_center && python warmup_daemon.py"

echo All HexCarb AI Command Center windows launched successfully.
pause
