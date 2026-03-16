/// SUI 5-Minute Binary Option Market
/// Users bet on whether SUI price will go Up or Down over a 5-minute window.
/// Settlement is triggered by an authorized oracle feeder.
module sui_binary_option::binary_option {
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::balance::{Self, Balance};
    use sui::event;
    use sui::table::{Self, Table};
    use sui::clock::Clock;

    // ======== Error codes ========
    const ENotAdmin: u64 = 0;
    const ERoundNotOpen: u64 = 1;
    const ERoundNotSettleable: u64 = 2;
    const ERoundAlreadySettled: u64 = 3;
    const EInvalidBetAmount: u64 = 4;
    const ENoPosition: u64 = 5;
    const EAlreadyClaimed: u64 = 6;
    const ERoundNotSettled: u64 = 7;
    const ENotOracle: u64 = 8;

    // ======== Constants ========
    const ROUND_DURATION_MS: u64 = 300_000; // 5 minutes
    const LOCK_BEFORE_END_MS: u64 = 30_000; // Lock betting 30s before end
    const FEE_BPS: u64 = 100; // 1% fee
    const BPS_DENOMINATOR: u64 = 10_000;

    // ======== Round status ========
    const STATUS_OPEN: u8 = 0;
    const STATUS_LOCKED: u8 = 1;
    const STATUS_SETTLED: u8 = 2;
    const STATUS_CANCELLED: u8 = 3;

    // ======== Bet direction ========
    const BET_UP: u8 = 0;
    const BET_DOWN: u8 = 1;

    // ======== Structs ========

    /// Admin capability - held by the deployer
    public struct AdminCap has key, store {
        id: UID,
    }

    /// Oracle capability - held by the authorized price feeder
    public struct OracleCap has key, store {
        id: UID,
    }

    /// The main market object (shared)
    public struct Market has key {
        id: UID,
        /// Current round number
        current_round: u64,
        /// All rounds
        rounds: Table<u64, Round>,
        /// Accumulated protocol fees
        fees: Balance<SUI>,
        /// Whether the market is paused
        paused: bool,
    }

    /// A single 5-minute round
    public struct Round has store {
        round_id: u64,
        start_time_ms: u64,
        end_time_ms: u64,
        lock_time_ms: u64,
        /// SUI/USD price at round start (8 decimals, e.g., 3_50000000 = $3.50)
        start_price: u64,
        /// SUI/USD price at round end
        end_price: u64,
        /// Total SUI bet on Up
        up_pool: Balance<SUI>,
        /// Total SUI bet on Down
        down_pool: Balance<SUI>,
        /// Individual bets
        bets: Table<address, Bet>,
        /// Round status
        status: u8,
        /// Total unique bettors
        total_bettors: u64,
    }

    /// An individual user's bet in a round
    public struct Bet has store {
        direction: u8,   // 0 = Up, 1 = Down
        amount: u64,
        claimed: bool,
    }

    // ======== Events ========

    public struct RoundCreated has copy, drop {
        round_id: u64,
        start_time_ms: u64,
        end_time_ms: u64,
        start_price: u64,
    }

    public struct BetPlaced has copy, drop {
        round_id: u64,
        bettor: address,
        direction: u8,
        amount: u64,
    }

    public struct RoundSettled has copy, drop {
        round_id: u64,
        start_price: u64,
        end_price: u64,
        winning_direction: u8,
        up_pool_total: u64,
        down_pool_total: u64,
    }

    public struct WinningsClaimed has copy, drop {
        round_id: u64,
        bettor: address,
        payout: u64,
    }

    public struct RoundCancelled has copy, drop {
        round_id: u64,
    }

    // ======== Init ========

    fun init(ctx: &mut TxContext) {
        let admin_cap = AdminCap { id: object::new(ctx) };
        let oracle_cap = OracleCap { id: object::new(ctx) };

        let market = Market {
            id: object::new(ctx),
            current_round: 0,
            rounds: table::new(ctx),
            fees: balance::zero(),
            paused: false,
        };

        transfer::transfer(admin_cap, ctx.sender());
        transfer::transfer(oracle_cap, ctx.sender());
        transfer::share_object(market);
    }

    // ======== Oracle functions ========

    /// Create a new round - called by oracle service every 5 minutes
    public fun create_round(
        _oracle: &OracleCap,
        market: &mut Market,
        start_price: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(!market.paused, ERoundNotOpen);

        let now = clock.timestamp_ms();
        let round_id = market.current_round + 1;
        market.current_round = round_id;

        let round = Round {
            round_id,
            start_time_ms: now,
            end_time_ms: now + ROUND_DURATION_MS,
            lock_time_ms: now + ROUND_DURATION_MS - LOCK_BEFORE_END_MS,
            start_price,
            end_price: 0,
            up_pool: balance::zero(),
            down_pool: balance::zero(),
            bets: table::new(ctx),
            status: STATUS_OPEN,
            total_bettors: 0,
        };

        event::emit(RoundCreated {
            round_id,
            start_time_ms: now,
            end_time_ms: now + ROUND_DURATION_MS,
            start_price,
        });

        table::add(&mut market.rounds, round_id, round);
    }

