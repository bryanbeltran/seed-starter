"use client";

import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { ShareLinkButton } from "./ShareLinkButton";
import type { ScheduleResult } from "./types";
import type { CropSelection } from "./formState";

export type SavedPlanSummary = {
  id: string;
  name: string;
  zip: string;
  zone: string;
  crops: string[];
  riskProfile: RiskProfile;
  climateDataVersion?: string | null;
  climateDataStale?: boolean;
  scheduleDiff?: {
    lastFrostChanged: boolean;
    previousLastFrost: string;
    currentLastFrost: string;
    tasksChanged: number;
  } | null;
  schedule: ScheduleResult;
};

type Props = {
  onLoadPlan: (plan: SavedPlanSummary) => void;
  onStatusMessage: (msg: string, variant?: "success" | "error") => void;
  currentZip: string;
  currentCrops: string[];
  currentRisk: RiskProfile;
  saveOpen: boolean;
  onSaveOpenChange: (open: boolean) => void;
};

export function SavedPlansPanel({
  onLoadPlan,
  onStatusMessage,
  currentZip,
  currentCrops,
  currentRisk,
  saveOpen,
  onSaveOpenChange,
}: Props) {
  const [plans, setPlans] = useState<SavedPlanSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [planName, setPlanName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SavedPlanSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/saved-plans");
      const data = await res.json();
      setPlans(data.plans ?? []);
    } catch {
      onStatusMessage("Could not load saved plans.", "error");
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
        onStatusMessage(data.error ?? "Could not save plan.", "error");
        return;
      }
      onSaveOpenChange(false);
      setPlanName("");
      onStatusMessage("Plan saved.", "success");
      await refresh();
    } catch {
      onStatusMessage("Could not save plan.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/saved-plans/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        onStatusMessage("Plan deleted.", "success");
        setDeleteTarget(null);
        await refresh();
      } else {
        onStatusMessage("Could not delete plan.", "error");
      }
    } finally {
      setDeleting(false);
    }
  }

  function shareUrl(planId: string) {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/plans?id=${planId}`;
    }
    return `/plans?id=${planId}`;
  }

  return (
    <aside className="space-y-3 print:hidden" aria-label="Saved plans">
      <h2 className="text-sm font-semibold">Saved plans</h2>

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : plans.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No saved plans yet. Calculate a schedule, then save.
        </p>
      ) : (
        <ul className="space-y-2">
          {plans.map((plan) => (
            <li
              key={plan.id}
              className="hover:bg-accent flex flex-col gap-2 rounded-md border p-2 text-sm"
            >
              <button
                type="button"
                className="min-w-0 text-left"
                onClick={() => {
                  onLoadPlan(plan);
                  if (plan.climateDataStale) {
                    const diff = plan.scheduleDiff;
                    const frostNote =
                      diff?.lastFrostChanged
                        ? ` Last frost moved (${new Date(diff.previousLastFrost).toLocaleDateString()} → ${new Date(diff.currentLastFrost).toLocaleDateString()}).`
                        : "";
                    onStatusMessage(
                      `Loaded "${plan.name}" — climate data updated since save; dates refreshed.${frostNote}`,
                      "success",
                    );
                  }
                }}
              >
                <span className="flex items-center gap-2 font-medium">
                  {plan.name}
                  {plan.climateDataStale && (
                    <Badge variant="outline" className="text-xs font-normal">
                      {plan.scheduleDiff?.lastFrostChanged
                        ? "Frost updated"
                        : "Stale data"}
                    </Badge>
                  )}
                </span>
                <span className="text-muted-foreground block text-xs">
                  {plan.zip} · Zone {plan.zone.toUpperCase()}
                </span>
              </button>
              <div className="flex items-center gap-1">
                <ShareLinkButton url={shareUrl(plan.id)} label="Copy" />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${plan.name}`}
                  onClick={() => setDeleteTarget(plan)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={saveOpen} onOpenChange={onSaveOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save plan</DialogTitle>
            <DialogDescription>
              Store this ZIP, crops, and risk profile for your account.
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

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete plan?</DialogTitle>
            <DialogDescription>
              This removes &ldquo;{deleteTarget?.name}&rdquo; permanently. Share
              links will stop working.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={() => void confirmDelete()}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </aside>
  );
}

export type { CropSelection };
