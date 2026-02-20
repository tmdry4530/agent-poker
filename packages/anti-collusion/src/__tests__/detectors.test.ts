import { describe, it, expect, beforeEach } from 'vitest';
import {
  ChipDumpDetector,
  WinRateAnomalyDetector,
  analyzeAgentPair,
  type HandRecord,
} from '../detectors.js';

// ── Helpers ─────────────────────────────────────────────────

function makeRecord(overrides: Partial<HandRecord> = {}): HandRecord {
  return {
    handId: `hand-${Math.random().toString(36).slice(2, 6)}`,
    agentId: 'agent-a',
    action: 'call',
    handStrength: 0.5,
    opponentId: 'agent-b',
    won: false,
    ...overrides,
  };
}

/**
 * Add N records with given overrides to the detector.
 */
function addRecords(detector: ChipDumpDetector, count: number, overrides: Partial<HandRecord> = {}): void {
  for (let i = 0; i < count; i++) {
    detector.addRecord(makeRecord({ handId: `hand-${i}`, ...overrides }));
  }
}

// ══════════════════════════════════════════════════════════════
// ChipDumpDetector
// ══════════════════════════════════════════════════════════════

describe('ChipDumpDetector', () => {
  let detector: ChipDumpDetector;

  beforeEach(() => {
    detector = new ChipDumpDetector();
  });

  // ── 1. Not enough data ──────────────────────────────────────

  it('returns null when fewer than 10 records exist for a pair', () => {
    addRecords(detector, 9, { agentId: 'agent-a', opponentId: 'agent-b', handStrength: 0.9, action: 'fold' });
    expect(detector.analyze('agent-a', 'agent-b')).toBeNull();
  });

  // ── 2. Normal play ─────────────────────────────────────────

  it('returns null for normal play (no excessive strong-hand folding)', () => {
    // 20 records, strong hands but agent calls/raises
    for (let i = 0; i < 20; i++) {
      detector.addRecord(makeRecord({
        handId: `h-${i}`,
        agentId: 'agent-a',
        opponentId: 'agent-b',
        handStrength: 0.8,
        action: i % 2 === 0 ? 'call' : 'raise',
      }));
    }
    expect(detector.analyze('agent-a', 'agent-b')).toBeNull();
  });

  // ── 3. Obvious chip dumping ────────────────────────────────

  it('detects chip dumping when agent folds strong hands >30%', () => {
    // 10 strong hand records: 5 fold, 5 call -> fold rate = 50% > 30%
    for (let i = 0; i < 10; i++) {
      detector.addRecord(makeRecord({
        handId: `h-${i}`,
        agentId: 'agent-a',
        opponentId: 'agent-b',
        handStrength: 0.8,
        action: i < 5 ? 'fold' : 'call',
      }));
    }
    const flag = detector.analyze('agent-a', 'agent-b');
    expect(flag).not.toBeNull();
    expect(flag!.type).toBe('CHIP_DUMP');
    expect((flag!.evidence as any).foldRate).toBeCloseTo(0.5);
  });

  // ── 4. Exactly at threshold (not exceeded) ─────────────────

  it('returns null when fold rate is exactly at threshold (30%)', () => {
    // 10 strong hands: 3 fold, 7 call -> fold rate = 30% (not > 30%)
    for (let i = 0; i < 10; i++) {
      detector.addRecord(makeRecord({
        handId: `h-${i}`,
        agentId: 'agent-a',
        opponentId: 'agent-b',
        handStrength: 0.8,
        action: i < 3 ? 'fold' : 'call',
      }));
    }
    expect(detector.analyze('agent-a', 'agent-b')).toBeNull();
  });

  // ── 5. Just above threshold ────────────────────────────────

  it('detects when fold rate is just above threshold', () => {
    // Need >30%: 4 fold out of 10 strong hands = 40%
    for (let i = 0; i < 10; i++) {
      detector.addRecord(makeRecord({
        handId: `h-${i}`,
        agentId: 'agent-a',
        opponentId: 'agent-b',
        handStrength: 0.7,
        action: i < 4 ? 'fold' : 'call',
      }));
    }
    const flag = detector.analyze('agent-a', 'agent-b');
    expect(flag).not.toBeNull();
    expect(flag!.type).toBe('CHIP_DUMP');
  });

  // ── 6. Pair key is order-independent ───────────────────────

  it('treats pair (A, B) the same as (B, A)', () => {
    addRecords(detector, 15, { agentId: 'x', opponentId: 'y', handStrength: 0.9, action: 'fold' });
    const flag1 = detector.analyze('x', 'y');
    const flag2 = detector.analyze('y', 'x');
    // Both should return the same result (same pair key)
    expect(flag1).toEqual(flag2);
  });

  // ── 7. Weak hands folding is normal ────────────────────────

  it('ignores folds with weak hands (below strength threshold)', () => {
    // All folds but with weak hands (below 0.6 default threshold)
    for (let i = 0; i < 20; i++) {
      detector.addRecord(makeRecord({
        handId: `h-${i}`,
        agentId: 'agent-a',
        opponentId: 'agent-b',
        handStrength: 0.3,
        action: 'fold',
      }));
    }
    expect(detector.analyze('agent-a', 'agent-b')).toBeNull();
  });

  // ── 8. Not enough strong hand samples (<5) ─────────────────

  it('returns null when not enough strong hand samples (< 5)', () => {
    // 10 records total, but only 4 strong hands
    for (let i = 0; i < 6; i++) {
      detector.addRecord(makeRecord({
        handId: `h-weak-${i}`,
        agentId: 'agent-a',
        opponentId: 'agent-b',
        handStrength: 0.3,
        action: 'fold',
      }));
    }
    for (let i = 0; i < 4; i++) {
      detector.addRecord(makeRecord({
        handId: `h-strong-${i}`,
        agentId: 'agent-a',
        opponentId: 'agent-b',
        handStrength: 0.9,
        action: 'fold',
      }));
    }
    expect(detector.analyze('agent-a', 'agent-b')).toBeNull();
  });

  // ── 9. Detection for agent B (not just agent A) ────────────

  it('detects chip dumping from agent B against agent A', () => {
    // Agent B folds strong hands against agent A
    for (let i = 0; i < 10; i++) {
      detector.addRecord(makeRecord({
        handId: `h-${i}`,
        agentId: 'agent-b',
        opponentId: 'agent-a',
        handStrength: 0.85,
        action: i < 5 ? 'fold' : 'call',
      }));
    }
    const flag = detector.analyze('agent-a', 'agent-b');
    expect(flag).not.toBeNull();
    expect(flag!.type).toBe('CHIP_DUMP');
    expect((flag!.evidence as any).agentId).toBe('agent-b');
  });

  // ── 10. Custom thresholds ──────────────────────────────────

  it('respects custom thresholds', () => {
    const strictDetector = new ChipDumpDetector(0.5, 0.2);
    // 10 strong hands (>= 0.5): 3 folds out of 10 = 30% > 20%
    for (let i = 0; i < 10; i++) {
      strictDetector.addRecord(makeRecord({
        handId: `h-${i}`,
        agentId: 'agent-a',
        opponentId: 'agent-b',
        handStrength: 0.6,
        action: i < 3 ? 'fold' : 'call',
      }));
    }
    const flag = strictDetector.analyze('agent-a', 'agent-b');
    expect(flag).not.toBeNull();
    expect(flag!.type).toBe('CHIP_DUMP');
  });

  // ── 11. getRecordCount ─────────────────────────────────────

  it('tracks record count per pair', () => {
    expect(detector.getRecordCount('a', 'b')).toBe(0);
    addRecords(detector, 5, { agentId: 'a', opponentId: 'b' });
    expect(detector.getRecordCount('a', 'b')).toBe(5);
    expect(detector.getRecordCount('b', 'a')).toBe(5); // order-independent
  });

  // ── 12. Multiple pairs are independent ─────────────────────

  it('keeps separate records for different pairs', () => {
    addRecords(detector, 15, { agentId: 'a', opponentId: 'b', handStrength: 0.9, action: 'fold' });
    addRecords(detector, 15, { agentId: 'a', opponentId: 'c', handStrength: 0.9, action: 'call' });
    expect(detector.analyze('a', 'b')).not.toBeNull();
    expect(detector.analyze('a', 'c')).toBeNull();
  });

  // ── 13. Evidence structure ─────────────────────────────────

  it('includes correct evidence data in flag', () => {
    for (let i = 0; i < 10; i++) {
      detector.addRecord(makeRecord({
        handId: `h-${i}`,
        agentId: 'agent-a',
        opponentId: 'agent-b',
        handStrength: 0.8,
        action: 'fold', // 100% fold rate
      }));
    }
    const flag = detector.analyze('agent-a', 'agent-b');
    expect(flag).not.toBeNull();
    const ev = flag!.evidence as any;
    expect(ev.agentId).toBe('agent-a');
    expect(ev.foldRate).toBe(1);
    expect(ev.strongHandCount).toBe(10);
    expect(ev.foldedCount).toBe(10);
  });
});