    /// Settle a round with the end price - called by oracle
    public fun settle_round(
        _oracle: &OracleCap,
        market: &mut Market,
        round_id: u64,
        end_price: u64,
        clock: &Clock,
    ) {
        let round = table::borrow_mut(&mut market.rounds, round_id);
        assert!(round.status == STATUS_OPEN || round.status == STATUS_LOCKED, ERoundAlreadySettled);
        assert!(clock.timestamp_ms() >= round.end_time_ms, ERoundNotSettleable);

        round.end_price = end_price;
        round.status = STATUS_SETTLED;

        // Determine winning direction: Up if end_price >= start_price
        let winning_direction = if (end_price >= round.start_price) { BET_UP } else { BET_DOWN };

        // Collect protocol fee from the losing pool
        let up_total = balance::value(&round.up_pool);
        let down_total = balance::value(&round.down_pool);

        let losing_pool_total = if (winning_direction == BET_UP) { down_total } else { up_total };
        let fee_amount = (losing_pool_total * FEE_BPS) / BPS_DENOMINATOR;

        if (fee_amount > 0) {
            let fee_balance = if (winning_direction == BET_UP) {
                balance::split(&mut round.down_pool, fee_amount)
            } else {
                balance::split(&mut round.up_pool, fee_amount)
            };
            balance::join(&mut market.fees, fee_balance);
        };

        event::emit(RoundSettled {
            round_id,
            start_price: round.start_price,
            end_price,
            winning_direction,
            up_pool_total: up_total,
            down_pool_total: down_total,
        });
    }

    // ======== User functions ========

    /// Place a bet on Up or Down
    public fun place_bet(
        market: &mut Market,
        round_id: u64,
        direction: u8,
        coin: Coin<SUI>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let amount = coin::value(&coin);
        assert!(amount > 0, EInvalidBetAmount);

        let round = table::borrow_mut(&mut market.rounds, round_id);
        assert!(round.status == STATUS_OPEN, ERoundNotOpen);

        let now = clock.timestamp_ms();
        // Auto-lock if within lock window
        if (now >= round.lock_time_ms) {
            round.status = STATUS_LOCKED;
            assert!(false, ERoundNotOpen); // Reject bet
        };

        let bettor = ctx.sender();

        // If user already has a bet in this round, add to it (must be same direction)
        if (table::contains(&round.bets, bettor)) {
            let existing = table::borrow_mut(&mut round.bets, bettor);
            assert!(existing.direction == direction, EInvalidBetAmount); // Must bet same direction
            existing.amount = existing.amount + amount;
        } else {
            table::add(&mut round.bets, bettor, Bet {
                direction,
                amount,
                claimed: false,
            });
            round.total_bettors = round.total_bettors + 1;
        };

        // Add to the appropriate pool
        let coin_balance = coin::into_balance(coin);
        if (direction == BET_UP) {
            balance::join(&mut round.up_pool, coin_balance);
        } else {
            balance::join(&mut round.down_pool, coin_balance);
        };

        event::emit(BetPlaced {
            round_id,
            bettor,
            direction,
            amount,
        });
    }

