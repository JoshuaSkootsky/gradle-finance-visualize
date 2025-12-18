# Groovy Visualization Project

A web server that provides stock price data with visualization using Chart.js. Built with Groovy, deployed with Gradle, and supporting Kubernetes.

## 🚀 Quick Start

### One-Command Setup
```bash
./setup.sh && ./dev.sh
```

This will:
1. Initialize your environment
2. Configure API key (optional)
3. Build the project
4. Start the development server

The application will be available at `http://localhost:8080`

## 📋 Prerequisites

- **Java 21+** (for local development)
- **Docker & Docker Compose** (for containerized deployment)
- **kubectl** (for Kubernetes deployment)
- **Optional**: Redis for caching, Traefik for advanced routing

## ⚙️ Configuration

### Environment Variables
```bash
cp .env.example .env
```

Edit `.env` with your settings:
```bash
ALPHAVANTAGE_API_KEY=your_actual_api_key_here  # Get from https://www.alphavantage.co/support/#api-key
```

## 🛠️ Development

### Local Development
```bash
# Start development server with defaults
./dev.sh

# With custom port and debug logging
./dev.sh -p 3000 -l DEBUG

# With hot reload (experimental)
./dev.sh -r
```

### Docker Development
```bash
# Build and run with Docker Compose
docker-compose up groovy-visualization

# Development mode with hot reload
docker-compose --profile dev up groovy-visualization-dev

# Full stack with monitoring
docker-compose --profile advanced --profile monitoring up
```

### Health Monitoring
```bash
# Check local application health
./health.sh local

# Continuous monitoring
./health.sh local -c -i 30

# Check Docker containers
./health.sh docker

# Check Kubernetes deployments
./health.sh staging
./health.sh prod
```

## 🐳 Container Deployment

### Build Docker Image
```bash
# Build with defaults
./dockerize.sh

# Build with custom tag and push
./dockerize.sh -t v1.0.0 -r myregistry -p

# Multi-architecture build
./dockerize.sh -t v1.0.0 -m -p
```

### Run Container
```bash
# Simple container
docker run -p 8080:8080 groovy-visualization:latest

# With environment variables
docker run -p 8080:8080 \
  -e ALPHAVANTAGE_API_KEY=your_key \
  groovy-visualization:latest
```

## ☸️ Kubernetes Deployment

### Multi-Environment Support
The project supports staging and production environments using Kustomize:

```bash
# Deploy to staging
./deploy.sh staging

# Deploy to production with specific tag
./deploy.sh prod -t v1.0.0 -w

# Dry run to preview changes
./deploy.sh staging -d
```

### Kubernetes Architecture
- **Base**: Common resources and configurations
- **Overlays**: Environment-specific customizations
  - **Staging**: Single replica, debug logging, minimal resources
  - **Production**: Three replicas, optimized resources, Ingress support

### Manual Kubernetes Deployment
```bash
# Apply namespaces
kubectl apply -f k8s/namespaces.yaml

# Deploy to staging
kubectl apply -k k8s/overlays/staging

# Deploy to production
kubectl apply -k k8s/overlays/prod
```

## 📁 Project Structure

```
groovy-visualization/
├── 📄 Orchestration Scripts
│   ├── setup.sh              # Environment initialization
│   ├── dev.sh                # Development server
│   ├── dockerize.sh          # Docker build automation
│   ├── deploy.sh             # Kubernetes deployment
│   └── health.sh             # Health monitoring
├── 📦 Container & Kubernetes
│   ├── docker-compose.yml    # Docker Compose configurations
│   ├── Dockerfile            # Production Docker build
│   ├── Dockerfile.dev        # Development Docker build
│   └── k8s/                  # Kubernetes manifests
│       ├── base/             # Base Kustomize configuration
│       ├── overlays/         # Environment-specific configs
│       └── namespaces.yaml   # Namespace definitions
├── 🏗️ Application
│   ├── src/main/groovy/
│   │   └── FinancialServer.groovy    # Main server application
│   ├── public/
│   │   ├── index.html                # Frontend with Chart.js
│   │   └── chart.js                  # Chart library
│   └── build.gradle                  # Gradle build configuration
├── ⚙️ Configuration
│   ├── .env.example                  # Environment variables template
│   ├── config/                       # Service configurations
│   └── gradlew                       # Gradle wrapper
└── 📊 Optional Monitoring
    ├── config/prometheus.yml         # Prometheus configuration
    └── config/grafana/               # Grafana dashboards
```

## 🏗️ Architecture

### Backend
- **Runtime**: Java 21 JRE (Groovy compiled to bytecode)
- **Server**: Built-in Java HTTP server (`com.sun.net.httpserver`)
- **Dependencies**: Minimal runtime dependencies for portability

### Frontend
- **Framework**: Vanilla HTML5 + JavaScript
- **Charts**: Chart.js for data visualization
- **API Integration**: Fetches stock data from backend

### API Endpoints
- `GET /` - Serve frontend application
- `GET /api/stock-prices` - JSON stock price data
- Health checks integrated for monitoring

### Data Flow
1. **Alpha Vantage API** → Backend → Frontend → Chart.js Visualization
2. **Fallback**: Sample data when API unavailable
3. **Caching**: Redis integration (optional for future enhancements)

## 🔧 Advanced Features

### Environment Configurations
- **Development**: Debug logging, hot reload, minimal resources
- **Staging**: Single replica, moderate resources, verbose logging
- **Production**: Multiple replicas, optimized resources, security hardening

### Monitoring Stack (Optional)
```bash
# Enable full monitoring stack
docker-compose --profile monitoring up
```
- **Prometheus**: Metrics collection at `http://localhost:9090`
- **Grafana**: Dashboards at `http://localhost:3000` (admin/admin123)
- **Traefik**: Advanced routing at `http://localhost:8081`

### Security Features
- **Non-root containers**: All containers run as non-root users
- **Read-only filesystem**: Production containers use read-only mounts
- **Health checks**: Comprehensive liveness and readiness probes
- **Resource limits**: CPU and memory constraints enforced

## 🚀 Runtime Dependencies

The project is designed for maximum portability:
- **Compilation**: Groovy 4.0.24 (compile-time only)
- **Runtime**: Java 21 JRE (production requirement)
- **No external runtime**: Self-contained JAR with all dependencies

## 🔍 Troubleshooting

### Common Issues

**Server won't start:**
```bash
# Check Java installation
java -version

# Check environment
./setup.sh
```

**API key issues:**
```bash
# Verify .env file
cat .env

# Test API key
curl "https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=IBM&apikey=$(grep ALPHAVANTAGE_API_KEY .env | cut -d= -f2)"
```

**Container issues:**
```bash
# Check container health
./health.sh docker -v

# View logs
docker logs groovy-visualization-app
```

**Kubernetes issues:**
```bash
# Check deployment status
./health.sh staging -v

# View pod logs
kubectl logs -f deployment/groovy-visualization --namespace=staging
```

## 📚 Documentation

- **API Documentation**: Check `/api/stock-prices` endpoint for response format
- **Configuration**: See `.env.example` for all available environment variables
- **Kubernetes**: Review `k8s/` directory for deployment manifests
- **Monitoring**: Check `config/` for Prometheus and Grafana configurations

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `./gradlew test`
5. Deploy locally: `./dev.sh`
6. Submit a pull request

## 📄 License

This project is open source. See LICENSE file for details.

## 🙏 Acknowledgments

- **Alpha Vantage**: For providing free stock market API
- **Chart.js**: For excellent data visualization library
- **Groovy**: For the powerful JVM language
- **Gradle**: For robust build automation