// ══════════════════════════════════════════════════════════════
// WinRateAnomalyDetector
// ══════════════════════════════════════════════════════════════

describe('WinRateAnomalyDetector', () => {
  let detector: WinRateAnomalyDetector;

  beforeEach(() => {
    detector = new WinRateAnomalyDetector();
  });

  // ── 14. Not enough data for single agent ───────────────────

  it('returns null when agent has fewer than 20 hands', () => {
    for (let i = 0; i < 19; i++) {
      detector.addResult('agent-a', true);
    }
    expect(detector.analyze('agent-a')).toBeNull();
  });

  // ── 15. Not enough agents for statistics ───────────────────

  it('returns null when fewer than 3 agents have enough data', () => {
    for (let i = 0; i < 30; i++) {
      detector.addResult('agent-a', true);
      detector.addResult('agent-b', false);
    }
    // Only 2 agents, need 3 for meaningful statistics
    expect(detector.analyze('agent-a')).toBeNull();
  });

  // ── 16. Normal win rates ───────────────────────────────────

  it('returns null for normal win rates across agents', () => {
    // 4 agents all winning ~50%
    for (let i = 0; i < 40; i++) {
      detector.addResult('agent-a', i % 2 === 0);
      detector.addResult('agent-b', i % 2 === 1);
      detector.addResult('agent-c', i % 3 === 0);
      detector.addResult('agent-d', i % 3 === 1);
    }
    expect(detector.analyze('agent-a')).toBeNull();
    expect(detector.analyze('agent-b')).toBeNull();
  });

  // ── 17. Extreme win rate anomaly (high) ────────────────────

  it('detects abnormally high win rate', () => {
    // Need many agents with similar rates so stddev is small, one extreme outlier.
    // 8 agents at 25% win rate, 1 outlier at 100%.
    // mean ~ (0.25*8 + 1.0)/9 = 0.333, stddev ~ 0.25
    // z-score for outlier = (1.0 - 0.333)/0.25 ~ 2.67 — still not >3
    // Use 10 agents at exactly 25%, 1 outlier at 100%
    // mean = (0.25*10 + 1.0)/11 = 0.318, stddev of [0.25x10, 1.0]
    // variance = (10*(0.25-0.318)^2 + (1.0-0.318)^2)/11 = (10*0.00462 + 0.465)/11 = 0.0463+0.0423 = 0.0464+0.0423
    // Let's just use many agents to shrink stddev
    for (let i = 0; i < 40; i++) {
      detector.addResult('outlier', true); // 100%
      // 20 normal agents at 25%
      for (let a = 0; a < 20; a++) {
        detector.addResult(`norm-${a}`, i < 10); // 25%
      }
    }
    const flag = detector.analyze('outlier');
    expect(flag).not.toBeNull();
    expect(flag!.type).toBe('WIN_RATE_ANOMALY');
    const ev = flag!.evidence as any;
    expect(ev.zScore).toBeGreaterThan(3);
  });

  // ── 18. Extreme win rate anomaly (low) ─────────────────────

  it('detects abnormally low win rate', () => {
    // 20 agents at 75% win rate, 1 outlier at 0%
    for (let i = 0; i < 40; i++) {
      detector.addResult('loser', false); // 0%
      for (let a = 0; a < 20; a++) {
        detector.addResult(`winner-${a}`, i < 30); // 75%
      }
    }
    const flag = detector.analyze('loser');
    expect(flag).not.toBeNull();
    expect(flag!.type).toBe('WIN_RATE_ANOMALY');
    const ev = flag!.evidence as any;
    expect(ev.zScore).toBeLessThan(-3);
  });

  // ── 19. All same win rate → stddev=0 → null ────────────────

  it('returns null when all agents have identical win rate (stddev=0)', () => {
    // All agents win exactly 50%
    for (let i = 0; i < 40; i++) {
      detector.addResult('agent-a', i % 2 === 0);
      detector.addResult('agent-b', i % 2 === 0);
      detector.addResult('agent-c', i % 2 === 0);
    }
    expect(detector.analyze('agent-a')).toBeNull();
  });

  // ── 20. Custom stddev threshold ────────────────────────────

  it('detects anomaly with lower stddev threshold', () => {
    const strictDetector = new WinRateAnomalyDetector(1.5);
    // agent-a wins 80%, others ~40%
    for (let i = 0; i < 30; i++) {
      strictDetector.addResult('agent-a', i < 24); // 80%
      strictDetector.addResult('agent-b', i < 12); // 40%
      strictDetector.addResult('agent-c', i < 12); // 40%
      strictDetector.addResult('agent-d', i < 12); // 40%
    }
    const flag = strictDetector.analyze('agent-a');
    expect(flag).not.toBeNull();
    expect(flag!.type).toBe('WIN_RATE_ANOMALY');
  });

  // ── 21. getAgentStats ──────────────────────────────────────

  it('returns correct agent stats', () => {
    for (let i = 0; i < 10; i++) {
      detector.addResult('agent-x', i < 3);
    }
    const stats = detector.getAgentStats('agent-x');
    expect(stats).not.toBeNull();
    expect(stats!.hands).toBe(10);
    expect(stats!.wins).toBe(3);
    expect(stats!.winRate).toBeCloseTo(0.3);
  });

  // ── 22. getAgentStats for unknown agent ────────────────────

  it('returns null for unknown agent stats', () => {
    expect(detector.getAgentStats('unknown')).toBeNull();
  });

  // ── 23. Evidence structure ─────────────────────────────────

  it('includes correct evidence data in flag', () => {
    // Use many agents with tight clustering + 1 outlier to get >3 stddev
    for (let i = 0; i < 40; i++) {
      detector.addResult('agent-a', true); // 100%
      for (let a = 0; a < 20; a++) {
        detector.addResult(`n-${a}`, i < 10); // 25%
      }
    }
    const flag = detector.analyze('agent-a');
    expect(flag).not.toBeNull();
    const ev = flag!.evidence as any;
    expect(ev.agentId).toBe('agent-a');
    expect(typeof ev.winRate).toBe('number');
    expect(typeof ev.mean).toBe('number');
    expect(typeof ev.stddev).toBe('number');
    expect(typeof ev.zScore).toBe('number');
    expect(ev.handsPlayed).toBe(40);
  });
});

