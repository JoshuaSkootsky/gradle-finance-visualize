import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useCombinedStockData } from '@/hooks/useStockData';
import type { StockData } from '@/types/stock';

interface FinancialChartProps {
  width: number;
  height: number;
  className?: string;
}

const FinancialChart = ({ width, height, className }: FinancialChartProps) => {
  const { data, isLoading, error } = useCombinedStockData();

  // Process data for recharts
  const chartData = useMemo(() => {
    if (!data) return [];

    return data.slice(-100).map((item: StockData) => ({
      ...item,
      date: new Date(item.x).toLocaleDateString(),
      time: new Date(item.x).toLocaleTimeString(),
    }));
  }, [data]);

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

  return (
    <div className={className} style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="c"
            stroke="#8884d8"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default React.memo(FinancialChart);