#!/bin/bash
# Render build script
set -e

echo "=== 1. Frontend build ==="
cd frontend
npm install
npm run build
cd ..

echo "=== 2. Frontend static -> backend/static ==="
rm -rf backend/static/*
cp -r frontend/dist/* backend/static/

echo "=== 3. Backend dependencies ==="
pip install -r backend/requirements.txt

echo "=== Build tugadi ==="
