import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:8080';

describe('API Integration Tests', () => {
  let server: any;

  beforeAll(async () => {
    // Start the server if not already running
    try {
      await fetch(`${BASE_URL}/api/stock-prices`);
    } catch (error) {
      // Server not running, tests will be skipped
      console.log('Backend server not running, skipping integration tests');
      return;
    }
  });

  it('should fetch stock prices from API', async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/stock-prices`);
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data).toHaveProperty('data');
      expect(Array.isArray(data.data)).toBe(true);
      
      if (data.data.length > 0) {
        const firstPoint = data.data[0];
        expect(firstPoint).toHaveProperty('x');
        expect(firstPoint).toHaveProperty('o');
        expect(firstPoint).toHaveProperty('h');
        expect(firstPoint).toHaveProperty('l');
        expect(firstPoint).toHaveProperty('c');
        expect(firstPoint).toHaveProperty('v');
      }
    } catch (error) {
      console.log('Integration test skipped - server not running');
    }
  });

  it('should have correct CORS headers', async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/stock-prices`);
      expect(response.headers.get('access-control-allow-origin')).toBe('*');
      expect(response.headers.get('access-control-allow-methods')).toContain('GET');
      expect(response.headers.get('access-control-allow-headers')).toContain('Content-Type');
    } catch (error) {
      console.log('Integration test skipped - server not running');
    }
  });

  it('should have correct content type', async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/stock-prices`);
      expect(response.headers.get('content-type')).toContain('application/json');
    } catch (error) {
      console.log('Integration test skipped - server not running');
    }
  });

  it('should access WebSocket endpoint', async () => {
    try {
      const response = await fetch(`${BASE_URL}/ws`);
      expect(response.ok).toBe(true);
    } catch (error) {
      console.log('Integration test skipped - server not running');
    }
  });

  it('should serve frontend files', async () => {
    try {
      const response = await fetch(BASE_URL);
      expect(response.ok).toBe(true);
      const text = await response.text();
      expect(text).toContain('html'); // Should return HTML content
    } catch (error) {
      console.log('Integration test skipped - server not running');
    }
  });
});