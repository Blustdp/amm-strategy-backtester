// GridBot.js
// Places a grid of price levels around a center price, spaced by
// `gridSpacingPct`. Each level tracks its own fill state: if price falls
// to or below a buy level that hasn't been filled, buy a fixed amount at
// that level; once filled, that level flips to watching for the level
// ABOVE it to sell into (capturing the spacing as profit), then resets
// to buy-watching again once sold. This is the standard grid-trading
// pattern: profit from oscillation within a range, not from a directional bet.

export class GridBotStrategy {
  /**
   * @param {object} config
   * @param {number} [config.centerPrice]        grid center; defaults to price at first tick if omitted
   * @param {number} [config.gridSpacingPct=0.05] spacing between levels, as a fraction (0.05 = 5%)
   * @param {number} [config.gridLevels=5]         number of levels above AND below center
   * @param {number} [config.amountPerLevel=100]   base currency spent per buy at each level
   */
  constructor(api, config = {}) {
    this.api = api;
    this.config = { gridSpacingPct: 0.05, gridLevels: 5, amountPerLevel: 100, ...config };
    this.levels = null; // built lazily on first tick once we know the center price
  }

  _buildLevels(centerPrice) {
    const { gridSpacingPct, gridLevels } = this.config;
    const levels = [];
    for (let i = -gridLevels; i <= gridLevels; i++) {
      if (i === 0) continue; // no level exactly at center
      levels.push({
        price: centerPrice * (1 + i * gridSpacingPct),
        direction: i < 0 ? 'buy' : 'sell', // levels below center are buy levels, above are sell levels
        filled: false, // for buy levels: has this level bought and is waiting to sell higher?
        amount: null, // tokens bought at this level, once filled
      });
    }
    return levels.sort((a, b) => a.price - b.price);
  }

  onTick() {
    const currentPrice = this.api.market.price();
    if (!this.levels) {
      this.levels = this._buildLevels(this.config.centerPrice ?? currentPrice);
    }

    const { amountPerLevel } = this.config;

    for (const level of this.levels) {
      if (level.direction === 'buy' && !level.filled && currentPrice <= level.price) {
        const { base } = this.api.wallet.balance();
        const spend = Math.min(amountPerLevel, base);
        if (spend <= 0) continue;
        this.api.trade.buy({ amount: spend });
        level.filled = true;
        level.amount = spend / currentPrice;
        return; // one order per tick, mirroring how a real exchange fills one order at a time
      }
      if (level.direction === 'sell' && !level.filled && currentPrice >= level.price) {
        // A sell-side grid level with nothing bought yet has nothing to sell —
        // in a full implementation this would open a short; unsupported here,
        // so sell levels only activate once a corresponding buy has filled
        // (handled by the next block instead). Left intentionally inert.
        continue;
      }
    }

    // Check filled buy levels for a take-profit at the next level up.
    for (const level of this.levels) {
      if (level.direction === 'buy' && level.filled) {
        const targetSellPrice = level.price * (1 + this.config.gridSpacingPct);
        if (currentPrice >= targetSellPrice) {
          this.api.trade.sell({ amount: level.amount });
          level.filled = false; // reset so this level can buy again on the next dip
          level.amount = null;
          return;
        }
      }
    }
  }
}
