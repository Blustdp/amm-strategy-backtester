import { AMMPool } from './AMMPool.js';
import { AllocationPlan } from './VestingSchedule.js';
import { generateAgentPopulation, defaultArchetypes } from './MarketAgents.js';
import { createRng } from './rng.js';

/**
 * TokenSimulator — orchestrates a full token launch simulation:
 * allocations + vesting, an AMM liquidity pool, and a population
 * of trading agents (whales/bots/retail) acting tick by tick.
 *
 * Every parameter has a default so `new TokenSimulator()` runs
 * out of the box, but everything is overridable.
 */
export class TokenSimulator {
  constructor(config = {}) {
    const {
      tokenName = 'Blustdp',
      tokenSymbol = 'BLUSTDP',
      totalSupply = 1_000_000_000,

      // Allocation split (fractions of totalSupply). Should sum to 1.
      allocations = {
        liquidity: { percentOfSupply: 0.20, tgePercent: 1.0, cliffMonths: 0, vestingMonths: 0 },
        publicSale: { percentOfSupply: 0.15, tgePercent: 0.5, cliffMonths: 0, vestingMonths: 3 },
        team: { percentOfSupply: 0.15, tgePercent: 0.0, cliffMonths: 6, vestingMonths: 18 },
        investors: { percentOfSupply: 0.15, tgePercent: 0.10, cliffMonths: 3, vestingMonths: 12 },
        community: { percentOfSupply: 0.20, tgePercent: 0.05, cliffMonths: 1, vestingMonths: 24 },
        treasury: { percentOfSupply: 0.15, tgePercent: 0.0, cliffMonths: 6, vestingMonths: 30 },
      },

      // Initial AMM liquidity pairing (base currency e.g. USD/USDC)
      initialBaseLiquidity = 50_000,
      ammFeeBps = 30,

      // Simulation horizon
      totalTicks = 52,          // e.g. weekly ticks for a year
      ticksPerMonth = 4.33,     // used to translate ticks -> vesting months

      // Agent population
      agentCount = 500,
      archetypes = null,        // pass custom archetype array, else default mix used

      seed = 1337,
    } = config;

    this.tokenName = tokenName;
    this.tokenSymbol = tokenSymbol;
    this.totalSupply = totalSupply;
    this.totalTicks = totalTicks;
    this.ticksPerMonth = ticksPerMonth;
    this.ammFeeBps = ammFeeBps;
    this.initialBaseLiquidity = initialBaseLiquidity;
    this.agentCount = agentCount;
    this.seed = seed;

    this.rng = createRng(seed);

    // --- Allocation plan / vesting ---
    this.allocationPlan = new AllocationPlan(totalSupply);
    for (const [name, cfg] of Object.entries(allocations)) {
      this.allocationPlan.addBucket({ name, ...cfg });
    }
    const allocated = this.allocationPlan.totalAllocated();
    if (Math.abs(allocated - totalSupply) / totalSupply > 0.001) {
      // Not fatal — just surfaced so the caller notices a misconfigured split
      this._allocationWarning = `Allocations sum to ${allocated.toLocaleString()}, not totalSupply (${totalSupply.toLocaleString()}).`;
    }

    // --- Liquidity pool seeded from the 'liquidity' bucket's TGE unlock ---
    const liquidityBucket = this.allocationPlan.getBucket('liquidity');
    const initialTokenLiquidity = liquidityBucket ? liquidityBucket.unlockedAt(0) : totalSupply * 0.2;
    this.pool = new AMMPool({
      tokenReserve: initialTokenLiquidity,
      baseReserve: initialBaseLiquidity,
      feeBps: ammFeeBps,
    });
    this.launchPrice = this.pool.getPrice();

    // --- Agent population ---
    const archetypeList = archetypes || defaultArchetypes();
    this.agents = generateAgentPopulation({
      count: agentCount,
      rng: this.rng,
      archetypes: archetypeList,
    });

    // --- Result buffers ---
    this.priceHistory = [this.launchPrice];
    this.volumeHistory = [0];
    this.marketCapHistory = [this.pool.getMarketCap(this._circulatingAt(0))];
    this.circulatingSupplyHistory = [this._circulatingAt(0)];
    this.tickLog = [];
  }

