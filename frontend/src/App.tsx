import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useRealTimeStockData, useCombinedStockData } from '@/hooks/useStockData';
import { useChartStore, useChartType, useShowVolume, useSelectedTimeRange } from '@/stores/chartStore';
import { ChartType } from '@/types/stock';
import FinancialChart from '@/components/FinancialChart';
import OptimizedChart from '@/components/OptimizedChart';
import DrawableChart from '@/components/DrawableChart';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
});

const Header = () => {
  const { connectionState, disconnect, connect } = useRealTimeStockData();
  const chartType = useChartType();
  const setChartType = useChartStore(state => state.setChartType);
  const showVolume = useShowVolume();
  const setShowVolume = useChartStore(state => state.setShowVolume);
  const selectedTimeRange = useSelectedTimeRange();
  const setSelectedTimeRange = useChartStore(state => state.setSelectedTimeRange);

  // Network status detection
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const getConnectionStatusColor = () => {
    switch (connectionState) {
      case 'connected': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500 animate-pulse';
      case 'error': return 'bg-orange-500'; // Less alarming than red
      default: return 'bg-gray-500';
    }
  };

  const getConnectionStatusText = () => {
    switch (connectionState) {
      case 'connected': return 'Live Data';
      case 'connecting': return 'Connecting';
      case 'error': return 'Error';
      case 'disconnected': return 'Disconnected';
      default: return 'Unknown';
    }
  };

  const chartTypes: { value: ChartType; label: string; icon: string }[] = [
    { value: 'candlestick', label: 'Candlestick', icon: '📊' },
    { value: 'line', label: 'Line', icon: '📈' },
    { value: 'bar', label: 'Bar', icon: '📊' },
    { value: 'area', label: 'Area', icon: '📉' },
  ];

  const timeRanges = [
    { value: '1D', label: '1 Day' },
    { value: '1W', label: '1 Week' },
    { value: '1M', label: '1 Month' },
    { value: '3M', label: '3 Months' },
    { value: '6M', label: '6 Months' },
    { value: '1Y', label: '1 Year' },
    { value: 'ALL', label: 'All' },
  ];

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              Interactive Financial Charts
            </h1>
            <p className="text-sm text-muted-foreground">
              With advanced drawing tools
            </p>
          </div>
          
          <div className="flex items-center gap-4 text-sm">
            {/* Network status */}
            <div className="flex items-center bg-muted px-2 py-1 rounded-full">
              <div className={`w-2 h-2 rounded-full mr-2 ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-muted-foreground">
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>

            {/* WebSocket status */}
            <div className="flex items-center bg-muted px-2 py-1 rounded-full">
              <div className={`w-2 h-2 rounded-full mr-2 ${getConnectionStatusColor()}`} />
              <span className="text-muted-foreground">
                {getConnectionStatusText()}
              </span>
            </div>

            {(connectionState === 'error' || connectionState === 'disconnected') && isOnline && (
              <button
                onClick={connect}
                className="text-primary hover:text-primary/80 font-medium px-2 py-1 rounded hover:bg-muted transition-colors"
              >
                Reconnect
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-6">
            {/* Chart Mode Indicator */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Mode:</span>
              <span className="px-3 py-1 text-sm bg-primary/10 text-primary rounded-full font-medium">
                🎨 Drawing Canvas
              </span>
            </div>

            {/* Time Range Selector */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Range:</span>
              <select
                value={selectedTimeRange}
                onChange={(e) => setSelectedTimeRange(e.target.value as any)}
                className="border border-input rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background"
              >
                {timeRanges.map((range) => (
                  <option key={range.value} value={range.value}>
                    {range.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Volume Toggle */}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showVolume}
                onChange={(e) => setShowVolume(e.target.checked)}
                className="rounded border-input text-primary focus:ring-ring"
              />
              <span className="text-muted-foreground">Volume</span>
            </label>
          </div>
      </div>
    </header>
  );
};

const ChartContainer = () => {
  const { data, isLoading, error, isConnected, isConnecting } = useCombinedStockData();
  const chartType = useChartType();
  const [chartDimensions, setChartDimensions] = useState({
    width: 800,
    height: 600,
  });
  const [useOptimizedView, setUseOptimizedView] = useState(false);

  // Responsive chart sizing
  useEffect(() => {
    const handleResize = () => {
      const container = document.getElementById('chart-container');
      if (container) {
        setChartDimensions({
          width: container.clientWidth,
          height: container.clientHeight,
        });
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Keep drawing chart as default - only switch to optimized view manually
  // Comment out auto-switch to keep drawing functionality accessible
  // useEffect(() => {
  //   if (data && data.length > 1000) {
  //     setUseOptimizedView(true);
  //   }
  // }, [data]);

  const latestData = data && data.length > 0 ? data[data.length - 1] : null;
  const previousData = data && data.length > 1 ? data[data.length - 2] : null;

  return (
    <main className="flex-1 flex flex-col p-4">
{/* Data Summary */}
        {data && data.length > 0 && latestData && (
          <div className="bg-card rounded-lg shadow-md p-4 mb-4 border border-border">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Latest Price:</span>
                <span className="ml-2 font-medium">
                  ${latestData.c.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Day Change:</span>
                <span 
                  className={`ml-2 font-medium ${
                    previousData && latestData.c > previousData.c 
                      ? 'text-up-trend' 
                      : previousData && latestData.c < previousData.c 
                      ? 'text-down-trend' 
                      : 'text-muted-foreground'
                  }`}
                >
                  {previousData && (
                    <>
                      {latestData.c > previousData.c ? '+' : ''}
                      {(latestData.c - previousData.c).toFixed(2)} (
                      {(((latestData.c - previousData.c) / previousData.c) * 100).toFixed(2)}%
                    </>
                  )}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Day High:</span>
                <span className="ml-2 font-medium text-up-trend">
                  ${Math.max(...data.slice(-1).map(d => d.h)).toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Day Low:</span>
                <span className="ml-2 font-medium text-down-trend">
                  ${Math.min(...data.slice(-1).map(d => d.l)).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}

      {/* Chart View Toggle */}
      {data && data.length > 100 && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-md mb-4 flex items-center justify-between">
          <div className="flex items-center">
            <span className="text-yellow-600 mr-2">📊</span>
            <span>
              Large dataset detected ({data.length.toLocaleString()} points). 
              Performance optimized view is available.
            </span>
          </div>
          <button
            onClick={() => setUseOptimizedView(!useOptimizedView)}
            className="bg-yellow-200 hover:bg-yellow-300 text-yellow-800 px-3 py-1 rounded text-sm font-medium transition-colors"
          >
            {useOptimizedView ? 'Show Chart' : 'Show Optimized'}
          </button>
        </div>
      )}

       {/* Drawing Instructions */}
       <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-md mb-4">
         <div className="flex items-center">
           <div className="text-blue-600 mr-2">🎨</div>
           <div>
             <strong>Drawing Tools Available:</strong> Click and drag to draw trendlines. Double-tap for Fibonacci levels.
             <span className="block text-sm mt-1">Mobile: Use 2 fingers for drawing (prevents scroll conflicts)</span>
           </div>
         </div>
       </div>

       {/* Chart Container */}
       <div className="flex-1 bg-white rounded-lg shadow-md p-4">
         <div
           id="chart-container"
           className="w-full h-full"
           style={{ minHeight: '500px' }}
         >
          {useOptimizedView ? (
            <OptimizedChart
              width={chartDimensions.width - 32}
              height={chartDimensions.height - 32}
              className="w-full h-full"
            />
          ) : (
            <DrawableChart
              width={chartDimensions.width - 32}
              height={chartDimensions.height - 32}
              className="w-full h-full"
            />
          )}
        </div>
      </div>
    </main>
  );
};

const AppContent = () => (
  <div className="min-h-screen bg-gray-50 flex flex-col">
    <Header />
    <ChartContainer />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AppContent />
    <ReactQueryDevtools initialIsOpen={false} />
  </QueryClientProvider>
);

export default App;