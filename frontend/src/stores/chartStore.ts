import { create } from 'zustand';
import { ChartType } from '@/types/stock';

interface ChartUIState {
  // UI State
  chartType: ChartType;
  symbol: string;
  timeframe: string;
  showVolume: boolean;
  showGrid: boolean;
  selectedTimeRange: '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL';
  
  // Actions
  setChartType: (type: ChartType) => void;
  setSymbol: (symbol: string) => void;
  setTimeframe: (timeframe: string) => void;
  setShowVolume: (show: boolean) => void;
  setShowGrid: (show: boolean) => void;
  setSelectedTimeRange: (range: '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL') => void;
}

export const useChartStore = create<ChartUIState>((set) => ({
  // Initial state
  chartType: 'candlestick',
  symbol: 'AAPL',
  timeframe: '1D',
  showVolume: true,
  showGrid: true,
  selectedTimeRange: '1M',

  // Actions
  setChartType: (type: ChartType) => set({ chartType: type }),
  setSymbol: (symbol: string) => set({ symbol }),
  setTimeframe: (timeframe: string) => set({ timeframe }),
  setShowVolume: (show: boolean) => set({ showVolume: show }),
  setShowGrid: (show: boolean) => set({ showGrid: show }),
  setSelectedTimeRange: (range) => set({ selectedTimeRange: range }),
}));

// Selector hooks for optimized re-renders
export const useChartType = () => useChartStore(state => state.chartType);
export const useChartSymbol = () => useChartStore(state => state.symbol);
export const useChartTimeframe = () => useChartStore(state => state.timeframe);
export const useShowVolume = () => useChartStore(state => state.showVolume);
export const useShowGrid = () => useChartStore(state => state.showGrid);
export const useSelectedTimeRange = () => useChartStore(state => state.selectedTimeRange);