import { cn } from "@/lib/utils";

type Props = {
  message: string | null;
  variant?: "success" | "error";
};

export function StatusBanner({ message, variant = "success" }: Props) {
  if (!message) return null;

  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn(
        "rounded-md border px-3 py-2 text-sm",
        variant === "error"
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
      )}
    >
      {message}
    </div>
  );
}
