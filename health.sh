#!/bin/bash

# Groovy Visualization Project - Health Check Script
# Monitors application health and provides diagnostics

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Default values
TARGET="local"
PORT=8080
NAMESPACE="staging"
CONTINUOUS=false
INTERVAL=30
VERBOSE=false

# Function to show usage
show_usage() {
    echo "Usage: $0 [TARGET] [OPTIONS]"
    echo ""
    echo "Arguments:"
    echo "  TARGET                  Target to check (local, staging, prod, docker)"
    echo ""
    echo "Options:"
    echo "  -p, --port PORT         Local port (default: 8080)"
    echo "  -n, --namespace NAMESPACE  Kubernetes namespace (default: staging)"
    echo "  -c, --continuous       Run continuous monitoring"
    echo "  -i, --interval SECONDS  Check interval for continuous mode (default: 30)"
    echo "  -v, --verbose          Show detailed output"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 local                # Check local development server"
    echo "  $0 staging              # Check staging deployment"
    echo "  $0 prod -c              # Continuous monitoring of production"
    echo "  $0 docker -p 8080       # Check Docker container"
}

# Parse command line arguments
TARGET="$1"
shift

while [[ $# -gt 0 ]]; do
    case $1 in
        -p|--port)
            PORT="$2"
            shift 2
            ;;
        -n|--namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        -c|--continuous)
            CONTINUOUS=true
            shift
            ;;
        -i|--interval)
            INTERVAL="$2"
            shift 2
            ;;
        -v|--verbose)
            VERBOSE=true
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

# Validate target
case $TARGET in
    local|staging|prod|docker)
        ;;
    *)
        echo -e "${RED}❌ Invalid target: $TARGET. Must be 'local', 'staging', 'prod', or 'docker'${NC}"
        exit 1
        ;;
esac

# Function to check local application
check_local() {
    echo -e "${BLUE}🔍 Checking local application health...${NC}"
    
    local url="http://localhost:$PORT"
    
    # Check if server is running
    if ! curl -f -s "$url" > /dev/null 2>&1; then
        echo -e "${RED}❌ Application not responding at $url${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✅ Application is responding${NC}"
    
    # Check API endpoint
    local api_url="$url/api/stock-prices"
    if [ "$VERBOSE" = true ]; then
        echo -e "${PURPLE}Checking API endpoint: $api_url${NC}"
    fi
    
    if curl -f -s "$api_url" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ API endpoint is healthy${NC}"
        
        if [ "$VERBOSE" = true ]; then
            # Get API response time
            local response_time=$(curl -o /dev/null -s -w '%{time_total}' "$api_url")
            echo -e "${PURPLE}API response time: ${response_time}s${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  API endpoint not responding${NC}"
        return 1
    fi
    
    return 0
}

# Function to check Docker container
check_docker() {
    echo -e "${BLUE}🔍 Checking Docker container health...${NC}"
    
    # Check if Docker is running
    if ! docker info > /dev/null 2>&1; then
        echo -e "${RED}❌ Docker is not running${NC}"
        return 1
    fi
    
    # Find running containers
    local containers=$(docker ps --filter "publish=$PORT" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep groovy-visualization || true)
    
    if [ -z "$containers" ]; then
        echo -e "${RED}❌ No running groovy-visualization containers found${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✅ Running containers found:${NC}"
    echo "$containers"
    
    # Check container health
    local healthy_containers=$(docker ps --filter "publish=$PORT" --filter "health=healthy" --format "{{.Names}}" | grep groovy-visualization || true)
    
    if [ -z "$healthy_containers" ]; then
        echo -e "${YELLOW}⚠️  No containers marked as healthy${NC}"
        
        if [ "$VERBOSE" = true ]; then
            echo -e "${PURPLE}Container health details:${NC}"
            docker ps --filter "publish=$PORT" --format "table {{.Names}}\t{{.Status}}" | grep groovy-visualization || true
        fi
    else
        echo -e "${GREEN}✅ Healthy containers: ${NC}"
        echo "$healthy_containers"
    fi
    
    return 0
}

