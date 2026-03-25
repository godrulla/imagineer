#!/bin/bash

echo "🔍 Checking Imagineer Platform Status..."
echo "========================================="
echo ""

# Check Docker containers
echo "📦 Docker Containers:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "   No containers running yet..."
echo ""

# Check if images are still being pulled
if docker-compose ps 2>/dev/null | grep -q "Pulling\|Building"; then
    echo "⏳ Still building/pulling images..."
    echo "   This can take 5-10 minutes on first run"
    echo "   (Docker is downloading all required services)"
else
    echo "✅ Images ready"
fi

echo ""
echo "📊 Quick Tips:"
echo "   • First run downloads ~2GB of Docker images"
echo "   • Check progress: docker-compose logs -f"
echo "   • Once ready, access: http://localhost:5173"
echo ""

# Show estimated time
if [ -z "$(docker ps -q)" ]; then
    echo "⏱️  Estimated time remaining: 3-7 minutes"
else
    count=$(docker ps -q | wc -l)
    echo "⏱️  Services running: $count / 15"
fi