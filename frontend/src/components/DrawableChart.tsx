import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';
import annotationPlugin from 'chartjs-plugin-annotation';
import Hammer from 'hammerjs';
import { useCombinedStockData } from '@/hooks/useStockData';
import { useChartUrl } from '@/hooks/useChartUrl';
import type { StockData } from '@/types/stock';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  annotationPlugin
);

interface DrawingAnnotation {
  id: string;
  type: 'trendline' | 'fibonacci';
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  fibLevels?: number[];
}

interface DrawableChartProps {
  width?: number;
  height?: number;
  className?: string;
}

const DrawableChart = ({ width, height, className }: DrawableChartProps) => {
  const { data, isLoading, error } = useCombinedStockData();
  const chartRef = useRef<any>(null);
  const hammerRef = useRef<HammerManager | null>(null);

  const [annotations, setAnnotations] = useState<DrawingAnnotation[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentDrawing, setCurrentDrawing] = useState<DrawingAnnotation | null>(null);

  // URL sharing functionality
  const { sharedState, shareChart } = useChartUrl(annotations, 'AAPL', '1D');

  // Load shared state on mount
  useEffect(() => {
    if (sharedState?.annotations) {
      setAnnotations(sharedState.annotations);
    }
  }, [sharedState]);

  // Process data for Chart.js
  const chartData = React.useMemo(() => {
    if (!data) return { datasets: [] };

    const processedData = data.slice(-100).map((item: StockData) => ({
      x: item.x, // Timestamp
      y: item.c, // Close price for line chart
      o: item.o, // Open
      h: item.h, // High
      l: item.l, // Low
      v: item.v, // Volume
    }));

    return {
      datasets: [
        {
          label: 'Price',
          data: processedData,
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 2,
          fill: false,
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0,
        },
      ],
    };
  }, [data]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        enabled: true,
        callbacks: {
          label: (context: any) => {
            const data = context.raw;
            return [
              `Open: ${data.o?.toFixed(2) || 'N/A'}`,
              `High: ${data.h?.toFixed(2) || 'N/A'}`,
              `Low: ${data.l?.toFixed(2) || 'N/A'}`,
              `Close: ${data.c?.toFixed(2) || 'N/A'}`,
              `Volume: ${data.v?.toLocaleString() || 'N/A'}`,
            ];
          },
        },
      },
      annotation: {
        annotations: [
          ...annotations,
          ...(currentDrawing ? [currentDrawing] : [])
        ].reduce((acc, annotation) => {
          if (annotation.type === 'trendline') {
            acc[`trendline-${annotation.id}`] = {
              type: 'line',
              xMin: annotation.startX,
              xMax: annotation.endX,
              yMin: annotation.startY,
              yMax: annotation.endY,
              borderColor: isDrawing && annotation.id === currentDrawing?.id
                ? 'rgba(59, 130, 246, 0.8)' // Blue for live drawing
                : 'rgba(239, 68, 68, 0.8)', // Red for finished lines
              borderWidth: 2,
              borderDash: [5, 5],
            };
          } else if (annotation.type === 'fibonacci' && annotation.fibLevels) {
            annotation.fibLevels.forEach((level, index) => {
              const colors = [
                'rgba(34, 197, 94, 0.3)', // Green 0%
                'rgba(251, 191, 36, 0.3)', // Yellow 38.2%
                'rgba(239, 68, 68, 0.3)',  // Red 61.8%
                'rgba(34, 197, 94, 0.3)', // Green 100%
              ];
              acc[`fib-${annotation.id}-${index}`] = {
                type: 'box',
                xMin: annotation.startX,
                xMax: annotation.endX,
                yMin: level,
                yMax: level,
                backgroundColor: colors[index % colors.length],
                borderWidth: 0,
              };
            });
          }
          return acc;
        }, {} as any),
      },
    },
    scales: {
      x: {
        type: 'time' as const,
        time: {
          unit: 'day' as const,
          displayFormats: {
            day: 'MMM dd',
          },
        },
        grid: {
          display: false,
        },
      },
      y: {
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
        ticks: {
          callback: (value: any) => `$${value}`,
        },
      },
    },
  };

  // Touch drawing logic
  useEffect(() => {
    if (!chartRef.current) return;

    const chart = chartRef.current;
    const canvas = chart.canvas;

    // Initialize Hammer.js for touch gestures
    hammerRef.current = new Hammer(canvas);

    // Configure for mobile-friendly gestures
    if (window.innerWidth < 768) {
      // Mobile: require two fingers for drawing to avoid conflicts with scrolling
      hammerRef.current.get('pan').set({ pointers: 2 });
    }

    let drawingStart: { x: number; y: number } | null = null;
    let currentAnnotation: DrawingAnnotation | null = null;

    // Pan start - begin drawing
    hammerRef.current.on('panstart', (event: HammerInput) => {
      if (!chart || isDrawing) return;

      const rect = canvas.getBoundingClientRect();
      const x = event.center.x - rect.left;
      const y = event.center.y - rect.top;

      // Get data coordinates
      const dataX = chart.scales.x.getValueForPixel(x);
      const dataY = chart.scales.y.getValueForPixel(y);

      if (dataX !== undefined && dataY !== undefined) {
        drawingStart = { x: dataX, y: dataY };
        setIsDrawing(true);

        // Create trendline annotation
        currentAnnotation = {
          id: `annotation-${Date.now()}`,
          type: 'trendline',
          startX: dataX,
          startY: dataY,
          endX: dataX,
          endY: dataY,
        };

        setCurrentDrawing(currentAnnotation);
      }
    });

    // Pan move - update drawing
    hammerRef.current.on('panmove', (event: HammerInput) => {
      if (!drawingStart || !currentAnnotation || !chart) return;

      const rect = canvas.getBoundingClientRect();
      const x = event.center.x - rect.left;
      const y = event.center.y - rect.top;

      // Get data coordinates
      const dataX = chart.scales.x.getValueForPixel(x);
      const dataY = chart.scales.y.getValueForPixel(y);

      if (dataX !== undefined && dataY !== undefined) {
        currentAnnotation.endX = dataX;
        currentAnnotation.endY = dataY;
        setCurrentDrawing({ ...currentAnnotation });
      }
    });

    // Pan end - finish drawing
    hammerRef.current.on('panend', () => {
      if (currentAnnotation && drawingStart) {
        // Snap to nearest data point for cleaner trendlines
        const nearestStart = findNearestDataPoint(currentAnnotation.startX, currentAnnotation.startY, data);
        const nearestEnd = findNearestDataPoint(currentAnnotation.endX, currentAnnotation.endY, data);

        if (nearestStart && nearestEnd) {
          const finalAnnotation: DrawingAnnotation = {
            ...currentAnnotation,
            startX: nearestStart.x,
            startY: nearestStart.c, // Use close price
            endX: nearestEnd.x,
            endY: nearestEnd.c, // Use close price
          };
          setAnnotations(prev => [...prev, finalAnnotation]);
        }
      }

      setIsDrawing(false);
      setCurrentDrawing(null);
      drawingStart = null;
      currentAnnotation = null;
    });

    // Double tap for Fibonacci levels
    hammerRef.current.on('doubletap', (event: HammerInput) => {
      if (!chart) return;

      const rect = canvas.getBoundingClientRect();
      const x = event.center.x - rect.left;
      const y = event.center.y - rect.top;

      const dataX = chart.scales.x.getValueForPixel(x);
      const dataY = chart.scales.y.getValueForPixel(y);

      if (dataX !== undefined && dataY !== undefined && data) {
        // Find high and low points for Fibonacci calculation
        const recentData = data.slice(-50); // Last 50 points
        const high = Math.max(...recentData.map(d => d.h));
        const low = Math.min(...recentData.map(d => d.l));

        const fibLevels = [
          low, // 0%
          low + (high - low) * 0.382, // 38.2%
          low + (high - low) * 0.618, // 61.8%
          high, // 100%
        ];

        const fibAnnotation: DrawingAnnotation = {
          id: `fib-${Date.now()}`,
          type: 'fibonacci',
          startX: dataX - 86400000 * 30, // 30 days ago
          startY: high,
          endX: dataX + 86400000 * 30, // 30 days ahead
          endY: low,
          fibLevels,
        };

        setAnnotations(prev => [...prev, fibAnnotation]);
      }
    });

    return () => {
      if (hammerRef.current) {
        hammerRef.current.destroy();
      }
    };
  }, [data, isDrawing]);

  // Helper function to find nearest data point
  const findNearestDataPoint = (x: number, y: number, data: StockData[] | undefined) => {
    if (!data || !data.length) return null;

    let nearest = data[0];
    let minDistance = Infinity;

    data.forEach(point => {
      const distance = Math.sqrt(
        Math.pow(point.x - x, 2) + Math.pow(point.c - y, 2)
      );
      if (distance < minDistance) {
        minDistance = distance;
        nearest = point;
      }
    });

    return nearest;
  };

  const undoLastAnnotation = useCallback(() => {
    setAnnotations(prev => prev.slice(0, -1));
  }, []);

  const clearAllAnnotations = useCallback(() => {
    setAnnotations([]);
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className={className} style={{ width: width || '100%', height: height || 400 }}>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading chart data...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={className} style={{ width: width || '100%', height: height || 400 }}>
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

  // No data state
  if (!chartData.datasets[0]?.data?.length) {
    return (
      <div className={className} style={{ width: width || '100%', height: height || 400 }}>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="text-6xl mb-4">📊</div>
            <p className="text-gray-500">No data available</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className} style={{ width: width || '100%', height: height || 400, position: 'relative' }}>
      {/* Header with share button */}
      <div className="absolute top-4 right-4 z-10">
        <button
          onClick={shareChart}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium shadow-lg hover:bg-blue-700 active:bg-blue-800 transition-colors"
          style={{
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          📤 Share Chart
        </button>
      </div>

      <Line ref={chartRef} data={chartData} options={chartOptions} />

      {/* Drawing controls */}
      <div className="absolute bottom-4 left-4 flex gap-2">
        <button
          onClick={undoLastAnnotation}
          disabled={annotations.length === 0}
          className="px-3 py-1 bg-gray-600 text-white rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          style={{
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          Undo
        </button>
        <button
          onClick={clearAllAnnotations}
          disabled={annotations.length === 0}
          className="px-3 py-1 bg-red-600 text-white rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          style={{
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          Clear All
        </button>
      </div>

      {/* Drawing instructions */}
      {window.innerWidth < 768 && (
        <div className="absolute top-4 left-4 bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs shadow-lg">
          👆 Use 2 fingers to draw trendlines
        </div>
      )}

      {/* Annotations counter */}
      {annotations.length > 0 && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-3 py-1 rounded-full text-sm">
          {annotations.length} annotation{annotations.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
};

export default DrawableChart;