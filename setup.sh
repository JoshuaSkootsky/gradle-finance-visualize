#!/bin/bash

# Groovy Visualization Project - Setup Script
# Initializes development environment for first-time setup

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Setting up Groovy Visualization Project${NC}"
echo "================================================="

# Check if Java is installed
echo -e "${YELLOW}Checking Java installation...${NC}"
if ! command -v java &> /dev/null; then
    echo -e "${RED}❌ Java is not installed or not in PATH${NC}"
    echo "Please install Java 21 or higher:"
    echo "  Ubuntu/Debian: sudo apt install openjdk-21-jdk"
    echo "  macOS: brew install openjdk@21"
    echo "  Windows: Download from https://adoptium.net/"
    exit 1
fi

JAVA_VERSION=$(java -version 2>&1 | head -n 1 | cut -d'"' -f2 | cut -d'.' -f1)
if [ "$JAVA_VERSION" -lt "21" ]; then
    echo -e "${RED}❌ Java version $JAVA_VERSION detected. Java 21+ is recommended.${NC}"
    echo "Please upgrade to Java 21 for best compatibility."
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo -e "${GREEN}✅ Java $JAVA_VERSION detected${NC}"
fi

# Check if Docker is installed (optional but recommended)
echo -e "${YELLOW}Checking Docker installation...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}⚠️  Docker not found. Install Docker for containerization support.${NC}"
else
    echo -e "${GREEN}✅ Docker detected${NC}"
fi

# Check if kubectl is installed (optional but recommended)
echo -e "${YELLOW}Checking kubectl installation...${NC}"
if ! command -v kubectl &> /dev/null; then
    echo -e "${YELLOW}⚠️  kubectl not found. Install kubectl for Kubernetes support.${NC}"
else
    echo -e "${GREEN}✅ kubectl detected${NC}"
fi

# Setup environment variables
echo -e "${YELLOW}Setting up environment variables...${NC}"
if [ ! -f ".env" ]; then
    echo "Creating .env file from template..."
    cp .env.example .env
    echo -e "${GREEN}✅ .env file created${NC}"
    
    echo
    echo -e "${BLUE}📝 Configure your Alpha Vantage API key:${NC}"
    echo "Visit: https://www.alphavantage.co/support/#api-key"
    echo "Get your FREE API key and add it to .env file"
    echo
    
    # Ask user if they want to configure API key now
    read -p "Do you want to configure the API key now? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "Enter your Alpha Vantage API key: " api_key
        if [ ! -z "$api_key" ]; then
            sed -i "s/your_real_key_12345/$api_key/" .env
            echo -e "${GREEN}✅ API key configured${NC}"
        else
            echo -e "${YELLOW}⚠️  No API key provided. You can add it later to .env${NC}"
        fi
    fi
else
    echo -e "${GREEN}✅ .env file already exists${NC}"
fi

# Validate API key if present
if [ -f ".env" ]; then
    if grep -q "your_real_key_12345" .env; then
        echo -e "${YELLOW}⚠️  API key still uses placeholder value. Please update it in .env${NC}"
    else
        echo -e "${GREEN}✅ API key appears to be configured${NC}"
    fi
fi

# Make scripts executable
echo -e "${YELLOW}Making scripts executable...${NC}"
chmod +x dev.sh dockerize.sh deploy.sh health.sh 2>/dev/null || true
echo -e "${GREEN}✅ Scripts made executable${NC}"

# Build the project
echo -e "${YELLOW}Building project...${NC}"
if ./gradlew build; then
    echo -e "${GREEN}✅ Project built successfully${NC}"
else
    echo -e "${RED}❌ Build failed. Please check the error messages above.${NC}"
    exit 1
fi

# Create environment directories
echo -e "${YELLOW}Creating environment directories...${NC}"
mkdir -p config/{staging,prod}
mkdir -p logs

echo -e "${GREEN}✅ Environment directories created${NC}"

# Final summary
echo
echo -e "${GREEN}🎉 Setup completed successfully!${NC}"
echo "================================================="
echo "Next steps:"
echo "  1. Update .env with your Alpha Vantage API key (if not done)"
echo "  2. Run: ./dev.sh              # Start development server"
echo "  3. Run: ./dockerize.sh        # Build Docker image"
echo "  4. Run: ./deploy.sh staging   # Deploy to staging"
echo "  5. Run: ./health.sh           # Check application health"
echo
echo "Documentation: Check README.md for detailed instructions"
echo "Happy coding! 🚀"