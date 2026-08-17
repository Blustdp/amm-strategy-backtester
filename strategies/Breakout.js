import { HOLD } from './indicators.js';

/**
 * Buy a break of the prior `lookback` high, sell a break of the prior low.
 */
export function breakout({ lookback = 8, tradeFraction = 0.25 } = {}) {
  return (agent, context) => {
    const { currentPrice, priceHistory } = context;
    if (priceHistory.length < lookback + 1) return HOLD;

    const prior = priceHistory.slice(-(lookback + 1), -1);
    const high = Math.max(...prior);
    const low = Math.min(...prior);

    if (currentPrice >= high && agent.baseBalance > 0) {
      return { action: 'buy', amount: agent.baseBalance * tradeFraction };
    }
    if (currentPrice <= low && agent.tokenBalance > 0) {
      return { action: 'sell', amount: agent.tokenBalance };
    }
    return HOLD;
  };
}
