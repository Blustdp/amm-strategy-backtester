import { HOLD } from './indicators.js';

/**
 * Follow volume spikes: if the latest tick's volume is `spikeMultiple`
 * times the recent average, buy when price rose on that spike and sell
 * when it fell. Uses `context.volumeHistory` from TokenSimulator.
 */
export function volumeFollow({
  lookback = 8,
  spikeMultiple = 3,
  tradeFraction = 0.25,
} = {}) {
  return (agent, context) => {
    const volumes = context.volumeHistory || [];
    const prices = context.priceHistory;
    if (volumes.length < lookback + 1 || prices.length < 2) return HOLD;

    const latest = volumes[volumes.length - 1];
    const prior = volumes.slice(-(lookback + 1), -1);
    const avg = prior.reduce((a, b) => a + b, 0) / prior.length;
    if (avg <= 0 || latest < avg * spikeMultiple) return HOLD;

    const priceMoved = prices[prices.length - 1] - prices[prices.length - 2];
    if (priceMoved > 0 && agent.baseBalance > 0) {
      return { action: 'buy', amount: agent.baseBalance * tradeFraction };
    }
    if (priceMoved < 0 && agent.tokenBalance > 0) {
      return { action: 'sell', amount: agent.tokenBalance * tradeFraction };
    }
    return HOLD;
  };
}
