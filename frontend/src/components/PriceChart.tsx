import React, { useEffect, useRef } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData, Time } from 'lightweight-charts';
import { PriceCandle } from '../hooks/useSuiPrice';

interface PriceChartProps {
  priceHistory: PriceCandle[];
  currentPrice: number;
  startPrice?: number;
}

export const PriceChart: React.FC<PriceChartProps> = ({ priceHistory, currentPrice, startPrice }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: '#0d1117' },
        textColor: '#8b949e',
      },
      grid: {
        vertLines: { color: '#21262d' },
        horzLines: { color: '#21262d' },
      },
      width: containerRef.current.clientWidth,
      height: 400,
      timeScale: {
        timeVisible: true,
        secondsVisible: true,
        borderColor: '#21262d',
      },
      rightPriceScale: {
        borderColor: '#21262d',
      },
      crosshair: {
        horzLine: { color: '#58a6ff' },
        vertLine: { color: '#58a6ff' },
      },
    });

    const series = chart.addCandlestickSeries({
      upColor: '#3fb68b',
      downColor: '#ff5353',
      borderUpColor: '#3fb68b',
      borderDownColor: '#ff5353',
      wickUpColor: '#3fb68b',
      wickDownColor: '#ff5353',
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  // Update data
  useEffect(() => {
    if (seriesRef.current && priceHistory.length > 0) {
      const data: CandlestickData<Time>[] = priceHistory.map((c) => ({
        time: c.time as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));
      seriesRef.current.setData(data);
    }
  }, [priceHistory]);

  return (
    <div style={{ position: 'relative' }}>
      <div ref={containerRef} style={{ width: '100%' }} />
      {startPrice && (
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: 16,
            color: '#8b949e',
            fontSize: 12,
          }}
        >
          Price to beat: <span style={{ color: '#fff', fontWeight: 'bold' }}>${startPrice.toFixed(4)}</span>
          {currentPrice > 0 && (
            <span style={{ marginLeft: 12 }}>
              Current:{' '}
              <span style={{ color: currentPrice >= startPrice ? '#3fb68b' : '#ff5353', fontWeight: 'bold' }}>
                ${currentPrice.toFixed(4)}
              </span>
            </span>
          )}
        </div>
      )}
    </div>
  );
};
