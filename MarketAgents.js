import { randRange, randInt, weightedPick } from './rng.js';
import { Agent } from './Agent.js';

/**
 * Built-in strategy functions. Each receives (agent, context) and
 * returns { action: 'buy' | 'sell' | 'hold', amount }.
 *
 * context shape:
 * {
 *   tick, priceHistory: number[], currentPrice, launchPrice, rng
 * }
 */

function priceMomentum(priceHistory, lookback = 3) {
  if (priceHistory.length < 2) return 0;
  const window = priceHistory.slice(-Math.min(lookback, priceHistory.length));
  const first = window[0];
  const last = window[window.length - 1];
  if (first <= 0) return 0;
  return (last - first) / first;
}

export const strategies = {
  /**
   * Whale: deploys large capital in the first few ticks, then mostly
   * holds. Dumps a large chunk if price multiplies past `dumpMultiple`
   * relative to cost basis, simulating profit-taking that can crash price.
   */
  whale({ dumpMultiple = 3, earlyTicks = 3, dumpFraction = 0.6 } = {}) {
    return (agent, context) => {
      const { tick, currentPrice, rng } = context;
      if (tick < earlyTicks && agent.baseBalance > 0) {
        const spend = agent.baseBalance * randRange(rng, 0.3, 0.8);
        return { action: 'buy', amount: spend };
      }
      if (agent.tokenBalance > 0 && agent.costBasis > 0 && currentPrice >= agent.costBasis * dumpMultiple) {
        return { action: 'sell', amount: agent.tokenBalance * dumpFraction };
      }
      // Small chance of opportunistic re-entry on dips
      if (agent.baseBalance > 0 && rng() < 0.03) {
        return { action: 'buy', amount: agent.baseBalance * randRange(rng, 0.05, 0.2) };
      }
      return { action: 'hold', amount: 0 };
    };
  },

  /**
   * Bot / sniper: buys aggressively in the launch block(s), then
   * flips for a quick profit within a short window. Mostly dormant
   * afterwards.
   */
  bot({ snipeTicks = 1, flipWindow = 4, flipTargetGain = 0.15 } = {}) {
    return (agent, context) => {
      const { tick, currentPrice, rng } = context;
      if (tick < snipeTicks && agent.baseBalance > 0) {
        return { action: 'buy', amount: agent.baseBalance * randRange(rng, 0.7, 1.0) };
      }
      if (
        agent.tokenBalance > 0 &&
        agent.costBasis > 0 &&
        tick < snipeTicks + flipWindow &&
        currentPrice >= agent.costBasis * (1 + flipTargetGain)
      ) {
        return { action: 'sell', amount: agent.tokenBalance };
      }
      // Cut losses if well past the flip window and still holding
      if (agent.tokenBalance > 0 && tick >= snipeTicks + flipWindow && rng() < 0.2) {
        return { action: 'sell', amount: agent.tokenBalance * 0.5 };
      }
      return { action: 'hold', amount: 0 };
    };
  },

  /**
   * Retail: momentum / sentiment driven. FOMO-buys on up-trends,
   * panic-sells on down-trends, otherwise trades small random size.
   */
  retail({ lookback = 3, momentumSensitivity = 2.5, baseTradeProb = 0.15 } = {}) {
    return (agent, context) => {
      const { priceHistory, rng } = context;
      const momentum = priceMomentum(priceHistory, lookback);
      const buyProb = baseTradeProb + Math.max(0, momentum) * momentumSensitivity;
      const sellProb = baseTradeProb + Math.max(0, -momentum) * momentumSensitivity;

      const roll = rng();
      if (roll < buyProb && agent.baseBalance > 0) {
        return { action: 'buy', amount: agent.baseBalance * randRange(rng, 0.05, 0.35) };
      }
      if (roll < buyProb + sellProb && agent.tokenBalance > 0) {
        return { action: 'sell', amount: agent.tokenBalance * randRange(rng, 0.1, 0.5) };
      }
      return { action: 'hold', amount: 0 };
    };
  },
};

/**
 * Generate a population of agents according to a distribution spec.
 *
 * @param {Object} opts
 * @param {number} opts.count                Total number of agents to create
 * @param {Function} opts.rng                 Seeded RNG function
 * @param {Array<{type:string, weight:number, strategy:Function, balanceRange:[number,number]}>} opts.archetypes
 */
export function generateAgentPopulation({ count, rng, archetypes }) {
  const agents = [];
  const pickList = archetypes.map((a) => ({ weight: a.weight, value: a }));

  for (let i = 0; i < count; i++) {
    const archetype = weightedPick(rng, pickList);
    const [min, max] = archetype.balanceRange;
    const baseBalance = randRange(rng, min, max);

    agents.push(
      new Agent({
        id: `${archetype.type}-${i}`,
        type: archetype.type,
        baseBalance,
        strategy: archetype.strategy,
      })
    );
  }
  return agents;
}

/**
 * A sensible default population mix: a small number of whales,
 * a slice of bots/snipers active mainly at launch, and a retail
 * majority driven by momentum/sentiment.
 */
export function defaultArchetypes() {
  return [
    {
      type: 'whale',
      weight: 2,
      balanceRange: [20000, 100000],
      strategy: strategies.whale(),
    },
    {
      type: 'bot',
      weight: 18,
      balanceRange: [500, 5000],
      strategy: strategies.bot(),
    },
    {
      type: 'retail',
      weight: 80,
      balanceRange: [50, 2000],
      strategy: strategies.retail(),
    },
  ];
}
