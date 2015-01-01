// strategies/index.js
// Registry of the six built-in strategies. Users can pass any of these
// (with optional config overrides) to createStrategyAgent(), or write
// their own class following the same shape: constructor(api, config),
// onTick().

import { MovingAverageCrossoverStrategy } from "./MovingAverageCrossover.js";
import { RSIStrategy } from "./RSI.js";
import { DCAStrategy } from "./DCA.js";
import { GridBotStrategy } from "./GridBot.js";
import { WhaleTraderStrategy } from "./WhaleTrader.js";
import { MarketMakerStrategy } from "./MarketMaker.js";

export const DEFAULT_STRATEGIES = {
  movingAverageCrossover: MovingAverageCrossoverStrategy,
  rsi: RSIStrategy,
  dca: DCAStrategy,
  gridBot: GridBotStrategy,
  whaleTrader: WhaleTraderStrategy,
  marketMaker: MarketMakerStrategy,
};

export {
  MovingAverageCrossoverStrategy,
  RSIStrategy,
  DCAStrategy,
  GridBotStrategy,
  WhaleTraderStrategy,
  MarketMakerStrategy,
};
