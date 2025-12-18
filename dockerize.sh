#!/bin/bash

# Groovy Visualization Project - Docker Build Script
# Creates optimized Docker images for multi-environment deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Default values
IMAGE_NAME="groovy-visualization"
TAG="latest"
ENVIRONMENT="production"
PUSH=false
REGISTRY=""
MULTI_ARCH=false

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -t, --tag TAG            Set image tag (default: latest)"
    echo "  -e, --env ENVIRONMENT    Set environment (development, staging, prod)"
    echo "  -p, --push               Push image to registry after build"
    echo "  -r, --registry REGISTRY  Set registry (e.g., docker.io/username)"
    echo "  -m, --multi-arch         Build for multiple architectures"
    echo "  -h, --help               Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                        # Build with defaults"
    echo "  $0 -t v1.0.0             # Build with tag v1.0.0"
    echo "  $0 -e staging -p         # Build staging image and push"
    echo "  $0 -r myregistry -p      # Build and push to custom registry"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--tag)
            TAG="$2"
            shift 2
            ;;
        -e|--env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -p|--push)
            PUSH=true
            shift
            ;;
        -r|--registry)
            REGISTRY="$2"
            shift 2
            ;;
        -m|--multi-arch)
            MULTI_ARCH=true
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

# Function to create Dockerfile
create_dockerfile() {
    local env=$1
    echo -e "${BLUE}📝 Creating optimized Dockerfile for $env environment...${NC}"
    
    cat > Dockerfile << 'EOF'
# Multi-stage build for Groovy Visualization Application
# Stage 1: Build stage
FROM gradle:8.11.1-jdk21 AS builder

# Set working directory
WORKDIR /app

# Copy gradle wrapper files first for better caching
COPY gradlew gradlew.bat ./
COPY gradle/wrapper/ gradle/wrapper/

# Copy build configuration
COPY build.gradle ./

# Cache dependencies
RUN ./gradlew dependencies || true

# Copy source code
COPY src/ src/
COPY public/ public/

# Build the application
RUN ./gradlew clean build -x test

# Stage 2: Runtime stage
FROM eclipse-temurin:21-jre-alpine AS runtime

# Install curl for health checks
RUN apk add --no-cache curl

# Create application user
RUN addgroup -g 1000 appgroup && adduser -u 1000 -G appgroup -s /bin/sh -D appuser

# Set working directory
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder /app/build/libs/groovy-visualization.jar app.jar
COPY --from=builder /app/public/ public/

# Create logs directory
RUN mkdir -p logs && chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8080

# Add health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/api/stock-prices || exit 1

# Set JVM options for production
ENV JAVA_OPTS="-Xmx512m -Xms256m -XX:+UseG1GC -XX:+UseContainerSupport"

# Run the application
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
EOF

    echo -e "${GREEN}✅ Dockerfile created${NC}"
}

