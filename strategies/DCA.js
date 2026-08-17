import { HOLD } from './indicators.js';

/**
 * Dollar-cost average: spend a fixed fraction of the agent's starting
 * base balance every `intervalTicks`, regardless of price. Accumulation
 * only — pair with another strategy if you want an exit.
 */
export function dca({ intervalTicks = 4, buyFraction = 0.1 } = {}) {
  const initialBase = new Map();

  return (agent, context) => {
    if (!initialBase.has(agent.id)) initialBase.set(agent.id, agent.baseBalance);
    if (context.tick % intervalTicks !== 0) return HOLD;

    const spend = Math.min(initialBase.get(agent.id) * buyFraction, agent.baseBalance);
    if (spend <= 0) return HOLD;
    return { action: 'buy', amount: spend };
  };
}
