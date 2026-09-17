import { cn } from "cn";
import { tonePing } from "@/components/shared/tone";

interface PingIndicatorProps {
  tone?: "emerald" | "amber";
  size?: "xs" | "sm" | "md";
  title?: string;
  className?: string;
}

const sizeClasses = {
  xs: "h-2 w-2",
  sm: "h-3 w-3",
  md: "h-3.5 w-3.5",
};

export function PingIndicator({
  tone = "emerald",
  size = "sm",
  title,
  className,
}: PingIndicatorProps) {
  return (
    <span
      className={cn("absolute -top-1 -right-1 flex", sizeClasses[size], className)}
      title={title}
    >
      <span
        className={cn(
          "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
          tonePing[tone].soft
        )}
      />
      <span
        className={cn(
          "ring-card relative inline-flex h-full w-full rounded-full shadow-xs ring-2",
          tonePing[tone].solid
        )}
      />
    </span>
  );
}
