#!/usr/bin/env python3
"""Bot ishga tushiruvchi — .env ni o'qib telegram botni ishga tushiradi."""
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

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bot.bot import main
main()
