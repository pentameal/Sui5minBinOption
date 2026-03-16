import { useState, useEffect, useRef, useCallback } from 'react';
import { BINANCE_WS_URL } from '../constants';

export interface PriceCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export function useSuiPrice() {
  const [price, setPrice] = useState<number>(0);
  const [priceHistory, setPriceHistory] = useState<PriceCandle[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const candleRef = useRef<PriceCandle | null>(null);

  const startNewCandle = useCallback((price: number, time: number) => {
    const candle: PriceCandle = {
      time: Math.floor(time / 1000),
      open: price,
      high: price,
      low: price,
      close: price,
    };
    candleRef.current = candle;
    return candle;
  }, []);

  useEffect(() => {
    const connect = () => {
      const ws = new WebSocket(BINANCE_WS_URL);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const tradePrice = parseFloat(data.p);
          const tradeTime = data.T;
          setPrice(tradePrice);

          // Build 10-second candles
          const candleTime = Math.floor(tradeTime / 10000) * 10;
          if (!candleRef.current || candleRef.current.time !== candleTime) {
            if (candleRef.current) {
              setPriceHistory((prev) => {
                const updated = [...prev, { ...candleRef.current! }];
                return updated.slice(-300); // Keep last 300 candles
              });
            }
            startNewCandle(tradePrice, tradeTime);
          } else {
            const c = candleRef.current;
            c.close = tradePrice;
            c.high = Math.max(c.high, tradePrice);
            c.low = Math.min(c.low, tradePrice);
          }
        } catch {
          // ignore
        }
      };

      ws.onclose = () => {
        setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [startNewCandle]);

  return { price, priceHistory };
}
