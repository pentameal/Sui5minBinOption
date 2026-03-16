import { PriceFeed } from './price-feed';
import { SuiContractClient } from './sui-client';
import { config } from './config';

/**
 * Oracle Service for SUI 5-Minute Binary Options
 *
 * Responsibilities:
 * 1. Fetches real-time SUI/USDT price from Binance
 * 2. Creates new rounds every 5 minutes with the current price
 * 3. Settles rounds after they expire with the final price
 */
class OracleService {
  private priceFeed: PriceFeed;
  private suiClient: SuiContractClient;
  private currentRoundId: number = 0;
  private roundInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.priceFeed = new PriceFeed();
    this.suiClient = new SuiContractClient();
  }

  async start(): Promise<void> {
    console.log('=== SUI 5-Min Binary Option Oracle ===');
    console.log(`Network: ${config.sui.network}`);
    console.log(`Round interval: ${config.round.intervalMs / 1000}s`);
    console.log(`Package: ${config.sui.packageId}`);
    console.log('');

    // Start price feed
    await this.priceFeed.start();

    // Wait for initial price
    await this.waitForPrice();

    // Get current round from contract
    try {
      this.currentRoundId = await this.suiClient.getCurrentRound();
      console.log(`[Oracle] Current on-chain round: ${this.currentRoundId}`);
    } catch (e) {
      console.log('[Oracle] Could not fetch current round, starting from 0');
    }

    // Start the round lifecycle
    this.startRoundCycle();
  }

  private async waitForPrice(): Promise<void> {
    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (this.priceFeed.getPrice() > 0) {
          clearInterval(check);
          resolve();
        }
      }, 100);
    });
  }

  private startRoundCycle(): void {
    // Create first round immediately
    this.createAndScheduleRound();

    // Then create a new round every ROUND_INTERVAL
    this.roundInterval = setInterval(() => {
      this.createAndScheduleRound();
    }, config.round.intervalMs);
  }

  private async createAndScheduleRound(): Promise<void> {
    const startPrice = this.priceFeed.getPriceScaled();
    const rawPrice = this.priceFeed.getPrice();

    console.log(`\n[Oracle] Creating round with start price: $${rawPrice} (${startPrice})`);

    try {
      await this.suiClient.createRound(startPrice);
      this.currentRoundId++;

      console.log(`[Oracle] Round #${this.currentRoundId} created`);

      // Schedule settlement for this round
      const roundToSettle = this.currentRoundId;
      setTimeout(async () => {
        await this.settleRound(roundToSettle);
      }, config.round.intervalMs + config.round.settleDelayMs);
    } catch (error) {
      console.error('[Oracle] Failed to create round:', error);
    }
  }

  private async settleRound(roundId: number): Promise<void> {
    const endPrice = this.priceFeed.getPriceScaled();
    const rawPrice = this.priceFeed.getPrice();

    console.log(`[Oracle] Settling round #${roundId} with end price: $${rawPrice} (${endPrice})`);

    try {
      await this.suiClient.settleRound(roundId, endPrice);
      console.log(`[Oracle] Round #${roundId} settled successfully`);
    } catch (error) {
      console.error(`[Oracle] Failed to settle round #${roundId}:`, error);
      // Retry once after a short delay
      setTimeout(async () => {
        try {
          const retryPrice = this.priceFeed.getPriceScaled();
          await this.suiClient.settleRound(roundId, retryPrice);
          console.log(`[Oracle] Round #${roundId} settled on retry`);
        } catch (retryError) {
          console.error(`[Oracle] Retry failed for round #${roundId}:`, retryError);
        }
      }, 3000);
    }
  }

  async stop(): Promise<void> {
    if (this.roundInterval) {
      clearInterval(this.roundInterval);
    }
    this.priceFeed.stop();
    console.log('[Oracle] Service stopped');
  }
}

// Main
const oracle = new OracleService();
oracle.start().catch(console.error);

process.on('SIGINT', async () => {
  await oracle.stop();
  process.exit(0);
});
