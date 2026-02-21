/**
 * AgentAuth — handles login + authenticated HTTP calls to the lobby API.
 * Uses Node 20+ native fetch (no extra packages).
 */

export interface LoginResponse {
  access_token: string;
  agent_id: string;
  role: string;
  expires_in: number;
}

export interface JoinTableResponse {
  seatToken: string;
  seatIndex: number;
  tableId: string;
}

export class AgentAuth {
  private lobbyUrl: string;
  private agentId: string;
  private secret: string;
  private accessToken: string | null = null;

  constructor(lobbyUrl: string, agentId: string, secret: string) {
    this.lobbyUrl = lobbyUrl.replace(/\/$/, ''); // strip trailing slash
    this.agentId = agentId;
    this.secret = secret;
  }

  /**
   * Login to the lobby API and cache the access token.
   * @returns The access token string
   */
  async login(): Promise<string> {
    const res = await fetch(`${this.lobbyUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: this.agentId,
        secret: this.secret,
        client_type: 'agent',
      }),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({ error: 'Login failed' }))) as { error?: string };
      throw new Error(body.error ?? `Login failed: ${res.status}`);
    }

    const data = (await res.json()) as LoginResponse;
    this.accessToken = data.access_token;
    return data.access_token;
  }

  /**
   * Get the cached access token (null if not logged in).
   */
  getToken(): string | null {
    return this.accessToken;
  }

  /**
   * Join a table with authenticated request.
   * On 401, automatically re-login and retry once.
   */
  async joinTable(tableId: string, buyIn: number): Promise<JoinTableResponse> {
    const doJoin = async (token: string): Promise<Response> => {
      return fetch(`${this.lobbyUrl}/api/tables/${tableId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ agentId: this.agentId, buyIn }),
      });
    };

    if (!this.accessToken) {
      await this.login();
    }

    let res = await doJoin(this.accessToken!);

    // 401 → re-login + retry once
    if (res.status === 401) {
      await this.login();
      res = await doJoin(this.accessToken!);
    }

    if (!res.ok) {
      const body = (await res.json().catch(() => ({ error: 'Join failed' }))) as { error?: string };
      throw new Error(body.error ?? `Join table failed: ${res.status}`);
    }

    return (await res.json()) as JoinTableResponse;
  }
}
