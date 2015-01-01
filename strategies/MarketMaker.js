// MarketMaker.js
// A real market maker places TWO resting limit orders simultaneously — a
// bid slightly below spot and an ask slightly above — and profits from
// the spread as both get filled by other traders over time. This engine's
// base api.trade.buy()/sell() only support immediate market orders (no
// resting orders), so this is a simplified approximation, not a faithful
// implementation: each tick, if flat, it buys immediately at the current
// price (standing in for "bid got filled"); once holding a position, it
// sells as soon as price rises by at least `spreadPct` above its entry
// (standing in for "ask got filled"). This captures the SHAPE of
// market-making behavior — buy low, sell slightly higher, repeat — without
// real resting-order infrastructure.
//
// For genuine resting bid/ask orders, use this alongside the OrderBook /
// limit-order system (see blustdp-exchange) instead of this simplified
// version — that project's `type: 'limit'` orders are real resting orders
// checked every tick, which is what a faithful market maker needs.

export class MarketMakerStrategy {
  /**
   * @param {object} config
   * @param {number} [config.spreadPct=0.02]     target spread to capture, as a fraction (0.02 = 2%)
   * @param {number} [config.orderAmount=500]     base currency spent per buy
   */
  constructor(api, config = {}) {
    this.api = api;
    this.config = { spreadPct: 0.02, orderAmount: 500, ...config };
    this.position = null; // { entryPrice, amount } | null
  }

  onTick() {
    const { spreadPct, orderAmount } = this.config;
    const currentPrice = this.api.market.price();

    if (this.position === null) {
      const { base } = this.api.wallet.balance();
      const spend = Math.min(orderAmount, base);
      if (spend <= 0) return;
      this.api.trade.buy({ amount: spend });
      this.position = { entryPrice: currentPrice, amount: spend / currentPrice };
      return;
    }

    const targetSellPrice = this.position.entryPrice * (1 + spreadPct);
    if (currentPrice >= targetSellPrice) {
      this.api.trade.sell({ amount: this.position.amount });
      this.position = null; // immediately eligible to buy again next tick, repeating the cycle
    }
  }
}
