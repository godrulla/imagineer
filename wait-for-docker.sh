#!/bin/bash

# Wait for Docker Desktop to be ready
echo "🐳 Starting Docker Desktop..."
echo "   This may take a minute on first launch..."

# Try to start Docker Desktop if not already starting
open -a "Docker" 2>/dev/null || open -a "Docker Desktop" 2>/dev/null || true

# Wait for Docker daemon to be responsive
MAX_WAIT=120
WAIT_COUNT=0

while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
    if docker version >/dev/null 2>&1; then
        echo "✅ Docker is ready!"
        
        # Also check docker-compose
        if docker-compose version >/dev/null 2>&1; then
            echo "✅ Docker Compose is ready!"
            exit 0
        elif docker compose version >/dev/null 2>&1; then
            echo "✅ Docker Compose (plugin) is ready!"
            exit 0
        else
            echo "⚠️  Docker Compose not found. Installing..."
            echo "   Please install Docker Compose from: https://docs.docker.com/compose/install/"
            exit 1
        fi
    fi
    
    printf "."
    sleep 2
    WAIT_COUNT=$((WAIT_COUNT + 2))
done

echo ""
echo "❌ Docker failed to start within $MAX_WAIT seconds"
echo ""
echo "Please:"
echo "1. Open Docker Desktop manually from Applications"
echo "2. Wait for it to fully start (green icon in menu bar)"
echo "3. Run ./start-imagineer.sh again"
exit 1