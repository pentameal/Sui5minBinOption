import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { config } from './config';

export class SuiContractClient {
  private client: SuiClient;
  private keypair: Ed25519Keypair;

  constructor() {
    const network = config.sui.network as 'testnet' | 'mainnet' | 'devnet';
    this.client = new SuiClient({
      url: config.sui.rpcUrl || getFullnodeUrl(network),
    });

    if (config.sui.privateKey) {
      this.keypair = Ed25519Keypair.fromSecretKey(
        Buffer.from(config.sui.privateKey, 'base64')
      );
    } else {
      this.keypair = new Ed25519Keypair();
      console.warn('[SuiClient] No private key configured, using random keypair');
    }

    console.log(`[SuiClient] Oracle address: ${this.keypair.getPublicKey().toSuiAddress()}`);
  }

  /** Create a new 5-minute round */
  async createRound(startPrice: number): Promise<string> {
    const tx = new Transaction();

    tx.moveCall({
      target: `${config.sui.packageId}::binary_option::create_round`,
      arguments: [
        tx.object(config.sui.oracleCapId),
        tx.object(config.sui.marketId),
        tx.pure.u64(startPrice),
        tx.object('0x6'), // Clock object
      ],
    });

    const result = await this.client.signAndExecuteTransaction({
      signer: this.keypair,
      transaction: tx,
      options: { showEffects: true, showEvents: true },
    });

    console.log(`[SuiClient] Round created, tx: ${result.digest}`);
    return result.digest;
  }

  /** Settle a round with the end price */
  async settleRound(roundId: number, endPrice: number): Promise<string> {
    const tx = new Transaction();

    tx.moveCall({
      target: `${config.sui.packageId}::binary_option::settle_round`,
      arguments: [
        tx.object(config.sui.oracleCapId),
        tx.object(config.sui.marketId),
        tx.pure.u64(roundId),
        tx.pure.u64(endPrice),
        tx.object('0x6'), // Clock object
      ],
    });

    const result = await this.client.signAndExecuteTransaction({
      signer: this.keypair,
      transaction: tx,
      options: { showEffects: true, showEvents: true },
    });

    console.log(`[SuiClient] Round ${roundId} settled, tx: ${result.digest}`);
    return result.digest;
  }

  /** Get current round number from market */
  async getCurrentRound(): Promise<number> {
    const obj = await this.client.getObject({
      id: config.sui.marketId,
      options: { showContent: true },
    });

    const fields = (obj.data?.content as any)?.fields;
    return parseInt(fields?.current_round || '0');
  }

  /** Get round details */
  async getRoundDetails(roundId: number): Promise<any> {
    // Use devInspect to call view functions
    const tx = new Transaction();
    tx.moveCall({
      target: `${config.sui.packageId}::binary_option::get_round_pools`,
      arguments: [
        tx.object(config.sui.marketId),
        tx.pure.u64(roundId),
      ],
    });

    const result = await this.client.devInspectTransactionBlock({
      transactionBlock: tx,
      sender: this.keypair.getPublicKey().toSuiAddress(),
    });

    return result;
  }

  getAddress(): string {
    return this.keypair.getPublicKey().toSuiAddress();
  }
}
