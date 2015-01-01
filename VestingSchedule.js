/**
 * VestingSchedule — models TGE unlock + cliff + linear vesting
 * for a single allocation bucket (team, investors, community, etc).
 */
export class VestingSchedule {
  /**
   * @param {Object} opts
   * @param {string} opts.name              Bucket name, e.g. "team"
   * @param {number} opts.totalAmount       Total tokens allocated to this bucket
   * @param {number} [opts.tgePercent=0]    Fraction (0-1) unlocked immediately at TGE
   * @param {number} [opts.cliffMonths=0]   Months before any post-TGE vesting starts
   * @param {number} [opts.vestingMonths=0] Months over which the remainder vests linearly after the cliff
   */
  constructor({ name, totalAmount, tgePercent = 0, cliffMonths = 0, vestingMonths = 0 }) {
    this.name = name;
    this.totalAmount = totalAmount;
    this.tgePercent = tgePercent;
    this.cliffMonths = cliffMonths;
    this.vestingMonths = vestingMonths;
  }

  /**
   * Cumulative unlocked amount at a given month index (0 = TGE).
   */
  unlockedAt(monthIndex) {
    const tgeAmount = this.totalAmount * this.tgePercent;
    if (monthIndex <= 0) return tgeAmount;

    const remainder = this.totalAmount - tgeAmount;
    if (this.vestingMonths <= 0) {
      // No linear vesting configured — remainder unlocks right after cliff
      return monthIndex >= this.cliffMonths ? this.totalAmount : tgeAmount;
    }

    const monthsPastCliff = monthIndex - this.cliffMonths;
    if (monthsPastCliff <= 0) return tgeAmount;

    const vestedFraction = Math.min(1, monthsPastCliff / this.vestingMonths);
    return tgeAmount + remainder * vestedFraction;
  }

  /** Amount that newly unlocks between month (monthIndex-1) and monthIndex */
  unlockDelta(monthIndex) {
    if (monthIndex <= 0) return this.unlockedAt(0);
    return this.unlockedAt(monthIndex) - this.unlockedAt(monthIndex - 1);
  }
}

/**
 * A collection of VestingSchedules representing the full tokenomics
 * allocation split (must sum to <= totalSupply).
 */
export class AllocationPlan {
  constructor(totalSupply) {
    this.totalSupply = totalSupply;
    this.buckets = [];
  }

  addBucket(config) {
    const amount = config.percentOfSupply != null
      ? this.totalSupply * config.percentOfSupply
      : config.totalAmount;
    const bucket = new VestingSchedule({ ...config, totalAmount: amount });
    this.buckets.push(bucket);
    return bucket;
  }

  totalAllocated() {
    return this.buckets.reduce((s, b) => s + b.totalAmount, 0);
  }

  /** Total circulating supply unlocked across all buckets at a given month */
  circulatingSupplyAt(monthIndex) {
    return this.buckets.reduce((s, b) => s + b.unlockedAt(monthIndex), 0);
  }

  getBucket(name) {
    return this.buckets.find((b) => b.name === name);
  }
}
