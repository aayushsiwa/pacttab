import { cn } from "cn";
import type { ReactNode } from "react";
import { formatMoney } from "@/lib/format";

interface AmountChipProps {
  value: number;
  polarity?: "" | "+" | "-" | "settled";
  size?: "sm" | "md";
  settledIcon?: ReactNode;
  className?: string;
}

export function AmountChip({
  value,
  polarity = "",
  size = "md",
  settledIcon,
  className,
}: AmountChipProps) {
  if (polarity === "settled") {
    return (
      <span
        className={cn(
          "text-muted-foreground bg-muted/60 inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-semibold",
          className
        )}
      >
        {settledIcon}Settled
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-lg border px-2 py-0.5 font-black",
        size === "sm" ? "text-xs" : "text-xs sm:text-sm",
        polarity === "-"
          ? "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
          : "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        className
      )}
    >
      {formatMoney(Math.abs(value), {
        sign: polarity === "-" ? "-" : polarity === "+" ? "+" : undefined,
      })}
    </span>
  );
}
