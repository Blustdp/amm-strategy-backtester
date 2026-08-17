import { HOLD } from './indicators.js';

/**
 * Grid around launch price. Buys at levels below center, takes profit
 * one spacing above the fill. Per-agent grid state is kept in a Map
 * keyed by `agent.id` (one decision per tick).
 */
export function grid({
  gridSpacingPct = 0.05,
  gridLevels = 4,
  amountPerLevelFraction = 0.15,
} = {}) {
  const state = new Map();

  function buildLevels(center) {
    const levels = [];
    for (let i = -gridLevels; i <= gridLevels; i++) {
      if (i === 0) continue;
      levels.push({
        price: center * (1 + i * gridSpacingPct),
        side: i < 0 ? 'buy' : 'sell',
        filled: false,
        tokens: 0,
      });
    }
    return levels.sort((a, b) => a.price - b.price);
  }

  return (agent, context) => {
    let gridState = state.get(agent.id);
    if (!gridState) {
      gridState = { levels: buildLevels(context.launchPrice || context.currentPrice) };
      state.set(agent.id, gridState);
    }

    const { currentPrice } = context;

    for (const level of gridState.levels) {
      if (level.side === 'buy' && !level.filled && currentPrice <= level.price && agent.baseBalance > 0) {
        const spend = agent.baseBalance * amountPerLevelFraction;
        if (spend <= 0) continue;
        level.filled = true;
        level.tokens = spend / currentPrice;
        return { action: 'buy', amount: spend };
      }
    }

    for (const level of gridState.levels) {
      if (level.side === 'buy' && level.filled && agent.tokenBalance > 0) {
        const target = level.price * (1 + gridSpacingPct);
        if (currentPrice >= target) {
          const amount = Math.min(level.tokens, agent.tokenBalance);
          level.filled = false;
          level.tokens = 0;
          return { action: 'sell', amount };
        }
      }
    }

    return HOLD;
  };
}

export { grid as gridBot };
