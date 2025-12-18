import com.sun.net.httpserver.*
import groovy.json.JsonBuilder
import java.net.InetSocketAddress
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit

// Load .env file
def envFile = new File(".env")
if (envFile.exists()) {
    envFile.eachLine { line ->
        if (line.contains("=")) {
            def (key, value) = line.split("=", 2)
            System.setProperty(key.trim(), value.trim())
            System.setProperty("env.${key.trim()}", value.trim()) // for getenv compat
            System.env.metaClass.getProperty = { name -> System.getProperty("env.\$name") ?: System.getenv(name) }
        }
    }
}

// createSampleData as a fallback
def createSampleData() {
    def data = []
    def now = new Date()
    def basePrice = 150.0

    (1..30).eachWithIndex { i ->
        def date = new Date(now.time + i * 24 * 60 * 60 * 1000)
        def volatility = (Math.random() - 0.5) * 8
        def open = basePrice + Math.sin(i / 5) * 10 + (Math.random() * 4 - 2)
        def change = (Math.random() * 6 - 1) + volatility

        def high = [open, open + change, open + Math.abs(change) * 0.5].max()
        def low = [open, open + change, open - Math.abs(change) * 0.7].min()
        def close = open + change
        def volume = (Math.random() * 5_000_000).toInteger()

        data << [
            x: date.getTime(), // Unix timestamp in ms
            o: Math.round(open * 100) / 100,
            h: Math.round(high * 100) / 100,
            l: Math.round(low * 100) / 100,
            c: Math.round(close * 100) / 100,
            v: volume
        ]
    }

    return data
}

// Create REST endpoint
HttpServer server = HttpServer.create(new InetSocketAddress(8080), 0)

// WebSocket connections storage
def webSocketConnections = new ConcurrentHashMap<WebSocket, String>()

// Scheduled executor for real-time data streaming
def scheduler = Executors.newScheduledThreadPool(1)


// api/stock-prices - simplified for testing
server.createContext("/api/stock-prices") { HttpExchange exchange ->
    try {
        // Simple test data
        def testData = [
            [x: 1640995200000, o: 150.0, h: 155.0, l: 145.0, c: 152.0, v: 1000000],
            [x: 1641081600000, o: 152.0, h: 158.0, l: 150.0, c: 157.0, v: 1200000],
            [x: 1641168000000, o: 157.0, h: 160.0, l: 155.0, c: 158.0, v: 900000]
        ]
        
        def responseJson = new JsonBuilder([data: testData]).toString()
        def bytes = responseJson.getBytes("UTF-8")

        exchange.getResponseHeaders().set("Content-Type", "application/json")
        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*")
        exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type")
        exchange.sendResponseHeaders(200, bytes.length)
        exchange.getResponseBody().write(bytes)
        exchange.getResponseBody().flush()
    } catch (Exception e) {
        println "API Error: ${e.message}"
        e.printStackTrace()
        exchange.sendResponseHeaders(500, -1)
    } finally {
        exchange.close()
    }
}

// WebSocket endpoint - simplified for testing
server.createContext("/ws") { HttpExchange exchange ->
    if (exchange.getRequestMethod() == "GET") {
        exchange.sendResponseHeaders(200, "WebSocket endpoint - not implemented yet".length())
        exchange.getResponseBody().write("WebSocket endpoint - not implemented yet".getBytes())
    }
    exchange.close()
}

// Start real-time data streaming
scheduler.scheduleAtFixedRate({
    if (!webSocketConnections.isEmpty()) {
        def currentData = fetchRealStockData()
        def message = new JsonBuilder([type: "update", data: currentData.takeLast(1)]).toString()
        
        webSocketConnections.keySet().each { ws ->
            try {
                ws.send(message)
            } catch (Exception e) {
                println "Error sending to WebSocket: ${e.message}"
            }
        }
    }
}, 0, 5, TimeUnit.SECONDS) // Send updates every 5 seconds

// Serve frontend (HTML/JS/CSS)
server.createContext("/") { HttpExchange exchange ->
    def path = exchange.getRequestURI().getPath()
    def fileName = path == "/" ? "index.html" : path.substring(1)

    def file = new File("public", fileName)
    if (file.exists()) {
        def contentType = fileName.endsWith(".js") ? "application/javascript" :
                         fileName.endsWith(".css") ? "text/css" : 
                         fileName.endsWith(".ico") ? "image/x-icon" : "text/html"
        exchange.getResponseHeaders().set("Content-Type", contentType)
        def bytes = file.bytes
        exchange.sendResponseHeaders(200, bytes.length)
        exchange.getResponseBody().write(bytes)
    } else {
        exchange.sendResponseHeaders(404, 0)
    }
    exchange.close()
}

// Simple WebSocket wrapper class
class WebSocket {
    def outputStream
    def inputStream
    def closed = false

    WebSocket(outputStream, inputStream) {
        this.outputStream = outputStream
        this.inputStream = inputStream
    }

    void send(String message) {
        if (!closed && outputStream) {
            try {
                def bytes = message.getBytes("UTF-8")
                def frame = new byte[bytes.length + 2]
                frame[0] = (byte) 0x81 // FIN=1, opcode=1 (text)
                frame[1] = (byte) bytes.length
                System.arraycopy(bytes, 0, frame, 2, bytes.length)
                outputStream.write(frame)
                outputStream.flush()
            } catch (Exception e) {
                closed = true
                throw e
            }
        }
    }

    boolean isClosed() {
        return closed
    }
}

// fetchRealStockData Fetch real AAPL data with fallback
def fetchRealStockData() {
    def apiKey = System.getenv("ALPHAVANTAGE_API_KEY")
    
    if (!apiKey) {
        println "No Alpha Vantage API key found, using sample data"
        return createSampleData()
    }

    def symbol = "AAPL"
    def url = "https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${apiKey}&outputsize=compact"

    try {
        def json = new groovy.json.JsonSlurper().parse(new URL(url).newReader())

        // Check for error message
        if (json.containsKey("Error Message")) {
            throw new Exception("Alpha Vantage Error: ${json.'Error Message'}")
        }
        if (json?.Note) {
            throw new Exception("Alpha Vantage Throttle: ${json.Note}")
        }

        def timeSeries = json?.'Time Series (Daily)'
        if (!timeSeries) {
            throw new Exception("No data returned – check API key or symbol")
        }

        def dataList = []
        timeSeries.entrySet().sort { e1, e2 -> e2.key <=> e1.key } // Desc → Asc
        timeSeries.each { dateStr, quote ->
            def date = Date.parse("yyyy-MM-dd", dateStr)
            def open = quote['1. open'] as Double
            def high = quote['2. high'] as Double
            def low = quote['3. low'] as Double
            def close = quote['4. close'] as Double
            def volume = quote['5. volume'] as Integer

            dataList << [
                x: date.time,
                o: Math.round(open * 100) / 100,
                h: Math.round(high * 100) / 100,
                l: Math.round(low * 100) / 100,
                c: Math.round(close * 100) / 100,
                v: volume
            ]
        }

        return dataList.take(30) // Last 30 trading days
    } catch (Exception e) {
        println "Failed to fetch real data: ${e.message}, using sample data"
        e.printStackTrace()
        return createSampleData() // Fallback to simulation on failure
    }
}

server.setExecutor(Executors.newCachedThreadPool()) // Use thread pool
println "Server started at http://localhost:8080"
println "WebSocket endpoint available at ws://localhost:8080/ws"
server.start()
