// RSI.js
// Classic Relative Strength Index strategy: buy when RSI drops below the
// oversold threshold (default 30), sell when it rises above the
// overbought threshold (default 70). RSI is computed using the standard
// average-gain / average-loss formula over `period` ticks.

export class RSIStrategy {
  /**
   * @param {object} config
   * @param {number} [config.period=14]        lookback window for RSI
   * @param {number} [config.oversold=30]        buy trigger
   * @param {number} [config.overbought=70]      sell trigger
   * @param {number} [config.buyAmount=1000]     base currency spent per buy
   */
  constructor(api, config = {}) {
    this.api = api;
    this.config = { period: 14, oversold: 30, overbought: 70, buyAmount: 1000, ...config };
    this.position = null; // { entryPrice, amount } | null
  }

  onTick() {
    const { period, oversold, overbought, buyAmount } = this.config;
    const prices = this.api.market.getPrices(period + 1); // need period+1 prices to get `period` price changes
    if (prices.length < period + 1) return;

    const rsi = this._calculateRSI(prices, period);
    const currentPrice = this.api.market.price();

    if (rsi <= oversold && this.position === null) {
      const { base } = this.api.wallet.balance();
      const spend = Math.min(buyAmount, base);
      if (spend <= 0) return;
      this.api.trade.buy({ amount: spend });
      this.position = { entryPrice: currentPrice, amount: spend / currentPrice };
    } else if (rsi >= overbought && this.position !== null) {
      this.api.trade.sell({ amount: this.position.amount });
      this.position = null;
    }
  }

  _calculateRSI(prices, period) {
    let gainSum = 0;
    let lossSum = 0;
    for (let i = prices.length - period; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) gainSum += change;
      else lossSum += -change;
    }
    const avgGain = gainSum / period;
    const avgLoss = lossSum / period;

    if (avgLoss === 0) return avgGain === 0 ? 50 : 100; // no losses at all -> maximally overbought (or perfectly flat -> neutral)
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  }
}
