"use client";

import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RiskProfile } from "@/planning";
import type { ScheduleResult } from "./types";
import type { CropSelection } from "./formState";

export type SavedPlanSummary = {
  id: string;
  name: string;
  zip: string;
  zone: string;
  crops: string[];
  riskProfile: RiskProfile;
  schedule: ScheduleResult;
};

type Props = {
  onLoadPlan: (plan: SavedPlanSummary) => void;
  onStatusMessage: (msg: string) => void;
  currentZip: string;
  currentCrops: string[];
  currentRisk: RiskProfile;
  hasResults: boolean;
};

export function SavedPlansPanel({
  onLoadPlan,
  onStatusMessage,
  currentZip,
  currentCrops,
  currentRisk,
  hasResults,
}: Props) {
  const [plans, setPlans] = useState<SavedPlanSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveOpen, setSaveOpen] = useState(false);
  const [planName, setPlanName] = useState("");
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/saved-plans");
      const data = await res.json();
      setPlans(data.plans ?? []);
    } catch {
      onStatusMessage("Could not load saved plans.");
    } finally {
      setLoading(false);
    }
  }, [onStatusMessage]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleSave() {
    if (!planName.trim() || currentCrops.length === 0 || !currentZip) return;
    setSaving(true);
    try {
      const res = await fetch("/api/saved-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: planName.trim(),
          zip: currentZip,
          crops: currentCrops,
          riskProfile: currentRisk,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        onStatusMessage(data.error ?? "Could not save plan.");
        return;
      }
      setSaveOpen(false);
      setPlanName("");
      onStatusMessage("Plan saved.");
      await refresh();
    } catch {
      onStatusMessage("Could not save plan.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete plan "${name}"?`)) return;
    const res = await fetch(`/api/saved-plans/${id}`, { method: "DELETE" });
    if (res.ok) {
      onStatusMessage("Plan deleted.");
      await refresh();
    }
  }

  return (
    <aside className="space-y-3 print:hidden" aria-label="Saved plans">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Saved plans</h2>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!hasResults || currentCrops.length === 0}
          onClick={() => setSaveOpen(true)}
        >
          Save plan
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : plans.length === 0 ? (
        <p className="text-muted-foreground text-sm">No saved plans yet.</p>
      ) : (
        <ul className="space-y-2">
          {plans.map((plan) => (
            <li
              key={plan.id}
              className="hover:bg-accent flex items-center justify-between gap-2 rounded-md border p-2 text-sm"
            >
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => onLoadPlan(plan)}
              >
                <span className="font-medium">{plan.name}</span>
                <span className="text-muted-foreground block text-xs">
                  {plan.zip} · Zone {plan.zone.toUpperCase()}
                </span>
              </button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0"
                aria-label={`Delete ${plan.name}`}
                onClick={() => void handleDelete(plan.id, plan.name)}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save plan</DialogTitle>
            <DialogDescription>
              Store this ZIP, crops, and risk profile locally.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="plan-name">Plan name</Label>
            <Input
              id="plan-name"
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
              placeholder="Spring 2026 bed"
            />
          </div>
          <Button
            className="w-full"
            disabled={saving || !planName.trim()}
            onClick={() => void handleSave()}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogContent>
      </Dialog>
    </aside>
  );
}

export type { CropSelection };
