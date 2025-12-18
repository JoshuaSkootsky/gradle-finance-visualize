export interface StockData {
  x: number; // Unix timestamp
  o: number; // Open price
  h: number; // High price
  l: number; // Low price
  c: number; // Close price
  v: number; // Volume
}

export interface WebSocketMessage {
  type: 'initial' | 'update' | 'error';
  data: StockData[];
  error?: string;
}

export interface ConnectionState {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  error?: string;
  lastPing?: number;
}

export interface ChartState {
  data: StockData[];
  isLoading: boolean;
  error?: string;
  symbol: string;
  timeframe: string;
}

export type ChartType = 'candlestick' | 'line' | 'bar' | 'area';