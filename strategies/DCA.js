// DCA.js
// Dollar-Cost Averaging: buy a fixed amount every `intervalTicks`,
// regardless of price. No sell logic — DCA is an accumulation strategy by
// definition; pair it with a separate exit strategy if you want one.
// "Every Monday" from the original spec becomes "every intervalTicks"
// here, since the simulator's clock is ticks, not calendar days —
// intervalTicks=7 with a daily-tick simulation reproduces "weekly."

export class DCAStrategy {
  /**
   * @param {object} config
   * @param {number} [config.intervalTicks=7]   buy every N ticks
   * @param {number} [config.buyAmount=100]      base currency spent per buy
   */
  constructor(api, config = {}) {
    this.api = api;
    this.config = { intervalTicks: 7, buyAmount: 100, ...config };
    this.totalBought = 0; // running total of tokens accumulated, for reporting/inspection
  }

  onTick() {
    const { intervalTicks, buyAmount } = this.config;
    const tick = this.api.market.tick();
    if (tick % intervalTicks !== 0) return;

    const { base } = this.api.wallet.balance();
    const spend = Math.min(buyAmount, base);
    if (spend <= 0) return;

    this.api.trade.buy({ amount: spend });
    this.totalBought += spend / this.api.market.price();
  }
}
