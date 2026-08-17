/** Shared indicator helpers for factory strategies. */

export function sma(prices, period) {
  if (!prices || prices.length < period) return null;
  const window = prices.slice(-period);
  return window.reduce((a, b) => a + b, 0) / window.length;
}

export function stdev(prices, period) {
  const mean = sma(prices, period);
  if (mean == null) return null;
  const window = prices.slice(-period);
  const variance = window.reduce((sum, p) => sum + (p - mean) ** 2, 0) / window.length;
  return Math.sqrt(variance);
}

export function rsi(prices, period = 14) {
  if (!prices || prices.length < period + 1) return null;
  const window = prices.slice(-(period + 1));
  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i < window.length; i++) {
    const change = window[i] - window[i - 1];
    if (change > 0) gainSum += change;
    else lossSum += -change;
  }
  const avgGain = gainSum / period;
  const avgLoss = lossSum / period;
  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

export const HOLD = { action: 'hold', amount: 0 };
