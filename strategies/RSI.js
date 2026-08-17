import { HOLD, rsi as calcRsi } from './indicators.js';

/**
 * Buy when RSI is oversold, sell when overbought.
 * Holds during indicator warm-up (`period + 1` prices).
 */
export function rsi({
  period = 14,
  oversold = 30,
  overbought = 70,
  tradeFraction = 0.25,
} = {}) {
  return (agent, context) => {
    const value = calcRsi(context.priceHistory, period);
    if (value == null) return HOLD;

    if (value <= oversold && agent.baseBalance > 0) {
      return { action: 'buy', amount: agent.baseBalance * tradeFraction };
    }
    if (value >= overbought && agent.tokenBalance > 0) {
      return { action: 'sell', amount: agent.tokenBalance * tradeFraction };
    }
    return HOLD;
  };
}
