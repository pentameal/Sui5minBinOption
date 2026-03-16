import React from 'react';
import { MIST_PER_SUI, PRICE_DECIMALS } from '../constants';

interface SettledRound {
  roundId: number;
  startPrice: number;
  endPrice: number;
  upPool: number;
  downPool: number;
  result: 'up' | 'down';
  startTime: number;
}

interface RoundHistoryProps {
  rounds: SettledRound[];
}

export const RoundHistory: React.FC<RoundHistoryProps> = ({ rounds }) => {
  const formatPrice = (p: number) => (p / 10 ** PRICE_DECIMALS).toFixed(4);
  const formatTime = (ts: number) => new Date(ts).toLocaleTimeString();

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>Recent Rounds</h3>
      <div style={styles.table}>
        <div style={styles.headerRow}>
          <span style={styles.headerCell}>Round</span>
          <span style={styles.headerCell}>Time</span>
          <span style={styles.headerCell}>Open</span>
          <span style={styles.headerCell}>Close</span>
          <span style={styles.headerCell}>Result</span>
          <span style={styles.headerCell}>Pool</span>
        </div>
        {rounds.length === 0 && (
          <div style={{ color: '#8b949e', textAlign: 'center', padding: 20 }}>
            No settled rounds yet
          </div>
        )}
        {rounds.map((r) => (
          <div key={r.roundId} style={styles.row}>
            <span style={styles.cell}>#{r.roundId}</span>
            <span style={styles.cell}>{formatTime(r.startTime)}</span>
            <span style={styles.cell}>${formatPrice(r.startPrice)}</span>
            <span style={styles.cell}>${formatPrice(r.endPrice)}</span>
            <span
              style={{
                ...styles.cell,
                color: r.result === 'up' ? '#3fb68b' : '#ff5353',
                fontWeight: 600,
              }}
            >
              {r.result === 'up' ? '↑ Up' : '↓ Down'}
            </span>
            <span style={styles.cell}>
              {((r.upPool + r.downPool) / MIST_PER_SUI).toFixed(1)} SUI
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: '#161b22',
    borderRadius: 12,
    padding: 20,
    border: '1px solid #30363d',
    marginTop: 16,
  },
  title: {
    color: '#e6edf3',
    fontSize: 16,
    fontWeight: 600,
    marginBottom: 12,
    margin: 0,
    marginBottom: 12,
  },
  table: {
    width: '100%',
  },
  headerRow: {
    display: 'flex',
    borderBottom: '1px solid #30363d',
    paddingBottom: 8,
    marginBottom: 4,
  },
  headerCell: {
    flex: 1,
    color: '#8b949e',
    fontSize: 11,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  row: {
    display: 'flex',
    padding: '8px 0',
    borderBottom: '1px solid #21262d',
  },
  cell: {
    flex: 1,
    color: '#e6edf3',
    fontSize: 13,
  },
};
