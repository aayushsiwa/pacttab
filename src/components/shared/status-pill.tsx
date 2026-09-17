import type { ReactNode } from "react";
import { cn } from "cn";
import { tonePill, toneDot, type Tone } from "@/components/shared/tone";

interface StatusPillProps {
  children: ReactNode;
  tone?: Tone;
  dot?: boolean;
  size?: "sm" | "lg";
  title?: string;
  className?: string;
}

const sizeClasses = {
  sm: "px-2 py-0.5 text-[10px] font-bold",
  lg: "px-3.5 py-1 text-xs font-semibold",
};

const dotSizeClasses = {
  sm: "h-1.5 w-1.5",
  lg: "h-2 w-2",
};

export function StatusPill({
  children,
  tone = "emerald",
  dot = false,
  size = "sm",
  title,
  className,
}: StatusPillProps) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border shadow-2xs",
        sizeClasses[size],
        tonePill[tone],
        className
      )}
    >
      {dot && (
        <span className={cn("animate-pulse rounded-full", dotSizeClasses[size], toneDot[tone])} />
      )}
      {children}
    </span>
  );
}
