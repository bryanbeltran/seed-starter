import { Suspense } from "react";
import Link from "next/link";
import { AppFooter } from "@/components/layout/AppFooter";
import { AppHeader } from "@/components/layout/AppHeader";
import { NativesLookup } from "@/components/natives/NativesLookup";

export const metadata = {
  title: "Native plants by ZIP | Seed Starter",
  description:
    "EPA Level III ecoregion natives and frost-aware seed-start dates for US ZIP codes.",
};

export default function NativesPage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-2xl px-4 py-10 pb-24">
        <p className="text-muted-foreground mb-6 text-sm">
          <Link href="/" className="underline">
            ← Vegetable planner
          </Link>
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Native plants</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Enter a ZIP to see plants native to that ecoregion and when to sow or
          start seeds, anchored to frost dates.
        </p>
        <div className="mt-8">
          <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
            <NativesLookup />
          </Suspense>
        </div>
      </main>
      <AppFooter />
    </>
  );
}
