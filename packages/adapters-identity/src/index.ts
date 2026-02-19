// adapters-identity: MVP1 API key/token auth

export type {
  IdentityProvider,
  AgentInfo,
  RegistrationResult,
  AuthResult,
} from './types.js';

export { MemoryIdentityProvider } from './memory-identity.js';
export {
  PostgresIdentityProvider,
  createIdentityProvider,
  type PostgresIdentityConfig,
} from './postgres-identity.js';
