import assert from 'assert';
import { TokenSimulator, strategies, defaultArchetypes } from '../index.js';

const NAMES = [
  'whale',
  'bot',
  'retail',
  'rsi',
  'dca',
  'grid',
  'movingAverageCrossover',
  'marketMaker',
  'volumeFollow',
  'meanReversion',
  'breakout',
];

for (const name of NAMES) {
  assert.strictEqual(typeof strategies[name], 'function', `${name} should be a factory`);
  const decision = strategies[name]();
  assert.strictEqual(typeof decision, 'function', `${name}() should return a decision fn`);
}

const defaultRun = new TokenSimulator({ seed: 42, agentCount: 40, totalTicks: 24 }).run();
assert.ok(Number.isFinite(defaultRun.finalPrice));
assert.ok(defaultRun.agentSummary.whale);
assert.ok(defaultRun.agentSummary.bot);
assert.ok(defaultRun.agentSummary.retail);

const replay = new TokenSimulator({ seed: 42, agentCount: 40, totalTicks: 24 }).run();
assert.strictEqual(replay.finalPrice, defaultRun.finalPrice, 'same seed should replay');

for (const name of NAMES) {
  const results = new TokenSimulator({
    seed: 7,
    agentCount: 30,
    totalTicks: 36,
    archetypes: [
      {
        type: name,
        weight: 1,
        balanceRange: [1000, 1000],
        strategy: strategies[name](),
      },
    ],
  }).run();

  assert.ok(Number.isFinite(results.finalPrice), `${name} should produce a price`);
  assert.ok(results.agentSummary[name], `${name} should appear in agentSummary`);
  assert.strictEqual(results.agentSummary[name].count, 30);
  assert.ok(Array.isArray(results.priceHistory) && results.priceHistory.length > 1);
}

const mixed = new TokenSimulator({
  seed: 99,
  agentCount: 80,
  totalTicks: 20,
  archetypes: [
    {
      type: 'rsi',
      weight: 40,
      balanceRange: [500, 2000],
      strategy: strategies.rsi({ period: 8 }),
    },
    {
      type: 'retail',
      weight: 60,
      balanceRange: [50, 2000],
      strategy: defaultArchetypes()[2].strategy,
    },
  ],
}).run();
assert.ok(mixed.agentSummary.rsi);
assert.ok(mixed.agentSummary.retail);

console.log('ok —', NAMES.length, 'strategies, replay, and mixed population');
