// Memory-based IdentityProvider implementation (MVP1)

import { randomBytes } from 'node:crypto';
import type {
  IdentityProvider,
  AgentInfo,
  RegistrationResult,
  AuthResult,
} from './types.js';

interface StoredAgent {
  agentId: string;
  displayName: string;
  apiKey: string;
  status: 'active' | 'banned';
}

/**
 * In-memory IdentityProvider for MVP1
 * Stores agents in a Map (no persistence)
 */
export class MemoryIdentityProvider implements IdentityProvider {
  private agents = new Map<string, StoredAgent>();
  private apiKeyIndex = new Map<string, string>(); // apiKey -> agentId

  async registerAgent(displayName: string): Promise<RegistrationResult> {
    const agentId = crypto.randomUUID();
    const apiKey = this.generateApiKey();

    const agent: StoredAgent = {
      agentId,
      displayName,
      apiKey,
      status: 'active',
    };

    this.agents.set(agentId, agent);
    this.apiKeyIndex.set(apiKey, agentId);

    return { agentId, apiKey };
  }

  async authenticate(apiKey: string): Promise<AuthResult | null> {
    const agentId = this.apiKeyIndex.get(apiKey);
    if (!agentId) {
      return null;
    }

    const agent = this.agents.get(agentId);
    if (!agent || agent.status === 'banned') {
      return null;
    }

    return {
      agentId: agent.agentId,
      displayName: agent.displayName,
    };
  }

  async getAgent(agentId: string): Promise<AgentInfo | null> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return null;
    }

    return {
      agentId: agent.agentId,
      displayName: agent.displayName,
      status: agent.status,
    };
  }

  /**
   * Generate API key: "ak_" + 32 hex characters
   */
  private generateApiKey(): string {
    const randomHex = randomBytes(16).toString('hex');
    return `ak_${randomHex}`;
  }

  /**
   * Test helper: ban an agent (for testing)
   */
  async banAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.status = 'banned';
    }
  }
}
