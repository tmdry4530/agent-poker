/**
 * Anti-collusion detection algorithms.
 */

// ── Types ───────────────────────────────────────────────────

export interface HandRecord {
  handId: string;
  agentId: string;
  action: 'fold' | 'check' | 'call' | 'bet' | 'raise';
  handStrength: number; // 0-1 normalized (0 = worst, 1 = nuts)
  opponentId: string;
  won: boolean;
}

export interface CollusionFlag {
  type: 'CHIP_DUMP' | 'WIN_RATE_ANOMALY';
  description: string;
  evidence: Record<string, unknown>;
}

export interface PairAnalysis {
  agentA: string;
  agentB: string;
  riskScore: number; // 0-100
  flags: CollusionFlag[];
  handsAnalyzed: number;
}

// ── ChipDumpDetector ────────────────────────────────────────

/**
 * Detects chip dumping: an agent folding strong hands against a specific opponent.
 * Threshold: >30% fold-with-strong-hand rate per agent pair.
 */
export class ChipDumpDetector {
  private pairRecords = new Map<string, HandRecord[]>();
  private strongHandThreshold: number;
  private foldRateThreshold: number;

  constructor(strongHandThreshold = 0.6, foldRateThreshold = 0.3) {
    this.strongHandThreshold = strongHandThreshold;
    this.foldRateThreshold = foldRateThreshold;
  }

  private pairKey(a: string, b: string): string {
    return [a, b].sort().join(':');
  }

  addRecord(record: HandRecord): void {
    const key = this.pairKey(record.agentId, record.opponentId);
    const records = this.pairRecords.get(key);
    if (records) {
      records.push(record);
    } else {
      this.pairRecords.set(key, [record]);
    }
  }

  analyze(agentA: string, agentB: string): CollusionFlag | null {
    const key = this.pairKey(agentA, agentB);
    const records = this.pairRecords.get(key) ?? [];

    if (records.length < 10) {
      return null; // Not enough data
    }

    // Check agent A folding strong hands against agent B
    const flagA = this.checkFoldRate(records, agentA);
    if (flagA) return flagA;

    // Check agent B folding strong hands against agent A
    const flagB = this.checkFoldRate(records, agentB);
    if (flagB) return flagB;

    return null;
  }

  private checkFoldRate(records: HandRecord[], agentId: string): CollusionFlag | null {
    const agentRecords = records.filter((r) => r.agentId === agentId);
    const strongHands = agentRecords.filter((r) => r.handStrength >= this.strongHandThreshold);

    if (strongHands.length < 5) {
      return null; // Not enough strong hand samples
    }

    const foldedStrong = strongHands.filter((r) => r.action === 'fold');
    const foldRate = foldedStrong.length / strongHands.length;

    if (foldRate > this.foldRateThreshold) {
      return {
        type: 'CHIP_DUMP',
        description: `Agent ${agentId} folds strong hands at ${(foldRate * 100).toFixed(1)}% rate (threshold: ${this.foldRateThreshold * 100}%)`,
        evidence: {
          agentId,
          foldRate,
          strongHandCount: strongHands.length,
          foldedCount: foldedStrong.length,
        },
      };
    }

    return null;
  }

  getRecordCount(agentA: string, agentB: string): number {
    const key = this.pairKey(agentA, agentB);
    return this.pairRecords.get(key)?.length ?? 0;
  }
}

// ── WinRateAnomalyDetector ──────────────────────────────────

/**
 * Detects win rate anomalies: an agent winning at >3 stddev from mean.
 */
export class WinRateAnomalyDetector {
  private agentWins = new Map<string, number>();
  private agentHands = new Map<string, number>();
  private stddevThreshold: number;

  constructor(stddevThreshold = 3) {
    this.stddevThreshold = stddevThreshold;
  }

  addResult(agentId: string, won: boolean): void {
    this.agentHands.set(agentId, (this.agentHands.get(agentId) ?? 0) + 1);
    if (won) {
      this.agentWins.set(agentId, (this.agentWins.get(agentId) ?? 0) + 1);
    }
  }

  analyze(agentId: string): CollusionFlag | null {
    const hands = this.agentHands.get(agentId) ?? 0;
    if (hands < 20) {
      return null; // Not enough data
    }

    const winRates = this.getAllWinRates();
    if (winRates.length < 3) {
      return null; // Not enough agents for meaningful statistics
    }

    const mean = winRates.reduce((sum, r) => sum + r, 0) / winRates.length;
    const variance = winRates.reduce((sum, r) => sum + (r - mean) ** 2, 0) / winRates.length;
    const stddev = Math.sqrt(variance);

    if (stddev === 0) {
      return null; // All agents have the same win rate
    }

    const agentWinRate = (this.agentWins.get(agentId) ?? 0) / hands;
    const zScore = (agentWinRate - mean) / stddev;

    if (Math.abs(zScore) > this.stddevThreshold) {
      return {
        type: 'WIN_RATE_ANOMALY',
        description: `Agent ${agentId} win rate ${(agentWinRate * 100).toFixed(1)}% is ${zScore.toFixed(2)} stddev from mean ${(mean * 100).toFixed(1)}%`,
        evidence: {
          agentId,
          winRate: agentWinRate,
          mean,
          stddev,
          zScore,
          handsPlayed: hands,
        },
      };
    }

    return null;
  }

  private getAllWinRates(): number[] {
    const rates: number[] = [];
    for (const [agentId, hands] of this.agentHands) {
      if (hands >= 20) {
        rates.push((this.agentWins.get(agentId) ?? 0) / hands);
      }
    }
    return rates;
  }

  getAgentStats(agentId: string): { hands: number; wins: number; winRate: number } | null {
    const hands = this.agentHands.get(agentId) ?? 0;
    if (hands === 0) return null;
    const wins = this.agentWins.get(agentId) ?? 0;
    return { hands, wins, winRate: wins / hands };
  }
}

// ── Combined Analysis ───────────────────────────────────────

/**
 * Analyze an agent pair for collusion indicators.
 */
export function analyzeAgentPair(
  chipDumpDetector: ChipDumpDetector,
  winRateDetector: WinRateAnomalyDetector,
  agentA: string,
  agentB: string,
): PairAnalysis {
  const flags: CollusionFlag[] = [];

  // Check chip dumping
  const chipDumpFlag = chipDumpDetector.analyze(agentA, agentB);
  if (chipDumpFlag) {
    flags.push(chipDumpFlag);
  }

  // Check win rate anomalies for both agents
  const winRateFlagA = winRateDetector.analyze(agentA);
  if (winRateFlagA) {
    flags.push(winRateFlagA);
  }

  const winRateFlagB = winRateDetector.analyze(agentB);
  if (winRateFlagB) {
    flags.push(winRateFlagB);
  }

  // Calculate risk score (0-100)
  let riskScore = 0;
  for (const flag of flags) {
    if (flag.type === 'CHIP_DUMP') {
      riskScore += 50;
    }
    if (flag.type === 'WIN_RATE_ANOMALY') {
      riskScore += 30;
    }
  }
  riskScore = Math.min(100, riskScore);

  return {
    agentA,
    agentB,
    riskScore,
    flags,
    handsAnalyzed: chipDumpDetector.getRecordCount(agentA, agentB),
  };
}
