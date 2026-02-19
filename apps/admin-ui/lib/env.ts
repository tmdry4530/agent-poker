export function getEnv() {
  const LOBBY_API_BASE_URL = process.env.LOBBY_API_BASE_URL ?? "http://localhost:8080";
  const ADMIN_API_KEY = process.env.ADMIN_API_KEY ?? "";
  return { LOBBY_API_BASE_URL, ADMIN_API_KEY };
}
