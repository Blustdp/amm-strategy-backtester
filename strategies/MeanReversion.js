import { HOLD, sma, stdev } from './indicators.js';

/**
 * Buy when price is `stdDevs` below the SMA, sell when it is that far above.
 */
export function meanReversion({
  period = 10,
  stdDevs = 1.5,
  tradeFraction = 0.2,
} = {}) {
  return (agent, context) => {
    const { currentPrice, priceHistory } = context;
    const mean = sma(priceHistory, period);
    const sd = stdev(priceHistory, period);
    if (mean == null || sd == null || sd === 0) return HOLD;

    if (currentPrice <= mean - stdDevs * sd && agent.baseBalance > 0) {
      return { action: 'buy', amount: agent.baseBalance * tradeFraction };
    }
    if (currentPrice >= mean + stdDevs * sd && agent.tokenBalance > 0) {
      return { action: 'sell', amount: agent.tokenBalance * tradeFraction };
    }
    return HOLD;
  };
}
