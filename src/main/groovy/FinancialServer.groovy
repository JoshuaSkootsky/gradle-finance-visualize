import com.sun.net.httpserver.*
import groovy.json.JsonBuilder
import java.net.InetSocketAddress

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
    def now = new Date().clearTime()
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


// api/stock-prices
server.createContext("/api/stock-prices") { HttpExchange exchange ->
    def data = fetchRealStockData() // Uses real data + fallback
    def responseJson = new JsonBuilder([data: data]).toString()
    def bytes = responseJson.getBytes("UTF-8")

    exchange.getResponseHeaders().set("Content-Type", "application/json")
    exchange.sendResponseHeaders(200, bytes.length)
    exchange.getResponseBody().write(bytes)
    exchange.close()
}

// Serve frontend (HTML/JS/CSS)
server.createContext("/") { HttpExchange exchange ->
    def path = exchange.getRequestURI().getPath()
    def fileName = path == "/" ? "index.html" : path.substring(1)

    def file = new File("public", fileName)
    if (file.exists()) {
        def contentType = fileName.endsWith(".js") ? "application/javascript" :
                         fileName.endsWith(".css") ? "text/css" : "text/html"

        exchange.getResponseHeaders().set("Content-Type", contentType)
        def bytes = file.bytes
        exchange.sendResponseHeaders(200, bytes.length)
        exchange.getResponseBody().write(bytes)
    } else {
        exchange.sendResponseHeaders(404, 0)
    }
    exchange.close()
}

// fetchFromAlphaVantage Fetch real AAPL data
def fetchFromAlphaVantage() {

    def apiKey = System.getenv("ALPHAVANTAGE_API_KEY")

    def symbol = "AAPL"
    
    def url = "https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${apiKey}&outputsize=compact"
    // Parse and format like sample data

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
        e.printStackTrace()
        return createSampleData() // Fallback to simulation on failure
    }
}

server.setExecutor(null) // Use default executor
println "Server started at http://localhost:8080"
server.start()
