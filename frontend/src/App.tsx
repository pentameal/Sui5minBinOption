import React, { useState, useEffect } from 'react';
import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit';
import { PriceChart } from './components/PriceChart';
import { BettingPanel } from './components/BettingPanel';
import { RoundHistory } from './components/RoundHistory';
import { useSuiPrice } from './hooks/useSuiPrice';
import { useMarket } from './hooks/useMarket';
import { ROUND_DURATION_MS, LOCK_BEFORE_END_MS, PRICE_DECIMALS } from './constants';

export const App: React.FC = () => {
  const { price, priceHistory } = useSuiPrice();
  const { currentRoundId, loading } = useMarket();
  const account = useCurrentAccount();
  const [timeLeft, setTimeLeft] = useState(ROUND_DURATION_MS);

  // Demo round data (will be replaced by on-chain data after deployment)
  const [demoStartPrice] = useState(() => 0);
  const [demoStartTime] = useState(() => Date.now());
  const [demoUpPool, setDemoUpPool] = useState(0);
  const [demoDownPool, setDemoDownPool] = useState(0);

  // Countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - demoStartTime;
      const remaining = Math.max(0, ROUND_DURATION_MS - (elapsed % ROUND_DURATION_MS));
      setTimeLeft(remaining);
    }, 100);
    return () => clearInterval(interval);
  }, [demoStartTime]);

  const isLocked = timeLeft < LOCK_BEFORE_END_MS;
  const startPriceDisplay = demoStartPrice || price;

  return (
    <div style={styles.app}>
      {/* Top bar */}
      <div style={styles.topBar}>
        <div style={styles.logo}>
          <span style={styles.logoIcon}>◆</span>
          SUI Binary Option
        </div>
        <div style={styles.topBarRight}>
          <div style={styles.priceDisplay}>
            SUI/USD{' '}
            <span style={{ color: '#3fb68b', fontWeight: 700 }}>
              ${price > 0 ? price.toFixed(4) : '—'}
            </span>
          </div>
          <ConnectButton />
        </div>
      </div>

      {/* Main content */}
      <div style={styles.main}>
        <div style={styles.leftPanel}>
          <PriceChart
            priceHistory={priceHistory}
            currentPrice={price}
            startPrice={startPriceDisplay > 0 ? startPriceDisplay : undefined}
          />
          <div style={styles.timeframeRow}>
            <button style={styles.timeframeBtnActive}>5 Min</button>
            <button style={styles.timeframeBtn}>15 Min</button>
            <button style={styles.timeframeBtn}>1 Day</button>
          </div>
          <RoundHistory rounds={[]} />
        </div>

        <div style={styles.rightPanel}>
          <BettingPanel
            roundId={currentRoundId || 1}
            upPool={demoUpPool}
            downPool={demoDownPool}
            timeLeft={timeLeft}
            isLocked={isLocked}
            startPrice={startPriceDisplay}
            currentPrice={price}
          />

          {/* Info card */}
          <div style={styles.infoCard}>
            <h4 style={styles.infoTitle}>How it works</h4>
            <ul style={styles.infoList}>
              <li>Each round lasts 5 minutes</li>
              <li>Bet on whether SUI price will go Up or Down</li>
              <li>If SUI price at end ≥ start price → Up wins</li>
              <li>Winners split the losing pool (minus 1% fee)</li>
              <li>Betting locks 30 seconds before round ends</li>
            </ul>
          </div>

          {/* Network badge */}
          <div style={styles.networkBadge}>
            <span style={{ color: '#3fb68b' }}>●</span> Sui Testnet
            {currentRoundId > 0 && (
              <span style={{ marginLeft: 8, color: '#8b949e' }}>
                Round #{currentRoundId}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  app: {
    minHeight: '100vh',
    background: '#0d1117',
    color: '#e6edf3',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  },
  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 24px',
    borderBottom: '1px solid #21262d',
  },
  logo: {
    fontSize: 20,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  logoIcon: {
    color: '#58a6ff',
    fontSize: 24,
  },
  topBarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 20,
  },
  priceDisplay: {
    fontSize: 14,
    color: '#8b949e',
  },
  main: {
    display: 'flex',
    gap: 24,
    padding: 24,
    maxWidth: 1200,
    margin: '0 auto',
  },
  leftPanel: {
    flex: 1,
  },
  rightPanel: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 16,
  },
  timeframeRow: {
    display: 'flex',
    gap: 8,
    marginTop: 12,
  },
  timeframeBtn: {
    padding: '6px 16px',
    background: 'transparent',
    border: '1px solid #30363d',
    borderRadius: 6,
    color: '#8b949e',
    cursor: 'pointer',
    fontSize: 13,
  },
  timeframeBtnActive: {
    padding: '6px 16px',
    background: '#21262d',
    border: '1px solid #58a6ff',
    borderRadius: 6,
    color: '#58a6ff',
    cursor: 'pointer',
    fontSize: 13,
  },
  infoCard: {
    background: '#161b22',
    borderRadius: 12,
    padding: 20,
    border: '1px solid #30363d',
  },
  infoTitle: {
    color: '#e6edf3',
    fontSize: 14,
    fontWeight: 600,
    margin: '0 0 10px 0',
  },
  infoList: {
    color: '#8b949e',
    fontSize: 13,
    lineHeight: 1.8,
    paddingLeft: 18,
    margin: 0,
  },
  networkBadge: {
    background: '#161b22',
    borderRadius: 8,
    padding: '10px 16px',
    border: '1px solid #30363d',
    fontSize: 13,
    color: '#e6edf3',
  },
};
