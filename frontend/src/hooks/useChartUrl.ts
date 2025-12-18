import { useEffect, useState, useCallback } from 'react';
import { compress, decompress } from 'lz-string';
import queryString from 'query-string';

interface ChartState {
  symbol?: string;
  timeframe?: string;
  annotations: DrawingAnnotation[];
  dataLength?: number;
}

interface DrawingAnnotation {
  id: string;
  type: 'trendline' | 'fibonacci';
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  fibLevels?: number[];
}

export const useChartUrl = (annotations: DrawingAnnotation[], symbol?: string, timeframe?: string) => {
  const [sharedState, setSharedState] = useState<ChartState | null>(null);

  // Serialize chart state to base64 URL-safe string
  const serializeState = useCallback((state: ChartState): string => {
    try {
      const jsonString = JSON.stringify(state);
      const compressed = compress(jsonString);
      // Make URL-safe by replacing problematic characters
      return compressed
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
    } catch (error) {
      console.error('Failed to serialize chart state:', error);
      return '';
    }
  }, []);

  // Deserialize from base64 URL-safe string
  const deserializeState = useCallback((hash: string): ChartState | null => {
    try {
      // Restore URL-safe characters
      const normalized = hash
        .replace(/-/g, '+')
        .replace(/_/g, '/');

      const decompressed = decompress(normalized);
      if (!decompressed) return null;

      return JSON.parse(decompressed);
    } catch (error) {
      console.error('Failed to deserialize chart state:', error);
      return null;
    }
  }, []);

  // Load state from URL on mount
  useEffect(() => {
    const query = queryString.parse(window.location.search);
    const viewHash = query.view as string;

    if (viewHash) {
      const loadedState = deserializeState(viewHash);
      if (loadedState) {
        setSharedState(loadedState);
      }
    }
  }, [deserializeState]);

  // Generate shareable URL
  const generateShareUrl = useCallback((): string => {
    const state: ChartState = {
      symbol: symbol || 'AAPL',
      timeframe: timeframe || '1D',
      annotations,
      dataLength: 100, // Default to last 100 points
    };

    const hash = serializeState(state);
    if (!hash) return window.location.origin + window.location.pathname;

    const queryParams = queryString.stringify({ view: hash });
    return `${window.location.origin}${window.location.pathname}?${queryString}`;
  }, [annotations, symbol, timeframe, serializeState]);

  // Share functionality
  const shareChart = useCallback(async () => {
    const url = generateShareUrl();

    // Check if Web Share API is available
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Chart Analysis',
          text: 'Check out this chart analysis',
          url,
        });
        return true;
      } catch (error) {
        // User cancelled share or error occurred
        console.log('Share cancelled or failed:', error);
      }
    }

    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(url);
      // You might want to show a toast notification here
      alert('Link copied to clipboard!');
      return true;
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      // Fallback: show the URL for manual copying
      alert(`Share this link: ${url}`);
      return false;
    }
  }, [generateShareUrl]);

  return {
    sharedState,
    generateShareUrl,
    shareChart,
    serializeState,
    deserializeState,
  };
};