    /// Claim winnings from a settled round
    public fun claim_winnings(
        market: &mut Market,
        round_id: u64,
        ctx: &mut TxContext,
    ) {
        let round = table::borrow_mut(&mut market.rounds, round_id);
        assert!(round.status == STATUS_SETTLED, ERoundNotSettled);

        let bettor = ctx.sender();
        assert!(table::contains(&round.bets, bettor), ENoPosition);

        let bet = table::borrow_mut(&mut round.bets, bettor);
        assert!(!bet.claimed, EAlreadyClaimed);

        let winning_direction = if (round.end_price >= round.start_price) { BET_UP } else { BET_DOWN };

        let up_total = balance::value(&round.up_pool) + balance::value(&round.down_pool);
        let _down_total = up_total; // total pool after fees

        // Calculate payout
        let payout = if (bet.direction == winning_direction) {
            // Winner gets their share proportional to their bet in winning pool
            let winning_pool_total = if (winning_direction == BET_UP) {
                // We need original up pool total - but it's been modified
                // Use the bet amount ratio approach
                balance::value(&round.up_pool)
            } else {
                balance::value(&round.down_pool)
            };

            let total_pool = balance::value(&round.up_pool) + balance::value(&round.down_pool);

            if (winning_pool_total == 0) {
                0
            } else {
                // payout = (bet_amount / winning_pool_total) * total_pool
                ((bet.amount as u128) * (total_pool as u128) / (winning_pool_total as u128) as u64)
            }
        } else if (balance::value(&round.up_pool) == 0 || balance::value(&round.down_pool) == 0) {
            // If no one bet on one side, return bets (no winner/loser)
            bet.amount
        } else {
            0 // Loser gets nothing
        };

        bet.claimed = true;

        if (payout > 0) {
            let payout_balance = if (winning_direction == BET_UP || bet.direction == winning_direction) {
                // Take from both pools proportionally
                let from_up = if (balance::value(&round.up_pool) >= payout) {
                    balance::split(&mut round.up_pool, payout)
                } else {
                    let from_up_amount = balance::value(&round.up_pool);
                    let remaining = payout - from_up_amount;
                    let up_part = balance::split(&mut round.up_pool, from_up_amount);
                    let down_part = balance::split(&mut round.down_pool, remaining);
                    balance::join(&mut up_part, down_part);
                    up_part
                };
                from_up
            } else {
                let from_down = if (balance::value(&round.down_pool) >= payout) {
                    balance::split(&mut round.down_pool, payout)
                } else {
                    let from_down_amount = balance::value(&round.down_pool);
                    let remaining = payout - from_down_amount;
                    let down_part = balance::split(&mut round.down_pool, from_down_amount);
                    let up_part = balance::split(&mut round.up_pool, remaining);
                    balance::join(&mut down_part, up_part);
                    down_part
                };
                from_down
            };

            transfer::public_transfer(coin::from_balance(payout_balance, ctx), bettor);

            event::emit(WinningsClaimed {
                round_id,
                bettor,
                payout,
            });
        };
    }

    /// Cancel a round (admin only) - refunds all bets
    public fun cancel_round(
        _admin: &AdminCap,
        market: &mut Market,
        round_id: u64,
    ) {
        let round = table::borrow_mut(&mut market.rounds, round_id);
        assert!(round.status != STATUS_SETTLED, ERoundAlreadySettled);
        round.status = STATUS_CANCELLED;

        event::emit(RoundCancelled { round_id });
    }

    /// Claim refund from a cancelled round
    public fun claim_refund(
        market: &mut Market,
        round_id: u64,
        ctx: &mut TxContext,
    ) {
        let round = table::borrow_mut(&mut market.rounds, round_id);
        assert!(round.status == STATUS_CANCELLED, ERoundNotSettled);

        let bettor = ctx.sender();
        assert!(table::contains(&round.bets, bettor), ENoPosition);

        let bet = table::borrow_mut(&mut round.bets, bettor);
        assert!(!bet.claimed, EAlreadyClaimed);
        bet.claimed = true;

        let refund = if (bet.direction == BET_UP) {
            balance::split(&mut round.up_pool, bet.amount)
        } else {
            balance::split(&mut round.down_pool, bet.amount)
        };

        transfer::public_transfer(coin::from_balance(refund, ctx), bettor);
    }

    // ======== Admin functions ========

    /// Withdraw accumulated fees
    public fun withdraw_fees(
        _admin: &AdminCap,
        market: &mut Market,
        ctx: &mut TxContext,
    ) {
        let fee_amount = balance::value(&market.fees);
        if (fee_amount > 0) {
            let fee_coin = coin::from_balance(
                balance::split(&mut market.fees, fee_amount),
                ctx,
            );
            transfer::public_transfer(fee_coin, ctx.sender());
        };
    }

    /// Pause/unpause market
    public fun set_paused(
        _admin: &AdminCap,
        market: &mut Market,
        paused: bool,
    ) {
        market.paused = paused;
    }

    /// Transfer oracle cap to a new address
    public fun transfer_oracle_cap(
        oracle: OracleCap,
        recipient: address,
    ) {
        transfer::transfer(oracle, recipient);
    }

    // ======== View functions ========

    public fun get_current_round(market: &Market): u64 {
        market.current_round
    }

    public fun get_round_status(market: &Market, round_id: u64): u8 {
        let round = table::borrow(&market.rounds, round_id);
        round.status
    }

    public fun get_round_pools(market: &Market, round_id: u64): (u64, u64) {
        let round = table::borrow(&market.rounds, round_id);
        (balance::value(&round.up_pool), balance::value(&round.down_pool))
    }

    public fun get_round_prices(market: &Market, round_id: u64): (u64, u64) {
        let round = table::borrow(&market.rounds, round_id);
        (round.start_price, round.end_price)
    }

    public fun get_round_times(market: &Market, round_id: u64): (u64, u64, u64) {
        let round = table::borrow(&market.rounds, round_id);
        (round.start_time_ms, round.end_time_ms, round.lock_time_ms)
    }
}
