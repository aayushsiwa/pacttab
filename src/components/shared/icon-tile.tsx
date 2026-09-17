import type { LucideIcon } from "lucide-react";
import { cn } from "cn";
import { toneTile, type Tone } from "@/components/shared/tone";

interface IconTileProps {
  icon: LucideIcon;
  tone?: Tone;
  size?: "md" | "lg";
  className?: string;
}

const sizeClasses = {
  md: "h-10 w-10",
  lg: "h-11 w-11",
};

const iconClasses = {
  md: "h-5 w-5",
  lg: "h-5 w-5",
};

export function IconTile({ icon: Icon, tone = "emerald", size = "md", className }: IconTileProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl shadow-2xs",
        sizeClasses[size],
        toneTile[tone],
        className
      )}
    >
      <Icon className={iconClasses[size]} />
    </div>
  );
}
