#!/bin/bash

# Docker entrypoint script for development with hot reload

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting Groovy Visualization in Development Mode${NC}"

# Check if we need to build first
if [ ! -f "build/libs/groovy-visualization.jar" ] || [ "src" -nt "build/libs/groovy-visualization.jar" ]; then
    echo -e "${YELLOW}🔨 Building application...${NC}"
    ./gradlew build -x test
    echo -e "${GREEN}✅ Build completed${NC}"
fi

# Start the application
echo -e "${BLUE}🌐 Starting server on http://localhost:8080${NC}"
echo -e "${BLUE}📊 API available at http://localhost:8080/api/stock-prices${NC}"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
echo ""

exec java $JAVA_OPTS -jar build/libs/groovy-visualization.jar