// Default configuration returned to the client so the form starts
// pre-filled with a reasonable, defensible tokenomics structure.
export const defaultConfig = {
  tokenName: "Blustdp",
  tokenSymbol: "BLUSTDP",
  totalSupply: 1_000_000,
  initialBaseLiquidity: 50_000,
  ammFeeBps: 30,
  totalTicks: 52,
  ticksPerMonth: 4.33,
  agentCount: 500,
  seed: 42,
  allocations: [
    {
      name: "liquidity",
      percentOfSupply: 0.25,
      tgePercent: 1.0,
      cliffMonths: 0,
      vestingMonths: 0,
    },
    {
      name: "community",
      percentOfSupply: 0.25,
      tgePercent: 0.2,
      cliffMonths: 0,
      vestingMonths: 6,
    },
    {
      name: "team",
      percentOfSupply: 0.15,
      tgePercent: 0.0,
      cliffMonths: 12,
      vestingMonths: 24,
    },
    {
      name: "investors",
      percentOfSupply: 0.15,
      tgePercent: 0.05,
      cliffMonths: 6,
      vestingMonths: 18,
    },
    {
      name: "treasury",
      percentOfSupply: 0.15,
      tgePercent: 0.0,
      cliffMonths: 3,
      vestingMonths: 24,
    },
    {
      name: "marketing",
      percentOfSupply: 0.05,
      tgePercent: 0.0,
      cliffMonths: 1,
      vestingMonths: 12,
    },
  ],
};
