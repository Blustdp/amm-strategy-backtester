# AMM STRATEGY BACKTESTER

A Node.js sandbox for **writing and backtesting trading strategies** against a simulated multi-agent token market.

Implement a strategy that returns buy/sell/hold decisions each tick, plug it into an agent population alongside whales, bots, and retail traders, and run it against a constant-product AMM with liquidity, vesting-driven circulating supply, and a seeded RNG for reproducible results.

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Strategy Interface](#strategy-interface)
- [Usage](#usage)
- [Configuration](#configuration)
- [Built-in Strategies](#built-in-strategies)
- [API Reference](#api-reference)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)

## Features

- Write custom trading strategies and backtest them over hundreds of ticks
- Mix your strategy into a population with built-in whale / bot / retail agents
- Constant-product AMM pool with swap fees and price impact
- Token vesting schedules (TGE, cliffs, linear unlocks) that drive circulating supply
- Seeded RNG for reproducible runs
- Per-agent `costBasis` and `realizedPnl` for stop-loss / take-profit and performance checks

## Prerequisites

- Node.js v14+
- npm or yarn

## Installation

```bash
npm install amm-strategy-backtester
```

Or clone for local development:

```bash
git clone https://github.com/Blustdp/amm-strategy-backtester.git
cd amm-strategy-backtester
npm install
```

## Strategy Interface

Strategies are factories that return a decision function:

```javascript
(agent, context) => ({ action: 'buy' | 'sell' | 'hold', amount: number })
```

**`agent`** exposes balances and module-tracked position state:

- `baseBalance`, `tokenBalance`
- `costBasis` — running average buy price (use this for stop-loss / take-profit)
- `realizedPnl`

**`context`** each tick:

- `tick`, `currentPrice`, `launchPrice`
- `priceHistory` — prices from prior ticks
- `rng` — seeded RNG from the simulator

Return `hold` with `amount: 0` during indicator warm-up or when there is no trade.

> **Note:** `Agent` tracks a single running `costBasis`, not a list of partial positions. Multi-position strategies (e.g. grid bots) must keep their own per-agent state (typically a `Map` keyed by `agent.id`). Each tick can emit only one `{ action, amount }` decision.

## Usage

### Importing the library

```javascript
import {
  TokenSimulator,
  AMMPool,
  VestingSchedule,
  AllocationPlan,
  Agent,
  strategies,
  generateAgentPopulation,
  defaultArchetypes,
} from 'amm-strategy-backtester';
```

### Backtest a custom strategy in a population

Same pattern as plugging RSI / grid strategies into the market sandbox:

```javascript
import { TokenSimulator, defaultArchetypes } from 'amm-strategy-backtester';

function myStrategy({ tradeFraction = 0.2 } = {}) {
  return (agent, context) => {
    const { currentPrice, priceHistory } = context;
    if (priceHistory.length < 10) return { action: 'hold', amount: 0 };

    if (agent.tokenBalance > 0 && agent.costBasis > 0) {
      const changePct = (currentPrice - agent.costBasis) / agent.costBasis;
      if (changePct <= -0.05 || changePct >= 0.1) {
        return { action: 'sell', amount: agent.tokenBalance };
      }
    }

    if (agent.tokenBalance <= 0 && agent.baseBalance > 0) {
      return { action: 'buy', amount: agent.baseBalance * tradeFraction };
    }

    return { action: 'hold', amount: 0 };
  };
}

const archetypes = [
  {
    type: 'myTrader',
    weight: 50,
    balanceRange: [500, 3000],
    strategy: myStrategy(),
  },
  {
    type: 'retail',
    weight: 40,
    balanceRange: [50, 2000],
    strategy: defaultArchetypes()[2].strategy,
  },
  {
    type: 'bot',
    weight: 10,
    balanceRange: [500, 5000],
    strategy: defaultArchetypes()[1].strategy,
  },
];

const simulator = new TokenSimulator({
  seed: 99,
  agentCount: 300,
  totalTicks: 300,
  archetypes,
});

const results = simulator.run();
console.log(results.agentSummary);
console.log(results.finalPrice, results.allTimeHigh, results.allTimeLow);
```

### Run the default market

```javascript
import { TokenSimulator } from 'amm-strategy-backtester';

const simulator = new TokenSimulator({
  agentCount: 500,
  totalTicks: 52,
  seed: 42,
});

console.log(simulator.run());
```

### Create a custom AMM pool

```javascript
import { AMMPool } from 'amm-strategy-backtester';

const pool = new AMMPool({
  tokenReserve: 100000,
  baseReserve: 10000,
  feeBps: 30,
});

const result = pool.buy(500);
console.log('tokens out:', result.tokensOut);
console.log('price after buy:', pool.getPrice());
```

### Create a custom vesting schedule

```javascript
import { VestingSchedule } from 'amm-strategy-backtester';

const schedule = new VestingSchedule({
  name: 'team',
  totalAmount: 200000,
  tgePercent: 0,
  cliffMonths: 12,
  vestingMonths: 24,
});

for (let month = 0; month <= 36; month += 6) {
  console.log(`Month ${month}: unlocked ${schedule.unlockedAt(month)}`);
}
```

## Configuration

The simulator accepts a config object with these keys:

- `tokenName` — token name
- `tokenSymbol` — token symbol
- `totalSupply` — total token supply
- `initialBaseLiquidity` — base asset liquidity for the AMM
- `ammFeeBps` — fee in basis points
- `totalTicks` — number of ticks to simulate
- `ticksPerMonth` — tick-to-month conversion for vesting
- `agentCount` — number of market agents
- `seed` — RNG seed (reproducible backtests)
- `archetypes` — custom agent mix (your strategy + background traders)
- `allocations` — object of allocation buckets keyed by name

Each allocation bucket supports:

- `percentOfSupply`
- `tgePercent`
- `cliffMonths`
- `vestingMonths`

Each archetype entry supports:

- `type` — label for results (`agentSummary`)
- `weight` — relative share of the population
- `balanceRange` — `[min, max]` starting base balance
- `strategy` — decision function from a strategy factory

## Built-in Strategies

Background market participants exported via `strategies`:

- `strategies.whale()` — large early buys and profit-taking dumps
- `strategies.bot()` — sniping and quick flipping
- `strategies.retail()` — momentum-driven retail trading

Use these as the competing population while you backtest your own strategy. `defaultArchetypes()` returns a ready-made whale / bot / retail mix.

## API Reference

### TokenSimulator

- `new TokenSimulator(config)` — create a market sandbox instance
- `runTick(tickIndex)` — advance one tick
- `run(ticks)` — run a multi-tick backtest
- `getResults()` — price, volume, market cap, and `agentSummary` by type

### AMMPool

- `new AMMPool({ tokenReserve, baseReserve, feeBps })`
- `buy(baseAmountIn)` — swap base currency for tokens
- `sell(tokenAmountIn)` — swap tokens for base currency
- `getPrice()` — current spot price
- `getMarketCap(circulatingSupply)` — estimate market cap

### VestingSchedule

- `new VestingSchedule({ name, totalAmount, tgePercent, cliffMonths, vestingMonths })`
- `unlockedAt(monthIndex)` — unlocked amount at a month
- `unlockDelta(monthIndex)` — newly unlocked amount in a month

### Agent

- `new Agent({ id, type, baseBalance, tokenBalance, strategy })`
- `decide(context)` — strategy decision for a tick
- `recordBuy(baseSpent, tokensReceived)` — handle buy execution
- `recordSell(tokensSold, baseReceived)` — handle sell execution
- `netWorth(currentPrice)` — compute current agent net worth

## Project Structure

```
amm-strategy-backtester/
├── Agent.js
├── AMMPool.js
├── MarketAgents.js      # whale / bot / retail strategies + population helpers
├── TokenSimulator.js    # backtest orchestration
├── VestingSchedule.js
├── defaultConfig.js
├── index.js
├── package.json
├── README.md
├── rng.js
└── strategies/          # experimental class-based strategy sketches (not the primary API)
    ├── index.js
    ├── DCA.js
    ├── GridBot.js
    ├── MarketMaker.js
    ├── MovingAverageCrossover.js
    ├── RSI.js
    └── WhaleTrader.js
```

## Contributing

Contributions are welcome. Open issues, submit pull requests, add new trading strategies, or improve documentation.

## License

ISC
