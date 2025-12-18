import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useCallback, useRef, useState } from 'react';
import { apiClient, wsManager } from '@/utils/api';
import { StockData, WebSocketMessage } from '@/types/stock';

// TanStack Query key factory
export const queryKeys = {
  stockData: ['stockData'] as const,
  realTimeData: ['stockData', 'realtime'] as const,
};

// Initial data fetch hook
export const useStockData = () => {
  return useQuery({
    queryKey: queryKeys.stockData,
    queryFn: apiClient.fetchStockData,
    refetchInterval: false, // We'll handle updates via WebSocket
    staleTime: 1000 * 60 * 15, // 15 minutes - keep data fresh longer
    retry: 2, // Reduce retries to fail faster
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000), // Shorter delays
    networkMode: 'offlineFirst', // Show cached data when offline
  });
};

// Real-time WebSocket hook
export const useRealTimeStockData = () => {
  const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const queryClient = useQueryClient();
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  const connect = useCallback(async () => {
    try {
      setConnectionState('connecting');
      await wsManager.connect();
      setConnectionState('connected');
    } catch (error) {
      setConnectionState('error');
      console.error('WebSocket connection failed:', error);
      
      // Schedule reconnection
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 5000);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    wsManager.disconnect();
    setConnectionState('disconnected');
  }, []);

  useEffect(() => {
    // Set up event listeners
    const handleMessage = (message: WebSocketMessage) => {
      setLastMessage(message);
      
      if (message.type === 'initial') {
        // Update the query cache with initial data
        queryClient.setQueryData(queryKeys.stockData, message.data);
      } else if (message.type === 'update') {
        // Optimistically update the cache with new data
        queryClient.setQueryData(
          queryKeys.stockData,
          (oldData: StockData[] = []) => {
            const existingTimestamps = new Set(oldData.map(d => d.x));
            const newData = message.data.filter(d => !existingTimestamps.has(d.x));
            
            if (newData.length > 0) {
              return [...oldData, ...newData]
                .sort((a, b) => a.x - b.x)
                .slice(-1000); // Keep last 1000 points
            }
            
            return oldData;
          }
        );
      }
    };

    const handleOpen = () => {
      setConnectionState('connected');
    };

    const handleClose = () => {
      setConnectionState('disconnected');
    };

    const handleError = () => {
      setConnectionState('error');
    };

    wsManager.on('message', handleMessage);
    wsManager.on('open', handleOpen);
    wsManager.on('close', handleClose);
    wsManager.on('error', handleError);

    // Auto-connect on mount
    connect();

    return () => {
      wsManager.off('message', handleMessage);
      wsManager.off('open', handleOpen);
      wsManager.off('close', handleClose);
      wsManager.off('error', handleError);
      disconnect();
    };
  }, [connect, disconnect, queryClient]);

  return {
    connectionState,
    lastMessage,
    connect,
    disconnect,
  };
};

// Combined hook for both initial data and real-time updates
export const useCombinedStockData = () => {
  const { data, isLoading, error, refetch } = useStockData();
  const { connectionState, lastMessage, connect, disconnect } = useRealTimeStockData();
  const queryClient = useQueryClient();

  // Fallback to WebSocket data if HTTP fetch fails
  useEffect(() => {
    if (!data && lastMessage?.type === 'initial' && lastMessage.data) {
      queryClient.setQueryData(queryKeys.stockData, lastMessage.data);
    }
  }, [data, lastMessage, queryClient]);

  const isConnected = connectionState === 'connected';
  const isConnecting = connectionState === 'connecting';
  const hasError = connectionState === 'error' || !!error;

  return {
    data,
    isLoading: isLoading || isConnecting,
    error: hasError ? (error as Error) || new Error('Connection error') : null,
    isConnected,
    isConnecting,
    refetch,
    reconnect: connect,
    disconnect,
  };
};