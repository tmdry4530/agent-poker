import type { AgentStrategy, ChosenAction, VisibleGameState } from './types.js';

/** Always calls or checks. Never folds, never raises. */
export class CallingStation implements AgentStrategy {
  chooseAction(state: VisibleGameState): ChosenAction {
    if (state.legalActions.includes('CHECK')) {
      return { action: 'CHECK' };
    }
    if (state.legalActions.includes('CALL')) {
      return { action: 'CALL' };
    }
    return { action: 'FOLD' };
  }
}

/** Randomly picks among legal actions (uniform). */
export class RandomBot implements AgentStrategy {
  private rng: () => number;

  constructor(seed?: number) {
    if (seed !== undefined) {
      this.rng = mulberry32(seed);
    } else {
      this.rng = Math.random;
    }
  }

  chooseAction(state: VisibleGameState): ChosenAction {
    const actions = state.legalActions.filter((a) => a !== 'FOLD'); // Avoid folding unless it's the only option
    if (actions.length === 0) return { action: 'FOLD' };
    const idx = Math.floor(this.rng() * actions.length);
    return { action: actions[idx]! };
  }
}

/** Aggressive: raises whenever possible, calls otherwise. */
export class AggressiveBot implements AgentStrategy {
  chooseAction(state: VisibleGameState): ChosenAction {
    if (state.legalActions.includes('RAISE')) {
      return { action: 'RAISE' };
    }
    if (state.legalActions.includes('BET')) {
      return { action: 'BET' };
    }
    if (state.legalActions.includes('CALL')) {
      return { action: 'CALL' };
    }
    if (state.legalActions.includes('CHECK')) {
      return { action: 'CHECK' };
    }
    return { action: 'FOLD' };
  }
}

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
