"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const BLIND_PRESETS = {
  micro: { smallBlind: 1, bigBlind: 2, label: "Micro (1/2)" },
  low: { smallBlind: 5, bigBlind: 10, label: "Low (5/10)" },
  mid: { smallBlind: 25, bigBlind: 50, label: "Mid (25/50)" },
  high: { smallBlind: 100, bigBlind: 200, label: "High (100/200)" },
  custom: { smallBlind: 0, bigBlind: 0, label: "Custom" },
} as const;

type BlindPreset = keyof typeof BLIND_PRESETS;

export interface CreateTableConfig {
  variant: string;
  blindPreset: BlindPreset;
  smallBlind: number;
  bigBlind: number;
  maxSeats: number;
  minBuyInBB: number;
  maxBuyInBB: number;
  anteEnabled: boolean;
  anteAmount: number;
}

const DEFAULT_CONFIG: CreateTableConfig = {
  variant: "LIMIT",
  blindPreset: "micro",
  smallBlind: 1,
  bigBlind: 2,
  maxSeats: 2,
  minBuyInBB: 20,
  maxBuyInBB: 100,
  anteEnabled: false,
  anteAmount: 0,
};

interface CreateTableFormProps {
  onSubmit: (config: CreateTableConfig) => Promise<void>;
  submitting?: boolean;
}

export function CreateTableForm({ onSubmit, submitting = false }: CreateTableFormProps) {
  const [config, setConfig] = useState<CreateTableConfig>(DEFAULT_CONFIG);

  function update<K extends keyof CreateTableConfig>(key: K, value: CreateTableConfig[K]) {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

  function handleBlindPreset(preset: BlindPreset) {
    const p = BLIND_PRESETS[preset];
    setConfig((prev) => ({
      ...prev,
      blindPreset: preset,
      ...(preset !== "custom"
        ? { smallBlind: p.smallBlind, bigBlind: p.bigBlind }
        : {}),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSubmit(config);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Table</CardTitle>
        <CardDescription>Configure a new poker table</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Variant */}
          <div className="space-y-2">
            <Label htmlFor="variant">Variant</Label>
            <Select
              id="variant"
              value={config.variant}
              onChange={(e) => update("variant", e.target.value)}
            >
              <option value="LIMIT">Limit Hold&apos;em</option>
              <option value="NL">No-Limit Hold&apos;em</option>
              <option value="PL">Pot-Limit Omaha</option>
            </Select>
          </div>

          {/* Blind level */}
          <div className="space-y-2">
            <Label htmlFor="blind-preset">Blind Level</Label>
            <Select
              id="blind-preset"
              value={config.blindPreset}
              onChange={(e) => handleBlindPreset(e.target.value as BlindPreset)}
            >
              {Object.entries(BLIND_PRESETS).map(([key, p]) => (
                <option key={key} value={key}>
                  {p.label}
                </option>
              ))}
            </Select>
          </div>

          {config.blindPreset === "custom" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sb">Small Blind</Label>
                <Input
                  id="sb"
                  type="number"
                  min={1}
                  value={config.smallBlind}
                  onChange={(e) => update("smallBlind", Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bb">Big Blind</Label>
                <Input
                  id="bb"
                  type="number"
                  min={1}
                  value={config.bigBlind}
                  onChange={(e) => update("bigBlind", Number(e.target.value))}
                />
              </div>
            </div>
          )}

          {/* Max seats */}
          <div className="space-y-2">
            <Label htmlFor="max-seats">Max Seats</Label>
            <Select
              id="max-seats"
              value={String(config.maxSeats)}
              onChange={(e) => update("maxSeats", Number(e.target.value))}
            >
              <option value="2">2 (Heads-Up)</option>
              <option value="4">4 (Short-Handed)</option>
              <option value="6">6 (6-Max)</option>
            </Select>
          </div>

          {/* Buy-in range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="min-buyin">Min Buy-in (BB)</Label>
              <Input
                id="min-buyin"
                type="number"
                min={1}
                value={config.minBuyInBB}
                onChange={(e) => update("minBuyInBB", Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max-buyin">Max Buy-in (BB)</Label>
              <Input
                id="max-buyin"
                type="number"
                min={1}
                value={config.maxBuyInBB}
                onChange={(e) => update("maxBuyInBB", Number(e.target.value))}
              />
            </div>
          </div>

          {/* Ante toggle */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="ante-toggle">Ante</Label>
              <Switch
                id="ante-toggle"
                checked={config.anteEnabled}
                onCheckedChange={(checked) => update("anteEnabled", checked)}
              />
            </div>
            {config.anteEnabled && (
              <div className="space-y-2">
                <Label htmlFor="ante-amount">Ante Amount</Label>
                <Input
                  id="ante-amount"
                  type="number"
                  min={1}
                  value={config.anteAmount}
                  onChange={(e) => update("anteAmount", Number(e.target.value))}
                />
              </div>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Creating..." : "Create Table"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
