import { TokenSimulator, strategies, defaultArchetypes } from '../index.js';

const archetypes = [
  {
    type: 'rsi',
    weight: 30,
    balanceRange: [500, 3000],
    strategy: strategies.rsi({ period: 10, oversold: 35 }),
  },
  ...defaultArchetypes(),
];

const results = new TokenSimulator({
  seed: 42,
  agentCount: 100,
  totalTicks: 52,
  archetypes,
}).run();

console.log('Final price:', results.finalPrice);
console.log('Agent summary:', results.agentSummary);
