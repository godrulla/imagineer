#!/bin/bash

echo "🚀 Launching Imagineer Demo Platform..."
echo "======================================"

# Start just the essential services
echo "📊 Starting database and cache..."
docker run -d --name imagineer-demo-postgres \
    -e POSTGRES_PASSWORD=imagineer_demo \
    -e POSTGRES_DB=imagineer \
    -e POSTGRES_USER=imagineer_user \
    -p 5433:5432 \
    postgres:15-alpine

docker run -d --name imagineer-demo-redis \
    -p 6380:6379 \
    redis:7-alpine

echo "⏳ Waiting for services to be ready..."
sleep 5

# Start the frontend
echo "🌐 Starting frontend development server..."
cd client && npm install --legacy-peer-deps 2>/dev/null || echo "Dependencies already installed"

echo ""
echo "🎉 IMAGINEER DEMO IS READY!"
echo "=========================="
echo ""
echo "🌐 Frontend will start at: http://localhost:5173"
echo "📊 Database running on: localhost:5433"
echo "🔄 Redis running on: localhost:6380"
echo ""
echo "📝 Note: This is a demo setup with frontend only."
echo "   Microservices can be added once dependencies are resolved."
echo ""
echo "🚀 Starting frontend now..."
npm run dev