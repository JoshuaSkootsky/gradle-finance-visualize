import { describe, it, expect, beforeEach } from 'vitest';
import { useChartStore, useChartType } from '@/stores/chartStore';

describe('chartStore Basic Tests', () => {
  beforeEach(() => {
    // Reset store state
    useChartStore.setState({
      chartType: 'candlestick',
      symbol: 'AAPL',
      timeframe: '1D',
      showVolume: true,
      showGrid: true,
      selectedTimeRange: '1M',
    });
  });

  it('should have correct initial state', () => {
    const state = useChartStore.getState();
    expect(state.chartType).toBe('candlestick');
    expect(state.symbol).toBe('AAPL');
    expect(state.timeframe).toBe('1D');
  });

  it('should update chart type', () => {
    useChartStore.getState().setChartType('line');
    const state = useChartStore.getState();
    expect(state.chartType).toBe('line');
  });

  it('should update symbol', () => {
    useChartStore.getState().setSymbol('GOOGL');
    const state = useChartStore.getState();
    expect(state.symbol).toBe('GOOGL');
  });

  it('should toggle volume', () => {
    useChartStore.getState().setShowVolume(false);
    const state = useChartStore.getState();
    expect(state.showVolume).toBe(false);
  });

  it('should toggle grid', () => {
    useChartStore.getState().setShowGrid(false);
    const state = useChartStore.getState();
    expect(state.showGrid).toBe(false);
  });
});