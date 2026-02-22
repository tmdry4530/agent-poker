import { eq } from 'drizzle-orm';
import { tables, seats } from './schema.js';
import type { Database } from './client.js';

/**
 * Persist a table record (upsert).
 * Called by lobby-api when creating a table.
 */
export async function persistTable(
  db: Database,
  data: {
    id: string;
    variant: string;
    status?: string;
    maxSeats: number;
    config: Record<string, unknown>;
  },
): Promise<void> {
  await db
    .insert(tables)
    .values({
      id: data.id,
      variant: data.variant,
      status: (data.status ?? 'open') as 'open' | 'running' | 'closed',
      maxSeats: data.maxSeats,
      config: data.config,
    })
    .onConflictDoUpdate({
      target: tables.id,
      set: {
        variant: data.variant,
        status: (data.status ?? 'open') as 'open' | 'running' | 'closed',
        maxSeats: data.maxSeats,
        config: data.config,
      },
    });
}

/**
 * Persist a seat record (upsert on tableId + seatNo).
 * Called by lobby-api when an agent joins a table.
 */
export async function persistSeat(
  db: Database,
  data: {
    tableId: string;
    seatNo: number;
    agentId: string;
    seatToken: string;
    buyInAmount: number;
  },
): Promise<void> {
  await db
    .insert(seats)
    .values({
      tableId: data.tableId,
      seatNo: data.seatNo,
      agentId: data.agentId,
      seatToken: data.seatToken,
      buyInAmount: data.buyInAmount,
      status: 'seated',
    })
    .onConflictDoUpdate({
      target: [seats.tableId, seats.seatNo],
      set: {
        agentId: data.agentId,
        seatToken: data.seatToken,
        buyInAmount: data.buyInAmount,
        status: 'seated' as const,
      },
    });
}

/**
 * Load a table with all its seats from DB.
 * Called by game-server when a table is not found in memory.
 */
export async function loadTableWithSeats(
  db: Database,
  tableId: string,
): Promise<{
  table: {
    id: string;
    variant: string;
    status: string;
    maxSeats: number;
    config: Record<string, unknown> | null;
  };
  seats: Array<{
    seatNo: number;
    agentId: string;
    seatToken: string | null;
    buyInAmount: number;
    status: string;
  }>;
} | null> {
  const tableRows = await db.select().from(tables).where(eq(tables.id, tableId));
  if (tableRows.length === 0) return null;

  const tableRow = tableRows[0]!;
  const seatRows = await db.select().from(seats).where(eq(seats.tableId, tableId));

  return {
    table: {
      id: tableRow.id,
      variant: tableRow.variant,
      status: tableRow.status,
      maxSeats: tableRow.maxSeats,
      config: tableRow.config as Record<string, unknown> | null,
    },
    seats: seatRows.map((s) => ({
      seatNo: s.seatNo,
      agentId: s.agentId,
      seatToken: s.seatToken,
      buyInAmount: s.buyInAmount,
      status: s.status,
    })),
  };
}
