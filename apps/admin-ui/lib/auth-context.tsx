"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";
import { decodeToken, isTokenExpired } from "./jwt";

const API_BASE =
  (typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_LOBBY_API_URL ?? "http://localhost:8080")
    : "http://localhost:8080"
  ).trim();

const TOKEN_KEY = "agent_poker_token";

interface AuthState {
  token: string | null;
  agentId: string | null;
  role: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (agentId: string, secret: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({
    token: null,
    agentId: null,
    role: null,
    isAuthenticated: false,
    isLoading: true,
  });

  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored && !isTokenExpired(stored)) {
      const payload = decodeToken(stored);
      setState({
        token: stored,
        agentId: (payload?.sub as string) ?? null,
        role: (payload?.role as string) ?? null,
        isAuthenticated: true,
        isLoading: false,
      });
    } else {
      if (stored) localStorage.removeItem(TOKEN_KEY);
      setState((s) => ({ ...s, isLoading: false }));
    }
  }, []);

  const login = useCallback(
    async (agentId: string, secret: string) => {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: agentId, secret, client_type: "human" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Login failed" }));
        throw new Error(err.error ?? "Login failed");
      }
      const data = await res.json();
      localStorage.setItem(TOKEN_KEY, data.access_token);
      const payload = decodeToken(data.access_token);
      setState({
        token: data.access_token,
        agentId: data.agent_id,
        role: data.role,
        isAuthenticated: true,
        isLoading: false,
      });
      router.push("/tables");
    },
    [router],
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setState({
      token: null,
      agentId: null,
      role: null,
      isAuthenticated: false,
      isLoading: false,
    });
    router.push("/login");
  }, [router]);

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
