"use client";

import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { isValidZip } from "./formState";

export type LocationPreview = {
  zone: string;
  lastFrostP50: string;
  frostSource: string;
  climateConfidence: string | null;
};

type Props = {
  zip: string;
  loading: boolean;
  zipError?: string | null;
  onZipChange: (zip: string) => void;
  onTryExample?: () => void;
};

export function LocationForm({
  zip,
  loading,
  zipError,
  onZipChange,
  onTryExample,
}: Props) {
  const [preview, setPreview] = useState<LocationPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const showZipHint = zip.length > 0 && !isValidZip(zip);

  useEffect(() => {
    if (!isValidZip(zip)) {
      setPreview(null);
      setPreviewError(null);
    }
  }, [zip]);

  async function loadPreview() {
    if (!isValidZip(zip)) return;
    const normalized = zip.replace(/\D/g, "");
    setPreviewError(null);
    try {
      const res = await fetch(`/api/location?zip=${normalized}`);
      const data = await res.json();
      if (!res.ok) {
        setPreview(null);
        setPreviewError(data.error ?? "Could not look up ZIP.");
        return;
      }
      setPreview(data as LocationPreview);
    } catch {
      setPreview(null);
      setPreviewError("Could not look up ZIP.");
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="zip">ZIP code</Label>
      <Input
        id="zip"
        inputMode="numeric"
        autoComplete="postal-code"
        value={zip}
        onChange={(e) => onZipChange(e.target.value)}
        onBlur={() => void loadPreview()}
        placeholder="e.g. 55423"
        disabled={loading}
        aria-invalid={!!zipError || showZipHint}
        aria-describedby={
          zipError ? "zip-error" : preview ? "zip-preview" : undefined
        }
      />
      {showZipHint && !zipError && (
        <p className="text-sm text-muted-foreground">Enter a 5-digit US ZIP code.</p>
      )}
      {zipError && (
        <p id="zip-error" className="text-sm text-destructive" role="alert">
          {zipError}
        </p>
      )}
      {preview && !zipError && (
        <p id="zip-preview" className="text-sm text-muted-foreground">
          Zone {preview.zone.toUpperCase()} · last frost ~{" "}
          {new Date(`${preview.lastFrostP50}T12:00:00`).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
          {preview.climateConfidence && (
            <> · {preview.climateConfidence} confidence</>
          )}
        </p>
      )}
      {previewError && !zipError && (
        <p className="text-sm text-muted-foreground">{previewError}</p>
      )}
      {onTryExample && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onTryExample}
          disabled={loading}
        >
          Try 55423
        </Button>
      )}
    </div>
  );
}
