import WebSocket from 'ws';
import axios from 'axios';
import { config } from './config';

/** Price with 8 decimal places (e.g., 3.50 USD = 350000000) */
const PRICE_DECIMALS = 8;
const PRICE_MULTIPLIER = 10 ** PRICE_DECIMALS;

export class PriceFeed {
  private ws: WebSocket | null = null;
  private currentPrice: number = 0; // raw USD price
  private currentPriceScaled: number = 0; // 8-decimal integer
  private listeners: ((price: number) => void)[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  async start(): Promise<void> {
    // Get initial price from REST API
    await this.fetchRestPrice();
    // Then connect WebSocket for real-time updates
    this.connectWs();
  }

  stop(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
  }

  /** Get current SUI/USD price as 8-decimal integer for on-chain use */
  getPriceScaled(): number {
    return this.currentPriceScaled;
  }

  /** Get current SUI/USD price as raw number */
  getPrice(): number {
    return this.currentPrice;
  }

  onPriceUpdate(listener: (price: number) => void): void {
    this.listeners.push(listener);
  }

  private async fetchRestPrice(): Promise<void> {
    try {
      const response = await axios.get(config.price.binanceRestUrl);
      this.updatePrice(parseFloat(response.data.price));
      console.log(`[PriceFeed] Initial SUI/USDT price: $${this.currentPrice}`);
    } catch (error) {
      console.error('[PriceFeed] Failed to fetch REST price:', error);
    }
  }

  private connectWs(): void {
    console.log('[PriceFeed] Connecting to Binance WebSocket...');
    this.ws = new WebSocket(config.price.binanceWsUrl);

    this.ws.on('open', () => {
      console.log('[PriceFeed] WebSocket connected');
    });

    this.ws.on('message', (data: WebSocket.Data) => {
      try {
        const trade = JSON.parse(data.toString());
        this.updatePrice(parseFloat(trade.p));
      } catch (err) {
        // ignore parse errors
      }
    });

    this.ws.on('close', () => {
      console.log('[PriceFeed] WebSocket disconnected, reconnecting in 5s...');
      this.reconnectTimer = setTimeout(() => this.connectWs(), 5000);
    });

    this.ws.on('error', (err) => {
      console.error('[PriceFeed] WebSocket error:', err.message);
    });
  }

  private updatePrice(price: number): void {
    this.currentPrice = price;
    this.currentPriceScaled = Math.round(price * PRICE_MULTIPLIER);
    this.listeners.forEach((l) => l(price));
  }
}
