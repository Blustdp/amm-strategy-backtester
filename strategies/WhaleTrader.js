// WhaleTrader.js
// "Follow the whales" — but the API deliberately never exposes WHO made a
// trade or gives strategies visibility into other agents (matching how a
// real trader can only see aggregate market data, not other accounts'
// internals). So this strategy approximates whale detection the way a
// real trader actually would: watching for a volume spike well above the
// recent average, then following the direction price moved on that spike.
// A single tick with unusually large volume is treated as "probably a
// whale," and the strategy buys if price rose on that spike, sells an
// existing position if price fell on that spike.

export class WhaleTraderStrategy {
  /**
   * @param {object} config
   * @param {number} [config.lookback=20]         window for computing average volume
   * @param {number} [config.spikeMultiple=3]      a tick's volume must exceed avg * this to count as a whale signal
   * @param {number} [config.buyAmount=1000]       base currency spent per buy
   */
  constructor(api, config = {}) {
    this.api = api;
    this.config = {
      lookback: 20,
      spikeMultiple: 3,
      buyAmount: 1000,
      ...config,
    };
    this.position = null; // { entryPrice, amount } | null
  }

  onTick() {
    const { lookback, spikeMultiple, buyAmount } = this.config;
    const volumes = this.api.market.getVolumes(lookback + 1);
    const prices = this.api.market.getPrices(2);
    if (volumes.length < lookback + 1 || prices.length < 2) return;

    const latestVolume = volumes[volumes.length - 1];
    const priorVolumes = volumes.slice(0, -1);
    const avgVolume =
      priorVolumes.reduce((a, b) => a + b, 0) / priorVolumes.length;

    if (avgVolume <= 0 || latestVolume < avgVolume * spikeMultiple) return; // no whale-sized spike this tick

    const priceMoved = prices[1] - prices[0];
    const currentPrice = this.api.market.price();

    if (priceMoved > 0 && this.position === null) {
      // Whale-sized buy pressure — follow it in.
      const { base } = this.api.wallet.balance();
      const spend = Math.min(buyAmount, base);
      if (spend <= 0) return;
      this.api.trade.buy({ amount: spend });
      this.position = {
        entryPrice: currentPrice,
        amount: spend / currentPrice,
      };
    } else if (priceMoved < 0 && this.position !== null) {
      // Whale-sized sell pressure — exit alongside it.
      this.api.trade.sell({ amount: this.position.amount });
      this.position = null;
    }
  }
}
