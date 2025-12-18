#!/bin/bash

# Groovy Visualization Project - Deployment Script
# Multi-environment deployment to Kubernetes with Kustomize

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="staging"
IMAGE_TAG="latest"
REGISTRY=""
DRY_RUN=false
SKIP_BUILD=false
WAIT=false
TIMEOUT=300s

# Function to show usage
show_usage() {
    echo "Usage: $0 [ENVIRONMENT] [OPTIONS]"
    echo ""
    echo "Arguments:"
    echo "  ENVIRONMENT             Target environment (staging, prod)"
    echo ""
    echo "Options:"
    echo "  -t, --tag TAG           Image tag to deploy (default: latest)"
    echo "  -r, --registry REGISTRY Container registry (e.g., docker.io/username)"
    echo "  -s, --skip-build        Skip Docker build step"
    echo "  -d, --dry-run           Show what would be deployed without applying"
    echo "  -w, --wait              Wait for deployment to complete"
    echo "  --timeout DURATION      Wait timeout (default: 300s)"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 staging              # Deploy to staging with latest image"
    echo "  $0 prod -t v1.0.0       # Deploy to production with tag v1.0.0"
    echo "  $0 staging -d           # Dry run to staging"
    echo "  $0 prod -w -t v1.0.0    # Deploy to production and wait"
}

# Parse command line arguments
ENVIRONMENT="$1"
shift

while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--tag)
            IMAGE_TAG="$2"
            shift 2
            ;;
        -r|--registry)
            REGISTRY="$2"
            shift 2
            ;;
        -s|--skip-build)
            SKIP_BUILD=true
            shift
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -w|--wait)
            WAIT=true
            shift
            ;;
        --timeout)
            TIMEOUT="$2"
            shift 2
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

# Validate environment
if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "prod" ]]; then
    echo -e "${RED}❌ Invalid environment: $ENVIRONMENT. Must be 'staging' or 'prod'${NC}"
    exit 1
fi

# Function to validate prerequisites
validate_prerequisites() {
    echo -e "${YELLOW}🔍 Validating prerequisites...${NC}"
    
    # Check if kubectl is installed
    if ! command -v kubectl &> /dev/null; then
        echo -e "${RED}❌ kubectl not found. Please install kubectl.${NC}"
        exit 1
    fi
    
    # Check if kustomize is installed
    if ! command -v kustomize &> /dev/null; then
        echo -e "${YELLOW}⚠️  kustomize not found. Using kubectl's built-in kustomize support.${NC}"
    fi
    
    # Check if cluster is accessible
    if ! kubectl cluster-info &> /dev/null; then
        echo -e "${RED}❌ Cannot connect to Kubernetes cluster. Please check your kubeconfig.${NC}"
        exit 1
    fi
    
    # Check if k8s directory exists
    if [ ! -d "k8s" ]; then
        echo -e "${RED}❌ k8s directory not found. Please run from project root.${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Prerequisites validated${NC}"
}

# Function to build and push Docker image
build_and_push_image() {
    if [ "$SKIP_BUILD" = true ]; then
        echo -e "${YELLOW}⚠️  Skipping Docker build step${NC}"
        return
    fi
    
    echo -e "${BLUE}🔨 Building Docker image for $ENVIRONMENT...${NC}"
    
    # Determine image tag
    local tag="$IMAGE_TAG"
    if [ "$ENVIRONMENT" = "staging" ] && [ "$IMAGE_TAG" = "latest" ]; then
        tag="staging"
    elif [ "$ENVIRONMENT" = "prod" ] && [ "$IMAGE_TAG" = "latest" ]; then
        tag="production"
    fi
    
    # Build and push image
    local build_args="-t $tag -e $ENVIRONMENT"
    if [ ! -z "$REGISTRY" ]; then
        build_args="$build_args -r $REGISTRY -p"
    fi
    
    if ./dockerize.sh $build_args; then
        echo -e "${GREEN}✅ Docker image built and pushed${NC}"
    else
        echo -e "${RED}❌ Docker build failed${NC}"
        exit 1
    fi
}

# Function to create secrets
create_secrets() {
    echo -e "${BLUE}🔐 Creating Kubernetes secrets...${NC}"
    
    # Check if .env file exists
    if [ ! -f ".env" ]; then
        echo -e "${RED}❌ .env file not found. Please create it with your API key.${NC}"
        exit 1
    fi
    
    # Extract API key from .env
    local api_key=$(grep "ALPHAVANTAGE_API_KEY" .env | cut -d'=' -f2)
    
    if [ -z "$api_key" ] || [ "$api_key" = "your_real_key_12345" ]; then
        echo -e "${YELLOW}⚠️  API key not configured. Using placeholder for testing.${NC}"
        api_key="placeholder_key_for_testing"
    fi
    
    # Create namespace if it doesn't exist
    kubectl apply -f k8s/namespaces.yaml
    
    # Create or update secret
    kubectl create secret generic groovy-visualization-secrets \
        --from-literal=alphavantage-api-key="$api_key" \
        --namespace="$ENVIRONMENT" \
        --dry-run=client -o yaml | kubectl apply -f -
    
    echo -e "${GREEN}✅ Secrets created/updated in $ENVIRONMENT namespace${NC}"
}

