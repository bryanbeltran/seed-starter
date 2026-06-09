import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

type Props = {
  zip: string;
  loading: boolean;
  onZipChange: (zip: string) => void;
};

export function LocationForm({ zip, loading, onZipChange }: Props) {
  return (
    <div>
      <Label htmlFor="zip">ZIP code</Label>
      <Input
        id="zip"
        inputMode="numeric"
        autoComplete="postal-code"
        value={zip}
        onChange={(e) => onZipChange(e.target.value)}
        placeholder="e.g. 55423"
        className="mt-1"
        disabled={loading}
      />
    </div>
  );
}
