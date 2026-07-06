@echo off
set KMP_DUPLICATE_LIB_OK=TRUE
set PYTHONIOENCODING=utf-8
:: Add your API keys below (or set them in .env)
:: set PEXELS_API_KEY=your_key_here
:: set GEMINI_API_KEY=your_key_here
cd /d %~dp0
python server.py
