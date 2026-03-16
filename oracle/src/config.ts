import dotenv from 'dotenv';
dotenv.config();

export const config = {
  sui: {
    network: process.env.SUI_NETWORK || 'testnet',
    rpcUrl: process.env.SUI_RPC_URL || 'https://fullnode.testnet.sui.io:443',
    packageId: process.env.PACKAGE_ID || '',
    marketId: process.env.MARKET_ID || '',
    oracleCapId: process.env.ORACLE_CAP_ID || '',
    privateKey: process.env.ORACLE_PRIVATE_KEY || '',
  },
  price: {
    binanceWsUrl: process.env.BINANCE_WS_URL || 'wss://stream.binance.com:9443/ws/suiusdt@trade',
    binanceRestUrl: process.env.BINANCE_REST_URL || 'https://api.binance.com/api/v3/ticker/price?symbol=SUIUSDT',
  },
  round: {
    intervalMs: parseInt(process.env.ROUND_INTERVAL_MS || '300000'),
    settleDelayMs: parseInt(process.env.SETTLE_DELAY_MS || '5000'),
  },
};