// ══════════════════════════════════════════════════════════════
// analyzeAgentPair
// ══════════════════════════════════════════════════════════════

describe('analyzeAgentPair', () => {
  // ── 24. Clean pair with no issues ──────────────────────────

  it('returns zero risk score for clean agent pair', () => {
    const chipDetector = new ChipDumpDetector();
    const winDetector = new WinRateAnomalyDetector();

    // Normal play, enough data
    for (let i = 0; i < 20; i++) {
      chipDetector.addRecord(makeRecord({
        handId: `h-${i}`,
        agentId: 'a',
        opponentId: 'b',
        handStrength: 0.7,
        action: 'call',
      }));
    }

    const result = analyzeAgentPair(chipDetector, winDetector, 'a', 'b');
    expect(result.riskScore).toBe(0);
    expect(result.flags).toHaveLength(0);
    expect(result.agentA).toBe('a');
    expect(result.agentB).toBe('b');
    expect(result.handsAnalyzed).toBe(20);
  });

  // ── 25. Chip dump only → riskScore 50 ──────────────────────

  it('returns risk score 50 for chip dump only', () => {
    const chipDetector = new ChipDumpDetector();
    const winDetector = new WinRateAnomalyDetector();

    for (let i = 0; i < 15; i++) {
      chipDetector.addRecord(makeRecord({
        handId: `h-${i}`,
        agentId: 'a',
        opponentId: 'b',
        handStrength: 0.9,
        action: 'fold',
      }));
    }

    const result = analyzeAgentPair(chipDetector, winDetector, 'a', 'b');
    expect(result.riskScore).toBe(50);
    expect(result.flags.some((f) => f.type === 'CHIP_DUMP')).toBe(true);
  });

  // ── 26. Win rate anomaly only → riskScore 30 ──────────────

  it('returns risk score 30 for win rate anomaly only', () => {
    const chipDetector = new ChipDumpDetector();
    const winDetector = new WinRateAnomalyDetector();

    // Agent 'a' wins 100%, 20 normal agents at 25%
    for (let i = 0; i < 40; i++) {
      winDetector.addResult('a', true); // 100%
      winDetector.addResult('b', i < 10); // 25%
      for (let n = 0; n < 18; n++) {
        winDetector.addResult(`n-${n}`, i < 10); // 25%
      }
    }

    const result = analyzeAgentPair(chipDetector, winDetector, 'a', 'b');
    // Agent A flagged for win rate anomaly (30 points)
    expect(result.riskScore).toBe(30);
    expect(result.flags.some((f) => f.type === 'WIN_RATE_ANOMALY')).toBe(true);
  });

  // ── 27. Both flags → riskScore capped at 100 ──────────────

  it('caps risk score at 100 when multiple flags exist', () => {
    const chipDetector = new ChipDumpDetector();
    const winDetector = new WinRateAnomalyDetector();

    // Chip dump flag
    for (let i = 0; i < 15; i++) {
      chipDetector.addRecord(makeRecord({
        handId: `h-${i}`,
        agentId: 'a',
        opponentId: 'b',
        handStrength: 0.9,
        action: 'fold',
      }));
    }

    // Win rate anomaly: agent 'a' at 0%, agent 'b' at 100%, 20 normals at 25%
    for (let i = 0; i < 40; i++) {
      winDetector.addResult('a', false); // 0%
      winDetector.addResult('b', true); // 100%
      for (let n = 0; n < 20; n++) {
        winDetector.addResult(`n-${n}`, i < 10); // 25%
      }
    }

    const result = analyzeAgentPair(chipDetector, winDetector, 'a', 'b');
    // 50 (chip dump) + 30 (agent A anomaly) + 30 (agent B anomaly) = 110 → capped at 100
    expect(result.riskScore).toBeLessThanOrEqual(100);
    expect(result.flags.length).toBeGreaterThanOrEqual(2);
  });

  // ── 28. PairAnalysis structure ─────────────────────────────

  it('returns correct PairAnalysis structure', () => {
    const chipDetector = new ChipDumpDetector();
    const winDetector = new WinRateAnomalyDetector();

    const result = analyzeAgentPair(chipDetector, winDetector, 'x', 'y');
    expect(result).toHaveProperty('agentA', 'x');
    expect(result).toHaveProperty('agentB', 'y');
    expect(result).toHaveProperty('riskScore');
    expect(result).toHaveProperty('flags');
    expect(result).toHaveProperty('handsAnalyzed');
    expect(Array.isArray(result.flags)).toBe(true);
    expect(typeof result.riskScore).toBe('number');
  });
});
