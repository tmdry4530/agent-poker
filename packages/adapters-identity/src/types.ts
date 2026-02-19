// adapters-identity types (port)

export interface AgentInfo {
  agentId: string;
  displayName: string;
  status: 'active' | 'banned';
}

export interface RegistrationResult {
  agentId: string;
  apiKey: string;
}

export interface AuthResult {
  agentId: string;
  displayName: string;
}

/**
 * IdentityProvider interface (port)
 * MVP1: API key/token authentication for agents
 */
export interface IdentityProvider {
  /**
   * Register a new agent
   * @param displayName - Agent display name
   * @returns Agent ID and API key
   */
  registerAgent(displayName: string): Promise<RegistrationResult>;

  /**
   * Authenticate an agent using API key
   * @param apiKey - API key to validate
   * @returns Agent info if valid, null otherwise
   */
  authenticate(apiKey: string): Promise<AuthResult | null>;

  /**
   * Get agent information by ID
   * @param agentId - Agent ID
   * @returns Agent info if exists, null otherwise
   */
  getAgent(agentId: string): Promise<AgentInfo | null>;
}
