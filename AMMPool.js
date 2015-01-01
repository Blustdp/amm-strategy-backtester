/**
 * AMMPool — a constant-product (x*y=k) automated market maker,
 * modeled after Uniswap-v2-style pools. Tracks a token reserve
 * and a base-currency reserve (e.g. USD, USDC, SOL, ETH — whatever
 * Blustdp is paired against).
 */
export class AMMPool {
  /**
   * @param {Object} opts
   * @param {number} opts.tokenReserve   Initial token liquidity
   * @param {number} opts.baseReserve    Initial base-currency liquidity
   * @param {number} [opts.feeBps=30]    Trading fee in basis points (30 = 0.3%)
   */
  constructor({ tokenReserve, baseReserve, feeBps = 30 }) {
    if (tokenReserve <= 0 || baseReserve <= 0) {
      throw new Error('AMMPool requires positive initial reserves');
    }
    this.tokenReserve = tokenReserve;
    this.baseReserve = baseReserve;
    this.k = tokenReserve * baseReserve;
    this.feeBps = feeBps;
    this.cumulativeVolumeBase = 0;
    this.tradeCount = 0;
  }

  /** Current spot price, expressed as base currency per token */
  getPrice() {
    return this.baseReserve / this.tokenReserve;
  }

  /** Market cap given a circulating supply figure */
  getMarketCap(circulatingSupply) {
    return this.getPrice() * circulatingSupply;
  }

  /**
   * Buy tokens by spending `baseAmountIn` of the base currency.
   * Returns tokens received and resulting price impact.
   */
  buy(baseAmountIn) {
    if (baseAmountIn <= 0) return { tokensOut: 0, priceImpact: 0, newPrice: this.getPrice() };
    const priceBefore = this.getPrice();
    const feeAdjusted = baseAmountIn * (1 - this.feeBps / 10000);
    const newBaseReserve = this.baseReserve + feeAdjusted;
    const newTokenReserve = this.k / newBaseReserve;
    const tokensOut = this.tokenReserve - newTokenReserve;

    this.baseReserve += baseAmountIn; // full amount enters pool (fee stays in reserve)
    this.tokenReserve = newTokenReserve;
    this.k = this.tokenReserve * this.baseReserve;

    this.cumulativeVolumeBase += baseAmountIn;
    this.tradeCount += 1;

    const priceAfter = this.getPrice();
    return {
      tokensOut,
      priceImpact: (priceAfter - priceBefore) / priceBefore,
      newPrice: priceAfter,
    };
  }

  /**
   * Sell `tokenAmountIn` tokens into the pool for the base currency.
   * Returns base currency received and resulting price impact.
   */
  sell(tokenAmountIn) {
    if (tokenAmountIn <= 0) return { baseOut: 0, priceImpact: 0, newPrice: this.getPrice() };
    const priceBefore = this.getPrice();
    const feeAdjusted = tokenAmountIn * (1 - this.feeBps / 10000);
    const newTokenReserve = this.tokenReserve + feeAdjusted;
    const newBaseReserve = this.k / newTokenReserve;
    const baseOut = this.baseReserve - newBaseReserve;

    this.tokenReserve += tokenAmountIn;
    this.baseReserve = newBaseReserve;
    this.k = this.tokenReserve * this.baseReserve;

    this.cumulativeVolumeBase += baseOut;
    this.tradeCount += 1;

    const priceAfter = this.getPrice();
    return {
      baseOut,
      priceImpact: (priceAfter - priceBefore) / priceBefore,
      newPrice: priceAfter,
    };
  }
}
