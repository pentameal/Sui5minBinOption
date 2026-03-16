// Contract addresses - update after deployment
export const PACKAGE_ID = import.meta.env.VITE_PACKAGE_ID || '0x0';
export const MARKET_ID = import.meta.env.VITE_MARKET_ID || '0x0';

// Network
export const SUI_NETWORK = (import.meta.env.VITE_SUI_NETWORK || 'testnet') as 'testnet' | 'mainnet' | 'devnet';

// Price feed
export const BINANCE_WS_URL = 'wss://stream.binance.com:9443/ws/suiusdt@trade';
export const BINANCE_KLINE_URL = 'wss://stream.binance.com:9443/ws/suiusdt@kline_1m';

// Decimals
export const PRICE_DECIMALS = 8;
export const SUI_DECIMALS = 9;
export const MIST_PER_SUI = 1_000_000_000;

// Directions
export const BET_UP = 0;
export const BET_DOWN = 1;

// Round duration
export const ROUND_DURATION_MS = 300_000; // 5 minutes
export const LOCK_BEFORE_END_MS = 30_000; // 30 seconds
