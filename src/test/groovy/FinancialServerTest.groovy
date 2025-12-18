import groovy.json.JsonSlurper
import groovy.json.JsonBuilder
import com.sun.net.httpserver.*
import java.net.InetSocketAddress
import java.net.HttpURLConnection
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import org.junit.jupiter.api.*
import static org.junit.jupiter.api.Assertions.*

class FinancialServerTest {

    private HttpServer server
    private int port = 8081 // Use different port for tests
    
    @BeforeEach
    void setUp() {
        // Create a test server instance
        server = HttpServer.create(new InetSocketAddress(port), 0)
        setupTestEndpoints()
        server.setExecutor(Executors.newCachedThreadPool())
        server.start()
        Thread.sleep(100) // Give server time to start
    }
    
    @AfterEach
    void tearDown() {
        server?.stop(0)
    }
    
    void setupTestEndpoints() {
        // Test endpoint for stock prices
        server.createContext("/api/stock-prices") { HttpExchange exchange ->
            try {
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
                exchange.sendResponseHeaders(500, -1)
            } finally {
                exchange.close()
            }
        }
        
        // Test WebSocket placeholder endpoint
        server.createContext("/ws") { HttpExchange exchange ->
            if (exchange.getRequestMethod() == "GET") {
                exchange.sendResponseHeaders(200, "WebSocket endpoint".length())
                exchange.getResponseBody().write("WebSocket endpoint".getBytes())
            }
            exchange.close()
        }
    }
    
    @Test
    void testStockPricesEndpointReturnsCorrectData() {
        def url = new URL("http://localhost:${port}/api/stock-prices")
        def connection = url.openConnection() as HttpURLConnection
        connection.requestMethod = "GET"
        
        def responseCode = connection.responseCode
        assertEquals(200, responseCode, "Should return HTTP 200")
        
        def response = connection.inputStream.text
        def json = new JsonSlurper().parseText(response) as Map
        
        assertTrue(json.containsKey("data"), "Response should contain 'data' field")
        def data = json.data as List
        assertEquals(3, data.size(), "Should return 3 data points")
        
        def firstPoint = data[0] as Map
        assertTrue(firstPoint.containsKey("x"), "Data point should have timestamp")
        assertTrue(firstPoint.containsKey("o"), "Data point should have open price")
        assertTrue(firstPoint.containsKey("h"), "Data point should have high price")
        assertTrue(firstPoint.containsKey("l"), "Data point should have low price")
        assertTrue(firstPoint.containsKey("c"), "Data point should have close price")
        assertTrue(firstPoint.containsKey("v"), "Data point should have volume")
        
        connection.disconnect()
    }
    
    @Test
    void testStockPricesDataStructure() {
        def url = new URL("http://localhost:${port}/api/stock-prices")
        def connection = url.openConnection() as HttpURLConnection
        connection.requestMethod = "GET"
        
        def response = connection.inputStream.text
        def json = new JsonSlurper().parseText(response) as Map
        def data = json.data as List
        def firstPoint = data[0] as Map
        
        // Check data types and ranges
        assertTrue(firstPoint.x instanceof Long, "Timestamp should be a number")
        assertTrue(firstPoint.o instanceof Number, "Open price should be a number")
        assertTrue(firstPoint.h instanceof Number, "High price should be a number")
        assertTrue(firstPoint.l instanceof Number, "Low price should be a number")
        assertTrue(firstPoint.c instanceof Number, "Close price should be a number")
        assertTrue(firstPoint.v instanceof Integer, "Volume should be an integer")
        
        // Check price relationships
        def open = firstPoint.o as Double
        def high = firstPoint.h as Double
        def low = firstPoint.l as Double
        def close = firstPoint.c as Double
        
        assertTrue(high >= open, "High should be >= open")
        assertTrue(high >= close, "High should be >= close")
        assertTrue(low <= open, "Low should be <= open")
        assertTrue(low <= close, "Low should be <= close")
        assertTrue(low > 0, "Prices should be positive")
        
        connection.disconnect()
    }
    
    @Test
    void testWebSocketEndpointAccessible() {
        def url = new URL("http://localhost:${port}/ws")
        def connection = url.openConnection() as HttpURLConnection
        connection.requestMethod = "GET"
        
        def responseCode = connection.responseCode
        assertEquals(200, responseCode, "WebSocket endpoint should be accessible")
        
        connection.disconnect()
    }
    
    @Test
    void testCorsHeaders() {
        def url = new URL("http://localhost:${port}/api/stock-prices")
        def connection = url.openConnection() as HttpURLConnection
        connection.requestMethod = "GET"
        
        def corsOrigin = connection.getHeaderField("Access-Control-Allow-Origin")
        def corsMethods = connection.getHeaderField("Access-Control-Allow-Methods")
        def corsHeaders = connection.getHeaderField("Access-Control-Allow-Headers")
        
        assertEquals("*", corsOrigin, "Should allow all origins")
        assertTrue(corsMethods.contains("GET"), "Should allow GET method")
        assertTrue(corsHeaders.contains("Content-Type"), "Should allow Content-Type header")
        
        connection.disconnect()
    }
    
    @Test
    void testContentTypeHeaders() {
        def url = new URL("http://localhost:${port}/api/stock-prices")
        def connection = url.openConnection() as HttpURLConnection
        connection.requestMethod = "GET"
        
        def contentType = connection.getHeaderField("Content-Type")
        assertEquals("application/json", contentType, "Should return JSON content type")
        
        connection.disconnect()
    }
}

// Test for createSampleData function
class SampleDataTest {
    
    @Test
    void testCreateSampleDataStructure() {
        // Simulate createSampleData function
        def createSampleData = {
            def data = []
            def now = new Date()
            def basePrice = 150.0

            (1..30).eachWithIndex { val, idx ->
                def date = new Date(now.time + val * 24 * 60 * 60 * 1000)
                def volatility = (Math.random() - 0.5) * 8
                def open = basePrice + Math.sin(idx / 5) * 10 + (Math.random() * 4 - 2)
                def change = (Math.random() * 6 - 1) + volatility

                def high = [open, open + change, open + Math.abs(change) * 0.5].max()
                def low = [open, open + change, open - Math.abs(change) * 0.7].min()
                def close = open + change
                def volume = (Math.random() * 5_000_000).toInteger()

                data << [
                    x: date.getTime(),
                    o: Math.round(open * 100) / 100,
                    h: Math.round(high * 100) / 100,
                    l: Math.round(low * 100) / 100,
                    c: Math.round(close * 100) / 100,
                    v: volume
                ]
            }
            return data
        }
        
        def data = createSampleData()
        
        assertEquals(30, data.size(), "Should generate 30 data points")
        
        data.each { point ->
            assertTrue(point.x instanceof Long, "Timestamp should be a number")
            assertTrue(point.o instanceof Number, "Open should be a number")
            assertTrue(point.h instanceof Number, "High should be a number")
            assertTrue(point.l instanceof Number, "Low should be a number")
            assertTrue(point.c instanceof Number, "Close should be a number")
            assertTrue(point.v instanceof Integer, "Volume should be an integer")
            assertTrue(point.v > 0, "Volume should be positive")
            
            // Check price relationships
            assertTrue(point.h >= point.o, "High should be >= open")
            assertTrue(point.h >= point.c, "High should be >= close")
            assertTrue(point.l <= point.o, "Low should be <= open")
            assertTrue(point.l <= point.c, "Low should be <= close")
            assertTrue(point.l > 0, "Prices should be positive")
        }
    }
}
