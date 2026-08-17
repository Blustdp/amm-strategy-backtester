import { HOLD } from './indicators.js';

/**
 * Simplified inventory loop: buy a slice of base, sell once price is
 * `spreadPct` above the fill. Approximates bid/ask capture without
 * resting limit orders.
 */
export function marketMaker({ spreadPct = 0.02, tradeFraction = 0.2 } = {}) {
  const entry = new Map();

  return (agent, context) => {
    const { currentPrice } = context;

    if (agent.tokenBalance <= 0 && agent.baseBalance > 0) {
      const spend = agent.baseBalance * tradeFraction;
      if (spend <= 0) return HOLD;
      entry.set(agent.id, currentPrice);
      return { action: 'buy', amount: spend };
    }

    const entryPrice = entry.get(agent.id) ?? agent.costBasis;
    if (agent.tokenBalance > 0 && entryPrice > 0 && currentPrice >= entryPrice * (1 + spreadPct)) {
      entry.delete(agent.id);
      return { action: 'sell', amount: agent.tokenBalance };
    }
    return HOLD;
  };
}