# Function to deploy application
deploy_application() {
    echo -e "${BLUE}🚀 Deploying application to $ENVIRONMENT...${NC}"
    
    local overlay_dir="k8s/overlays/$ENVIRONMENT"
    
    if [ ! -d "$overlay_dir" ]; then
        echo -e "${RED}❌ Overlay directory not found: $overlay_dir${NC}"
        exit 1
    fi
    
    # Update image tag in kustomization
    local full_image_name="groovy-visualization:$IMAGE_TAG"
    if [ ! -z "$REGISTRY" ]; then
        full_image_name="$REGISTRY/groovy-visualization:$IMAGE_TAG"
    fi
    
    # Deploy using kustomize
    if [ "$DRY_RUN" = true ]; then
        echo -e "${PURPLE}🔍 Dry run - showing what would be deployed:${NC}"
        kubectl kustomize "$overlay_dir" | kubectl apply --dry-run=client -f -
    else
        echo -e "${PURPLE}Applying manifests...${NC}"
        kubectl apply -k "$overlay_dir"
        
        echo -e "${GREEN}✅ Deployment applied to $ENVIRONMENT${NC}"
        
        if [ "$WAIT" = true ]; then
            echo -e "${BLUE}⏳ Waiting for deployment to complete...${NC}"
            kubectl rollout status deployment/groovy-visualization \
                --namespace="$ENVIRONMENT" \
                --timeout="$TIMEOUT"
            
            echo -e "${GREEN}✅ Deployment completed successfully${NC}"
        fi
    fi
}

# Function to show deployment status
show_deployment_status() {
    if [ "$DRY_RUN" = true ]; then
        return
    fi
    
    echo ""
    echo -e "${BLUE}📊 Deployment Status${NC}"
    echo "===================="
    
    # Show pods
    echo -e "${PURPLE}Pods in $ENVIRONMENT:${NC}"
    kubectl get pods --namespace="$ENVIRONMENT" -l app=groovy-visualization
    
    # Show services
    echo ""
    echo -e "${PURPLE}Services in $ENVIRONMENT:${NC}"
    kubectl get services --namespace="$ENVIRONMENT" -l app=groovy-visualization
    
    # Show ingress if available
    if kubectl get ingress --namespace="$ENVIRONMENT" -l app=groovy-visualization &>/dev/null; then
        echo ""
        echo -e "${PURPLE}Ingress in $ENVIRONMENT:${NC}"
        kubectl get ingress --namespace="$ENVIRONMENT" -l app=groovy-visualization
    fi
    
    # Show service URL
    local service_url=""
    if [ "$ENVIRONMENT" = "staging" ]; then
        service_url="http://groovy-visualization-staging.example.com"
    elif [ "$ENVIRONMENT" = "prod" ]; then
        service_url="https://groovy-visualization.example.com"
    fi
    
    if [ ! -z "$service_url" ]; then
        echo ""
        echo -e "${GREEN}🌐 Application URL: $service_url${NC}"
    fi
}

# Function to show rollback information
show_rollback_info() {
    if [ "$DRY_RUN" = true ]; then
        return
    fi
    
    echo ""
    echo -e "${BLUE}🔄 Rollback Information${NC}"
    echo "======================="
    echo "To rollback to previous version:"
    echo "  kubectl rollout undo deployment/groovy-visualization --namespace=$ENVIRONMENT"
    echo ""
    echo "To check rollout history:"
    echo "  kubectl rollout history deployment/groovy-visualization --namespace=$ENVIRONMENT"
}

# Main execution
main() {
    echo -e "${BLUE}🚀 Groovy Visualization Deployment${NC}"
    echo "===================================="
    echo -e "${PURPLE}Environment: $ENVIRONMENT${NC}"
    echo -e "${PURPLE}Image Tag: $IMAGE_TAG${NC}"
    echo -e "${PURPLE}Registry: ${REGISTRY:-"local"}${NC}"
    echo -e "${PURPLE}Dry Run: $DRY_RUN${NC}"
    echo ""
    
    validate_prerequisites
    build_and_push_image
    create_secrets
    deploy_application
    show_deployment_status
    show_rollback_info
    
    if [ "$DRY_RUN" = false ]; then
        echo ""
        echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
        echo "Monitor logs with: kubectl logs -f deployment/groovy-visualization --namespace=$ENVIRONMENT"
    fi
}

# Handle interrupt gracefully
trap 'echo -e "\n${YELLOW}🛑 Deployment cancelled${NC}"; exit 0' INT

# Run main function
main "$@"