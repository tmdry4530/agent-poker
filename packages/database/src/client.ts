import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

export interface DatabaseConfig {
  connectionString: string;
  maxConnections?: number;
}

export function createDatabase(config: DatabaseConfig) {
  const queryClient = postgres(config.connectionString, {
    max: config.maxConnections ?? 10,
  });

  return drizzle(queryClient, { schema });
}

export type Database = ReturnType<typeof createDatabase>;