# Function to check Kubernetes deployment
check_kubernetes() {
    local env="$1"
    echo -e "${BLUE}🔍 Checking Kubernetes deployment health...${NC}"
    
    # Check if kubectl is available
    if ! command -v kubectl &> /dev/null; then
        echo -e "${RED}❌ kubectl not found${NC}"
        return 1
    fi
    
    # Check if cluster is accessible
    if ! kubectl cluster-info &> /dev/null; then
        echo -e "${RED}❌ Cannot access Kubernetes cluster${NC}"
        return 1
    fi
    
    echo -e "${PURPLE}Environment: $env${NC}"
    echo -e "${PURPLE}Namespace: $NAMESPACE${NC}"
    
    # Check pods
    echo ""
    echo -e "${PURPLE}Pod Status:${NC}"
    local pod_status=$(kubectl get pods --namespace="$NAMESPACE" -l app=groovy-visualization --no-headers 2>/dev/null || true)
    
    if [ -z "$pod_status" ]; then
        echo -e "${RED}❌ No pods found in namespace $NAMESPACE${NC}"
        return 1
    fi
    
    echo "$pod_status"
    
    # Check pod health
    local unhealthy_pods=$(echo "$pod_status" | grep -v "Running\|Completed" | wc -l)
    if [ "$unhealthy_pods" -gt 0 ]; then
        echo -e "${YELLOW}⚠️  $unhealthy_pods unhealthy pod(s) found${NC}"
        
        if [ "$VERBOSE" = true ]; then
            echo -e "${PURPLE}Pod details:${NC}"
            kubectl describe pods --namespace="$NAMESPACE" -l app=groovy-visualization
        fi
    else
        echo -e "${GREEN}✅ All pods are healthy${NC}"
    fi
    
    # Check services
    echo ""
    echo -e "${PURPLE}Service Status:${NC}"
    local services=$(kubectl get services --namespace="$NAMESPACE" -l app=groovy-visualization --no-headers 2>/dev/null || true)
    
    if [ -z "$services" ]; then
        echo -e "${RED}❌ No services found${NC}"
        return 1
    fi
    
    echo "$services"
    echo -e "${GREEN}✅ Services are configured${NC}"
    
    # Check deployment status
    echo ""
    echo -e "${PURPLE}Deployment Status:${NC}"
    local deployment_status=$(kubectl rollout status deployment/groovy-visualization --namespace="$NAMESPACE" 2>&1 || true)
    
    if echo "$deployment_status" | grep -q "successfully rolled out"; then
        echo -e "${GREEN}✅ Deployment is healthy${NC}"
    else
        echo -e "${YELLOW}⚠️  Deployment issues detected${NC}"
        echo "$deployment_status"
    fi
    
    return 0
}

# Function to check external dependencies
check_dependencies() {
    echo ""
    echo -e "${BLUE}🔍 Checking external dependencies...${NC}"
    
    # Check Alpha Vantage API
    if [ -f ".env" ]; then
        local api_key=$(grep "ALPHAVANTAGE_API_KEY" .env | cut -d'=' -f2)
        
        if [ -z "$api_key" ] || [ "$api_key" = "your_real_key_12345" ]; then
            echo -e "${YELLOW}⚠️  Alpha Vantage API key not configured${NC}"
        else
            echo -e "${GREEN}✅ Alpha Vantage API key is configured${NC}"
            
            if [ "$VERBOSE" = true ]; then
                echo -e "${PURPLE}Testing API connectivity...${NC}"
                local test_url="https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=IBM&apikey=$api_key"
                local api_response=$(curl -s --max-time 10 "$test_url" || echo "Failed")
                
                if echo "$api_response" | grep -q "Global Quote"; then
                    echo -e "${GREEN}✅ Alpha Vantage API is accessible${NC}"
                elif echo "$api_response" | grep -q "premium"; then
                    echo -e "${YELLOW}⚠️  Alpha Vantage API limit reached${NC}"
                else
                    echo -e "${YELLOW}⚠️  Alpha Vantage API test failed${NC}"
                fi
            fi
        fi
    else
        echo -e "${YELLOW}⚠️  .env file not found${NC}"
    fi
}

