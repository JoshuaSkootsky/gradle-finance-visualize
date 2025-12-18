import { describe, it, expect, vi } from 'vitest';
import { queryKeys } from '@/hooks/useStockData';

describe('useStockData Basic Tests', () => {
  it('should have correct query keys', () => {
    expect(queryKeys.stockData).toEqual(['stockData']);
    expect(queryKeys.realTimeData).toEqual(['stockData', 'realtime']);
  });

  it('should validate query key structure', () => {
    expect(Array.isArray(queryKeys.stockData)).toBe(true);
    expect(queryKeys.stockData[0]).toBe('stockData');
    expect(queryKeys.realTimeData.length).toBe(2);
    expect(queryKeys.realTimeData[0]).toBe('stockData');
    expect(queryKeys.realTimeData[1]).toBe('realtime');
  });
});