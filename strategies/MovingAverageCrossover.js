// MovingAverageCrossover.js
// Buys when the short-period MA crosses above the long-period MA (uptrend
// signal), sells when it crosses back below, with optional stop-loss and
// take-profit exits checked every tick regardless of MA state.
//
// Fixes two bugs from the original sample this was based on:
//   1. calculateMA now divides by the actual number of prices available
//      (recent.length), not the target period — the original version
//      silently produced an artificially low average during the first
//      `period` ticks, before enough history existed.
//   2. position now stores `amount` (how many tokens were actually
//      bought), which the original never set — its sell() call referenced
//      `this.position.amount` while only ever setting `entryPrice`.

export class MovingAverageCrossoverStrategy {
  /**
   * @param {import('../StrategyAPI.js').StrategyAPI} api
   * @param {object} config
   * @param {number} [config.shortPeriod=20]
   * @param {number} [config.longPeriod=50]
   * @param {number} [config.buyAmount=1000]   base currency spent per buy
   * @param {number} [config.stopLoss=0.1]     fraction below entry price that triggers an exit, e.g. 0.1 = -10%
   * @param {number} [config.takeProfit=0.2]   fraction above entry price that triggers an exit, e.g. 0.2 = +20%
   */
  constructor(api, config = {}) {
    this.api = api;
    this.config = {
      shortPeriod: 20,
      longPeriod: 50,
      buyAmount: 1000,
      stopLoss: 0.1,
      takeProfit: 0.2,
      ...config,
    };
    this.position = null; // { entryPrice, amount } | null
  }

  onTick() {
    const { shortPeriod, longPeriod, buyAmount, stopLoss, takeProfit } = this.config;
    const prices = this.api.market.getPrices(longPeriod);
    if (prices.length < shortPeriod) return; // not enough history to compute even the short MA yet

    const shortMA = this._calculateMA(prices, shortPeriod);
    const longMA = this._calculateMA(prices, longPeriod);
    const currentPrice = this.api.market.price();

    // Exit checks run regardless of MA state — a stop-loss shouldn't wait for a crossover to fire.
    if (this.position) {
      const changeFromEntry = (currentPrice - this.position.entryPrice) / this.position.entryPrice;
      if (changeFromEntry <= -stopLoss || changeFromEntry >= takeProfit) {
        this.api.trade.sell({ amount: this.position.amount });
        this.position = null;
        return;
      }
    }

    if (longMA === null) return; // not enough history for the long MA yet — crossover signal isn't meaningful

    if (shortMA > longMA && this.position === null) {
      const { base } = this.api.wallet.balance();
      const spend = Math.min(buyAmount, base);
      if (spend <= 0) return;
      this.api.trade.buy({ amount: spend });
      // We don't get tokensOut back through this API by design (it mirrors
      // a real exchange call, which doesn't hand you the fill synchronously
      // either) — approximate the position size from spend/price. Slightly
      // off from the exact fill due to price impact/fees, but close enough
      // for exit-trigger purposes; a strategy that needs the exact fill
      // should read it back via wallet.balance() on the NEXT tick.
      this.position = { entryPrice: currentPrice, amount: spend / currentPrice };
    } else if (shortMA < longMA && this.position !== null) {
      this.api.trade.sell({ amount: this.position.amount });
      this.position = null;
    }
  }

  _calculateMA(prices, period) {
    const recent = prices.slice(-period);
    if (recent.length < period) return null; // not enough data for this specific MA yet
    const sum = recent.reduce((a, b) => a + b, 0);
    return sum / recent.length; // fixed: divide by what we actually have, not the target period
  }
}
