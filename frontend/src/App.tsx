import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useRealTimeStockData, useCombinedStockData } from '@/hooks/useStockData';
import { useChartStore, useChartType, useShowVolume, useSelectedTimeRange } from '@/stores/chartStore';
import { ChartType } from '@/types/stock';
import FinancialChart from '@/components/FinancialChart';
import OptimizedChart from '@/components/OptimizedChart';

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

  const getConnectionStatusColor = () => {
    switch (connectionState) {
      case 'connected': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getConnectionStatusText = () => {
    switch (connectionState) {
      case 'connected': return 'Connected';
      case 'connecting': return 'Connecting...';
      case 'error': return 'Connection Error';
      default: return 'Disconnected';
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
          <div className="flex items-center">
            <h1 className="text-xl font-semibold text-gray-900">
              Real-time Financial Charts
            </h1>
            <div className="ml-4 flex items-center">
              <div className={`w-2 h-2 rounded-full mr-2 ${getConnectionStatusColor()}`} />
              <span className="text-sm text-gray-600">
                {getConnectionStatusText()}
              </span>
              {connectionState === 'error' && (
                <button
                  onClick={connect}
                  className="ml-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  Retry
                </button>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Chart Type Selector */}
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Type:</span>
              <select
                value={chartType}
                onChange={(e) => setChartType(e.target.value as ChartType)}
                className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {chartTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.icon} {type.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Time Range Selector */}
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Range:</span>
              <select
                value={selectedTimeRange}
                onChange={(e) => setSelectedTimeRange(e.target.value as any)}
                className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {timeRanges.map((range) => (
                  <option key={range.value} value={range.value}>
                    {range.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Volume Toggle */}
            <label className="flex items-center space-x-2 text-sm">
              <input
                type="checkbox"
                checked={showVolume}
                onChange={(e) => setShowVolume(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-gray-600">Volume</span>
            </label>
          </div>
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

  // Auto-switch to optimized view for large datasets
  useEffect(() => {
    if (data && data.length > 1000) {
      setUseOptimizedView(true);
    }
  }, [data]);

  const latestData = data && data.length > 0 ? data[data.length - 1] : null;
  const previousData = data && data.length > 1 ? data[data.length - 2] : null;

  return (
    <main className="flex-1 flex flex-col p-4">
      {/* Data Summary */}
      {data && data.length > 0 && latestData && (
        <div className="bg-white rounded-lg shadow-md p-4 mb-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Latest Price:</span>
              <span className="ml-2 font-medium">
                ${latestData.c.toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Day Change:</span>
              <span 
                className={`ml-2 font-medium ${
                  previousData && latestData.c > previousData.c 
                    ? 'text-green-600' 
                    : previousData && latestData.c < previousData.c 
                    ? 'text-red-600' 
                    : 'text-gray-600'
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
              <span className="text-gray-600">Day High:</span>
              <span className="ml-2 font-medium text-green-600">
                ${Math.max(...data.slice(-1).map(d => d.h)).toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Day Low:</span>
              <span className="ml-2 font-medium text-red-600">
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
            <FinancialChart
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