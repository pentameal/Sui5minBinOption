# SUI 5-Minute Binary Option

A Polymarket-style binary prediction market for SUI/USD price, built on the Sui blockchain.

Users bet on whether SUI price will go **Up** or **Down** over 5-minute windows. Winners split the losing pool minus a 1% protocol fee.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Frontend   │────▶│  Sui Network │◀────│  Oracle Service  │
│  (React +    │     │  (Move       │     │  (Node.js)       │
│   dapp-kit)  │     │   Contract)  │     │                  │
└─────────────┘     └──────────────┘     └────────┬─────────┘
                                                   │
                                          ┌────────▼─────────┐
                                          │   Binance Price   │
                                          │   Feed (WS+REST)  │
                                          └──────────────────┘
```

### On-chain (Sui Move)
- **Market** — shared object holding all rounds
- **Rounds** — 5-minute betting windows with Up/Down pools
- **Settlement** — oracle submits end price, contract determines winners
- **Claims** — winners claim proportional share of total pool

### Off-chain (Oracle Service)
- Streams SUI/USDT price from Binance WebSocket
- Creates new rounds every 5 minutes with start price
- Settles rounds after expiry with end price
- Retries on failure

### Frontend (React + Vite)
- Real-time price chart (lightweight-charts)
- Wallet connection via `@mysten/dapp-kit`
- Betting panel with Up/Down buttons
- Round history

## Quick Start

### 1. Deploy Contract

```bash
# Ensure sui CLI is installed and configured for testnet
cd contract
sui move build
sui client publish --gas-budget 200000000

# Note the Package ID, Market ID, and OracleCap ID from output
```

### 2. Run Oracle Service

```bash
cd oracle
npm install
cp .env.example .env
# Edit .env with your contract addresses and oracle private key
npm run dev
```

### 3. Run Frontend

```bash
cd frontend
npm install

# Set contract addresses
export VITE_PACKAGE_ID=0x...
export VITE_MARKET_ID=0x...

npm run dev
# Open http://localhost:3000
```

## Contract Design

### Round Lifecycle
1. **Open** — Oracle creates round with start price, users can bet Up or Down
2. **Locked** — 30 seconds before end, no new bets accepted
3. **Settled** — Oracle submits end price; if end ≥ start → Up wins, else Down wins
4. **Claims** — Winners claim proportional payout from combined pool

### Pricing
- Bet amounts are in SUI (native token)
- Implied probability = your_pool / total_pool
- Payout = (your_bet / winning_pool) × total_pool × (1 - fee)
- Fee: 1% of losing pool

### Key Functions
| Function | Caller | Description |
|----------|--------|-------------|
| `create_round` | Oracle | Start new 5-min round with start price |
| `place_bet` | User | Bet Up or Down with SUI |
| `settle_round` | Oracle | Submit end price and settle |
| `claim_winnings` | User | Claim payout from won round |
| `cancel_round` | Admin | Cancel round, enable refunds |

## Development Notes

- **Price Oracle**: Uses Binance SUI/USDT as price source. For production, consider Pyth Network or Supra oracle on Sui.
- **Tick Size**: Price uses 8 decimal places. Small tick movements in 5-min windows mean the Up/Down split approaches 50/50, which is the desired behavior for binary options.
- **IV/Pricing**: Since this is a parimutuel market (not an order book), implied volatility doesn't directly affect pricing. The market-clearing price is determined by the ratio of Up vs Down pool sizes.
- **Matching Engine**: No order book needed — this is parimutuel. All bets go into Up/Down pools and winners split proportionally.

## License

MIT