# Function to show system resources
show_system_resources() {
    if [ "$VERBOSE" != true ]; then
        return
    fi
    
    echo ""
    echo -e "${BLUE}📊 System Resources${NC}"
    echo "==================="
    
    case $TARGET in
        local|docker)
            echo -e "${PURPLE}Memory Usage:${NC}"
            free -h 2>/dev/null || echo "Memory info not available"
            
            echo ""
            echo -e "${PURPLE}Disk Usage:${NC}"
            df -h . | tail -1
            
            echo ""
            echo -e "${PURPLE}Port $PORT Usage:${NC}"
            lsof -i ":$PORT" 2>/dev/null || echo "Port not in use"
            ;;
        staging|prod)
            echo -e "${PURPLE}Node Resources:${NC}"
            kubectl top nodes 2>/dev/null || echo "Node metrics not available"
            
            echo ""
            echo -e "${PURPLE}Pod Resources:${NC}"
            kubectl top pods --namespace="$NAMESPACE" -l app=groovy-visualization 2>/dev/null || echo "Pod metrics not available"
            ;;
    esac
}

# Function to run health check
run_health_check() {
    echo -e "${BLUE}🏥 Groovy Visualization Health Check${NC}"
    echo "======================================"
    echo -e "${PURPLE}Target: $TARGET${NC}"
    echo -e "${PURPLE}Timestamp: $(date)${NC}"
    echo ""
    
    local health_status=0
    
    # Run target-specific health check
    case $TARGET in
        local)
            check_local || health_status=1
            ;;
        docker)
            check_docker || health_status=1
            ;;
        staging|prod)
            check_kubernetes "$TARGET" || health_status=1
            ;;
    esac
    
    # Check dependencies
    check_dependencies
    
    # Show system resources
    show_system_resources
    
    # Summary
    echo ""
    if [ $health_status -eq 0 ]; then
        echo -e "${GREEN}✅ Overall health: HEALTHY${NC}"
    else
        echo -e "${RED}❌ Overall health: UNHEALTHY${NC}"
    fi
    
    return $health_status
}

# Function to run continuous monitoring
run_continuous_monitoring() {
    echo -e "${BLUE}🔄 Starting continuous monitoring...${NC}"
    echo -e "${PURPLE}Interval: ${INTERVAL}s${NC}"
    echo -e "${PURPLE}Press Ctrl+C to stop${NC}"
    echo ""
    
    while true; do
        echo -e "${BLUE}📊 Health Check - $(date)${NC}"
        echo "==============================="
        
        run_health_check
        
        echo ""
        echo -e "${BLUE}⏳ Next check in ${INTERVAL} seconds...${NC}"
        sleep $INTERVAL
    done
}

# Main execution
main() {
    # Check prerequisites based on target
    case $TARGET in
        staging|prod)
            if ! command -v kubectl &> /dev/null; then
                echo -e "${RED}❌ kubectl required for Kubernetes health checks${NC}"
                exit 1
            fi
            ;;
        docker)
            if ! command -v docker &> /dev/null; then
                echo -e "${RED}❌ docker required for Docker health checks${NC}"
                exit 1
            fi
            ;;
    esac
    
    if [ "$CONTINUOUS" = true ]; then
        run_continuous_monitoring
    else
        run_health_check
    fi
}

# Handle interrupt gracefully
trap 'echo -e "\n${YELLOW}🛑 Health monitoring stopped${NC}"; exit 0' INT

# Run main function
main "$@"