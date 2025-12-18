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
  type: 'trendline' | 'fibonacci' | 'horizontal' | 'vertical' | 'rectangle' | 'arrow';
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  fibLevels?: number[];
  label?: string;
  color?: string;
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
  const [drawingMode, setDrawingMode] = useState<'trendline' | 'fibonacci' | 'horizontal' | 'vertical' | 'rectangle' | 'arrow'>('trendline');

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

    // Calculate min/max for better scaling
    const prices = processedData.map(d => d.y);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice;
    
    // Determine if trend is up or down for coloring
    const isUpTrend = processedData.length > 1 && 
                     processedData[processedData.length - 1]!.y > processedData[0]!.y;

    return {
      datasets: [
        {
          label: 'Price',
          data: processedData,
          borderColor: isUpTrend ? 'rgb(16, 185, 129)' : 'rgb(239, 68, 68)', // Green for up, red for down
          backgroundColor: isUpTrend ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          borderWidth: isUpTrend ? 2.5 : 2,
          fill: false,
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.2, // Add slight curve for smoother line
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
        backgroundColor: 'rgba(30, 30, 30, 0.95)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: '#444',
        borderWidth: 1,
        cornerRadius: 8,
        padding: 12,
        displayColors: false,
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
          if (annotation.type === 'trendline' || annotation.type === 'horizontal' || annotation.type === 'vertical') {
            acc[`trendline-${annotation.id}`] = {
              type: 'line',
              xMin: annotation.startX,
              xMax: annotation.endX,
              yMin: annotation.startY,
              yMax: annotation.endY,
              borderColor: isDrawing && annotation.id === currentDrawing?.id
                ? 'rgba(59, 130, 246, 0.9)' // Blue for live drawing
                : 'rgba(239, 68, 68, 0.9)', // Red for finished lines
              borderWidth: 2,
              borderDash: [6, 4],
              label: {
                display: true,
                content: annotation.type === 'horizontal' ? 'Horizontal Line' : 
                        annotation.type === 'vertical' ? 'Vertical Line' : 'Trendline',
                position: 'start',
                backgroundColor: 'rgba(239, 68, 68, 0.7)',
                font: {
                  size: 10
                }
              }
            };
          } else if (annotation.type === 'fibonacci' && annotation.fibLevels) {
            annotation.fibLevels.forEach((level, index) => {
              const colors = [
                'rgba(34, 197, 94, 0.3)', // Green 0%
                'rgba(251, 191, 36, 0.3)', // Yellow 38.2%
                'rgba(239, 68, 68, 0.3)',  // Red 61.8%
                'rgba(34, 197, 94, 0.3)', // Green 100%
              ];
              const labels = ['0%', '38.2%', '61.8%', '100%'];
              acc[`fib-${annotation.id}-${index}`] = {
                type: 'box',
                xMin: annotation.startX,
                xMax: annotation.endX,
                yMin: level,
                yMax: level,
                backgroundColor: colors[index % colors.length],
                borderWidth: 0,
                label: {
                  display: index === 0 || index === 3, // Only show labels for 0% and 100%
                  content: labels[index],
                  position: 'start',
                  backgroundColor: 'rgba(30, 30, 30, 0.7)',
                  font: {
                    size: 10
                  },
                  color: '#fff'
                }
              };
            });
          } else if (annotation.type === 'rectangle') {
            acc[`rectangle-${annotation.id}`] = {
              type: 'box',
              xMin: annotation.startX,
              xMax: annotation.endX,
              yMin: annotation.startY,
              yMax: annotation.endY,
              backgroundColor: 'rgba(59, 130, 246, 0.2)',
              borderColor: 'rgba(59, 130, 246, 0.8)',
              borderWidth: 2,
              borderDash: [5, 5],
            };
          } else if (annotation.type === 'arrow') {
            acc[`arrow-${annotation.id}`] = {
              type: 'line',
              xMin: annotation.startX,
              xMax: annotation.endX,
              yMin: annotation.startY,
              yMax: annotation.endY,
              borderColor: 'rgba(139, 69, 19, 0.8)',
              borderWidth: 2,
              arrowHeads: {
                start: {},
                end: {}
              },
              label: {
                display: true,
                content: 'Arrow',
                position: 'start',
                backgroundColor: 'rgba(139, 69, 19, 0.7)',
                font: {
                  size: 10
                }
              }
            };
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
          color: 'rgba(200, 200, 200, 0.2)',
          drawBorder: false,
        },
        ticks: {
          color: '#666',
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 8,
        },
        border: {
          display: false,
        }
      },
      y: {
        grid: {
          color: 'rgba(200, 200, 200, 0.2)',
          drawBorder: false,
        },
        ticks: {
          callback: (value: any) => `$${value}`,
          color: '#666'
        },
        border: {
          display: false,
        }
      },
    },
    elements: {
      point: {
        radius: 0,
      },
      line: {
        tension: 0.2,
      }
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

        // Create annotation based on current drawing mode
        currentAnnotation = {
          id: `annotation-${Date.now()}`,
          type: drawingMode,
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
        // For horizontal lines, keep startY constant
        if (drawingMode === 'horizontal') {
          currentAnnotation.endX = dataX;
          currentAnnotation.endY = currentAnnotation.startY;
        } 
        // For vertical lines, keep startX constant
        else if (drawingMode === 'vertical') {
          currentAnnotation.endX = currentAnnotation.startX;
          currentAnnotation.endY = dataY;
        }
        // For other tools, allow free movement
        else {
          currentAnnotation.endX = dataX;
          currentAnnotation.endY = dataY;
        }
        setCurrentDrawing({ ...currentAnnotation });
      }
    });

    // Pan end - finish drawing
    hammerRef.current.on('panend', () => {
      if (currentAnnotation && drawingStart) {
        // For Fibonacci, we need special handling
        if (drawingMode === 'fibonacci') {
          if (!chart) return;
          
          const rect = canvas.getBoundingClientRect();
          const x = rect.width / 2;
          const y = rect.height / 2;
          
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
        } else {
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
      }

      setIsDrawing(false);
      setCurrentDrawing(null);
      drawingStart = null;
      currentAnnotation = null;
    });

    // Double tap for Fibonacci levels or other tools
    hammerRef.current.on('doubletap', (event: HammerInput) => {
      if (!chart) return;

      const rect = canvas.getBoundingClientRect();
      const x = event.center.x - rect.left;
      const y = event.center.y - rect.top;

      const dataX = chart.scales.x.getValueForPixel(x);
      const dataY = chart.scales.y.getValueForPixel(y);

      if (dataX !== undefined && dataY !== undefined && data) {
        if (drawingMode === 'fibonacci') {
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
        } else if (drawingMode === 'horizontal' || drawingMode === 'vertical') {
          // Create a horizontal or vertical line
          const newAnnotation: DrawingAnnotation = {
            id: `line-${Date.now()}`,
            type: drawingMode,
            startX: dataX,
            startY: dataY,
            endX: dataX + (drawingMode === 'horizontal' ? 86400000 * 5 : 0), // 5 days for horizontal
            endY: dataY + (drawingMode === 'vertical' ? 5 : 0),
          };
          
          setAnnotations(prev => [...prev, newAnnotation]);
        }
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
      <div className={`${className} bg-white/80 backdrop-blur-lg rounded-xl shadow-xl border border-white/20 p-4 animate-fade-in`} style={{ width: width || '100%', height: height || 400 }}>
        <div className="flex items-center justify-center h-full">
          <div className="text-center bg-white/80 backdrop-blur-sm p-8 rounded-xl shadow-lg border border-border animate-pulse-subtle">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600 mx-auto mb-4"></div>
            <p className="text-foreground font-medium">Loading chart data...</p>
            <p className="text-muted-foreground text-sm mt-2">Connecting to financial data feed</p>
          </div>
        </div>
      </div>
    );
  }

  // Check if we have cached data to show even with errors
  const hasDataToShow = chartData.datasets?.[0]?.data && chartData.datasets[0].data.length > 0;

  // No data state
  if (!chartData.datasets[0]?.data?.length) {
    return (
      <div className={`${className} bg-white/80 backdrop-blur-lg rounded-xl shadow-xl border border-white/20 p-4 animate-fade-in`} style={{ width: width || '100%', height: height || 400 }}>
        <div className="flex items-center justify-center h-full">
          <div className="text-center bg-white/80 backdrop-blur-sm p-8 rounded-xl shadow-lg border border-border max-w-xs">
            <div className="text-6xl mb-4 animate-pulse">📊</div>
            <p className="text-foreground font-medium">No data available</p>
            <p className="text-muted-foreground text-sm mt-2">Financial data could not be loaded</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${className} bg-white/80 backdrop-blur-lg rounded-xl shadow-xl border border-white/20 p-4 animate-fade-in`} style={{ width: width || '100%', height: height || 400, position: 'relative' }}>
      {/* Header with share button */}
      <div className="absolute top-4 right-4 z-10">
        <button
          onClick={async () => {
            const success = await shareChart();
            if (success) {
              // Show visual feedback
              const button = document.activeElement as HTMLElement;
              button?.classList.add('animate-pulse-subtle');
              setTimeout(() => {
                button?.classList.remove('animate-pulse-subtle');
              }, 2000);
            }
          }}
          className="px-4 py-2 bg-gradient-to-r from-primary to-blue-700 text-white rounded-xl text-sm font-medium shadow-xl hover:from-primary/90 hover:to-blue-800 active:from-primary/80 active:to-blue-900 transition-all duration-200 flex items-center gap-2 hover:scale-105 transform backdrop-blur-sm border border-white/20 shadow-primary/20"
          style={{
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <span>📤</span>
          <span>Share Chart</span>
        </button>
      </div>

      {/* Error overlay - only show if we have no data to display */}
      {error && !hasDataToShow && (
        <div className="absolute inset-0 bg-gradient-to-br from-red-50/80 to-orange-50/50 backdrop-blur-sm flex items-center justify-center z-20 rounded-xl animate-fade-in">
          <div className="text-center bg-white/90 backdrop-blur-sm p-6 rounded-xl shadow-xl border border-red-200/50 max-w-xs">
            <div className="text-4xl mb-4">⚠️</div>
            <p className="text-red-600 font-medium mb-2">Connection Issue</p>
            <p className="text-gray-600 text-sm mb-4">Unable to load fresh data</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-lg text-sm font-medium hover:from-red-600 hover:to-orange-600 transition-all shadow-md"
            >
              🔄 Retry Connection
            </button>
          </div>
        </div>
      )}

      {/* Connection warning - show if we have data but there are errors */}
      {error && hasDataToShow && (
        <div className="absolute top-16 left-4 right-4 z-10 animate-slide-in">
          <div className="bg-gradient-to-r from-yellow-50/80 to-amber-50/80 backdrop-blur-sm border border-yellow-200/50 text-yellow-800 px-4 py-3 rounded-lg text-sm flex flex-col sm:flex-row items-start sm:items-center gap-2 shadow-md">
            <div className="flex items-center gap-2">
              <span className="text-lg">⚡</span>
              <div>
                <span className="font-medium">Connection Issue</span>
                <span className="ml-2 block sm:inline">Showing cached data. Some features may be limited.</span>
              </div>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="ml-auto px-3 py-1 bg-gradient-to-r from-yellow-500 to-amber-500 text-white rounded text-xs font-medium hover:from-yellow-600 hover:to-amber-600 transition-all"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      <div className="rounded-lg overflow-hidden bg-white/90 backdrop-blur-sm">
        <Line ref={chartRef} data={chartData} options={chartOptions} />
      </div>

      {/* Enhanced Drawing Tools */}
      <div className="absolute bottom-4 left-4 right-4 flex flex-col sm:flex-row gap-3 bg-white/80 backdrop-blur-lg rounded-xl p-3 shadow-xl border border-white/30 z-10 animate-slide-in">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={undoLastAnnotation}
            disabled={annotations.length === 0}
            className="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center gap-1"
            style={{
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <span>↶</span>
            <span>Undo</span>
          </button>
          <button
            onClick={clearAllAnnotations}
            disabled={annotations.length === 0}
            className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center gap-1"
            style={{
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <span>🗑️</span>
            <span>Clear All</span>
          </button>
        </div>
        
        {/* Drawing tools */}
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setDrawingMode('trendline')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all shadow-sm flex items-center gap-1 ${
              drawingMode === 'trendline' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <span>📏</span>
            <span>Trend</span>
          </button>
          <button
            onClick={() => setDrawingMode('fibonacci')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all shadow-sm flex items-center gap-1 ${
              drawingMode === 'fibonacci' 
                ? 'bg-purple-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <span>📊</span>
            <span>Fib</span>
          </button>
          <button
            onClick={() => setDrawingMode('horizontal')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all shadow-sm flex items-center gap-1 ${
              drawingMode === 'horizontal' 
                ? 'bg-green-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <span>➖</span>
            <span>Horiz</span>
          </button>
        </div>
        
        {/* Drawing mode indicator */}
        <div className="flex items-center text-xs text-gray-600 ml-auto">
          <span className="flex items-center">
            <span className="w-2 h-2 rounded-full bg-green-500 mr-1"></span>
            Drawing Active
          </span>
        </div>
      </div>

      {/* Drawing instructions */}
      {annotations.length === 0 && (
        <div className="absolute top-4 left-4 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 backdrop-blur-sm border border-blue-200/50 text-blue-800 px-4 py-3 rounded-xl text-sm shadow-lg max-w-xs animate-slide-in">
          <div className="font-medium mb-1 flex items-center gap-2">
            <span>🎨</span>
            <span>Drawing Tools Active</span>
          </div>
          <div className="text-xs">
            {window.innerWidth < 768
              ? "👆 Use 2 fingers to draw trendlines • 👇👆 Double-tap for Fibonacci levels"
              : "🖱️ Click and drag to draw trendlines • 👆 Double-click for Fibonacci levels"
            }
          </div>
        </div>
      )}

      {/* Mobile instructions */}
      {window.innerWidth < 768 && annotations.length === 0 && (
        <div className="absolute top-20 left-4 bg-gradient-to-r from-orange-50/80 to-amber-50/80 backdrop-blur-sm border border-orange-200/50 text-orange-800 px-3 py-2 rounded-lg text-xs shadow-lg flex items-center gap-1">
          <span>📱</span>
          <span>Mobile: 2 fingers prevent scroll conflicts</span>
        </div>
      )}

      {/* Annotations counter */}
      {annotations.length > 0 && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-gray-700/80 to-gray-800/80 backdrop-blur-sm text-white px-4 py-1.5 rounded-full text-sm shadow-lg border border-white/20 animate-fade-in">
          <span className="flex items-center gap-1">
            <span>✏️</span>
            <span>{annotations.length} annotation{annotations.length !== 1 ? 's' : ''}</span>
          </span>
        </div>
      )}
    </div>
  );
};

export default DrawableChart;