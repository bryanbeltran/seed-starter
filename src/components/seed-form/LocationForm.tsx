"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { isValidZip } from "./formState";

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
  const showZipHint = zip.length > 0 && !isValidZip(zip);

  return (
    <div className="space-y-2">
      <Label htmlFor="zip">ZIP code</Label>
      <Input
        id="zip"
        inputMode="numeric"
        autoComplete="postal-code"
        value={zip}
        onChange={(e) => onZipChange(e.target.value)}
        placeholder="e.g. 55423"
        disabled={loading}
        aria-invalid={!!zipError || showZipHint}
        aria-describedby={zipError ? "zip-error" : undefined}
      />
      {showZipHint && !zipError && (
        <p className="text-sm text-muted-foreground">Enter a 5-digit US ZIP code.</p>
      )}
      {zipError && (
        <p id="zip-error" className="text-sm text-destructive" role="alert">
          {zipError}
        </p>
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
