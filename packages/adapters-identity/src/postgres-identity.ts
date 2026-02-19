import { eq } from 'drizzle-orm';
import { randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import type { Database } from '@agent-poker/database';
import { agents, agentApiKeys } from '@agent-poker/database';
import type {
  IdentityProvider,
  AgentInfo,
  RegistrationResult,
  AuthResult,
} from './types.js';

export interface PostgresIdentityConfig {
  db: Database;
  bcryptRounds?: number;
}

/**
 * Postgres-based IdentityProvider for MVP1
 * Stores agents and API keys in database with bcrypt hashing
 */
export class PostgresIdentityProvider implements IdentityProvider {
  private db: Database;
  private bcryptRounds: number;

  constructor(config: PostgresIdentityConfig) {
    this.db = config.db;
    this.bcryptRounds = config.bcryptRounds ?? 10;
  }

  async registerAgent(displayName: string): Promise<RegistrationResult> {
    const agentId = randomUUID();
    const apiKey = this.generateApiKey();
    const keyHash = await bcrypt.hash(apiKey, this.bcryptRounds);

    await this.db.transaction(async (tx) => {
      await tx.insert(agents).values({
        id: agentId,
        displayName,
        createdAt: new Date(),
        status: 'active',
      });

      await tx.insert(agentApiKeys).values({
        id: randomUUID(),
        agentId,
        keyHash,
        createdAt: new Date(),
      });
    });

    return { agentId, apiKey };
  }

  async authenticate(apiKey: string): Promise<AuthResult | null> {
    const allKeys = await this.db
      .select({
        id: agentApiKeys.id,
        agentId: agentApiKeys.agentId,
        keyHash: agentApiKeys.keyHash,
        displayName: agents.displayName,
        status: agents.status,
      })
      .from(agentApiKeys)
      .innerJoin(agents, eq(agentApiKeys.agentId, agents.id));

    for (const row of allKeys) {
      const isValid = await bcrypt.compare(apiKey, row.keyHash);
      if (isValid) {
        if (row.status === 'banned') {
          return null;
        }
        return {
          agentId: row.agentId,
          displayName: row.displayName,
        };
      }
    }

    return null;
  }

  async getAgent(agentId: string): Promise<AgentInfo | null> {
    const results = await this.db
      .select()
      .from(agents)
      .where(eq(agents.id, agentId))
      .limit(1);

    if (results.length === 0) {
      return null;
    }

    const agent = results[0]!;
    return {
      agentId: agent.id,
      displayName: agent.displayName,
      status: agent.status,
    };
  }

  private generateApiKey(): string {
    const randomHex = randomBytes(16).toString('hex');
    return `ak_${randomHex}`;
  }
}

export function createIdentityProvider(config: PostgresIdentityConfig): IdentityProvider {
  return new PostgresIdentityProvider(config);
}