  _circulatingAt(tick) {
    const month = tick / this.ticksPerMonth;
    return this.allocationPlan.circulatingSupplyAt(month);
  }

  /** Distribute any newly-unlocked, non-liquidity tokens to community/retail agents as buying power proxies is out of scope here — new unlocks primarily affect circulating supply and market cap math. */
  runTick(tickIndex) {
    const tickVolumeBefore = this.pool.cumulativeVolumeBase;
    const context = {
      tick: tickIndex,
      priceHistory: this.priceHistory,
      currentPrice: this.pool.getPrice(),
      launchPrice: this.launchPrice,
      rng: this.rng,
    };

    // Shuffle-free deterministic iteration order (agents array order is fixed by seed already)
    for (const agent of this.agents) {
      const decision = agent.decide(context);
      if (!decision || decision.action === 'hold' || decision.amount <= 0) continue;

      if (decision.action === 'buy') {
        const spend = Math.min(decision.amount, agent.baseBalance);
        if (spend <= 0) continue;
        const { tokensOut } = this.pool.buy(spend);
        agent.recordBuy(spend, tokensOut);
      } else if (decision.action === 'sell') {
        const sellAmount = Math.min(decision.amount, agent.tokenBalance);
        if (sellAmount <= 0) continue;
        const { baseOut } = this.pool.sell(sellAmount);
        agent.recordSell(sellAmount, baseOut);
      }
    }

    const price = this.pool.getPrice();
    const circulating = this._circulatingAt(tickIndex);
    const tickVolume = this.pool.cumulativeVolumeBase - tickVolumeBefore;

    this.priceHistory.push(price);
    this.volumeHistory.push(tickVolume);
    this.circulatingSupplyHistory.push(circulating);
    this.marketCapHistory.push(this.pool.getMarketCap(circulating));

    this.tickLog.push({
      tick: tickIndex,
      price,
      volume: tickVolume,
      circulatingSupply: circulating,
      marketCap: this.pool.getMarketCap(circulating),
    });

    return this.tickLog[this.tickLog.length - 1];
  }

  run(ticks = this.totalTicks) {
    for (let t = 1; t <= ticks; t++) {
      this.runTick(t);
    }
    return this.getResults();
  }

  getResults() {
    const prices = this.priceHistory;
    const ath = Math.max(...prices);
    const atl = Math.min(...prices);
    const finalPrice = prices[prices.length - 1];

    return {
      tokenName: this.tokenName,
      tokenSymbol: this.tokenSymbol,
      launchPrice: this.launchPrice,
      finalPrice,
      allTimeHigh: ath,
      allTimeLow: atl,
      percentChangeFromLaunch: ((finalPrice - this.launchPrice) / this.launchPrice) * 100,
      totalVolume: this.pool.cumulativeVolumeBase,
      totalTrades: this.pool.tradeCount,
      finalCirculatingSupply: this.circulatingSupplyHistory[this.circulatingSupplyHistory.length - 1],
      finalMarketCap: this.marketCapHistory[this.marketCapHistory.length - 1],
      priceHistory: this.priceHistory,
      volumeHistory: this.volumeHistory,
      marketCapHistory: this.marketCapHistory,
      circulatingSupplyHistory: this.circulatingSupplyHistory,
      allocationWarning: this._allocationWarning || null,
      agentSummary: this._summarizeAgents(finalPrice),
    };
  }

  _summarizeAgents(finalPrice) {
    const byType = {};
    for (const agent of this.agents) {
      byType[agent.type] = byType[agent.type] || { count: 0, totalNetWorth: 0, totalRealizedPnl: 0 };
      byType[agent.type].count += 1;
      byType[agent.type].totalNetWorth += agent.netWorth(finalPrice);
      byType[agent.type].totalRealizedPnl += agent.realizedPnl;
    }
    return byType;
  }
}
