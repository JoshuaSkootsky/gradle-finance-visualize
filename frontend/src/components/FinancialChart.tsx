import React, { useMemo, useRef, useEffect } from 'react';
import {
  ChartCanvas,
  Chart,
  CandlestickSeries,
  BarSeries,
  LineSeries,
  XAxis,
  YAxis,
  CrossHairCursor,
  EdgeIndicator,
  MouseCoordinateX,
  MouseCoordinateY,
  discontinuousTimeScaleProvider,
  lastVisibleItemBasedZoomAnchor,
  XAxisZoomBehavior,
  YAxisZoomBehavior,
} from '@react-financial-charts/core';
import { format } from 'd3-format';
import { useCombinedStockData } from '@/hooks/useStockData';
import { useChartType, useShowVolume } from '@/stores/chartStore';
import type { StockData, ChartType } from '@/types/stock';

interface FinancialChartProps {
  width: number;
  height: number;
  className?: string;
}

const FinancialChart = ({ width, height, className }: FinancialChartProps) => {
  const { data, isLoading, error } = useCombinedStockData();
  const chartType = useChartType();
  const showVolume = useShowVolume();

  // Process data for react-financial-charts
  const chartData = useMemo(() => {
    if (!data) return [];
    
    return data.map((item: StockData, index: number) => ({
      ...item,
      date: new Date(item.x),
      displayDate: new Date(item.x).toLocaleDateString(),
      index,
    }));
  }, [data]);

  // Memoized chart components based on chart type
  const renderMainSeries = useMemo(() => {
    switch (chartType) {
      case 'candlestick':
        return <CandlestickSeries />;
      case 'line':
        return (
          <LineSeries
            strokeStyle="#2196f3"
            strokeWidth={2}
          />
        );
      case 'bar':
        return <BarSeries />;
      default:
        return <CandlestickSeries />;
    }
  }, [chartType]);

  // Loading state
  if (isLoading) {
    return (
      <div className={className} style={{ width, height }}>
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

  // No data state
  if (!chartData.length) {
    return (
      <div className={className} style={{ width, height }}>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="text-6xl mb-4">📊</div>
            <p className="text-gray-500">No data available</p>
          </div>
        </div>
      </div>
    );
  }

  // Main chart for datasets under 1000 points
  if (chartData.length < 1000) {
    const displayData = chartData.slice(-100); // Show last 100 points for better performance
    
    return (
      <ChartCanvas
        width={width}
        height={height}
        margin={{ left: 50, right: 60, top: 10, bottom: 30 }}
        data={displayData}
        xAccessor={(d: any) => d.date}
        xScaleProvider={discontinuousTimeScaleProvider}
        xExtents={displayData.length > 0 ? [
          displayData[0].date,
          displayData[displayData.length - 1].date
        ] : undefined}
        zoomAnchor={lastVisibleItemBasedZoomAnchor}
        xZoomBehavior={XAxisZoomBehavior}
        yZoomBehavior={YAxisZoomBehavior}
        className={className}
      >
        <Chart 
          id={1} 
          yExtents={(d: any) => [d.l, d.h]}
          height={showVolume ? height * 0.7 : height}
        >
          <XAxis 
            axisAt="bottom" 
            orient="bottom" 
            ticks={6}
          />
          <XAxis axisAt="top" orient="top" />
          
          <YAxis axisAt="right" orient="right" ticks={5} />
          <YAxis axisAt="left" orient="left" ticks={5} />
          
          {renderMainSeries}
          
          <MouseCoordinateX
            at="bottom"
            orient="bottom"
            displayFormat={(date: Date) => date.toLocaleTimeString()}
          />
          <MouseCoordinateY
            at="right"
            orient="right"
            displayFormat={(price: number) => price.toFixed(2)}
          />
          
          <EdgeIndicator
            itemType="last"
            orient="right"
            edgeAt="right"
            yAccessor={(d: any) => d.c}
            fillStyle={(item: any) => 
              item.c > item.o ? '#26a69a' : '#ef5350'
            }
            textFill="#000"
            fontSize={12}
          />
          
          <CrossHairCursor />
        </Chart>

        {showVolume && (
          <Chart 
            id={2} 
            yExtents={(d: any) => [d.v * 0.8, d.v * 1.2]}
            origin={(w: number, h: number) => [0, h - height * 0.3]}
            height={height * 0.3}
          >
            <XAxis axisAt="bottom" orient="bottom" />
            <YAxis axisAt="right" orient="right" tickFormat={format(".0s")} />
            <BarSeries yAccessor={(d: any) => d.v} />
          </Chart>
        )}
      </ChartCanvas>
    );
  }

  // Fallback for large datasets - show optimized list view
  return (
    <div className={className} style={{ width, height }}>
      <div className="text-center py-8 bg-yellow-50 border border-yellow-200 rounded-md mb-4">
        <p className="text-yellow-800">
          Large dataset detected ({chartData.length} points). 
          Showing optimized view for better performance.
        </p>
      </div>
      <div className="bg-gray-50 rounded-md p-4 text-center">
        <p className="text-gray-600">
          Use the optimized table view for large datasets.
        </p>
      </div>
    </div>
  );
};

export default React.memo(FinancialChart);