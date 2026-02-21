/**
 * Position & seat rotation utilities for 2-6 player poker.
 *
 * Seat indices are 0-5 and may be non-contiguous (empty seats allowed).
 * All functions are pure — no side effects.
 */

export interface PositionAssignment {
  seatIndex: number;
  position: Position;
}

export type Position = 'BTN' | 'SB' | 'BB' | 'UTG' | 'HJ' | 'CO';

const POSITION_ORDER_BY_COUNT: Record<number, Position[]> = {
  2: ['BTN', 'BB'],           // HU: BTN=SB
  3: ['BTN', 'SB', 'BB'],
  4: ['BTN', 'SB', 'BB', 'UTG'],
  5: ['BTN', 'SB', 'BB', 'UTG', 'CO'],
  6: ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'],
};

/**
 * Assign positional labels starting from the dealer seat, clockwise.
 *
 * @param activeSeatIndices - sorted seat indices of active players (2-6)
 * @param dealerSeatIndex  - which seat holds the dealer button
 * @returns position assignments in clockwise order starting from BTN
 */
export function assignPositions(
  activeSeatIndices: number[],
  dealerSeatIndex: number,
): PositionAssignment[] {
  const n = activeSeatIndices.length;
  if (n < 2 || n > 6) throw new Error(`Need 2-6 players, got ${n}`);

  const positions = POSITION_ORDER_BY_COUNT[n]!;
  const sorted = [...activeSeatIndices].sort((a, b) => a - b);

  // Find dealer's position in the sorted array
  const dealerIdx = sorted.indexOf(dealerSeatIndex);
  if (dealerIdx === -1) throw new Error(`Dealer seat ${dealerSeatIndex} not in active seats`);

  // Rotate so dealer is first
  const rotated: number[] = [];
  for (let i = 0; i < n; i++) {
    rotated.push(sorted[(dealerIdx + i) % n]!);
  }

  return rotated.map((seatIndex, i) => ({
    seatIndex,
    position: positions[i]!,
  }));
}

/**
 * Get the seat index of the first player to act preflop.
 *
 * HU (2 players): BTN (who is also SB) acts first.
 * 3+ players: UTG (seat after BB) acts first.
 */
export function getFirstToActPreflop(
  activeSeatIndices: number[],
  dealerSeatIndex: number,
): number {
  const n = activeSeatIndices.length;
  const sorted = sortedSeatsFrom(activeSeatIndices, dealerSeatIndex);

  if (n === 2) {
    // HU: BTN/SB acts first = dealer
    return sorted[0]!;
  }
  // 3+: UTG = seat after BB (index 3 in rotated order)
  return sorted[3 % n]!;
}

/**
 * Get the seat index of the first player to act postflop.
 * First non-folded, non-allin player clockwise from dealer's left.
 *
 * @param activeSeatIndices - all active seat indices
 * @param dealerSeatIndex   - dealer button seat
 * @param foldedSeats       - set of seats that have folded
 * @param allInSeats        - set of seats that are all-in
 * @returns seat index or -1 if no one can act
 */
export function getFirstToActPostflop(
  activeSeatIndices: number[],
  dealerSeatIndex: number,
  foldedSeats: Set<number>,
  allInSeats: Set<number>,
): number {
  const sorted = sortedSeatsFrom(activeSeatIndices, dealerSeatIndex);
  // Start from seat after dealer (index 1 in rotated order)
  for (let i = 1; i <= sorted.length; i++) {
    const seat = sorted[i % sorted.length]!;
    if (!foldedSeats.has(seat) && !allInSeats.has(seat)) {
      return seat;
    }
  }
  return -1;
}

/**
 * Get the next active (non-folded, non-allin) seat clockwise from currentSeat.
 *
 * @returns seat index or -1 if no next active player
 */
export function getNextActiveSeat(
  activeSeatIndices: number[],
  currentSeatIndex: number,
  foldedSeats: Set<number>,
  allInSeats: Set<number>,
): number {
  const sorted = [...activeSeatIndices].sort((a, b) => a - b);
  const currentPos = sorted.indexOf(currentSeatIndex);
  if (currentPos === -1) return -1;

  const n = sorted.length;
  for (let i = 1; i < n; i++) {
    const seat = sorted[(currentPos + i) % n]!;
    if (!foldedSeats.has(seat) && !allInSeats.has(seat)) {
      return seat;
    }
  }
  return -1;
}

/**
 * Advance dealer button clockwise to the next active seat.
 */
export function advanceDealer(
  activeSeatIndices: number[],
  currentDealerSeatIndex: number,
): number {
  const sorted = [...activeSeatIndices].sort((a, b) => a - b);
  const currentPos = sorted.indexOf(currentDealerSeatIndex);
  if (currentPos === -1) {
    // Dealer left; pick first seat
    return sorted[0]!;
  }
  return sorted[(currentPos + 1) % sorted.length]!;
}

/**
 * Get SB and BB seat indices.
 *
 * HU: BTN=SB, other=BB.
 * 3+: SB=left of BTN, BB=left of SB.
 */
export function getBlindSeats(
  activeSeatIndices: number[],
  dealerSeatIndex: number,
): { sbSeat: number; bbSeat: number } {
  const sorted = sortedSeatsFrom(activeSeatIndices, dealerSeatIndex);
  const n = sorted.length;

  if (n === 2) {
    return { sbSeat: sorted[0]!, bbSeat: sorted[1]! };
  }
  return { sbSeat: sorted[1]!, bbSeat: sorted[2]! };
}

// ── Internal helpers ─────────────────────────────────────────

/** Return seats sorted clockwise starting from dealerSeatIndex. */
function sortedSeatsFrom(activeSeatIndices: number[], dealerSeatIndex: number): number[] {
  const sorted = [...activeSeatIndices].sort((a, b) => a - b);
  const dealerPos = sorted.indexOf(dealerSeatIndex);
  if (dealerPos === -1) throw new Error(`Dealer seat ${dealerSeatIndex} not in active seats`);

  const rotated: number[] = [];
  for (let i = 0; i < sorted.length; i++) {
    rotated.push(sorted[(dealerPos + i) % sorted.length]!);
  }
  return rotated;
}
