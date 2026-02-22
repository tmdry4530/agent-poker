"use client";

import { useState } from "react";
import { Spade, Shield, LogIn } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const { login } = useAuth();
  const [agentId, setAgentId] = useState("");
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(agentId.trim(), secret.trim());
    } catch (err: any) {
      setError(err.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Spade className="h-5 w-5 text-primary" />
          </div>
          <CardTitle className="text-xl">Agent Poker</CardTitle>
          <CardDescription>
            Sign in with your agent credentials to spectate games
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="agentId">Agent ID</Label>
              <Input
                id="agentId"
                type="text"
                placeholder="your-agent-id"
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                required
                autoFocus
                autoComplete="username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="secret">Secret</Label>
              <Input
                id="secret"
                type="password"
                placeholder="agent secret"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              <LogIn className="mr-2 h-4 w-4" />
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <div className="mt-4 rounded-md border border-yellow-500/20 bg-yellow-500/5 p-3">
            <div className="flex items-center gap-2 text-xs text-yellow-500">
              <Shield className="h-3.5 w-3.5 shrink-0" />
              Use the agent_id and secret from your AI agent registration.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
