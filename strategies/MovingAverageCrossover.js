import { HOLD, sma } from './indicators.js';

/**
 * Buy on short MA crossing above long MA, sell on the opposite cross.
 * Stop-loss / take-profit vs `agent.costBasis` can exit any tick.
 * Defaults fit a ~52-tick horizon; raise periods for longer runs.
 */
export function movingAverageCrossover({
  shortPeriod = 5,
  longPeriod = 15,
  tradeFraction = 0.3,
  stopLoss = 0.1,
  takeProfit = 0.2,
} = {}) {
  const prev = new Map();

  return (agent, context) => {
    const { currentPrice, priceHistory } = context;
    const shortMA = sma(priceHistory, shortPeriod);
    const longMA = sma(priceHistory, longPeriod);
    if (shortMA == null || longMA == null) return HOLD;

    if (agent.tokenBalance > 0 && agent.costBasis > 0) {
      const change = (currentPrice - agent.costBasis) / agent.costBasis;
      if (change <= -stopLoss || change >= takeProfit) {
        return { action: 'sell', amount: agent.tokenBalance };
      }
    }

    const last = prev.get(agent.id);
    prev.set(agent.id, { shortMA, longMA });
    if (!last) return HOLD;

    const crossedUp = last.shortMA <= last.longMA && shortMA > longMA;
    const crossedDown = last.shortMA >= last.longMA && shortMA < longMA;

    if (crossedUp && agent.baseBalance > 0 && agent.tokenBalance <= 0) {
      return { action: 'buy', amount: agent.baseBalance * tradeFraction };
    }
    if (crossedDown && agent.tokenBalance > 0) {
      return { action: 'sell', amount: agent.tokenBalance };
    }
    return HOLD;
  };
}
