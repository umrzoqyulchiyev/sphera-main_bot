#!/usr/bin/env python3
"""Backend ishga tushiruvchi — .env ni o'qib uvicorn ni ishga tushiradi."""
import os
import sys

env_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
if os.path.exists(env_file):
    for line in open(env_file):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "#" in line:
            line = line[: line.index("#")].strip()
        if "=" in line:
            k, v = line.split("=", 1)
            os.environ[k.strip()] = v.strip()

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend"))

import uvicorn
uvicorn.run("app.main:app", host="0.0.0.0", port=8001, reload=False)
