import React, { useState } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { PACKAGE_ID, MARKET_ID, BET_UP, BET_DOWN, MIST_PER_SUI } from '../constants';

interface BettingPanelProps {
  roundId: number;
  upPool: number;
  downPool: number;
  timeLeft: number;
  isLocked: boolean;
  startPrice: number;
  currentPrice: number;
}

export const BettingPanel: React.FC<BettingPanelProps> = ({
  roundId,
  upPool,
  downPool,
  timeLeft,
  isLocked,
  startPrice,
  currentPrice,
}) => {
  const [amount, setAmount] = useState<string>('1');
  const [selectedTab, setSelectedTab] = useState<'5M' | '50K'>('5M');
  const account = useCurrentAccount();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  const totalPool = upPool + downPool;
  const upPercent = totalPool > 0 ? Math.round((upPool / totalPool) * 100) : 50;
  const downPercent = 100 - upPercent;

  const minutesLeft = Math.floor(timeLeft / 60000);
  const secondsLeft = Math.floor((timeLeft % 60000) / 1000);

  const placeBet = async (direction: number) => {
    if (!account) {
      alert('Please connect your wallet first');
      return;
    }

    const betAmount = Math.floor(parseFloat(amount) * MIST_PER_SUI);
    if (betAmount <= 0) return;

    const tx = new Transaction();
    const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(betAmount)]);

    tx.moveCall({
      target: `${PACKAGE_ID}::binary_option::place_bet`,
      arguments: [
        tx.object(MARKET_ID),
        tx.pure.u64(roundId),
        tx.pure.u8(direction),
        coin,
        tx.object('0x6'), // Clock
      ],
    });

    try {
      const result = await signAndExecute({ transaction: tx });
      console.log('Bet placed:', result);
    } catch (error) {
      console.error('Failed to place bet:', error);
    }
  };

  const presetAmounts = selectedTab === '5M' ? [0.5, 1, 2, 5] : [10, 25, 50, 100];

  return (
    <div style={styles.container}>
      {/* Header with round info */}
      <div style={styles.header}>
        <div style={styles.roundBadge}>
          SUI Up or Down · 5 Minutes
        </div>
        <div style={styles.timer}>
          <span style={styles.timerDigit}>{String(minutesLeft).padStart(2, '0')}</span>
          <span style={styles.timerSep}>:</span>
          <span style={styles.timerDigit}>{String(secondsLeft).padStart(2, '0')}</span>
        </div>
      </div>

      {/* Buy / Sell tabs */}
      <div style={styles.tabRow}>
        <button
          style={{ ...styles.tab, ...(selectedTab === '5M' ? styles.tabActive : {}) }}
          onClick={() => setSelectedTab('5M')}
        >
          ≤ 5M
        </button>
        <button
          style={{ ...styles.tab, ...(selectedTab === '50K' ? styles.tabActive : {}) }}
          onClick={() => setSelectedTab('50K')}
        >
          ≤ 50K
        </button>
      </div>

      {/* Amount input */}
      <div style={styles.amountSection}>
        <label style={styles.label}>Amount (SUI)</label>
        <div style={styles.amountInputRow}>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={styles.amountInput}
            min="0.01"
            step="0.1"
          />
        </div>
        <div style={styles.presets}>
          {presetAmounts.map((a) => (
            <button
              key={a}
              onClick={() => setAmount(String(a))}
              style={styles.presetBtn}
            >
              +{a}
            </button>
          ))}
        </div>
      </div>

      {/* Pool info */}
      <div style={styles.poolInfo}>
        <div style={styles.poolBar}>
          <div
            style={{
              ...styles.poolBarUp,
              width: `${upPercent}%`,
            }}
          />
          <div
            style={{
              ...styles.poolBarDown,
              width: `${downPercent}%`,
            }}
          />
        </div>
        <div style={styles.poolLabels}>
          <span style={{ color: '#3fb68b' }}>Up {upPercent}%</span>
          <span style={{ color: '#ff5353' }}>Down {downPercent}%</span>
        </div>
        <div style={styles.poolLabels}>
          <span style={{ color: '#8b949e' }}>{(upPool / MIST_PER_SUI).toFixed(2)} SUI</span>
          <span style={{ color: '#8b949e' }}>{(downPool / MIST_PER_SUI).toFixed(2)} SUI</span>
        </div>
      </div>

      {/* Bet buttons */}
      <div style={styles.betButtons}>
        <button
          style={{
            ...styles.betBtn,
            ...styles.betBtnUp,
            opacity: isLocked ? 0.5 : 1,
          }}
          onClick={() => placeBet(BET_UP)}
          disabled={isLocked || !account}
        >
          ↑ Up
        </button>
        <button
          style={{
            ...styles.betBtn,
            ...styles.betBtnDown,
            opacity: isLocked ? 0.5 : 1,
          }}
          onClick={() => placeBet(BET_DOWN)}
          disabled={isLocked || !account}
        >
          ↓ Down
        </button>
      </div>

      {isLocked && (
        <div style={styles.lockedMsg}>
          Betting locked — round ending soon
        </div>
      )}

      {!account && (
        <div style={styles.lockedMsg}>
          Connect wallet to place bets
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: '#161b22',
    borderRadius: 12,
    padding: 20,
    border: '1px solid #30363d',
    width: 360,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  roundBadge: {
    color: '#e6edf3',
    fontSize: 14,
    fontWeight: 600,
  },
  timer: {
    display: 'flex',
    alignItems: 'center',
    background: '#0d1117',
    borderRadius: 8,
    padding: '6px 12px',
  },
  timerDigit: {
    color: '#3fb68b',
    fontSize: 20,
    fontWeight: 700,
    fontFamily: 'monospace',
  },
  timerSep: {
    color: '#3fb68b',
    fontSize: 20,
    fontWeight: 700,
    margin: '0 2px',
  },
  tabRow: {
    display: 'flex',
    gap: 8,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    padding: '8px 0',
    border: '1px solid #30363d',
    borderRadius: 8,
    background: 'transparent',
    color: '#8b949e',
    cursor: 'pointer',
    fontSize: 14,
  },
  tabActive: {
    background: '#238636',
    borderColor: '#238636',
    color: '#fff',
  },
  amountSection: {
    marginBottom: 16,
  },
  label: {
    color: '#8b949e',
    fontSize: 12,
    marginBottom: 6,
    display: 'block',
  },
  amountInputRow: {
    display: 'flex',
    gap: 8,
  },
  amountInput: {
    flex: 1,
    background: '#0d1117',
    border: '1px solid #30363d',
    borderRadius: 8,
    padding: '10px 14px',
    color: '#e6edf3',
    fontSize: 18,
    fontWeight: 600,
    outline: 'none',
  },
  presets: {
    display: 'flex',
    gap: 6,
    marginTop: 8,
  },
  presetBtn: {
    flex: 1,
    padding: '6px 0',
    background: '#21262d',
    border: '1px solid #30363d',
    borderRadius: 6,
    color: '#8b949e',
    cursor: 'pointer',
    fontSize: 13,
  },
  poolInfo: {
    marginBottom: 16,
  },
  poolBar: {
    display: 'flex',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  poolBarUp: {
    background: '#3fb68b',
    transition: 'width 0.3s',
  },
  poolBarDown: {
    background: '#ff5353',
    transition: 'width 0.3s',
  },
  poolLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 12,
    marginBottom: 2,
  },
  betButtons: {
    display: 'flex',
    gap: 10,
  },
  betBtn: {
    flex: 1,
    padding: '14px 0',
    border: 'none',
    borderRadius: 10,
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  },
  betBtnUp: {
    background: '#238636',
    color: '#fff',
  },
  betBtnDown: {
    background: '#da3633',
    color: '#fff',
  },
  lockedMsg: {
    textAlign: 'center' as const,
    color: '#8b949e',
    fontSize: 12,
    marginTop: 10,
  },
};
