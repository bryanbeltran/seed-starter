import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";

const nav = [
  { href: "/natives", label: "Natives" },
  { href: "/coverage", label: "Coverage" },
  { href: "/docs", label: "Docs" },
];

export function AppHeader() {
  return (
    <header className="border-b print:hidden">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-4 py-4">
        <div className="mr-auto">
          <Link href="/" className="text-xl font-bold tracking-tight">
            Seed Starter
          </Link>
          <p className="text-muted-foreground text-sm">
            Frost-aware garden planning
          </p>
        </div>
        <nav className="order-3 flex basis-full items-center gap-3 border-t pt-3 sm:order-2 sm:basis-auto sm:border-t-0 sm:pt-0">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-muted-foreground hover:text-foreground text-sm"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="order-2 flex items-center gap-3">
          <ThemeToggle />
          <a
            href="https://github.com/bryanbeltran/seed-starter"
            className="text-muted-foreground hover:text-foreground text-sm"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
        </div>
      </div>
    </header>
  );
}
