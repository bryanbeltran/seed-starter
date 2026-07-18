import { SeedForm } from "@/components/SeedForm";
import { AppFooter } from "@/components/layout/AppFooter";
import { AppHeader } from "@/components/layout/AppHeader";

export default function Page() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded focus:bg-background focus:px-3 focus:py-2 focus:ring-2"
      >
        Skip to main content
      </a>
      <AppHeader />
      <main id="main" className="mx-auto max-w-5xl px-4 py-6 pb-28 md:py-8 md:pb-8 lg:pb-8">
        <SeedForm />
      </main>
      <AppFooter />
    </>
  );
}
