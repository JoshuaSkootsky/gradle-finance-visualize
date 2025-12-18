import React, { useMemo, useCallback, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useStockData } from '@/hooks/useStockData';
import { StockData } from '@/types/stock';

interface OptimizedChartProps {
  width: number;
  height: number;
  className?: string;
}

const ITEM_HEIGHT = 40;
const BUFFER_ITEMS = 20;

const OptimizedChart = ({ width, height, className }: OptimizedChartProps) => {
  const { data, isLoading, error } = useStockData();
  const parentRef = useRef<HTMLDivElement>(null);

  // Memoized data processing with performance optimizations
  const processedData = useMemo(() => {
    if (!data || !data.length) return [];

    return data.map((item, index) => ({
      ...item,
      index,
      displayDate: new Date(item.x).toLocaleDateString(),
      displayTime: new Date(item.x).toLocaleTimeString(),
      change: index > 0 && data[index - 1] ? item.c - data[index - 1]!.c : 0,
      changePercent: index > 0 && data[index - 1] ? ((item.c - data[index - 1]!.c) / data[index - 1]!.c) * 100 : 0,
    }));
  }, [data]);

  // Virtual scrolling setup
  const rowVirtualizer = useVirtualizer({
    count: processedData.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ITEM_HEIGHT,
    overscan: BUFFER_ITEMS,
  });

  // Memoized color function
  const getPriceColor = useCallback((current: number, previous: number) => {
    if (current > previous) return '#10b981';
    if (current < previous) return '#ef4444';
    return '#6b7280';
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className={className} style={{ width, height }}>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading financial data...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={className} style={{ width, height }}>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <p className="text-red-600 font-medium">Error loading data</p>
            <p className="text-gray-500 text-sm mt-2">{error.message}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!processedData.length) {
    return (
      <div className={className} style={{ width, height }}>
        <div className="flex items-center justify-center h-full">
          <div className="text-center text-gray-500">
            <div className="text-6xl mb-4">📊</div>
            <p>No data available</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={parentRef} className={className} style={{ width, height, overflow: 'auto' }}>
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualItem) => {
          const item = processedData[virtualItem.index];
          if (!item) return null;

          const previousItem = processedData[virtualItem.index - 1];
          const priceColor = getPriceColor(item.c, previousItem?.c || item.c);
          const changeColor = item.change > 0 ? '#10b981' : item.change < 0 ? '#ef4444' : '#6b7280';

          return (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              className="virtual-row"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <div className="flex items-center px-3" style={{ height: '100%' }}>
                <div className="flex items-center flex-1 min-w-0">
                  <div className="text-sm text-gray-600 min-w-24 mr-4">
                    <div className="font-medium">{item.displayDate}</div>
                    <div className="text-xs text-gray-400">{item.displayTime}</div>
                  </div>
                  
                  <div className="flex items-center space-x-3 flex-1 text-sm">
                    <span className="font-mono font-medium min-w-16 text-right">
                      O: {item.o.toFixed(2)}
                    </span>
                    <span className="font-mono font-medium min-w-16 text-right">
                      H: {item.h.toFixed(2)}
                    </span>
                    <span className="font-mono font-medium min-w-16 text-right">
                      L: {item.l.toFixed(2)}
                    </span>
                    <span 
                      className="font-mono font-bold min-w-16 text-right"
                      style={{ color: priceColor }}
                    >
                      C: {item.c.toFixed(2)}
                    </span>
                    
                    {item.change !== 0 && (
                      <span 
                        className="font-mono font-medium min-w-20 text-right"
                        style={{ color: changeColor }}
                      >
                        {item.change > 0 ? '+' : ''}{item.change.toFixed(2)}
                        <span className="text-xs ml-1">
                          ({item.changePercent.toFixed(2)}%)
                        </span>
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="text-sm text-gray-500 min-w-20 text-right font-mono">
                  {(item.v / 1000000).toFixed(2)}M
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Performance stats for development */}
      {import.meta.env.DEV && (
        <div className="fixed bottom-4 right-4 bg-gray-900 text-white text-xs p-3 rounded-lg shadow-lg">
          <div className="font-mono">
            <div>Total: {processedData.length.toLocaleString()}</div>
            <div>Visible: {rowVirtualizer.getVirtualItems().length}</div>
            <div>Buffer: {BUFFER_ITEMS}</div>
            <div>Height: {ITEM_HEIGHT}px</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(OptimizedChart);