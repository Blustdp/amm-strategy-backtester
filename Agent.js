/**
 * Agent — a single market participant. Behavior is delegated to a
 * `strategy` function so new archetypes can be plugged in without
 * subclassing (see MarketAgents.js for built-in strategies).
 */
export class Agent {
  /**
   * @param {Object} opts
   * @param {string} opts.id
   * @param {string} opts.type            'whale' | 'bot' | 'retail' | custom label
   * @param {number} opts.baseBalance     Available spending power in base currency
   * @param {number} [opts.tokenBalance=0]
   * @param {Function} opts.strategy      (agent, context) => { action: 'buy'|'sell'|'hold', amount }
   */
  constructor({ id, type, baseBalance, tokenBalance = 0, strategy }) {
    this.id = id;
    this.type = type;
    this.baseBalance = baseBalance;
    this.tokenBalance = tokenBalance;
    this.strategy = strategy;
    this.costBasis = 0; // running average buy price, for PnL tracking
    this.realizedPnl = 0;
  }

  decide(context) {
    return this.strategy(this, context);
  }

  recordBuy(baseSpent, tokensReceived) {
    const prevValue = this.costBasis * this.tokenBalance;
    this.tokenBalance += tokensReceived;
    this.baseBalance -= baseSpent;
    this.costBasis = this.tokenBalance > 0 ? (prevValue + baseSpent) / this.tokenBalance : 0;
  }

  recordSell(tokensSold, baseReceived) {
    this.realizedPnl += baseReceived - tokensSold * this.costBasis;
    this.tokenBalance -= tokensSold;
    this.baseBalance += baseReceived;
  }

  netWorth(currentPrice) {
    return this.baseBalance + this.tokenBalance * currentPrice;
  }
}
