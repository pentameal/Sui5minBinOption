import { useEffect, useState, useCallback } from 'react';
import { useSuiClient } from '@mysten/dapp-kit';
import { MARKET_ID, PACKAGE_ID, PRICE_DECIMALS } from '../constants';

export interface RoundData {
  roundId: number;
  startTimeMs: number;
  endTimeMs: number;
  lockTimeMs: number;
  startPrice: number;
  endPrice: number;
  upPool: number; // in MIST
  downPool: number; // in MIST
  status: number; // 0=open, 1=locked, 2=settled, 3=cancelled
  totalBettors: number;
}

export function useMarket() {
  const client = useSuiClient();
  const [currentRoundId, setCurrentRoundId] = useState<number>(0);
  const [rounds, setRounds] = useState<Map<number, RoundData>>(new Map());
  const [loading, setLoading] = useState(true);

  const fetchMarket = useCallback(async () => {
    if (!MARKET_ID || MARKET_ID === '0x0') {
      setLoading(false);
      return;
    }

    try {
      const obj = await client.getObject({
        id: MARKET_ID,
        options: { showContent: true },
      });

      const fields = (obj.data?.content as any)?.fields;
      if (fields) {
        setCurrentRoundId(parseInt(fields.current_round));
      }
    } catch (e) {
      console.error('Failed to fetch market:', e);
    }
    setLoading(false);
  }, [client]);

  // Subscribe to events for real-time updates
  useEffect(() => {
    fetchMarket();

    const interval = setInterval(fetchMarket, 10_000); // Poll every 10s
    return () => clearInterval(interval);
  }, [fetchMarket]);

  // Subscribe to contract events
  useEffect(() => {
    if (!PACKAGE_ID || PACKAGE_ID === '0x0') return;

    const unsubscribe = client.subscribeEvent({
      filter: {
        MoveModule: {
          package: PACKAGE_ID,
          module: 'binary_option',
        },
      },
      onMessage: (event) => {
        console.log('[Event]', event.type, event.parsedJson);
        fetchMarket(); // Refresh on any event
      },
    });

    return () => {
      unsubscribe.then((unsub) => unsub());
    };
  }, [client, fetchMarket]);

  return {
    currentRoundId,
    rounds,
    loading,
    refresh: fetchMarket,
  };
}
