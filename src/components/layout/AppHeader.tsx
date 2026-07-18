import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";

const nav = [
  { href: "/coverage", label: "Coverage" },
  { href: "/docs", label: "Docs" },
];

export function AppHeader() {
  return (
    <header className="border-b print:hidden">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
        <div>
          <Link href="/" className="text-xl font-bold tracking-tight">
            Seed Starter
          </Link>
          <p className="text-muted-foreground text-sm">
            Frost-aware garden planning
          </p>
        </div>
        <div className="flex items-center gap-3">
          <nav className="hidden items-center gap-3 sm:flex">
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
