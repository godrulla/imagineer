#!/bin/bash

# Imagineer Platform Startup Script
# This script starts the complete microservices platform

set -e

echo "🚀 Starting Imagineer Platform..."
echo "=================================="

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from template..."
    cp .env.example .env
    echo "✅ Created .env file. Please configure your API keys and secrets."
    echo "📝 Edit .env with your:"
    echo "   - Database passwords"
    echo "   - LLM API keys (OpenAI, Anthropic, Google)"
    echo "   - Figma access token"
    echo "   - JWT secret"
    echo ""
    read -p "Press Enter once you've configured .env..."
fi

# Load environment variables
source .env

# Check for required tools
echo "🔍 Checking requirements..."

if ! command -v docker &> /dev/null; then
    echo "❌ Docker is required but not installed."
    echo "   Install Docker from: https://www.docker.com/get-started"
    exit 1
fi

# Check if Docker daemon is running
if ! docker version >/dev/null 2>&1; then
    echo "⚠️  Docker Desktop is not running."
    echo "   Starting Docker Desktop now..."
    ./wait-for-docker.sh || exit 1
fi

# Check for docker-compose (both standalone and plugin versions)
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
    echo "✅ Docker Compose found (standalone)"
elif docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
    echo "✅ Docker Compose found (plugin)"
else
    echo "❌ Docker Compose is required but not installed."
    echo "   Install Docker Compose from: https://docs.docker.com/compose/install/"
    exit 1
fi

echo "✅ Docker daemon is running"

# Check if ports are available
echo "🔌 Checking port availability..."

check_port() {
    local port=$1
    local service=$2
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "⚠️  Port $port is in use (needed for $service)"
        echo "   Please free this port or change the configuration"
        return 1
    fi
    return 0
}

# Check critical ports
check_port 5433 "PostgreSQL" || exit 1
check_port 6380 "Redis" || exit 1
check_port 8090 "API Gateway" || exit 1
check_port 8001 "Design Parser" || exit 1
check_port 8002 "Translation Engine" || exit 1
check_port 8003 "Export Engine" || exit 1
check_port 8004 "Collaboration Hub" || exit 1

echo "✅ All required ports are available"

# Start the platform
echo "🏗️  Building and starting services..."
echo "   This may take a few minutes on first run..."

$DOCKER_COMPOSE up -d --build

echo ""
echo "⏳ Waiting for services to be healthy..."

# Wait for services to be ready
wait_for_service() {
    local url=$1
    local service=$2
    local timeout=120
    local count=0
    
    while [ $count -lt $timeout ]; do
        if curl -s -f "$url" > /dev/null 2>&1; then
            echo "✅ $service is ready"
            return 0
        fi
        sleep 2
        count=$((count + 2))
        printf "."
    done
    
    echo "❌ $service failed to start within $timeout seconds"
    return 1
}

# Wait for database
echo -n "📊 PostgreSQL: "
wait_for_service "http://localhost:5433" "PostgreSQL" || {
    echo "Checking PostgreSQL with pg_isready..."
    $DOCKER_COMPOSE exec postgres pg_isready -U imagineer_user -d imagineer || exit 1
    echo "✅ PostgreSQL is ready"
}

# Wait for Redis
echo -n "🔄 Redis: "
wait_for_service "http://localhost:6380" "Redis" || {
    echo "Checking Redis with ping..."
    $DOCKER_COMPOSE exec redis redis-cli ping | grep PONG > /dev/null || exit 1
    echo "✅ Redis is ready"
}

# Wait for microservices
echo -n "🔧 Design Parser: "
wait_for_service "http://localhost:8001/health" "Design Parser" || exit 1

echo -n "🤖 Translation Engine: "
wait_for_service "http://localhost:8002/health" "Translation Engine" || exit 1

echo -n "📤 Export Engine: "
wait_for_service "http://localhost:8003/health" "Export Engine" || exit 1

echo -n "👥 Collaboration Hub: "
wait_for_service "http://localhost:8004/health" "Collaboration Hub" || exit 1

echo -n "🚪 API Gateway: "
wait_for_service "http://localhost:8090/health" "API Gateway" || exit 1

echo ""
echo "🎉 IMAGINEER PLATFORM IS READY!"
echo "=================================="
echo ""
echo "🌐 Access Points:"
echo "   • Frontend:          http://localhost:5173"
echo "   • API Gateway:       http://localhost:8090"
echo "   • Design Parser:     http://localhost:8001"
echo "   • Translation:       http://localhost:8002" 
echo "   • Export Engine:     http://localhost:8003"
echo "   • Collaboration:     http://localhost:8004"
echo ""
echo "🔧 Management Tools:"
echo "   • Database Admin:    http://localhost:5050 (connects to PostgreSQL on 5433)"
echo "   • Redis Commander:   http://localhost:8081 (connects to Redis on 6380)"
echo "   • Prometheus:        http://localhost:9090"
echo "   • Grafana:          http://localhost:3001"
echo "   • Jaeger Tracing:   http://localhost:16686"
echo ""
echo "📊 System Status:"
$DOCKER_COMPOSE ps
echo ""
echo "🚀 Platform is ready for design-to-LLM translation!"
echo ""
echo "💡 Next steps:"
echo "   1. Open http://localhost:5173 in your browser"
echo "   2. Try the 'Import Figma' button with a Figma URL"
echo "   3. Create designs and click 'Generate LLM Prompt'"
echo ""
echo "📚 Documentation: See ./docs/ for detailed guides"
echo "🛠️  Logs: Use '$DOCKER_COMPOSE logs [service]' to debug"
echo "🛑 Stop: Use '$DOCKER_COMPOSE down' to stop all services"