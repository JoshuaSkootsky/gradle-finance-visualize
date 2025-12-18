import { useCallback, useEffect, useRef, useState } from 'react';
import { WebSocketMessage, ConnectionState } from '@/types/stock';

const WS_URL = import.meta.env.PROD 
  ? 'wss://your-production-server.com/ws' 
  : 'ws://localhost:8080/ws';

const RECONNECT_DELAY = 3000;
const MAX_RECONNECT_ATTEMPTS = 5;
const PING_INTERVAL = 30000; // 30 seconds

export const useWebSocket = () => {
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    status: 'disconnected',
  });
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  const pingInterval = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);

  const startPing = useCallback(() => {
    if (pingInterval.current) {
      clearInterval(pingInterval.current);
    }

    pingInterval.current = setInterval(() => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({ type: 'ping' }));
        setConnectionState(prev => ({ ...prev, lastPing: Date.now() }));
      }
    }, PING_INTERVAL);
  }, []);

  const stopPing = useCallback(() => {
    if (pingInterval.current) {
      clearInterval(pingInterval.current);
      pingInterval.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN || 
        ws.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    setConnectionState({ status: 'connecting' });

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = import.meta.env.PROD ? window.location.host : 'localhost:8080';
      const wsUrl = `${protocol}//${host}/ws`;
      
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        console.log('WebSocket connected');
        setConnectionState({ status: 'connected' });
        reconnectAttempts.current = 0;
        startPing();
      };

      ws.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setLastMessage(message);

          if (message.type === 'error') {
            setConnectionState(prev => ({
              status: 'error',
              error: message.error || 'Unknown error',
            }));
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
          setConnectionState(prev => ({
            status: 'error',
            error: 'Invalid message format',
          }));
        }
      };

       ws.current.onclose = (event) => {
         console.log('WebSocket disconnected:', event.code, event.reason);
         stopPing();

         if (event.code !== 1000) { // Not a normal closure
           // Don't immediately show error state - try reconnecting first
           setConnectionState({ status: 'connecting' });

           // Attempt reconnection if we haven't exceeded max attempts
           if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
             reconnectAttempts.current++;
             console.log(`Reconnection attempt ${reconnectAttempts.current}/${MAX_RECONNECT_ATTEMPTS}`);

             reconnectTimeout.current = setTimeout(() => {
               connect();
             }, RECONNECT_DELAY);
           } else {
             setConnectionState({
               status: 'error',
               error: 'Connection lost - unable to reconnect',
             });
           }
         } else {
           setConnectionState({ status: 'disconnected' });
         }
       };

       ws.current.onerror = (error) => {
         console.error('WebSocket error:', error);
         // Don't immediately fail - let onclose handle reconnection logic
         // Just log the error for debugging
       };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setConnectionState({
        status: 'error',
        error: 'Failed to create connection',
      });
    }
  }, [startPing, stopPing]);

  const disconnect = useCallback(() => {
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
      reconnectTimeout.current = null;
    }

    stopPing();

    if (ws.current) {
      ws.current.close(1000, 'User disconnected');
      ws.current = null;
    }

    setConnectionState({ status: 'disconnected' });
    reconnectAttempts.current = 0;
  }, [stopPing]);

  const sendMessage = useCallback((message: any) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    connectionState,
    lastMessage,
    sendMessage,
    connect,
    disconnect,
  };
};