# Function to create .dockerignore
create_dockerignore() {
    echo -e "${BLUE}📝 Creating .dockerignore...${NC}"
    
    cat > .dockerignore << 'EOF'
# Gradle
.gradle/
build/
!build/libs/*.jar

# IDE
.idea/
.vscode/
*.iml
*.ipr
*.iws

# OS
.DS_Store
Thumbs.db

# Git
.git/
.gitignore

# Documentation
README.md
*.md

# Environment files
.env
.env.*

# Logs
logs/
*.log

# Docker
Dockerfile
.dockerignore

# Scripts
setup.sh
dev.sh
dockerize.sh
deploy.sh
health.sh

# Kubernetes
k8s/

# Temporary files
*.tmp
*.temp
*~
EOF

    echo -e "${GREEN}✅ .dockerignore created${NC}"
}

# Function to build Docker image
build_image() {
    local full_image_name="$IMAGE_NAME:$TAG"
    if [ ! -z "$REGISTRY" ]; then
        full_image_name="$REGISTRY/$IMAGE_NAME:$TAG"
    fi
    
    echo -e "${BLUE}🔨 Building Docker image: $full_image_name${NC}"
    echo -e "${PURPLE}Environment: $ENVIRONMENT${NC}"
    echo -e "${PURPLE}Multi-arch: $MULTI_ARCH${NC}"
    echo ""
    
    # Build arguments
    local build_args=""
    if [ "$ENVIRONMENT" != "production" ]; then
        build_args="--build-arg ENVIRONMENT=$ENVIRONMENT"
    fi
    
    if [ "$MULTI_ARCH" = true ]; then
        echo -e "${YELLOW}🏗️  Building multi-architecture image...${NC}"
        docker buildx build --platform linux/amd64,linux/arm64 $build_args -t "$full_image_name" --push .
    else
        docker build $build_args -t "$full_image_name" .
        echo -e "${GREEN}✅ Image built successfully${NC}"
        
        # Show image info
        echo ""
        echo -e "${BLUE}Image details:${NC}"
        docker images | grep "$IMAGE_NAME" | grep "$TAG"
    fi
}

# Function to push image
push_image() {
    local full_image_name="$IMAGE_NAME:$TAG"
    if [ ! -z "$REGISTRY" ]; then
        full_image_name="$REGISTRY/$IMAGE_NAME:$TAG"
    fi
    
    echo -e "${BLUE}📤 Pushing image: $full_image_name${NC}"
    
    if [ "$MULTI_ARCH" != true ]; then
        docker push "$full_image_name"
        echo -e "${GREEN}✅ Image pushed successfully${NC}"
    else
        echo -e "${YELLOW}Multi-arch image already pushed during build${NC}"
    fi
}

# Function to check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}🔍 Checking prerequisites...${NC}"
    
    # Check if Docker is running
    if ! docker info >/dev/null 2>&1; then
        echo -e "${RED}❌ Docker is not running. Please start Docker.${NC}"
        exit 1
    fi
    
    # Check if Docker Buildx is available (for multi-arch builds)
    if [ "$MULTI_ARCH" = true ]; then
        if ! docker buildx version >/dev/null 2>&1; then
            echo -e "${RED}❌ Docker Buildx not available. Required for multi-arch builds.${NC}"
            exit 1
        fi
        
        # Initialize buildx builder
        docker buildx create --use --name multiarch-builder 2>/dev/null || docker buildx use multiarch-builder
    fi
    
    # Check if project is built
    if [ ! -f "./gradlew" ]; then
        echo -e "${RED}❌ Gradle wrapper not found. Please run ./setup.sh first${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Prerequisites check passed${NC}"
}

# Function to show image summary
show_summary() {
    local full_image_name="$IMAGE_NAME:$TAG"
    if [ ! -z "$REGISTRY" ]; then
        full_image_name="$REGISTRY/$IMAGE_NAME:$TAG"
    fi
    
    echo ""
    echo -e "${GREEN}🎉 Docker build completed successfully!${NC}"
    echo "=========================================="
    echo -e "${PURPLE}Image: $full_image_name${NC}"
    echo -e "${PURPLE}Environment: $ENVIRONMENT${NC}"
    echo -e "${PURPLE}Size: $(docker images --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}" | grep "$full_image_name" | awk '{print $2}' || echo "N/A")${NC}"
    echo ""
    echo "Next steps:"
    echo "  Test: docker run -p 8080:8080 $full_image_name"
    if [ "$PUSH" = false ]; then
        echo "  Push: docker push $full_image_name"
    fi
    echo "  Deploy: ./deploy.sh $ENVIRONMENT"
}

# Main execution
main() {
    echo -e "${BLUE}🐳 Groovy Visualization Docker Build${NC}"
    echo "=================================="
    
    check_prerequisites
    create_dockerfile
    create_dockerignore
    build_image
    
    if [ "$PUSH" = true ]; then
        push_image
    fi
    
    show_summary
}

# Handle interrupt gracefully
trap 'echo -e "\n${YELLOW}🛑 Docker build cancelled${NC}"; exit 0' INT

# Run main function
main "$@"