"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  url: string;
  label?: string;
  size?: "sm" | "default";
};

export function ShareLinkButton({ url, label = "Copy link", size = "sm" }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <Button type="button" variant="outline" size={size} onClick={() => void copy()}>
      {copied ? (
        <>
          <Check className="size-4" />
          Copied
        </>
      ) : (
        <>
          <Link2 className="size-4" />
          {label}
        </>
      )}
    </Button>
  );
}
