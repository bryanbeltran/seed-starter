import { SeedForm } from "@/components/SeedForm";

export default function Page() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Seed Starter</h1>
        <p className="mt-2 text-muted-foreground">
          Frost-aware indoor sow dates for your ZIP code.
        </p>
      </header>
      <SeedForm />
    </main>
  );
}
