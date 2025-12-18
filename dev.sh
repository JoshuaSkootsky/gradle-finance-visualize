#!/bin/bash

# Groovy Visualization Project - Development Script
# Optimized for local development with enhanced features

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Default values
PORT=8080
ENVIRONMENT="development"
LOG_LEVEL="INFO"
HOT_RELOAD=false
OPEN_BROWSER=true

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -p, --port PORT         Set server port (default: 8080)"
    echo "  -e, --env ENVIRONMENT   Set environment (development, staging, prod)"
    echo "  -l, --log LEVEL         Set log level (DEBUG, INFO, WARN, ERROR)"
    echo "  -r, --reload            Enable hot reload (experimental)"
    echo "  -b, --no-browser        Don't open browser automatically"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                      # Start with defaults"
    echo "  $0 -p 3000              # Start on port 3000"
    echo "  $0 -e staging -l DEBUG  # Start with staging config and debug logs"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -p|--port)
            PORT="$2"
            shift 2
            ;;
        -e|--env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -l|--log)
            LOG_LEVEL="$2"
            shift 2
            ;;
        -r|--reload)
            HOT_RELOAD=true
            shift
            ;;
        -b|--no-browser)
            OPEN_BROWSER=false
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            show_usage
            exit 1
            ;;
    esac
done

# Function to check if port is available
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 1
    fi
    return 0
}

# Function to open browser
open_browser() {
    local url="http://localhost:$PORT"
    echo -e "${BLUE}Opening browser at $url${NC}"
    
    case "$(uname -s)" in
        Darwin*)    open "$url" ;;
        Linux*)     xdg-open "$url" ;;
        CYGWIN*|MINGW*|MSYS*) start "$url" ;;
        *)          echo -e "${YELLOW}Please open $url manually${NC}" ;;
    esac
}

# Function to build and run
build_and_run() {
    echo -e "${BLUE}🔧 Building application for $ENVIRONMENT environment...${NC}"
    
    # Build the project
    if ! ./gradlew clean build; then
        echo -e "${RED}❌ Build failed${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Build successful${NC}"
    
    # Check if port is available
    if ! check_port $PORT; then
        echo -e "${YELLOW}⚠️  Port $PORT is already in use${NC}"
        read -p "Do you want to use a different port? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            PORT=$((PORT + 1))
            echo -e "${BLUE}Using port $PORT${NC}"
        else
            echo -e "${RED}❌ Port $PORT is in use. Please stop the other process or choose a different port.${NC}"
            exit 1
        fi
    fi
    
    echo -e "${BLUE}🚀 Starting development server...${NC}"
    echo -e "${PURPLE}Environment: $ENVIRONMENT${NC}"
    echo -e "${PURPLE}Port: $PORT${NC}"
    echo -e "${PURPLE}Log Level: $LOG_LEVEL${NC}"
    echo -e "${PURPLE}Hot Reload: $HOT_RELOAD${NC}"
    echo ""
    
    # Set environment variables for development
    export SERVER_PORT=$PORT
    export LOG_LEVEL=$LOG_LEVEL
    export ENVIRONMENT=$ENVIRONMENT
    export DEV_MODE=true
    
    # Start the server
    if [ "$HOT_RELOAD" = true ]; then
        echo -e "${YELLOW}🔄 Hot reload enabled. Monitoring file changes...${NC}"
        # Note: For true hot reload, you might need to implement file watching
        # This is a simplified version that restarts on changes
        while true; do
            ./gradlew run &
            SERVER_PID=$!
            
            # Wait for interrupt or file change
            trap "kill $SERVER_PID 2>/dev/null; exit 0" INT
            
            # Simple file watching (you might want to use `inotifywait` for better results)
            echo -e "${GREEN}✅ Server started with PID $SERVER_PID${NC}"
            if [ "$OPEN_BROWSER" = true ]; then
                open_browser
                OPEN_BROWSER=false  # Only open once
            fi
            
            echo -e "${BLUE}Press Ctrl+C to stop${NC}"
            wait $SERVER_PID
        done
    else
        echo -e "${GREEN}✅ Server starting...${NC}"
        echo -e "${BLUE}🌐 Application will be available at http://localhost:$PORT${NC}"
        echo -e "${BLUE}📊 API endpoint: http://localhost:$PORT/api/stock-prices${NC}"
        echo ""
        echo -e "${BLUE}Press Ctrl+C to stop${NC}"
        
        if [ "$OPEN_BROWSER" = true ]; then
            open_browser
        fi
        
        ./gradlew run
    fi
}

# Function to check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}🔍 Checking prerequisites...${NC}"
    
    # Check if .env exists
    if [ ! -f ".env" ]; then
        echo -e "${RED}❌ .env file not found. Please run ./setup.sh first${NC}"
        exit 1
    fi
    
    # Check if API key is configured
    if grep -q "your_real_key_12345" .env; then
        echo -e "${YELLOW}⚠️  API key still uses placeholder. Using fallback data.${NC}"
    else
        echo -e "${GREEN}✅ API key configured${NC}"
    fi
    
    # Check if Gradle wrapper exists
    if [ ! -f "./gradlew" ]; then
        echo -e "${RED}❌ Gradle wrapper not found. Please run ./setup.sh first${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Prerequisites check passed${NC}"
}

# Main execution
main() {
    echo -e "${BLUE}🚀 Groovy Visualization Development Server${NC}"
    echo "=========================================="
    
    check_prerequisites
    build_and_run
}

# Handle interrupt gracefully
trap 'echo -e "\n${YELLOW}🛑 Stopping server...${NC}"; exit 0' INT

# Run main function
main "$@"