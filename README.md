# Groovy Visualization Project

A web server that provides stock price data with visualization using Chart.js.

## Setup

This project uses Gradle wrapper to build and run. No external Groovy installation required - only Java is needed.

### Prerequisites

- Java 21 (or compatible Java version)
- Gradle wrapper included (automatically downloads Gradle 8.11.1)

### Configuration

Copy the environment variables template:
```bash
cp .env.example .env
```

Edit `.env` and add your Alpha Vantage API key:
```
ALPHAVANTAGE_API_KEY=your_actual_api_key_here
```

## Running the Application

Start the server:
```bash
./gradlew run
```

The server will start at `http://localhost:8080`

### Alternative Commands

- Build the project: `./gradlew build`
- Create distributable packages: `./gradlew assemble`
- Run tests: `./gradlew test`


### Testing

🚀 How to Run Tests
# Run all tests
./test.sh
# Or run separately
./gradlew test                    # Backend only
cd frontend && bun test            # Frontend only



## Project Structure

```
groovy-visualization/
├── src/main/groovy/
│   └── FinancialServer.groovy    # Main server application
├── public/
│   ├── index.html                # Frontend with Chart.js visualization
│   └── chart.js                  # Chart library
├── build.gradle                  # Gradle build configuration
├── .env.example                  # Environment variables template
└── gradlew                       # Gradle wrapper script
```

## Architecture

- **Backend**: Groovy HTTP server using Java's built-in `com.sun.net.httpserver`
- **Frontend**: HTML5 with Chart.js for data visualization
- **API**: REST endpoint `/api/stock-prices` returning JSON data
- **Data Source**: Alpha Vantage API with fallback to sample data

## Runtime Dependencies

The project is configured to compile with Groovy but run with only Java runtime dependencies, making it portable without requiring Groovy installation on target systems.